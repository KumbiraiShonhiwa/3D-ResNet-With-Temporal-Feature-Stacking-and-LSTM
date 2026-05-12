# 3D ResNet With Temporal Feature Stacking and LSTM

A deep learning pipeline for video-based object understanding using a 3D ResNet backbone, temporal feature stacking, and an LSTM head for sequence learning.

This project combines spatial feature extraction from video frames with temporal modeling to improve object detection and tracking performance across time.

---

## 🚀 Architecture Overview

Video Frames → 3D ResNet → ROI Feature Extraction → Temporal Feature Stacking → LSTM → Classification / Prediction

---

## 🧠 Key Ideas

- 3D CNN (ResNet) for spatio-temporal feature extraction
- Faster R-CNN for bounding box proposals
- ROI feature pooling per frame
- Temporal stacking of ROI features across frames
- LSTM to learn motion and object continuity
- Designed for datasets like KITTI / driving scenes

---

## 📂 Project Structure
