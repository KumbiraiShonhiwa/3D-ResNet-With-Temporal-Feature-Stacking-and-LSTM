"""KITTI tracklet parsing, crop-cache construction and the training Dataset.

This module replaces the notebook's KITTIDataset. The decisive difference is
that visual features are taken from a crop around each object's projected 2D
box rather than from the whole camera frame. In the original pipeline every
tracklet in a video received a byte-identical visual descriptor, which made the
"multi-modal" branch a video-identity signal rather than an object descriptor.
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
import torch
from torch.utils.data import Dataset

from src.calibration import project_box, projection_matrix
from src.config import (BOX_CONTEXT_MARGIN, CLASS_MAP, CROP_CACHE_DIR, CROP_SIZE,
                        DATA_DIR, MIN_BOX_PIXELS, TARGET_FRAMES, VIDEO_NAMES)
from src.utils import get_logger

LOG = get_logger()


@dataclass
class Tracklet:
    video: str
    index: int
    label: str
    first_frame: int
    geometry: np.ndarray
    frame_indices: np.ndarray

    @property
    def length(self) -> int:
        return len(self.frame_indices)

    @property
    def cache_path(self) -> Path:
        return CROP_CACHE_DIR / self.video / f"tracklet_{self.index:03d}.npz"


def resolve_image_dir(video: str) -> Path:
    """Locate a video's frame directory.

    Video_1 nests its frames one level deeper in sequence_images/data/. The
    original code hardcoded sequence_images/ and so silently produced all-zero
    features for that entire video.
    """
    base = DATA_DIR / video / "sequence_images"
    nested = base / "data"
    if nested.is_dir():
        return nested
    if not base.is_dir():
        raise FileNotFoundError(f"no sequence_images directory for {video}")
    return base


def parse_tracklets(video: str) -> list[Tracklet]:
    """Parse Video.xml into per-object pose sequences.

    Two fixes over the original parseXML:

    * It iterates tracklets/item directly. The original matched every pose
      element too, and only produced the right answer because pose items happen
      to have an empty objectType that the caller filtered out.
    * first_frame is honoured. The original used the enumerate index as the
      frame number, so any tracklet not starting at frame 0 was paired with the
      wrong images for its entire length.
    """
    xml_path = DATA_DIR / video / "Video.xml"
    root = ET.parse(xml_path).getroot()
    container = root.find("tracklets")
    if container is None:
        raise ValueError(f"{xml_path} has no tracklets element")

    tracklets: list[Tracklet] = []
    for index, obj in enumerate(container.findall("item")):
        label = (obj.findtext("objectType") or "").strip()
        if label not in CLASS_MAP:
            continue

        first_frame = int(obj.findtext("first_frame", "0"))
        w = float(obj.findtext("w", "0"))
        h = float(obj.findtext("h", "0"))
        l = float(obj.findtext("l", "0"))

        poses_el = obj.find("poses")
        poses = poses_el.findall("item") if poses_el is not None else []
        if not poses:
            continue

        geometry = np.array([
            [float(p.findtext("tx", "0")), float(p.findtext("ty", "0")),
             float(p.findtext("tz", "0")), float(p.findtext("rx", "0")),
             float(p.findtext("ry", "0")), float(p.findtext("rz", "0")), w, h, l]
            for p in poses
        ], dtype=np.float32)

        frame_indices = first_frame + np.arange(len(poses), dtype=np.int64)
        tracklets.append(Tracklet(video=video, index=index, label=label,
                                  first_frame=first_frame, geometry=geometry,
                                  frame_indices=frame_indices))
    return tracklets


def load_all_tracklets(videos=None) -> list[Tracklet]:
    videos = videos or VIDEO_NAMES
    out: list[Tracklet] = []
    for video in videos:
        out.extend(parse_tracklets(video))
    return out


def derive_motion_features(geometry: np.ndarray) -> np.ndarray:
    """Append velocity / acceleration channels to an (L, 9) geometry array.

    Returns (L, 17): the original nine, then vx, vy, vz, speed, ax, ay, az,
    accel. Translation deltas separate a walking pedestrian from a moving car
    far more sharply than absolute position does, and cost nothing to compute.
    """
    translation = geometry[:, :3]
    velocity = np.zeros_like(translation)
    if len(translation) > 1:
        velocity[1:] = np.diff(translation, axis=0)
    speed = np.linalg.norm(velocity, axis=1, keepdims=True)

    acceleration = np.zeros_like(velocity)
    if len(velocity) > 1:
        acceleration[1:] = np.diff(velocity, axis=0)
    accel_mag = np.linalg.norm(acceleration, axis=1, keepdims=True)

    return np.concatenate(
        [geometry, velocity, speed, acceleration, accel_mag], axis=1
    ).astype(np.float32)


def _expand_and_clamp(box, img_w: int, img_h: int, margin: float = BOX_CONTEXT_MARGIN):
    """Pad a box by margin on each side and clip it to the image."""
    u_min, v_min, u_max, v_max = box
    pad_u = (u_max - u_min) * margin
    pad_v = (v_max - v_min) * margin
    u_min, u_max = u_min - pad_u, u_max + pad_u
    v_min, v_max = v_min - pad_v, v_max + pad_v

    u_min = int(np.floor(max(0.0, u_min)))
    v_min = int(np.floor(max(0.0, v_min)))
    u_max = int(np.ceil(min(float(img_w), u_max)))
    v_max = int(np.ceil(min(float(img_h), v_max)))

    if u_max - u_min < MIN_BOX_PIXELS or v_max - v_min < MIN_BOX_PIXELS:
        return None
    return u_min, v_min, u_max, v_max


def build_crop_cache(videos=None, overwrite: bool = False) -> dict:
    """Crop every tracklet in every frame and cache the result to .npz.

    Images are decoded once per frame and shared across all tracklets visible in
    that frame, so the cost is one pass over the image set rather than one pass
    per tracklet.
    """
    videos = videos or VIDEO_NAMES
    stats = {"tracklets": 0, "frames": 0, "valid_crops": 0,
             "missing_images": 0, "unusable_boxes": 0, "per_video": {}}

    for video in videos:
        tracklets = parse_tracklets(video)
        if not tracklets:
            continue

        image_dir = resolve_image_dir(video)
        matrix = projection_matrix(str(DATA_DIR / video / "calib_cam_to_cam.txt"),
                                   str(DATA_DIR / video / "calib_velo_to_cam.txt"))
        out_dir = CROP_CACHE_DIR / video
        out_dir.mkdir(parents=True, exist_ok=True)

        buffers = {
            t.index: {
                "crops": np.zeros((t.length, CROP_SIZE, CROP_SIZE, 3), dtype=np.uint8),
                "valid": np.zeros(t.length, dtype=bool),
            }
            for t in tracklets
        }

        by_frame = defaultdict(list)
        for t in tracklets:
            for position, frame_idx in enumerate(t.frame_indices):
                by_frame[int(frame_idx)].append((t, position))

        video_missing = 0
        for frame_idx in sorted(by_frame):
            img_path = image_dir / f"{frame_idx:010d}.png"
            image = cv2.imread(str(img_path))
            if image is None:
                video_missing += len(by_frame[frame_idx])
                stats["missing_images"] += len(by_frame[frame_idx])
                continue

            img_h, img_w = image.shape[:2]
            for tracklet, position in by_frame[frame_idx]:
                tx, ty, tz, _rx, _ry, rz, w, h, l = tracklet.geometry[position]
                box = project_box(matrix, tx, ty, tz, w, h, l, rz)
                if box is None:
                    stats["unusable_boxes"] += 1
                    continue
                clamped = _expand_and_clamp(box, img_w, img_h)
                if clamped is None:
                    stats["unusable_boxes"] += 1
                    continue

                u_min, v_min, u_max, v_max = clamped
                crop = image[v_min:v_max, u_min:u_max]
                crop = cv2.resize(crop, (CROP_SIZE, CROP_SIZE), interpolation=cv2.INTER_LINEAR)
                buffers[tracklet.index]["crops"][position] = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
                buffers[tracklet.index]["valid"][position] = True
                stats["valid_crops"] += 1

        for tracklet in tracklets:
            buf = buffers[tracklet.index]
            path = tracklet.cache_path
            if path.exists() and not overwrite:
                continue
            np.savez_compressed(
                path,
                crops=buf["crops"],
                valid=buf["valid"],
                geometry=derive_motion_features(tracklet.geometry),
                frame_indices=tracklet.frame_indices,
                label=CLASS_MAP[tracklet.label],
                label_name=tracklet.label,
                video=tracklet.video,
                first_frame=tracklet.first_frame,
            )
            stats["tracklets"] += 1
            stats["frames"] += tracklet.length

        n_valid = int(sum(buffers[t.index]["valid"].sum() for t in tracklets))
        stats["per_video"][video] = {
            "tracklets": len(tracklets),
            "frames": int(sum(t.length for t in tracklets)),
            "valid_crops": n_valid,
            "missing_image_frames": video_missing,
        }
        LOG.info("%-9s %3d tracklets  %5d frames  %5d valid crops  %4d missing images",
                 video, len(tracklets), stats["per_video"][video]["frames"],
                 n_valid, video_missing)

    return stats


IMAGENET_MEAN = np.array([0.43216, 0.394666, 0.37645], dtype=np.float32)
IMAGENET_STD = np.array([0.22803, 0.22145, 0.216989], dtype=np.float32)


@dataclass
class CachedTracklet:
    path: Path
    label: int
    video: str
    length: int
    n_valid: int


def index_cache(videos=None) -> list[CachedTracklet]:
    """List cached tracklets, skipping any with no usable crop at all."""
    videos = videos or VIDEO_NAMES
    entries: list[CachedTracklet] = []
    for video in videos:
        for path in sorted((CROP_CACHE_DIR / video).glob("tracklet_*.npz")):
            with np.load(path, allow_pickle=True) as data:
                valid = data["valid"]
                n_valid = int(valid.sum())
                if n_valid == 0:
                    LOG.warning("%s/%s has no usable crops; excluded", video, path.name)
                    continue
                entries.append(CachedTracklet(path=path, label=int(data["label"]),
                                              video=video, length=len(valid),
                                              n_valid=n_valid))
    return entries


class TrackletDataset(Dataset):
    """Fixed-length clips of object crops plus aligned geometry.

    __getitem__ returns a dict with:
      clip     (3, T, 112, 112) float32, normalised for r3d_18
      geometry (T, 17) float32
      mask     (T,) bool -- True where the timestep is real, not padding
      label    scalar long
    """

    def __init__(self, entries, augment: bool = False, geometry_stats=None,
                 target_frames: int = TARGET_FRAMES):
        self.entries = entries
        self.augment = augment
        self.geometry_stats = geometry_stats
        self.target_frames = target_frames

    def __len__(self) -> int:
        return len(self.entries)

    def _sample_window(self, length: int, rng):
        """Pick target_frames indices, padding short tracklets.

        130 of the 293 tracklets are shorter than 32 frames (one is a single
        frame). Rather than repeating the last pose 31 times and letting the
        recurrent head read that as genuine temporal evidence, short sequences
        are padded and the padded steps are masked out.
        """
        t = self.target_frames
        if length >= t:
            start = int(rng.integers(0, length - t + 1)) if self.augment else 0
            indices = np.arange(start, start + t)
            mask = np.ones(t, dtype=bool)
        else:
            indices = np.concatenate([np.arange(length), np.full(t - length, length - 1)])
            mask = np.zeros(t, dtype=bool)
            mask[:length] = True
        return indices, mask

    def __getitem__(self, idx: int) -> dict:
        entry = self.entries[idx]
        seed = int(torch.randint(0, 2 ** 31 - 1, (1,)).item()) if self.augment else idx
        rng = np.random.default_rng(seed)

        with np.load(entry.path, allow_pickle=True) as data:
            crops = data["crops"]
            valid = data["valid"]
            geometry = data["geometry"]

        indices, mask = self._sample_window(len(valid), rng)
        mask = mask & valid[indices]

        clip = crops[indices].astype(np.float32) / 255.0
        geom = geometry[indices].astype(np.float32).copy()

        if self.augment:
            if rng.random() < 0.5:
                clip = clip[:, :, ::-1]
                geom[:, 1] *= -1
                geom[:, 10] *= -1
                geom[:, 14] *= -1
            if rng.random() < 0.5:
                clip = np.clip(clip * rng.uniform(0.8, 1.2) + rng.uniform(-0.1, 0.1), 0.0, 1.0)

        clip = (clip - IMAGENET_MEAN) / IMAGENET_STD
        clip[~mask] = 0.0
        clip = np.ascontiguousarray(clip.transpose(3, 0, 1, 2))

        if self.geometry_stats is not None:
            mean, std = self.geometry_stats
            geom = (geom - mean) / std
        geom[~mask] = 0.0

        return {
            "clip": torch.from_numpy(clip),
            "geometry": torch.from_numpy(np.ascontiguousarray(geom)),
            "mask": torch.from_numpy(mask),
            "label": torch.tensor(entry.label, dtype=torch.long),
        }


def compute_geometry_stats(entries):
    """Mean/std over training tracklets only, to avoid leaking split statistics."""
    chunks = []
    for entry in entries:
        with np.load(entry.path, allow_pickle=True) as data:
            geom, valid = data["geometry"], data["valid"]
        if valid.any():
            chunks.append(geom[valid])
    stacked = np.concatenate(chunks, axis=0)
    mean = stacked.mean(axis=0).astype(np.float32)
    std = stacked.std(axis=0).astype(np.float32)
    std[std < 1e-6] = 1.0
    return mean, std
