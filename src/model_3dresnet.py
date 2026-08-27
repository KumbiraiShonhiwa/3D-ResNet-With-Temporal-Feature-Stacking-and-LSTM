"""3D ResNet backbone and the full tracklet classifier.

This is the module that makes the project name true. The original pipeline had
no 3D CNN anywhere: it ran a 2D Faster R-CNN FPN over whole frames, froze the
result to .npy, and trained a Keras head on top -- which is also why its
"three-stage fine-tuning" could not do anything, since no gradient ever reached
the backbone. Here the backbone is r3d_18 (Kinetics-400 pretrained), it consumes
per-object crop clips, and staged unfreezing genuinely changes what trains.
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision.models.video import R3D_18_Weights, r3d_18

from src.config import NUM_CLASSES, NUM_GEOMETRY_FEATURES
from src.lstm_head import build_head

# Which backbone parameters train at each stage. Stage 1 is head-only; each
# later stage releases one more residual stage, deepest first.
STAGE_TRAINABLE = {
    1: (),
    2: ("layer4",),
    3: ("layer3", "layer4"),
}


class R3DBackbone(nn.Module):
    """r3d_18 truncated after layer4, returning a temporal feature sequence."""

    OUT_CHANNELS = 512

    def __init__(self, pretrained: bool = True):
        super().__init__()
        weights = R3D_18_Weights.KINETICS400_V1 if pretrained else None
        net = r3d_18(weights=weights)
        self.stem = net.stem
        self.layer1 = net.layer1
        self.layer2 = net.layer2
        self.layer3 = net.layer3
        self.layer4 = net.layer4
        self._frozen_stage = None

    def forward(self, clip: torch.Tensor, out_frames: int) -> torch.Tensor:
        """``(B, 3, T, H, W)`` -> ``(B, 512, out_frames)``.

        r3d_18 applies temporal stride 2 in layers 2-4, so a 32-frame clip
        leaves layer4 with 4 timesteps. Those are pooled spatially and then
        interpolated back to the input frame rate so the temporal head still
        reasons at 32 steps -- which is what makes the FPN dilations of 1/2/4
        correspond to the 3/5/9-frame receptive fields the report describes.
        """
        x = self.stem(clip)
        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.layer4(x)                       # (B, 512, T', H', W')
        x = x.mean(dim=(3, 4))                   # (B, 512, T') spatial pool
        if x.size(2) != out_frames:
            x = F.interpolate(x, size=out_frames, mode="linear", align_corners=False)
        return x

    def set_stage(self, stage: int) -> None:
        """Freeze everything, then re-enable the layers this stage trains."""
        if stage not in STAGE_TRAINABLE:
            raise KeyError(f"unknown stage {stage}; options: {sorted(STAGE_TRAINABLE)}")
        self._frozen_stage = stage
        for param in self.parameters():
            param.requires_grad = False
        for layer_name in STAGE_TRAINABLE[stage]:
            for param in getattr(self, layer_name).parameters():
                param.requires_grad = True

    def train(self, mode: bool = True):
        """Keep frozen submodules in eval mode.

        Without this, BatchNorm running statistics would keep drifting in layers
        whose weights are frozen -- a silent form of training that would make
        the stage comparison meaningless.
        """
        super().train(mode)
        if not mode or self._frozen_stage is None:
            return self
        trainable = STAGE_TRAINABLE[self._frozen_stage]
        for name in ("stem", "layer1", "layer2", "layer3", "layer4"):
            if name not in trainable:
                getattr(self, name).eval()
        return self


class TrackletClassifier(nn.Module):
    """3D ResNet visual branch + geometry/motion branch -> temporal head."""

    def __init__(self, head: str = "temporal_fpn_bilstm", pretrained: bool = True,
                 visual_dim: int = 128, geometry_dim: int = 64,
                 num_classes: int = NUM_CLASSES, use_visual: bool = True):
        super().__init__()
        self.use_visual = use_visual
        self.backbone = R3DBackbone(pretrained=pretrained) if use_visual else None

        if use_visual:
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

        fused_dim = (visual_dim if use_visual else 0) + geometry_dim
        self.head = build_head(head, fused_dim)
        self.head_name = head

    def forward(self, clip: torch.Tensor, geometry: torch.Tensor,
                mask: torch.Tensor) -> torch.Tensor:
        frames = geometry.size(1)
        features = [self.geometry_encoder(geometry.transpose(1, 2))]

        if self.use_visual:
            visual = self.backbone(clip, out_frames=frames)
            features.insert(0, self.visual_proj(visual))

        fused = torch.cat(features, dim=1) if len(features) > 1 else features[0]
        fused = fused * mask.unsqueeze(1).to(fused.dtype)
        return self.head(fused, mask)

    def set_stage(self, stage: int) -> None:
        if self.backbone is not None:
            self.backbone.set_stage(stage)

    def trainable_backbone_parameters(self) -> tuple[int, int]:
        if self.backbone is None:
            return 0, 0
        total = sum(p.numel() for p in self.backbone.parameters())
        trainable = sum(p.numel() for p in self.backbone.parameters() if p.requires_grad)
        return trainable, total
