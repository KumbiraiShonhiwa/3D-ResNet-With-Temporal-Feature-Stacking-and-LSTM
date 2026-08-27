"""Training: staged end-to-end fine-tuning plus the fast frozen-backbone path
used for cross-validation and the head ablation.

Two training paths share one model definition:

* **Frozen-backbone path.** The r3d_18 features are precomputed once per
  tracklet window, after which a head trains in seconds. This is what makes a
  9-fold leave-one-video-out sweep across 5 head variants affordable.
* **End-to-end path.** The full model trains with augmentation and staged
  unfreezing of the backbone. Expensive, so it is reserved for the final model.

Leave-one-video-out is the headline protocol because a single video-level test
split cannot support per-class metrics here: Video_13 contains no Pedestrian and
no Cyclist tracklets at all.
"""
from __future__ import annotations

import argparse
import copy
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset

from src.config import (BATCH_SIZE, CANONICAL_SPLIT, CLASS_NAMES, DATA_DIR,
                        EARLY_STOPPING_PATIENCE, MAX_EPOCHS, NUM_CLASSES,
                        NUM_WORKERS, RUNS_DIR, SEED, STAGE_LEARNING_RATES,
                        TARGET_FRAMES, VIDEO_NAMES)
from src.dataset import (IMAGENET_MEAN, IMAGENET_STD, CachedTracklet,
                         TrackletDataset, compute_geometry_stats, index_cache)
from src.evaluate import predict, summarise
from src.lstm_head import HEAD_VARIANTS, build_head
from src.model_3dresnet import R3DBackbone, TrackletClassifier
from src.utils import get_device, get_logger, save_json, set_seed

LOG = get_logger()
EMBED_CACHE_DIR = DATA_DIR / "embed_cache"
WINDOWS_PER_TRACKLET = 4


# --------------------------------------------------------------------------
# Class weighting
# --------------------------------------------------------------------------
def class_weights(labels: np.ndarray, device) -> torch.Tensor:
    """Inverse-frequency weights over the classes present in this split.

    Without weighting, a model that always predicts Car scores 80% accuracy on
    this dataset, which is exactly the degenerate solution the original run
    drifted towards (recall 1.00 on Car, 0.00 on everything rare).
    """
    counts = np.bincount(labels, minlength=NUM_CLASSES).astype(np.float64)
    weights = np.zeros(NUM_CLASSES, dtype=np.float32)
    present = counts > 0
    weights[present] = counts.sum() / (present.sum() * counts[present])
    return torch.tensor(weights, device=device)


# --------------------------------------------------------------------------
# Frozen-backbone embedding cache
# --------------------------------------------------------------------------
class EmbeddingDataset(Dataset):
    """Serves precomputed r3d_18 features; one sample per tracklet.

    During training a random cached window is drawn (temporal augmentation
    survives precomputation this way); evaluation always uses window 0.
    """

    def __init__(self, records, train: bool = False, geometry_stats=None):
        self.records = records
        self.train = train
        self.geometry_stats = geometry_stats

    def __len__(self):
        return len(self.records)

    def __getitem__(self, idx):
        record = self.records[idx]
        with np.load(record["path"]) as data:
            features = data["features"]      # (K, 512, T)
            geometry = data["geometry"]      # (K, T, 17)
            mask = data["mask"]              # (K, T)

        k = int(np.random.randint(len(features))) if self.train else 0
        geom = geometry[k].astype(np.float32).copy()
        if self.geometry_stats is not None:
            mean, std = self.geometry_stats
            geom = (geom - mean) / std
        geom[~mask[k]] = 0.0

        return {
            "features": torch.from_numpy(features[k].astype(np.float32)),
            "geometry": torch.from_numpy(geom),
            "mask": torch.from_numpy(mask[k]),
            "label": torch.tensor(record["label"], dtype=torch.long),
        }


@torch.no_grad()
def precompute_embeddings(entries, device, overwrite: bool = False) -> list[dict]:
    """Run the frozen backbone once per tracklet window and cache the result."""
    backbone = R3DBackbone(pretrained=True).to(device).eval()
    records = []

    for entry in entries:
        out_path = EMBED_CACHE_DIR / entry.video / entry.path.name
        out_path.parent.mkdir(parents=True, exist_ok=True)

        if out_path.exists() and not overwrite:
            records.append({"path": out_path, "label": entry.label, "video": entry.video})
            continue

        # Deterministic evenly-spaced windows; window 0 is the canonical one.
        starts = [0]
        if entry.length > TARGET_FRAMES:
            span = entry.length - TARGET_FRAMES
            starts = sorted({int(round(s)) for s in
                             np.linspace(0, span, WINDOWS_PER_TRACKLET)})

        with np.load(entry.path, allow_pickle=True) as data:
            crops, valid, geometry = data["crops"], data["valid"], data["geometry"]

        clips, geoms, masks = [], [], []
        for start in starts:
            if entry.length >= TARGET_FRAMES:
                idx = np.arange(start, start + TARGET_FRAMES)
                m = np.ones(TARGET_FRAMES, dtype=bool)
            else:
                idx = np.concatenate([np.arange(entry.length),
                                      np.full(TARGET_FRAMES - entry.length, entry.length - 1)])
                m = np.zeros(TARGET_FRAMES, dtype=bool)
                m[:entry.length] = True
            m = m & valid[idx]

            clip = crops[idx].astype(np.float32) / 255.0
            clip = (clip - IMAGENET_MEAN) / IMAGENET_STD
            clip[~m] = 0.0
            clips.append(np.ascontiguousarray(clip.transpose(3, 0, 1, 2)))
            geoms.append(geometry[idx].astype(np.float32))
            masks.append(m)

        batch = torch.from_numpy(np.stack(clips)).to(device)
        features = backbone(batch, out_frames=TARGET_FRAMES).cpu().numpy()

        np.savez_compressed(out_path, features=features.astype(np.float32),
                            geometry=np.stack(geoms), mask=np.stack(masks),
                            label=entry.label)
        records.append({"path": out_path, "label": entry.label, "video": entry.video})

    del backbone
    torch.cuda.empty_cache()
    return records


class EmbeddedClassifier(nn.Module):
    """Head-only model consuming precomputed backbone features."""

    def __init__(self, head: str, visual_dim: int = 128, geometry_dim: int = 64):
        super().__init__()
        from src.config import NUM_GEOMETRY_FEATURES
        self.visual_proj = nn.Sequential(
            nn.Conv1d(R3DBackbone.OUT_CHANNELS, visual_dim, 1),
            nn.BatchNorm1d(visual_dim),
            nn.ReLU(inplace=True),
        )
        self.geometry_encoder = nn.Sequential(
            nn.Conv1d(NUM_GEOMETRY_FEATURES, geometry_dim, 3, padding=1),
            nn.BatchNorm1d(geometry_dim),
            nn.ReLU(inplace=True),
        )
        self.head = build_head(head, visual_dim + geometry_dim)

    def forward(self, features, geometry, mask):
        fused = torch.cat([self.visual_proj(features),
                           self.geometry_encoder(geometry.transpose(1, 2))], dim=1)
        fused = fused * mask.unsqueeze(1).to(fused.dtype)
        return self.head(fused, mask)


@torch.no_grad()
def predict_embedded(model, loader, device):
    model.eval()
    probs, labels = [], []
    for batch in loader:
        logits = model(batch["features"].to(device), batch["geometry"].to(device),
                       batch["mask"].to(device))
        probs.append(torch.softmax(logits.float(), dim=1).cpu().numpy())
        labels.append(batch["label"].numpy())
    probs = np.concatenate(probs)
    return probs, probs.argmax(axis=1), np.concatenate(labels)


def train_embedded_head(head_name, train_records, test_records, device,
                        epochs: int = 40, lr: float = 1e-3, batch_size: int = 16):
    """Train one head on cached features; return metrics on the held-out video."""
    train_labels = np.array([r["label"] for r in train_records])

    stats_entries = [CachedTracklet(path=r["path"], label=r["label"], video=r["video"],
                                    length=0, n_valid=1) for r in train_records]
    geometry_stats = _embedding_geometry_stats(stats_entries)

    train_ds = EmbeddingDataset(train_records, train=True, geometry_stats=geometry_stats)
    test_ds = EmbeddingDataset(test_records, train=False, geometry_stats=geometry_stats)
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, drop_last=False)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False)

    model = EmbeddedClassifier(head_name).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights(train_labels, device))
    optimiser = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimiser, T_max=epochs)

    for _ in range(epochs):
        model.train()
        for batch in train_loader:
            optimiser.zero_grad(set_to_none=True)
            logits = model(batch["features"].to(device), batch["geometry"].to(device),
                           batch["mask"].to(device))
            loss = criterion(logits, batch["label"].to(device))
            loss.backward()
            optimiser.step()
        scheduler.step()

    probs, preds, labels = predict_embedded(model, test_loader, device)
    return summarise(probs, preds, labels), probs, preds, labels


def _embedding_geometry_stats(entries):
    chunks = []
    for entry in entries:
        with np.load(entry.path) as data:
            geom, mask = data["geometry"][0], data["mask"][0]
        if mask.any():
            chunks.append(geom[mask])
    stacked = np.concatenate(chunks, axis=0)
    mean = stacked.mean(axis=0).astype(np.float32)
    std = stacked.std(axis=0).astype(np.float32)
    std[std < 1e-6] = 1.0
    return mean, std


def leave_one_video_out(records, head_name, device, epochs: int = 40):
    """9-fold CV, one video held out per fold. Returns per-fold metrics + pooled."""
    fold_metrics, all_preds, all_labels, all_probs = [], [], [], []

    for video in VIDEO_NAMES:
        test_records = [r for r in records if r["video"] == video]
        train_records = [r for r in records if r["video"] != video]
        if not test_records:
            continue

        set_seed(SEED)
        metrics, probs, preds, labels = train_embedded_head(
            head_name, train_records, test_records, device, epochs=epochs)
        metrics["video"] = video
        fold_metrics.append(metrics)
        all_probs.append(probs)
        all_preds.append(preds)
        all_labels.append(labels)
        LOG.info("  %-9s n=%-3d acc=%.3f macroF1=%.3f", video, metrics["n"],
                 metrics["accuracy"], metrics["macro_f1"])

    pooled_probs = np.concatenate(all_probs)
    pooled_preds = np.concatenate(all_preds)
    pooled_labels = np.concatenate(all_labels)

    return {
        "folds": fold_metrics,
        "macro_f1_mean": float(np.mean([m["macro_f1"] for m in fold_metrics])),
        "macro_f1_std": float(np.std([m["macro_f1"] for m in fold_metrics])),
        "accuracy_mean": float(np.mean([m["accuracy"] for m in fold_metrics])),
        "accuracy_std": float(np.std([m["accuracy"] for m in fold_metrics])),
        "pooled": summarise(pooled_probs, pooled_preds, pooled_labels),
    }, pooled_probs, pooled_preds, pooled_labels


# --------------------------------------------------------------------------
# End-to-end staged fine-tuning
# --------------------------------------------------------------------------
def run_epoch(model, loader, criterion, device, optimiser=None, scaler=None):
    training = optimiser is not None
    model.train(training)
    total_loss, correct, seen = 0.0, 0, 0

    for batch in loader:
        clip = batch["clip"].to(device, non_blocking=True)
        geom = batch["geometry"].to(device, non_blocking=True)
        mask = batch["mask"].to(device, non_blocking=True)
        target = batch["label"].to(device, non_blocking=True)

        with torch.set_grad_enabled(training):
            with torch.autocast("cuda", enabled=(device.type == "cuda")):
                logits = model(clip, geom, mask)
                loss = criterion(logits, target)

            if training:
                optimiser.zero_grad(set_to_none=True)
                scaler.scale(loss).backward()
                scaler.unscale_(optimiser)
                torch.nn.utils.clip_grad_norm_(
                    [p for p in model.parameters() if p.requires_grad], 5.0)
                scaler.step(optimiser)
                scaler.update()

        total_loss += loss.item() * target.size(0)
        correct += (logits.argmax(1) == target).sum().item()
        seen += target.size(0)

    return total_loss / max(seen, 1), correct / max(seen, 1)


def train_end_to_end(train_entries, val_entries, device, head="temporal_fpn_bilstm",
                     stages=(1, 2, 3), max_epochs: int = MAX_EPOCHS):
    """Staged fine-tuning. Each stage resumes the previous stage's best weights.

    Unlike the original loop, each stage is a distinct optimisation problem: a
    fresh optimiser at a stage-specific learning rate over a different set of
    trainable parameters, and the best checkpoint is restored between stages.
    """
    geometry_stats = compute_geometry_stats(train_entries)
    train_loader = DataLoader(
        TrackletDataset(train_entries, augment=True, geometry_stats=geometry_stats),
        batch_size=BATCH_SIZE, shuffle=True, num_workers=NUM_WORKERS, drop_last=False)
    val_loader = DataLoader(
        TrackletDataset(val_entries, augment=False, geometry_stats=geometry_stats),
        batch_size=BATCH_SIZE, shuffle=False, num_workers=NUM_WORKERS)

    labels = np.array([e.label for e in train_entries])
    model = TrackletClassifier(head=head).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights(labels, device))

    histories, stage_summaries = {}, []
    best_overall = None

    for stage in stages:
        model.set_stage(stage)
        trainable, total = model.trainable_backbone_parameters()
        LOG.info("Stage %d: backbone trainable %s / %s params, lr=%.1e",
                 stage, f"{trainable:,}", f"{total:,}", STAGE_LEARNING_RATES[stage])

        optimiser = torch.optim.AdamW(
            [p for p in model.parameters() if p.requires_grad],
            lr=STAGE_LEARNING_RATES[stage], weight_decay=1e-4)
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            optimiser, mode="min", factor=0.5, patience=4)
        scaler = torch.amp.GradScaler("cuda", enabled=(device.type == "cuda"))

        history = {"train_loss": [], "val_loss": [], "train_acc": [], "val_acc": []}
        best_loss, best_state, stalled = float("inf"), None, 0

        for epoch in range(max_epochs):
            t0 = time.time()
            tr_loss, tr_acc = run_epoch(model, train_loader, criterion, device,
                                        optimiser, scaler)
            va_loss, va_acc = run_epoch(model, val_loader, criterion, device)
            scheduler.step(va_loss)

            history["train_loss"].append(tr_loss)
            history["val_loss"].append(va_loss)
            history["train_acc"].append(tr_acc)
            history["val_acc"].append(va_acc)

            if va_loss < best_loss - 1e-4:
                best_loss, stalled = va_loss, 0
                best_state = copy.deepcopy(model.state_dict())
            else:
                stalled += 1

            if epoch % 5 == 0 or epoch == max_epochs - 1:
                LOG.info("  epoch %3d  train %.4f/%.3f  val %.4f/%.3f  (%.1fs)",
                         epoch + 1, tr_loss, tr_acc, va_loss, va_acc, time.time() - t0)

            if stalled >= EARLY_STOPPING_PATIENCE:
                LOG.info("  early stop at epoch %d", epoch + 1)
                break

        if best_state is not None:
            model.load_state_dict(best_state)
        histories[f"stage{stage}"] = history
        stage_summaries.append({"stage": stage, "best_val_loss": best_loss,
                                "epochs": len(history["train_loss"]),
                                "backbone_trainable": trainable})
        best_overall = best_loss

    return model, histories, stage_summaries, geometry_stats


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Train the KITTI tracklet classifier")
    parser.add_argument("--mode", default="cv",
                        choices=["cv", "ablation", "end2end", "smoke-test"])
    parser.add_argument("--head", default="temporal_fpn_bilstm", choices=list(HEAD_VARIANTS))
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--overwrite-embeddings", action="store_true")
    args = parser.parse_args()

    set_seed(SEED)
    device = get_device()
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    LOG.info("device=%s mode=%s", device, args.mode)

    entries = index_cache()
    LOG.info("%d cached tracklets", len(entries))

    if args.mode == "smoke-test":
        train_entries = [e for e in entries if e.video in CANONICAL_SPLIT["train"]][:12]
        val_entries = [e for e in entries if e.video in CANONICAL_SPLIT["val"]][:6]
        model, histories, summaries, _ = train_end_to_end(
            train_entries, val_entries, device, head=args.head, stages=(1,), max_epochs=2)
        LOG.info("smoke test OK: %s", summaries)
        if device.type == "cuda":
            LOG.info("peak VRAM: %.2f GB", torch.cuda.max_memory_allocated() / 1e9)
        return

    LOG.info("precomputing frozen-backbone embeddings ...")
    t0 = time.time()
    records = precompute_embeddings(entries, device, overwrite=args.overwrite_embeddings)
    LOG.info("embeddings ready for %d tracklets (%.1fs)", len(records), time.time() - t0)

    if args.mode == "ablation":
        from src.evaluate import plot_ablation
        results = {}
        for head_name in HEAD_VARIANTS:
            LOG.info("--- ablation: %s ---", head_name)
            summary, *_ = leave_one_video_out(records, head_name, device, epochs=args.epochs)
            results[head_name] = summary
            LOG.info("%s: macroF1 %.3f +/- %.3f | pooled acc %.3f",
                     head_name, summary["macro_f1_mean"], summary["macro_f1_std"],
                     summary["pooled"]["accuracy"])
        save_json(results, RUNS_DIR / "ablation.json")
        plot_ablation(results)
        return

    if args.mode == "cv":
        from src.evaluate import plot_confusion_matrix, text_report
        summary, probs, preds, labels = leave_one_video_out(
            records, args.head, device, epochs=args.epochs)
        LOG.info("macroF1 %.3f +/- %.3f | pooled accuracy %.3f",
                 summary["macro_f1_mean"], summary["macro_f1_std"],
                 summary["pooled"]["accuracy"])
        print(text_report(preds, labels))
        save_json(summary, RUNS_DIR / f"cv_{args.head}.json")
        plot_confusion_matrix(preds, labels,
                              "Leave-one-video-out (pooled, n=293)",
                              "confusion_matrix_lovo.png")
        plot_confusion_matrix(preds, labels,
                              "Leave-one-video-out, row-normalised",
                              "confusion_matrix_lovo_normalised.png", normalize=True)
        return

    if args.mode == "end2end":
        from src.evaluate import plot_confusion_matrix, plot_learning_curves, text_report
        train_entries = [e for e in entries if e.video in CANONICAL_SPLIT["train"]]
        val_entries = [e for e in entries if e.video in CANONICAL_SPLIT["val"]]
        test_entries = [e for e in entries if e.video in CANONICAL_SPLIT["test"]]

        model, histories, summaries, geometry_stats = train_end_to_end(
            train_entries, val_entries, device, head=args.head)

        test_loader = DataLoader(
            TrackletDataset(test_entries, augment=False, geometry_stats=geometry_stats),
            batch_size=BATCH_SIZE, shuffle=False)
        probs, preds, labels = predict(model, test_loader, device)
        metrics = summarise(probs, preds, labels)
        LOG.info("held-out Video_13: acc %.3f macroF1 %.3f", metrics["accuracy"],
                 metrics["macro_f1"])
        print(text_report(preds, labels))

        save_json({"stages": summaries, "test": metrics, "history": histories},
                  RUNS_DIR / "end2end.json")
        torch.save({"state_dict": model.state_dict(),
                    "geometry_stats": geometry_stats,
                    "head": args.head}, RUNS_DIR / "end2end_model.pt")
        for name, history in histories.items():
            plot_learning_curves(history, f"End-to-end fine-tuning ({name})",
                                 f"learning_curves_{name}.png")
        plot_confusion_matrix(preds, labels, "Held-out Video_13 (n=27)",
                              "confusion_matrix_video13.png")


if __name__ == "__main__":
    main()
