"""
DeepFace Flask Microservice for Hugging Face Spaces Deployment
This is a cloud-compatible version that accepts base64 images instead of file paths.

MODELS USED (same as local version):
- Recognition: ArcFace (512-dim embeddings, best accuracy with angular margin loss)
- Detection: RetinaFace (5-point landmark alignment, handles angles/lighting)
"""

import os
# Optimize TensorFlow BEFORE importing
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"  # Suppress TF warnings
os.environ["TF_DETERMINISTIC_OPS"] = "1"
os.environ["TF_CUDNN_DETERMINISTIC"] = "1"

from flask import Flask, request, jsonify
from deepface import DeepFace
import numpy as np
import cv2
import base64
import traceback

# Check GPU/CPU
try:
    import tensorflow as tf
    tf.config.experimental.enable_op_determinism()
    gpus = tf.config.list_physical_devices('GPU')
    if gpus:
        print(f"GPU detected: {gpus}")
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
    else:
        print("No GPU detected, using CPU")
    print("TensorFlow deterministic mode enabled")
except Exception as e:
    print(f"GPU setup note: {e}")

app = Flask(__name__)

# =============================================================================
# MODEL CONFIGURATION - Same as local version
# =============================================================================
MODEL_NAME = "ArcFace"
DETECTOR_BACKEND = os.environ.get("DETECTOR_BACKEND", "retinaface")
DISTANCE_METRIC = "cosine"
FACE_MATCH_THRESHOLD = 0.60
FACE_MATCH_GAP = 0.05

print(f"DeepFace Service starting with model: {MODEL_NAME}, detector: {DETECTOR_BACKEND}")
print(f"Thresholds: match <= {FACE_MATCH_THRESHOLD}, max gap >= {FACE_MATCH_GAP}")


def convert_to_native(obj):
    """Convert numpy types to native Python types for JSON serialization"""
    if isinstance(obj, dict):
        return {k: convert_to_native(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_to_native(i) for i in obj]
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.str_):
        return str(obj)
    else:
        return obj


def load_image_from_base64(base64_string):
    """Load image from base64 string"""
    # Handle data URL format
    if "," in base64_string:
        base64_string = base64_string.split(",")[1]
    img_data = base64.b64decode(base64_string)
    nparr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode base64 image")
    return img


def preprocess_for_detection(img):
    """Preprocess image to improve face detection"""
    original_h, original_w = img.shape[:2]
    scale = 1.0
    
    max_dim = 1600
    if max(original_h, original_w) > max_dim:
        scale = max_dim / max(original_h, original_w)
        img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    mean_brightness = np.mean(gray)
    std_brightness = np.std(gray)
    
    if mean_brightness < 100 or std_brightness < 40:
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        
        if mean_brightness < 60:
            clip_limit = 4.0
        elif mean_brightness < 80:
            clip_limit = 3.0
        else:
            clip_limit = 2.0
        
        clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(8, 8))
        l = clahe.apply(l)
        lab = cv2.merge([l, a, b])
        img = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    
    return img, scale


def detect_faces_robust(img, model_name, detector_backend):
    """Detect faces with multiple strategies"""
    all_detections = []
    seen_faces = set()
    
    def face_key(fa):
        x, y = fa.get("x", 0), fa.get("y", 0)
        return (x // 50, y // 50)
    
    try:
        detections = DeepFace.represent(
            img_path=img,
            model_name=model_name,
            detector_backend=detector_backend,
            enforce_detection=False,
            align=True
        )
        for det in detections:
            key = face_key(det.get("facial_area", {}))
            if key not in seen_faces:
                seen_faces.add(key)
                all_detections.append(det)
    except Exception as e:
        print(f"Detection failed: {e}")
    
    return all_detections


def scale_facial_area(facial_area, scale):
    """Scale facial area coordinates back to original image size"""
    if scale == 1.0:
        return facial_area
    return {
        "x": int(facial_area.get("x", 0) / scale),
        "y": int(facial_area.get("y", 0) / scale),
        "w": int(facial_area.get("w", 0) / scale),
        "h": int(facial_area.get("h", 0) / scale)
    }


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "service": "SnapTick DeepFace API",
        "model": MODEL_NAME,
        "detector": DETECTOR_BACKEND,
        "status": "running"
    })


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "model": MODEL_NAME, "detector": DETECTOR_BACKEND})


@app.route("/extract-embedding", methods=["POST"])
def extract_embedding():
    """Extract face embedding from a base64 image"""
    try:
        data = request.get_json()
        
        if "image_base64" not in data:
            return jsonify({"error": "'image_base64' is required"}), 400

        img = load_image_from_base64(data["image_base64"])
        
        # Resize for faster processing
        h, w = img.shape[:2]
        max_dim = 800
        if max(h, w) > max_dim:
            scale = max_dim / max(h, w)
            img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)

        embeddings = DeepFace.represent(
            img_path=img,
            model_name=MODEL_NAME,
            detector_backend=DETECTOR_BACKEND,
            enforce_detection=True,
            align=True
        )

        if not embeddings:
            return jsonify({"error": "No face detected in the image"}), 400

        embedding = embeddings[0]["embedding"]
        facial_area = embeddings[0].get("facial_area", {})

        return jsonify(convert_to_native({
            "success": True,
            "embedding": embedding,
            "embedding_size": len(embedding),
            "facial_area": facial_area,
            "model": MODEL_NAME
        }))

    except ValueError as e:
        if "Face could not be detected" in str(e):
            return jsonify({"error": "No face detected in the image"}), 400
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/match-faces", methods=["POST"])
def match_faces():
    """Match detected faces against enrolled face descriptors (base64 version)"""
    try:
        data = request.get_json()
        
        if "image_base64" not in data:
            return jsonify({"error": "'image_base64' is required"}), 400

        img = load_image_from_base64(data["image_base64"])
        enrolled_faces = data.get("enrolled_faces", [])
        
        if not enrolled_faces:
            return jsonify({"error": "No enrolled faces provided"}), 400

        processed_img, scale = preprocess_for_detection(img)
        detections = detect_faces_robust(processed_img, MODEL_NAME, DETECTOR_BACKEND)

        if not detections:
            return jsonify({
                "success": True,
                "matches": [],
                "face_count": 0,
                "message": "No faces detected in the image"
            })

        # Sort by position for consistency
        def get_face_position(det):
            fa = det.get("facial_area", {})
            return (fa.get("y", 0), fa.get("x", 0))
        
        detections = sorted(detections, key=get_face_position)

        def find_best_match(embedding, face_index):
            best = {"label": "unknown", "distance": float("inf")}
            second_best = {"label": "unknown", "distance": float("inf")}
            embedding_np = np.array(embedding)
            embedding_dim = len(embedding)
            all_candidates = []

            for enrolled in enrolled_faces:
                roll_number = enrolled["rollNumber"]
                descriptors = enrolled.get("descriptors", [])
                min_distance = float("inf")
                
                for desc in descriptors:
                    if len(desc) != embedding_dim:
                        continue
                    desc_np = np.array(desc)
                    cos_sim = np.dot(embedding_np, desc_np) / (np.linalg.norm(embedding_np) * np.linalg.norm(desc_np))
                    distance = 1 - cos_sim
                    if distance < min_distance:
                        min_distance = distance
                
                if min_distance < float("inf"):
                    all_candidates.append({"label": roll_number, "distance": float(min_distance)})
            
            all_candidates.sort(key=lambda x: x["distance"])
            
            if len(all_candidates) >= 1:
                best = all_candidates[0]
            if len(all_candidates) >= 2:
                second_best = all_candidates[1]
            
            gap = second_best["distance"] - best["distance"]
            
            # Adaptive gap based on confidence
            if best["distance"] <= 0.35:
                required_gap = 0.01
            elif best["distance"] <= 0.45:
                required_gap = 0.02
            elif best["distance"] <= 0.55:
                required_gap = 0.03
            else:
                required_gap = FACE_MATCH_GAP
            
            is_match = bool(
                best["distance"] <= FACE_MATCH_THRESHOLD and
                gap >= required_gap
            )

            return {
                "label": best["label"] if is_match else "unknown",
                "distance": float(best["distance"]),
                "is_match": is_match
            }

        results = []
        label_winners = {}

        for i, detection in enumerate(detections):
            embedding = detection["embedding"]
            facial_area = detection.get("facial_area", {})
            facial_area = scale_facial_area(facial_area, scale)
            match = find_best_match(embedding, i)

            results.append({
                "index": i,
                "facial_area": facial_area,
                "match": match
            })

            if match["is_match"] and match["label"] != "unknown":
                label = match["label"]
                if label not in label_winners or match["distance"] < label_winners[label]["distance"]:
                    label_winners[label] = {"index": i, "distance": match["distance"]}

        matches = []
        for result in results:
            match = result["match"]
            is_winner = bool(
                match["is_match"] and
                match["label"] != "unknown" and
                label_winners.get(match["label"], {}).get("index") == result["index"]
            )

            matches.append({
                "facial_area": convert_to_native(result["facial_area"]),
                "roll_number": match["label"] if is_winner else "unknown",
                "distance": float(match["distance"]),
                "is_recognized": is_winner,
                "embedding": convert_to_native(detections[result["index"]]["embedding"])
            })

        return jsonify(convert_to_native({
            "success": True,
            "matches": matches,
            "face_count": len(detections),
            "recognized_count": len(label_winners)
        }))

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/diagnose", methods=["POST"])
def diagnose_matching():
    """Diagnostic endpoint (base64 version)"""
    try:
        data = request.get_json()
        
        if "image_base64" not in data:
            return jsonify({"error": "'image_base64' is required"}), 400

        img = load_image_from_base64(data["image_base64"])
        enrolled_faces = data.get("enrolled_faces", [])
        
        if not enrolled_faces:
            return jsonify({"error": "No enrolled faces provided"}), 400

        processed_img, scale = preprocess_for_detection(img)
        detections = detect_faces_robust(processed_img, MODEL_NAME, DETECTOR_BACKEND)

        if not detections:
            return jsonify({
                "success": True,
                "message": "No faces detected",
                "faces": [],
                "recommendations": ["Try a clearer photo with better lighting"]
            })

        face_analyses = []
        
        for i, detection in enumerate(detections):
            embedding = detection["embedding"]
            embedding_np = np.array(embedding)
            embedding_dim = len(embedding)
            facial_area = scale_facial_area(detection.get("facial_area", {}), scale)
            
            all_distances = []
            for enrolled in enrolled_faces:
                roll_number = enrolled["rollNumber"]
                name = enrolled.get("name", roll_number)
                descriptors = enrolled.get("descriptors", [])
                
                distances_to_person = []
                for desc in descriptors:
                    if len(desc) != embedding_dim:
                        continue
                    desc_np = np.array(desc)
                    cos_sim = np.dot(embedding_np, desc_np) / (np.linalg.norm(embedding_np) * np.linalg.norm(desc_np))
                    distance = 1 - cos_sim
                    distances_to_person.append(float(distance))
                
                if distances_to_person:
                    min_dist = min(distances_to_person)
                    all_distances.append({
                        "rollNumber": roll_number,
                        "name": name,
                        "minDistance": round(min_dist, 4),
                        "numDescriptors": len(distances_to_person),
                        "wouldMatch": min_dist <= FACE_MATCH_THRESHOLD
                    })
            
            all_distances.sort(key=lambda x: x["minDistance"])
            best = all_distances[0] if all_distances else None
            second_best = all_distances[1] if len(all_distances) > 1 else None
            
            if best:
                gap = (second_best["minDistance"] - best["minDistance"]) if second_best else float("inf")
                
                if best["minDistance"] <= 0.35:
                    required_gap = 0.01
                elif best["minDistance"] <= 0.45:
                    required_gap = 0.02
                elif best["minDistance"] <= 0.55:
                    required_gap = 0.03
                else:
                    required_gap = FACE_MATCH_GAP
                
                is_match = best["minDistance"] <= FACE_MATCH_THRESHOLD and gap >= required_gap
                
                recommendations = []
                if not is_match:
                    if best["minDistance"] > FACE_MATCH_THRESHOLD:
                        recommendations.append(f"Distance {best['minDistance']:.3f} exceeds threshold")
                        recommendations.append(f"Re-enroll {best['name']} with similar photo")
                    elif gap < required_gap:
                        recommendations.append(f"Gap too small between matches")
                
                face_analyses.append({
                    "faceIndex": i,
                    "facialArea": facial_area,
                    "bestMatch": best,
                    "isMatch": is_match,
                    "matchedTo": best["name"] if is_match else "Unknown",
                    "allCandidates": all_distances[:5],
                    "recommendations": recommendations
                })

        return jsonify(convert_to_native({
            "success": True,
            "faceCount": len(detections),
            "threshold": FACE_MATCH_THRESHOLD,
            "faces": face_analyses
        }))

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # Pre-load model
    print("Pre-loading DeepFace model...")
    try:
        dummy_img = np.zeros((224, 224, 3), dtype=np.uint8)
        dummy_img[50:174, 50:174] = 128
        DeepFace.represent(
            img_path=dummy_img,
            model_name=MODEL_NAME,
            detector_backend=DETECTOR_BACKEND,
            enforce_detection=False
        )
        print(f"Model {MODEL_NAME} loaded successfully")
    except Exception as e:
        print(f"Model pre-load note: {e}")

    port = int(os.environ.get("PORT", 7860))  # Hugging Face uses 7860
    print(f"Starting DeepFace service on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False)
