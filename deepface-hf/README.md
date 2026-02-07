---
title: SnapTick DeepFace API
emoji: 📸
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
license: mit
---

# SnapTick DeepFace API

Face recognition service for the SnapTick Attendance System.

## Endpoints

- `GET /` - Service info
- `GET /health` - Health check
- `POST /extract-embedding` - Extract face embedding from image
- `POST /match-faces` - Match faces in group photo against enrolled students
- `POST /diagnose` - Diagnostic analysis for debugging

## Model Configuration

- **Recognition Model**: ArcFace (512-dim embeddings)
- **Detector**: RetinaFace (5-point landmark alignment)
- **Distance Metric**: Cosine similarity
- **Match Threshold**: 0.60
