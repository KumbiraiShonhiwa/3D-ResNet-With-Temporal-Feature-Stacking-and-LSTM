"""Seeding, logging and checkpoint helpers shared across the pipeline."""
from __future__ import annotations

import json
import logging
import os
import random
from pathlib import Path

import numpy as np
import torch

from src.config import SEED


def set_seed(seed: int = SEED, deterministic: bool = True) -> None:
    """Seed every RNG the pipeline touches."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)
    if deterministic:
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False


def get_device() -> torch.device:
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def get_logger(name: str = "kitti") -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)-7s %(message)s",
                                               datefmt="%H:%M:%S"))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger


def save_json(obj, path: str | Path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    def default(o):
        if isinstance(o, (np.integer,)):
            return int(o)
        if isinstance(o, (np.floating,)):
            return float(o)
        if isinstance(o, np.ndarray):
            return o.tolist()
        if isinstance(o, Path):
            return str(o)
        raise TypeError(f"not JSON serialisable: {type(o)}")

    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, default=default)


def load_json(path: str | Path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def count_parameters(module: torch.nn.Module) -> tuple[int, int]:
    """Return ``(trainable, total)`` parameter counts."""
    total = sum(p.numel() for p in module.parameters())
    trainable = sum(p.numel() for p in module.parameters() if p.requires_grad)
    return trainable, total
