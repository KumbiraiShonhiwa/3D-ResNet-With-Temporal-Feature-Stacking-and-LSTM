"""Metrics, plots and prediction dumps.

Every metric here passes ``zero_division=0`` and takes an explicit ``labels``
list. The original notebook did neither, so it emitted a wall of
UndefinedMetricWarning and silently reported 0.00 for classes that simply had no
test samples -- Video_13 contains no Pedestrian and no Cyclist at all.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import (ConfusionMatrixDisplay, accuracy_score,
                             average_precision_score, classification_report,
                             confusion_matrix, f1_score)

from src.config import CLASS_NAMES, FIGURES_DIR, NUM_CLASSES


@torch.no_grad()
def predict(model, loader, device) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return ``(probabilities, predictions, labels)`` for a whole loader."""
    model.eval()
    probs, labels = [], []
    for batch in loader:
        logits = model(batch["clip"].to(device, non_blocking=True),
                       batch["geometry"].to(device, non_blocking=True),
                       batch["mask"].to(device, non_blocking=True))
        probs.append(torch.softmax(logits.float(), dim=1).cpu().numpy())
        labels.append(batch["label"].numpy())

    probs = np.concatenate(probs) if probs else np.zeros((0, NUM_CLASSES))
    labels = np.concatenate(labels) if labels else np.zeros(0, dtype=int)
    return probs, probs.argmax(axis=1), labels


def per_class_average_precision(probs: np.ndarray, labels: np.ndarray) -> dict:
    """AP per class, ``None`` where the split contains no positive example.

    Reporting 0.0 for an absent class -- as the original code did -- drags the
    mean down and reads as a model failure rather than a missing test sample.
    """
    out = {}
    for idx, name in enumerate(CLASS_NAMES):
        positives = (labels == idx)
        out[name] = (float(average_precision_score(positives.astype(int), probs[:, idx]))
                     if positives.any() else None)
    return out


def summarise(probs: np.ndarray, preds: np.ndarray, labels: np.ndarray) -> dict:
    """Headline metrics for one evaluation split."""
    present = sorted(set(labels.tolist()))
    ap = per_class_average_precision(probs, labels)
    measured_ap = [v for v in ap.values() if v is not None]

    counts = np.bincount(labels, minlength=NUM_CLASSES)
    weighted_map = (float(sum(ap[CLASS_NAMES[c]] * counts[c] for c in present
                              if ap[CLASS_NAMES[c]] is not None) / counts.sum())
                    if counts.sum() else 0.0)

    return {
        "n": int(len(labels)),
        "accuracy": float(accuracy_score(labels, preds)) if len(labels) else 0.0,
        # Macro-F1 over classes actually present; averaging in absent classes as
        # zero would misreport a data gap as a model failure.
        "macro_f1": float(f1_score(labels, preds, labels=present, average="macro",
                                   zero_division=0)) if len(labels) else 0.0,
        "weighted_f1": float(f1_score(labels, preds, average="weighted",
                                      zero_division=0)) if len(labels) else 0.0,
        "classes_present": [CLASS_NAMES[c] for c in present],
        "average_precision": ap,
        "macro_map": float(np.mean(measured_ap)) if measured_ap else 0.0,
        "weighted_map": weighted_map,
    }


def text_report(preds: np.ndarray, labels: np.ndarray) -> str:
    return classification_report(labels, preds, labels=list(range(NUM_CLASSES)),
                                 target_names=CLASS_NAMES, zero_division=0)


def plot_confusion_matrix(preds, labels, title: str, filename: str,
                          normalize: bool = False) -> Path:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    cm = confusion_matrix(labels, preds, labels=list(range(NUM_CLASSES)))
    if normalize:
        with np.errstate(invalid="ignore", divide="ignore"):
            cm = np.nan_to_num(cm / cm.sum(axis=1, keepdims=True))

    fig, ax = plt.subplots(figsize=(7, 6))
    ConfusionMatrixDisplay(cm, display_labels=CLASS_NAMES).plot(
        ax=ax, cmap="Blues", colorbar=False,
        values_format=".2f" if normalize else "d")
    ax.set_title(title)
    plt.setp(ax.get_xticklabels(), rotation=30, ha="right")
    plt.tight_layout()

    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    path = FIGURES_DIR / filename
    fig.savefig(path, dpi=150)
    plt.close(fig)
    return path


def plot_learning_curves(history: dict, title: str, filename: str) -> Path:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, axes = plt.subplots(1, 2, figsize=(13, 4.5))
    epochs = range(1, len(history["train_loss"]) + 1)

    axes[0].plot(epochs, history["train_loss"], label="Train", color="#2196F3")
    axes[0].plot(epochs, history["val_loss"], label="Validation", color="#FF5722", ls="--")
    axes[0].set_title("Loss")
    axes[0].set_xlabel("Epoch")
    axes[0].set_ylabel("Cross-entropy")

    axes[1].plot(epochs, [a * 100 for a in history["train_acc"]],
                 label="Train", color="#2196F3")
    axes[1].plot(epochs, [a * 100 for a in history["val_acc"]],
                 label="Validation", color="#FF5722", ls="--")
    axes[1].set_title("Accuracy")
    axes[1].set_xlabel("Epoch")
    axes[1].set_ylabel("Accuracy (%)")

    for ax in axes:
        ax.legend()
        ax.grid(alpha=0.3)

    fig.suptitle(title)
    plt.tight_layout()

    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    path = FIGURES_DIR / filename
    fig.savefig(path, dpi=150)
    plt.close(fig)
    return path


def plot_ablation(results: dict, filename: str = "ablation_macro_f1.png") -> Path:
    """Horizontal bar chart of macro-F1 (mean +/- std) per head variant."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    names = list(results)
    means = [results[n]["macro_f1_mean"] for n in names]
    stds = [results[n]["macro_f1_std"] for n in names]
    order = np.argsort(means)

    fig, ax = plt.subplots(figsize=(9, 4.5))
    ax.barh([names[i].replace("_", " ") for i in order], [means[i] for i in order],
            xerr=[stds[i] for i in order], color="#4CAF50", alpha=0.85,
            error_kw={"ecolor": "#37474F", "capsize": 4})
    ax.set_xlabel("Macro F1 (leave-one-video-out mean, error bars = 1 std)")
    ax.set_title("Temporal head ablation")
    ax.grid(axis="x", alpha=0.3)
    plt.tight_layout()

    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    path = FIGURES_DIR / filename
    fig.savefig(path, dpi=150)
    plt.close(fig)
    return path
