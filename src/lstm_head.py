"""Temporal heads: the Temporal FPN block, the BiLSTM classifier, and the
ablation variants the technical report claims but never implemented.

All heads take ``(B, C, T)`` features plus a ``(B, T)`` boolean validity mask
and return ``(B, num_classes)`` logits. The mask matters here: 130 of the 293
tracklets are shorter than the 32-frame window, so a head that pools blindly
over time would average in padding.
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F

from src.config import NUM_CLASSES


def masked_mean(x: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
    """Mean over time of ``(B, C, T)`` counting only valid steps."""
    m = mask.unsqueeze(1).to(x.dtype)                 # (B, 1, T)
    total = (x * m).sum(dim=2)
    count = m.sum(dim=2).clamp(min=1.0)
    return total / count


class TemporalFPNBlock(nn.Module):
    """Multi-scale temporal pyramid with a top-down lateral pathway.

    A PyTorch port of the notebook's Keras ``TemporalFPNBlock``. Three dilated
    Conv1d branches give receptive fields of 3, 5 and 9 frames (P3/P4/P5), and
    the top-down merge pushes coarse context back into the fine level, mirroring
    the FPN of Lin et al. (2017) on the time axis.
    """

    def __init__(self, in_channels: int, out_channels: int = 128):
        super().__init__()
        self.out_channels = out_channels

        def conv(cin, cout, k, dilation=1):
            pad = dilation * (k - 1) // 2
            return nn.Conv1d(cin, cout, k, padding=pad, dilation=dilation)

        self.p3_conv = conv(in_channels, out_channels, 3, dilation=1)
        self.p4_conv = conv(in_channels, out_channels, 3, dilation=2)
        self.p5_conv = conv(in_channels, out_channels, 3, dilation=4)

        self.lat_p4 = nn.Conv1d(out_channels, out_channels, 1)
        self.lat_p3 = nn.Conv1d(out_channels, out_channels, 1)

        self.merge_p4 = conv(out_channels, out_channels, 3)
        self.merge_p3 = conv(out_channels, out_channels, 3)

        self.out_proj = nn.Conv1d(out_channels, out_channels, 1)
        self.bn_out = nn.BatchNorm1d(out_channels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        p3 = F.relu(self.p3_conv(x))
        p4 = F.relu(self.p4_conv(x))
        p5 = F.relu(self.p5_conv(x))

        p4_td = F.relu(self.merge_p4(self.lat_p4(p4) + p5))
        p3_td = F.relu(self.merge_p3(self.lat_p3(p3) + p4_td))
        return self.bn_out(self.out_proj(p3_td))


class _Classifier(nn.Module):
    """Shared Dense(128) + Dropout + Linear head."""

    def __init__(self, in_features: int, num_classes: int = NUM_CLASSES,
                 dropout: float = 0.5):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_features, 128),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout),
            nn.Linear(128, num_classes),
        )

    def forward(self, x):
        return self.net(x)


class MeanPoolMLP(nn.Module):
    """Ablation: no temporal modelling at all -- masked mean then MLP."""

    def __init__(self, in_channels: int, num_classes: int = NUM_CLASSES):
        super().__init__()
        self.classifier = _Classifier(in_channels, num_classes)

    def forward(self, x, mask):
        return self.classifier(masked_mean(x, mask))


class Conv1DOnly(nn.Module):
    """Ablation: Conv1d prefix, no recurrence and no pyramid."""

    def __init__(self, in_channels: int, hidden: int = 128,
                 num_classes: int = NUM_CLASSES):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv1d(in_channels, hidden, 3, padding=1),
            nn.BatchNorm1d(hidden),
            nn.ReLU(inplace=True),
            nn.Conv1d(hidden, hidden, 3, padding=1),
            nn.BatchNorm1d(hidden),
            nn.ReLU(inplace=True),
        )
        self.classifier = _Classifier(hidden, num_classes)

    def forward(self, x, mask):
        return self.classifier(masked_mean(self.conv(x), mask))


class RecurrentHead(nn.Module):
    """Conv1d prefix -> optional Temporal FPN -> stacked LSTM -> classifier.

    Setting ``bidirectional`` and ``use_fpn`` selects the proposed model and the
    two recurrent ablations from a single implementation.
    """

    def __init__(self, in_channels: int, hidden: int = 128,
                 num_classes: int = NUM_CLASSES, bidirectional: bool = True,
                 use_fpn: bool = True):
        super().__init__()
        self.prefix = nn.Sequential(
            nn.Conv1d(in_channels, hidden, 3, padding=1),
            nn.BatchNorm1d(hidden),
            nn.ReLU(inplace=True),
        )
        self.fpn = TemporalFPNBlock(hidden, hidden) if use_fpn else None

        self.lstm1 = nn.LSTM(hidden, hidden, batch_first=True,
                             bidirectional=bidirectional)
        directions = 2 if bidirectional else 1
        self.lstm2 = nn.LSTM(hidden * directions, hidden // 2, batch_first=True,
                             bidirectional=bidirectional)
        self.classifier = _Classifier((hidden // 2) * directions, num_classes)

    def forward(self, x, mask):
        x = self.prefix(x)
        if self.fpn is not None:
            x = self.fpn(x)

        # Pack so the LSTM never consumes padded steps. Lengths come from the
        # mask; a fully-padded sample cannot occur because index_cache drops
        # tracklets with no valid crop, but clamp to 1 for safety.
        lengths = mask.sum(dim=1).clamp(min=1).cpu()
        seq = x.transpose(1, 2)                                  # (B, T, C)

        packed = nn.utils.rnn.pack_padded_sequence(
            seq, lengths, batch_first=True, enforce_sorted=False)
        packed, _ = self.lstm1(packed)
        packed, _ = self.lstm2(packed)
        out, _ = nn.utils.rnn.pad_packed_sequence(
            packed, batch_first=True, total_length=seq.size(1))

        return self.classifier(masked_mean(out.transpose(1, 2), mask))


HEAD_VARIANTS = {
    "mean_pool_mlp": lambda c: MeanPoolMLP(c),
    "conv1d_only": lambda c: Conv1DOnly(c),
    "uni_lstm": lambda c: RecurrentHead(c, bidirectional=False, use_fpn=False),
    "bilstm_no_fpn": lambda c: RecurrentHead(c, bidirectional=True, use_fpn=False),
    "temporal_fpn_bilstm": lambda c: RecurrentHead(c, bidirectional=True, use_fpn=True),
}


def build_head(name: str, in_channels: int) -> nn.Module:
    if name not in HEAD_VARIANTS:
        raise KeyError(f"unknown head {name!r}; options: {sorted(HEAD_VARIANTS)}")
    return HEAD_VARIANTS[name](in_channels)
