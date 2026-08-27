"""Central configuration: paths, class map, and hyperparameters.

Every path is derived from the repository root so the modules behave the same
whether they are imported from a notebook in ``notebooks/`` or run as
``python -m src.train`` from the project root.
"""
from __future__ import annotations

from pathlib import Path

# --- Paths -----------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
CROP_CACHE_DIR = DATA_DIR / "crop_cache"
RUNS_DIR = REPO_ROOT / "runs"
FIGURES_DIR = REPO_ROOT / "docs" / "Visualisations"

# --- Task definition -------------------------------------------------------
CLASS_MAP = {"Car": 0, "Van": 1, "Truck": 2, "Pedestrian": 3, "Cyclist": 4}
INV_CLASS_MAP = {v: k for k, v in CLASS_MAP.items()}
CLASS_NAMES = [INV_CLASS_MAP[i] for i in range(len(CLASS_MAP))]
NUM_CLASSES = len(CLASS_MAP)

# The nine raw pose/dimension features carried per frame, in fixed order.
GEOMETRY_FEATURES = ["tx", "ty", "tz", "rx", "ry", "rz", "w", "h", "l"]
# Derived motion features appended per frame (see dataset.derive_motion_features).
MOTION_FEATURES = ["vx", "vy", "vz", "speed", "ax", "ay", "az", "accel"]
NUM_GEOMETRY_FEATURES = len(GEOMETRY_FEATURES) + len(MOTION_FEATURES)

# --- Clip / crop geometry --------------------------------------------------
TARGET_FRAMES = 32          # temporal window fed to the network
CROP_SIZE = 112             # r3d_18 was trained at 112x112
BOX_CONTEXT_MARGIN = 0.15   # fractional padding around the projected 2D box
MIN_BOX_PIXELS = 4          # boxes smaller than this on either axis are dropped

# --- Training --------------------------------------------------------------
SEED = 42
BATCH_SIZE = 4              # tuned for 6 GB VRAM at 32x112x112 with AMP
NUM_WORKERS = 0             # Windows + notebooks: worker processes are unreliable
MAX_EPOCHS = 60
EARLY_STOPPING_PATIENCE = 12

# Learning rates per fine-tuning stage. Each stage unfreezes more of the
# backbone and therefore uses a smaller step than the one before it.
STAGE_LEARNING_RATES = {1: 1e-3, 2: 1e-4, 3: 3e-5}

# --- Dataset -------------------------------------------------------------
# Videos present in data/. Discovered dynamically so adding a sequence needs no
# code change, but the canonical ordering is kept for reproducible splits.
VIDEO_NAMES = [f"Video_{i}" for i in (1, 2, 3, 4, 9, 10, 11, 12, 13)]

# The historical single-split protocol, retained as a secondary result only.
# Note Video_13 contains no Pedestrian and no Cyclist tracklets, so per-class
# metrics on this split are not meaningful for those classes.
CANONICAL_SPLIT = {
    "train": ["Video_1", "Video_2", "Video_3", "Video_4", "Video_9", "Video_10", "Video_11"],
    "val": ["Video_12"],
    "test": ["Video_13"],
}
