"""KITTI calibration parsing and 3D->2D projection.

Ported from the original notebook cells 3-7. The parsing and the
``P_rect_02 @ R_rect @ Tr_velo_to_cam`` composition were already correct and are
kept as-is; the box-corner construction has been rewritten (see
:func:`project_box`).
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import numpy as np


def parse_calibration_file(path: str | Path) -> dict[str, np.ndarray]:
    """Read a KITTI ``calib_*.txt`` into ``{key: flat float array}``."""
    calib: dict[str, np.ndarray] = {}
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if not line or ":" not in line:
                continue
            key, values = line.split(":", 1)
            try:
                calib[key.strip()] = np.array([float(v) for v in values.split()])
            except ValueError:
                # Non-numeric entries (e.g. calib_time) are not needed here.
                pass
    return calib


@lru_cache(maxsize=32)
def projection_matrix(cam_to_cam_path: str, velo_to_cam_path: str) -> np.ndarray:
    """Build the 3x4 matrix mapping homogeneous velodyne points to image pixels."""
    vc = parse_calibration_file(velo_to_cam_path)
    tr_velo_to_cam = np.vstack(
        [np.hstack([vc["R"].reshape(3, 3), vc["T"].reshape(3, 1)]), [0, 0, 0, 1]]
    )

    cc = parse_calibration_file(cam_to_cam_path)
    r_rect = np.eye(4)
    r_rect[:3, :3] = cc["R_rect_00"].reshape(3, 3)
    p_rect_02 = cc["P_rect_02"].reshape(3, 4)

    return p_rect_02 @ r_rect @ tr_velo_to_cam


def project_points(matrix: np.ndarray, points: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Project Nx3 velodyne points to Nx2 pixels.

    Returns ``(pixels, in_front)`` where ``in_front`` marks points with positive
    camera-frame depth. Points behind the camera project to mathematically valid
    but physically meaningless pixels, so callers must honour the mask -- the
    original ``create2D`` silently returned ``(0, 0)`` for them.
    """
    points = np.asarray(points, dtype=np.float64).reshape(-1, 3)
    homogeneous = np.hstack([points, np.ones((len(points), 1))])
    projected = homogeneous @ matrix.T          # (N, 3)
    depth = projected[:, 2]
    in_front = depth > 1e-6
    safe_depth = np.where(in_front, depth, 1.0)
    pixels = projected[:, :2] / safe_depth[:, None]
    return pixels, in_front


def box_corners(tx: float, ty: float, tz: float,
                w: float, h: float, l: float, rz: float = 0.0) -> np.ndarray:
    """Return the 8 velodyne-frame corners of a KITTI tracklet box.

    KITTI tracklet poses are given in the velodyne frame with the box origin at
    the *centre of the bottom face*: local +x spans the length, +y the width and
    +z the height, with ``rz`` the yaw about the vertical axis.

    The original ``create2DBOX`` mapped ``w`` onto x and ``l`` onto y (swapping
    length and width) and ignored ``rz`` entirely, so rotated objects produced
    axis-aligned boxes of the wrong aspect ratio.
    """
    half_l, half_w = l / 2.0, w / 2.0
    local = np.array([
        [sx * half_l, sy * half_w, sz * h]
        for sx in (-1, 1)
        for sy in (-1, 1)
        for sz in (0, 1)
    ], dtype=np.float64)

    cos_rz, sin_rz = np.cos(rz), np.sin(rz)
    rotation = np.array([[cos_rz, -sin_rz, 0.0],
                         [sin_rz,  cos_rz, 0.0],
                         [0.0,     0.0,    1.0]])
    return local @ rotation.T + np.array([tx, ty, tz])


def project_box(matrix: np.ndarray, tx: float, ty: float, tz: float,
                w: float, h: float, l: float, rz: float = 0.0):
    """Project a 3D tracklet box to an axis-aligned 2D pixel box.

    Returns ``(u_min, v_min, u_max, v_max)`` as floats, or ``None`` when the box
    is not usable -- fewer than half its corners are in front of the camera.
    """
    corners = box_corners(tx, ty, tz, w, h, l, rz)
    pixels, in_front = project_points(matrix, corners)
    if in_front.sum() < 4:
        return None
    visible = pixels[in_front]
    return (float(visible[:, 0].min()), float(visible[:, 1].min()),
            float(visible[:, 0].max()), float(visible[:, 1].max()))
