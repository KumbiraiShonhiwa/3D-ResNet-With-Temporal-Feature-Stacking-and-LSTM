# 3D ResNet with Temporal Feature Stacking and LSTM

Multi-modal **tracklet classification** on the KITTI raw dataset. A 3D ResNet
consumes short clips of per-object image crops, a geometry branch encodes the
LiDAR box pose and its derived motion, and a temporal head — a dilated Temporal
FPN followed by a stacked BiLSTM — classifies the tracklet as one of
**Car, Van, Truck, Pedestrian, Cyclist**.

The repository also contains a self-contained MNIST CNN study (`src/mnist.py`).

---

## Architecture

```
Object crops (T x 112 x 112 x 3)        Tracklet pose (T x 17)
        │                                        │
        ▼                                        ▼
3D ResNet-18 (r3d_18, Kinetics-400)      Conv1D geometry encoder
   spatial pool + temporal resample              │
        │  (T x 512) ──► 1x1 proj (T x 128)      │ (T x 64)
        └──────────────────┬─────────────────────┘
                           ▼
                  concat (T x 192), masked
                           ▼
             Conv1D prefix + BatchNorm
                           ▼
          Temporal FPN  (dilations 1 / 2 / 4, top-down merge)
                           ▼
          BiLSTM(128) → BiLSTM(64), padding-aware
                           ▼
              masked mean → Dense(128) → Dropout(0.5)
                           ▼
                     5-class softmax
```

The geometry branch carries the nine KITTI pose/dimension values
(`tx, ty, tz, rx, ry, rz, w, h, l`) plus eight derived motion channels
(velocity, speed, acceleration, acceleration magnitude).

---

## Dataset reality

This is a small dataset, and the evaluation protocol is built around that fact.
Measured directly from the tracklet XML across the nine sequences:

| Class | Tracklets |
|-------|-----------|
| Car | 235 |
| Van | 30 |
| Pedestrian | 12 |
| Cyclist | 9 |
| Truck | 7 |
| **Total** | **293** |

12,489 tracklet-frames, of which 12,388 (99.2%) yield a usable crop. 130 of the
293 tracklets are shorter than the 32-frame window — the shortest is a single
frame — so short sequences are zero-padded and **masked**, and the recurrent
head is packed so it never consumes padding.

**Video_13 contains no Pedestrian and no Cyclist tracklets.** A single
video-level test split therefore cannot produce meaningful per-class metrics,
which is why the headline protocol is **leave-one-video-out cross-validation**
over all nine sequences, reported as mean ± standard deviation.

---

## Project structure

```
src/
  config.py          # paths, class map, hyperparameters, seed
  calibration.py     # calibration parsing, 3D→2D projection, box corners
  dataset.py         # XML parsing, crop cache builder, TrackletDataset
  model_3dresnet.py  # r3d_18 backbone, staged freezing, full classifier
  lstm_head.py       # Temporal FPN block, BiLSTM head, ablation variants
  train.py           # training loops, cross-validation driver, CLI
  evaluate.py        # metrics, confusion matrices, learning curves
  mnist.py           # the separate MNIST CNN study
  utils.py           # seeding, logging, checkpoint helpers
notebooks/
  KITTI_Model.ipynb  # thin driver over src/
  MNIST_Model.ipynb
docs/
  Technical Reports/ # written report
  Visualisations/    # generated figures
```

---

## Installation

```bash
git clone https://github.com/your-username/3D-ResNet-Temporal-Stacking-LSTM.git
cd 3D-ResNet-Temporal-Stacking-LSTM

python -m venv .venv
.venv/Scripts/activate          # Windows;  source .venv/bin/activate on Linux/macOS

pip install torch==2.7.1+cu118 torchvision==0.22.1+cu118 \
    --index-url https://download.pytorch.org/whl/cu118
pip install -r requirements.txt
```

The KITTI sequences are expected under `data/Video_<n>/` with `Video.xml`, the
three `calib_*.txt` files, and a `sequence_images/` directory of PNG frames.

---

## Usage

Build the crop cache once (~100 s for all nine sequences):

```bash
python -c "from src.dataset import build_crop_cache; build_crop_cache(overwrite=True)"
```

Then:

```bash
python -m src.train --mode smoke-test    # one short fold, verifies shapes and VRAM
python -m src.train --mode cv            # leave-one-video-out, headline result
python -m src.train --mode ablation      # all five temporal heads, 9 folds each
python -m src.train --mode end2end       # staged fine-tuning on the canonical split
python -m src.mnist                      # the MNIST study
```

`--mode cv` and `--mode ablation` train on precomputed frozen-backbone features,
so a full nine-fold sweep takes minutes rather than hours. `--mode end2end` runs
the three-stage schedule with augmentation and unfreezes the backbone.

---

## Fine-tuning stages

| Stage | Trainable backbone params | Learning rate |
|-------|---------------------------|---------------|
| 1 | 0 (head only) | 1e-3 |
| 2 | 24,908,800 (`layer4`) | 1e-4 |
| 3 | 31,137,280 (`layer3` + `layer4`) | 3e-5 |

Each stage is a fresh optimisation problem: a new optimiser over a different
parameter set, resuming the previous stage's best checkpoint. Frozen submodules
are held in `eval()` so their BatchNorm running statistics do not keep drifting.

---

## Evaluation

* **Leave-one-video-out CV** across all nine sequences — the headline number,
  reported as mean ± std with per-class metrics pooled across folds.
* **Held-out Video_13** — retained as a secondary result, captioned with the
  fact that two of the five classes are absent from it.
* Per-class average precision is reported as *not measurable* rather than 0.0
  when a split contains no positive example of a class.

---

## License

MIT License
