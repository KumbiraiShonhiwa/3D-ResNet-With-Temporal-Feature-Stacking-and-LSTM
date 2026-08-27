"""MNIST CNN study: three architectures of increasing depth and regularisation.

Extracted from MNIST_Model.ipynb so the experiment can be run headlessly and
reproduced. Fixes carried over from the notebook version:

* ``evaluate`` took one argument but was called with two, so two of the three
  models raised TypeError before producing any result.
* ``ShallowCNN = ShallowCNN()`` rebound the class name to an instance, so the
  cell could not be run twice.
* The official 10,000-image test set was loaded and then never used; "test"
  metrics were computed on a slice of the training data. Both are now reported.
* The validation accuracy curve had no label and no distinct line style, so the
  legend showed only "Train" and the two curves were indistinguishable.
"""
from __future__ import annotations

import copy
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch.utils.data import DataLoader, random_split
from torchvision import transforms
from torchvision.datasets import MNIST

from src.config import DATA_DIR, FIGURES_DIR, SEED
from src.utils import get_device, get_logger, set_seed

LOG = get_logger("mnist")

MAX_EPOCHS = 25
EARLY_STOPPING_PATIENCE = 7
BATCH_SIZE = 128


class ShallowCNN(nn.Module):
    """One conv block, no normalisation or dropout -- the lower bound."""

    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 32, 3, padding=1)
        self.pool = nn.MaxPool2d(2, 2)
        self.fc1 = nn.Linear(32 * 14 * 14, 128)
        self.fc2 = nn.Linear(128, 10)

    def forward(self, x):
        x = self.pool(F.relu(self.conv1(x)))
        x = x.flatten(1)
        x = F.relu(self.fc1(x))
        return self.fc2(x)


class DualBlockCNN(nn.Module):
    """Two conv blocks with batch normalisation."""

    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 32, 3, padding=1)
        self.bn1 = nn.BatchNorm2d(32)
        self.conv2 = nn.Conv2d(32, 64, 3, padding=1)
        self.bn2 = nn.BatchNorm2d(64)
        self.pool = nn.MaxPool2d(2, 2)
        self.fc1 = nn.Linear(64 * 7 * 7, 256)
        self.bn3 = nn.BatchNorm1d(256)
        self.fc2 = nn.Linear(256, 10)

    def forward(self, x):
        x = self.pool(F.relu(self.bn1(self.conv1(x))))
        x = self.pool(F.relu(self.bn2(self.conv2(x))))
        x = x.flatten(1)
        x = F.relu(self.bn3(self.fc1(x)))
        return self.fc2(x)


class DeepRegularisedCNN(nn.Module):
    """Three conv stages, batch normalisation and dropout."""

    def __init__(self, dropout: float = 0.4):
        super().__init__()
        self.conv1a = nn.Conv2d(1, 32, 3, padding=1)
        self.bn1a = nn.BatchNorm2d(32)
        self.conv1b = nn.Conv2d(32, 32, 3, padding=1)
        self.bn1b = nn.BatchNorm2d(32)
        self.conv2a = nn.Conv2d(32, 64, 3, padding=1)
        self.bn2a = nn.BatchNorm2d(64)
        self.conv2b = nn.Conv2d(64, 64, 3, padding=1)
        self.bn2b = nn.BatchNorm2d(64)
        self.conv3 = nn.Conv2d(64, 128, 3, padding=1)
        self.bn3 = nn.BatchNorm2d(128)
        self.pool = nn.MaxPool2d(2, 2)
        self.dropout = nn.Dropout(dropout)
        self.fc1 = nn.Linear(128 * 3 * 3, 256)
        self.bn4 = nn.BatchNorm1d(256)
        self.fc2 = nn.Linear(256, 10)

    def forward(self, x):
        x = F.relu(self.bn1a(self.conv1a(x)))
        x = self.pool(F.relu(self.bn1b(self.conv1b(x))))
        x = F.relu(self.bn2a(self.conv2a(x)))
        x = self.pool(F.relu(self.bn2b(self.conv2b(x))))
        x = self.pool(F.relu(self.bn3(self.conv3(x))))
        x = self.dropout(x.flatten(1))
        x = F.relu(self.bn4(self.fc1(x)))
        return self.fc2(self.dropout(x))


MODELS = {
    "ShallowCNN": ShallowCNN,
    "DualBlockCNN": DualBlockCNN,
    "DeepRegularisedCNN": DeepRegularisedCNN,
}


def build_loaders(batch_size: int = BATCH_SIZE):
    """Split 60k train into 42k/9k/9k and keep the official 10k test set.

    ``num_workers`` is 0 deliberately: worker processes are unreliable inside
    Jupyter on Windows.
    """
    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.1307,), (0.3081,)),
    ])
    root = DATA_DIR / "mnist"
    train_full = MNIST(root=str(root), train=True, download=True, transform=transform)
    official_test = MNIST(root=str(root), train=False, download=True, transform=transform)

    generator = torch.Generator().manual_seed(SEED)
    train_data, holdout = random_split(train_full, [42000, 18000], generator=generator)
    val_data, inner_test = random_split(holdout, [9000, 9000], generator=generator)

    loaders = {
        "train": DataLoader(train_data, batch_size=batch_size, shuffle=True, num_workers=0),
        "val": DataLoader(val_data, batch_size=batch_size, shuffle=False, num_workers=0),
        "inner_test": DataLoader(inner_test, batch_size=batch_size, shuffle=False, num_workers=0),
        "official_test": DataLoader(official_test, batch_size=batch_size, shuffle=False, num_workers=0),
    }
    return loaders, train_full


def _run_epoch(model, loader, criterion, device, optimiser=None):
    training = optimiser is not None
    model.train(training)
    total_loss, correct, seen = 0.0, 0, 0
    with torch.set_grad_enabled(training):
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            loss = criterion(outputs, labels)
            if training:
                optimiser.zero_grad(set_to_none=True)
                loss.backward()
                optimiser.step()
            total_loss += loss.item() * labels.size(0)
            correct += (outputs.argmax(1) == labels).sum().item()
            seen += labels.size(0)
    return total_loss / seen, correct / seen


def train_model(model, name, loaders, device, max_epochs: int = MAX_EPOCHS):
    model = model.to(device)
    criterion = nn.CrossEntropyLoss()
    optimiser = optim.Adam(model.parameters(), lr=1e-3)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimiser, mode="min",
                                                     factor=0.5, patience=3)

    history = {"train_loss": [], "val_loss": [], "train_acc": [], "val_acc": []}
    best_loss, best_state, stalled = float("inf"), None, 0

    for epoch in range(max_epochs):
        tr_loss, tr_acc = _run_epoch(model, loaders["train"], criterion, device, optimiser)
        va_loss, va_acc = _run_epoch(model, loaders["val"], criterion, device)
        scheduler.step(va_loss)

        history["train_loss"].append(tr_loss)
        history["val_loss"].append(va_loss)
        history["train_acc"].append(tr_acc)
        history["val_acc"].append(va_acc)

        if va_loss < best_loss:
            best_loss, stalled = va_loss, 0
            best_state = copy.deepcopy(model.state_dict())
        else:
            stalled += 1

        if epoch == 0 or (epoch + 1) % 5 == 0:
            LOG.info("[%s] epoch %2d/%d  train %.4f/%.4f  val %.4f/%.4f",
                     name, epoch + 1, max_epochs, tr_loss, tr_acc, va_loss, va_acc)

        if stalled >= EARLY_STOPPING_PATIENCE:
            LOG.info("[%s] early stopping at epoch %d", name, epoch + 1)
            break

    if best_state is not None:
        model.load_state_dict(best_state)
    LOG.info("[%s] done. best val loss %.4f", name, best_loss)
    return model, history


@torch.no_grad()
def evaluate(model, loader, device):
    """Return ``(accuracy, predictions, labels)``.

    One argument for the loader -- the notebook's version hardcoded a global
    loader yet was called with one, which is what raised TypeError.
    """
    model.eval()
    preds, targets = [], []
    for images, labels in loader:
        outputs = model(images.to(device))
        preds.append(outputs.argmax(1).cpu().numpy())
        targets.append(labels.numpy())
    preds = np.concatenate(preds)
    targets = np.concatenate(targets)
    return float((preds == targets).mean()), preds, targets


def count_params(model) -> int:
    return sum(p.numel() for p in model.parameters())


def plot_samples(train_full, filename: str = "mnist_samples.png") -> Path:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    per_digit = {i: [] for i in range(10)}
    for image, label in train_full:
        if len(per_digit[label]) < 2:
            per_digit[label].append(image)
        if all(len(v) == 2 for v in per_digit.values()):
            break

    fig, axes = plt.subplots(2, 10, figsize=(15, 3.5))
    fig.suptitle("MNIST sample images")
    for col in range(10):
        for row in range(2):
            axes[row, col].imshow(per_digit[col][row].squeeze(), cmap="gray")
            axes[row, col].axis("off")
            if row == 0:
                axes[row, col].set_title(f"Digit {col}")
    plt.tight_layout()

    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    path = FIGURES_DIR / filename
    fig.savefig(path, dpi=150)
    plt.close(fig)
    return path


def plot_learning_curves(histories: dict, filename: str = "learning_curves.png") -> Path:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    colours = {"ShallowCNN": "#2196F3", "DualBlockCNN": "#4CAF50",
               "DeepRegularisedCNN": "#FF5722"}
    fig, axes = plt.subplots(2, len(histories), figsize=(16, 8))
    fig.suptitle("Learning curves")

    for col, (name, history) in enumerate(histories.items()):
        colour = colours.get(name, "#607D8B")
        epochs = range(1, len(history["train_loss"]) + 1)

        axes[0, col].plot(epochs, history["train_loss"], color=colour, label="Train")
        axes[0, col].plot(epochs, history["val_loss"], color=colour, ls="--",
                          label="Validation")
        axes[0, col].set_title(f"{name}\nLoss")
        axes[0, col].set_ylabel("Cross-entropy loss")

        axes[1, col].plot(epochs, [a * 100 for a in history["train_acc"]],
                          color=colour, label="Train")
        # The notebook omitted both label and linestyle here, so the legend
        # showed only "Train" and the curves overlapped indistinguishably.
        axes[1, col].plot(epochs, [a * 100 for a in history["val_acc"]],
                          color=colour, ls="--", label="Validation")
        axes[1, col].set_title(f"{name}\nAccuracy")
        axes[1, col].set_ylabel("Accuracy (%)")

        for row in (0, 1):
            axes[row, col].set_xlabel("Epoch")
            axes[row, col].legend()
            axes[row, col].grid(alpha=0.3)

    plt.tight_layout()
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    path = FIGURES_DIR / filename
    fig.savefig(path, dpi=150)
    plt.close(fig)
    return path


def plot_confusion_matrices(results: dict, filename: str = "confusion_matrices.png") -> Path:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from sklearn.metrics import ConfusionMatrixDisplay, confusion_matrix

    fig, axes = plt.subplots(1, len(results), figsize=(18, 6))
    fig.suptitle("Confusion matrices on the official MNIST test set")
    for ax, (name, payload) in zip(np.atleast_1d(axes), results.items()):
        cm = confusion_matrix(payload["labels"], payload["preds"])
        ConfusionMatrixDisplay(cm, display_labels=list(range(10))).plot(
            ax=ax, colorbar=False, cmap="Blues")
        ax.set_title(name)
    plt.tight_layout()

    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    path = FIGURES_DIR / filename
    fig.savefig(path, dpi=150)
    plt.close(fig)
    return path


def main():
    from sklearn.metrics import classification_report

    from src.config import RUNS_DIR
    from src.utils import save_json

    set_seed(SEED)
    device = get_device()
    LOG.info("device=%s", device)

    loaders, train_full = build_loaders()
    plot_samples(train_full)

    histories, results, summary = {}, {}, []
    for name, factory in MODELS.items():
        set_seed(SEED)
        model, history = train_model(factory(), name, loaders, device)
        histories[name] = history

        inner_acc, _, _ = evaluate(model, loaders["inner_test"], device)
        official_acc, preds, labels = evaluate(model, loaders["official_test"], device)
        results[name] = {"preds": preds, "labels": labels}

        LOG.info("[%s] held-out split %.4f | official test %.4f", name, inner_acc, official_acc)
        print(f"\n{name} — classification report (official test set)")
        print(classification_report(labels, preds, digits=4))

        summary.append({
            "model": name,
            "params": count_params(model),
            "best_val_acc": max(history["val_acc"]),
            "inner_test_acc": inner_acc,
            "official_test_acc": official_acc,
            "epochs": len(history["train_loss"]),
        })

    plot_learning_curves(histories)
    plot_confusion_matrices(results)

    print("\nSummary")
    print(f"{'Model':<22}{'Params':>10}{'Val acc':>10}{'Held-out':>10}{'Official':>10}{'Epochs':>8}")
    for row in summary:
        print(f"{row['model']:<22}{row['params']:>10,}{row['best_val_acc']*100:>9.2f}%"
              f"{row['inner_test_acc']*100:>9.2f}%{row['official_test_acc']*100:>9.2f}%"
              f"{row['epochs']:>8}")

    save_json({"summary": summary, "histories": histories}, RUNS_DIR / "mnist.json")


if __name__ == "__main__":
    main()
