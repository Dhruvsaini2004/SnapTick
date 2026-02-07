"""
DeepFace Flask Microservice for Face Detection and Recognition
Runs on port 5001 and provides APIs for:
- Extracting face embeddings from images
- Detecting multiple faces in group photos
- Verifying/matching faces

MODELS USED:
- Recognition: ArcFace (512-dim embeddings, best accuracy with angular margin loss)
- Detection: RetinaFace (5-point landmark alignment, handles angles/lighting)

NOTE: Students enrolled with older models (Facenet512, face-api.js) must be re-enrolled!
"""

import os
# Enable GPU and optimize TensorFlow BEFORE importing
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"  # Suppress TF warnings
os.environ["CUDA_VISIBLE_DEVICES"] = "0"  # Use first GPU
# Enable deterministic operations for consistent results
os.environ["TF_DETERMINISTIC_OPS"] = "1"
os.environ["TF_CUDNN_DETERMINISTIC"] = "1"

from flask import Flask, request, jsonify
from deepface import DeepFace
import numpy as np
import cv2
import base64
import traceback

# Check GPU availability and enable deterministic mode
try:
    import tensorflow as tf
    # Enable deterministic behavior for reproducible results
    tf.config.experimental.enable_op_determinism()
    gpus = tf.config.list_physical_devices('GPU')
    if gpus:
        print(f"GPU detected: {gpus}")
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
    else:
        print("No GPU detected, using CPU (RetinaFace may be slow)")
    print("TensorFlow deterministic mode enabled for consistent results")
except Exception as e:
    print(f"GPU/deterministic setup note: {e}")

app = Flask(__name__)

# =============================================================================
# MODEL CONFIGURATION - ArcFace + RetinaFace (Industry Standard)
# =============================================================================
# ArcFace: Uses Angular Margin Loss for better discrimination between similar faces
# RetinaFace: 5-point landmark detection for proper face alignment before recognition
MODEL_NAME = "ArcFace"
DETECTOR_BACKEND = os.environ.get("DETECTOR_BACKEND", "retinaface")
DISTANCE_METRIC = "cosine"

# Threshold for ArcFace with cosine distance
# ArcFace embeddings: same person usually 0.0 - 0.55, different person 0.6+
# DeepFace default for ArcFace+cosine is 0.68
# 
# TUNING: 0.60 gives good balance for most classroom scenarios
FACE_MATCH_THRESHOLD = 0.60  # Balanced threshold
FACE_MATCH_GAP = 0.05  # Require clear separation to avoid matching wrong person

print(f"DeepFace Service starting with model: {MODEL_NAME}, detector: {DETECTOR_BACKEND}")
print(f"Thresholds: match <= {FACE_MATCH_THRESHOLD}, max gap >= {FACE_MATCH_GAP}")
print(f"Using adaptive gap: confident matches need less gap, borderline matches need more")


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


def load_image_from_path(image_path, for_group_photo=False):
    """Load image from file path. For group photos, keep original size for accurate bounding boxes."""
    # Handle Windows path separators that may come from Node.js
    image_path = image_path.replace("\\", "/") if image_path else image_path
    
    # Log the path for debugging
    print(f"[DEBUG] Attempting to load image from: {image_path}")
    
    if not os.path.exists(image_path):
        # Try to resolve relative paths from the uploads directory
        uploads_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
        alt_path = os.path.join(uploads_dir, os.path.basename(image_path))
        print(f"[DEBUG] Path not found, trying alternative: {alt_path}")
        
        if os.path.exists(alt_path):
            image_path = alt_path
        else:
            raise FileNotFoundError(f"Image not found: {image_path} (also tried: {alt_path})")
    
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not read image: {image_path}")
    
    # Only resize for single face enrollment, NOT for group photos
    if not for_group_photo:
        h, w = img.shape[:2]
        max_dim = 800  # Smaller = faster for enrollment
        if max(h, w) > max_dim:
            scale = max_dim / max(h, w)
            img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
            print(f"[DEBUG] Resized image from {w}x{h} to {img.shape[1]}x{img.shape[0]}")
    
    return img


def load_image_from_base64(base64_string):
    """Load image from base64 string"""
    img_data = base64.b64decode(base64_string)
    nparr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode base64 image")
    return img  # Return original, preprocess only for detection


def preprocess_for_detection(img):
    """Preprocess image to improve face detection in challenging conditions.
    Applies adaptive enhancement based on image brightness."""
    original_h, original_w = img.shape[:2]
    scale = 1.0
    
    # Resize if too large (saves memory and speeds up processing)
    # Keep larger for group photos to maintain face detail
    max_dim = 1600
    if max(original_h, original_w) > max_dim:
        scale = max_dim / max(original_h, original_w)
        img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        print(f"[DEBUG] Resized group photo from {original_w}x{original_h} to {img.shape[1]}x{img.shape[0]}")
    
    # Check if image needs enhancement (low brightness)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    mean_brightness = np.mean(gray)
    std_brightness = np.std(gray)
    
    print(f"[DEBUG] Image brightness: mean={mean_brightness:.1f}, std={std_brightness:.1f}")
    
    # Apply CLAHE for dark or low-contrast images
    if mean_brightness < 100 or std_brightness < 40:
        # Convert to LAB color space for processing
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        
        # Adaptive CLAHE based on darkness level
        if mean_brightness < 60:
            clip_limit = 4.0  # Very dark - aggressive enhancement
        elif mean_brightness < 80:
            clip_limit = 3.0  # Dark
        else:
            clip_limit = 2.0  # Slightly dark
        
        clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(8, 8))
        l = clahe.apply(l)
        
        # Merge and convert back
        lab = cv2.merge([l, a, b])
        img = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        print(f"[DEBUG] Applied CLAHE with clip_limit={clip_limit} (brightness was {mean_brightness:.1f})")
    
    return img, scale


def detect_faces_robust(img, model_name, detector_backend):
    """
    Detect faces with multiple strategies for better recall.
    Tries different approaches to maximize face detection.
    """
    all_detections = []
    seen_faces = set()  # Track detected face regions to avoid duplicates
    
    def face_key(fa):
        """Create a key for deduplicating faces based on position"""
        x, y, w, h = fa.get("x", 0), fa.get("y", 0), fa.get("w", 0), fa.get("h", 0)
        # Round to nearest 50 pixels to group nearby detections
        return (x // 50, y // 50)
    
    # Strategy 1: Standard detection
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
        print(f"[DEBUG] Strategy 1 (standard): Found {len(detections)} faces")
    except Exception as e:
        print(f"[DEBUG] Strategy 1 failed: {e}")
    
    # Strategy 2: Try with upscaled image if few faces found and image is large enough
    h, w = img.shape[:2]
    if len(all_detections) < 3 and max(h, w) < 1200:
        try:
            # Upscale by 1.5x to help detect smaller faces
            upscaled = cv2.resize(img, None, fx=1.5, fy=1.5, interpolation=cv2.INTER_CUBIC)
            detections = DeepFace.represent(
                img_path=upscaled,
                model_name=model_name,
                detector_backend=detector_backend,
                enforce_detection=False,
                align=True
            )
            # Scale facial areas back to original size
            for det in detections:
                if "facial_area" in det:
                    fa = det["facial_area"]
                    det["facial_area"] = {
                        "x": int(fa.get("x", 0) / 1.5),
                        "y": int(fa.get("y", 0) / 1.5),
                        "w": int(fa.get("w", 0) / 1.5),
                        "h": int(fa.get("h", 0) / 1.5)
                    }
                key = face_key(det.get("facial_area", {}))
                if key not in seen_faces:
                    seen_faces.add(key)
                    all_detections.append(det)
            print(f"[DEBUG] Strategy 2 (upscaled): Found {len(detections)} additional faces")
        except Exception as e:
            print(f"[DEBUG] Strategy 2 failed: {e}")
    
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


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "ok", "model": MODEL_NAME, "detector": DETECTOR_BACKEND})


@app.route("/extract-embedding", methods=["POST"])
def extract_embedding():
    """
    Extract face embedding from a single image.
    Expects JSON with either 'image_path' or 'image_base64'
    Returns the face embedding as a list of floats
    """
    try:
        data = request.get_json()
        
        if "image_path" in data:
            img = load_image_from_path(data["image_path"])
        elif "image_base64" in data:
            img = load_image_from_base64(data["image_base64"])
        else:
            return jsonify({"error": "Either 'image_path' or 'image_base64' is required"}), 400

        # Extract embedding using DeepFace
        embeddings = DeepFace.represent(
            img_path=img,
            model_name=MODEL_NAME,
            detector_backend=DETECTOR_BACKEND,
            enforce_detection=True,
            align=True
        )

        if not embeddings or len(embeddings) == 0:
            return jsonify({"error": "No face detected in the image"}), 400

        # Return the first face's embedding
        embedding = embeddings[0]["embedding"]
        facial_area = embeddings[0].get("facial_area", {})

        response = {
            "success": True,
            "embedding": embedding,
            "embedding_size": len(embedding),
            "facial_area": facial_area,
            "model": MODEL_NAME
        }
        return jsonify(convert_to_native(response))

    except ValueError as e:
        if "Face could not be detected" in str(e):
            return jsonify({"error": "No face detected in the image"}), 400
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/detect-faces", methods=["POST"])
def detect_faces():
    """
    Detect all faces in an image and extract their embeddings.
    Expects JSON with either 'image_path' or 'image_base64'
    Returns list of face embeddings with bounding boxes
    """
    try:
        data = request.get_json()
        
        if "image_path" in data:
            img = load_image_from_path(data["image_path"])
        elif "image_base64" in data:
            img = load_image_from_base64(data["image_base64"])
        else:
            return jsonify({"error": "Either 'image_path' or 'image_base64' is required"}), 400

        # Extract all face embeddings
        embeddings = DeepFace.represent(
            img_path=img,
            model_name=MODEL_NAME,
            detector_backend=DETECTOR_BACKEND,
            enforce_detection=False,  # Don't fail if no faces
            align=True
        )

        faces = []
        for emb in embeddings:
            faces.append({
                "embedding": emb["embedding"],
                "facial_area": emb.get("facial_area", {}),
                "confidence": emb.get("face_confidence", 0)
            })

        response = {
            "success": True,
            "faces": faces,
            "face_count": len(faces),
            "model": MODEL_NAME
        }
        return jsonify(convert_to_native(response))

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/match-faces", methods=["POST"])
def match_faces():
    """
    Match detected faces against enrolled face descriptors.
    Expects JSON with:
    - 'image_path' or 'image_base64': The group photo
    - 'enrolled_faces': List of {rollNumber, descriptors: [[...]]}
    Returns matched faces with roll numbers and bounding boxes
    """
    try:
        data = request.get_json()
        
        if "image_path" in data:
            img = load_image_from_path(data["image_path"], for_group_photo=True)
        elif "image_base64" in data:
            img = load_image_from_base64(data["image_base64"])
        else:
            return jsonify({"error": "Either 'image_path' or 'image_base64' is required"}), 400

        enrolled_faces = data.get("enrolled_faces", [])
        if not enrolled_faces:
            return jsonify({"error": "No enrolled faces provided"}), 400

        # Preprocess image for better detection
        processed_img, scale = preprocess_for_detection(img)

        # Use robust detection with multiple strategies for group photos
        detections = detect_faces_robust(processed_img, MODEL_NAME, DETECTOR_BACKEND)

        if not detections:
            return jsonify({
                "success": True,
                "matches": [],
                "face_count": 0,
                "message": "No faces detected in the image"
            })

        # Sort detections by position (top-to-bottom, left-to-right) for consistent ordering
        # This eliminates inconsistency from random detection order
        def get_face_position(det):
            fa = det.get("facial_area", {})
            return (fa.get("y", 0), fa.get("x", 0))
        
        detections = sorted(detections, key=get_face_position)
        print(f"[DEBUG] Detected {len(detections)} faces, sorted by position")
        
        # Log enrolled faces info for debugging
        dimension_mismatches = []
        for enrolled in enrolled_faces:
            desc_count = len(enrolled.get("descriptors", []))
            desc_dims = [len(d) for d in enrolled.get("descriptors", [])]
            print(f"[DEBUG] Enrolled: {enrolled['rollNumber']} with {desc_count} descriptors, dims={desc_dims}")
            # Check for potential dimension mismatches (ArcFace uses 512)
            for dim in desc_dims:
                if dim != 512:
                    dimension_mismatches.append((enrolled['rollNumber'], dim))
        
        if dimension_mismatches:
            print(f"[WARN] Found {len(dimension_mismatches)} enrolled faces with non-512-dim embeddings!")
            print(f"[WARN] These students need to be re-enrolled: {[r[0] for r in dimension_mismatches]}")
            print(f"[WARN] Use POST /enroll/re-embed to update all embeddings with current model")

        # Match each detected face against enrolled faces
        def find_best_match(embedding, face_index):
            best = {"label": "unknown", "distance": float("inf")}
            second_best = {"label": "unknown", "distance": float("inf")}
            embedding_np = np.array(embedding)
            embedding_dim = len(embedding)
            
            # Track all candidates for debugging
            all_candidates = []
            
            # For each enrolled person, find their BEST (minimum) distance
            person_distances = {}

            for enrolled in enrolled_faces:
                roll_number = enrolled["rollNumber"]
                descriptors = enrolled.get("descriptors", [])
                
                min_distance = float("inf")
                for desc in descriptors:
                    # Check for dimension mismatch (e.g., old 128-dim vs new 512-dim)
                    if len(desc) != embedding_dim:
                        print(f"[WARN] Dimension mismatch for {roll_number}: enrolled={len(desc)}, detected={embedding_dim}")
                        continue
                    
                    desc_np = np.array(desc)
                    # Cosine similarity -> distance
                    cos_sim = np.dot(embedding_np, desc_np) / (np.linalg.norm(embedding_np) * np.linalg.norm(desc_np))
                    distance = 1 - cos_sim
                    
                    if distance < min_distance:
                        min_distance = distance
                
                if min_distance < float("inf"):
                    person_distances[roll_number] = float(min_distance)
                    all_candidates.append({"label": roll_number, "distance": float(min_distance)})
            
            # Sort candidates by distance
            all_candidates.sort(key=lambda x: x["distance"])
            
            # Get best and second best
            if len(all_candidates) >= 1:
                best = all_candidates[0]
            if len(all_candidates) >= 2:
                second_best = all_candidates[1]
            
            # Log top candidates for debugging
            top_candidates = [(c['label'], round(c['distance'], 3)) for c in all_candidates[:5]]
            print(f"[DEBUG] Face #{face_index} candidates: {top_candidates}")

            # Check if match is confident enough
            # Key insight: if someone is NOT enrolled, they may still have a "best match"
            # but the distance will be high AND gap to second-best will be small
            gap = second_best["distance"] - best["distance"]
            
            # Adaptive gap based on confidence level
            if best["distance"] <= 0.35:
                # Very confident - definitely the same person
                required_gap = 0.01
            elif best["distance"] <= 0.45:
                # Confident match
                required_gap = 0.02
            elif best["distance"] <= 0.55:
                # Good match but need some separation
                required_gap = 0.03
            else:
                # Borderline - require clear separation to avoid false positives
                required_gap = FACE_MATCH_GAP
            
            is_match = bool(
                best["distance"] <= FACE_MATCH_THRESHOLD and
                gap >= required_gap
            )
            
            # Log match details for debugging borderline cases
            status = "MATCH" if is_match else "REJECTED"
            reason = ""
            if not is_match:
                if best["distance"] > FACE_MATCH_THRESHOLD:
                    reason = f"(dist {best['distance']:.3f} > threshold {FACE_MATCH_THRESHOLD})"
                elif gap < required_gap:
                    reason = f"(gap {gap:.3f} < required {required_gap:.3f})"
            print(f"[DEBUG] Face -> {best['label']}: dist={best['distance']:.3f}, gap={gap:.3f}, req_gap={required_gap:.3f} | {status} {reason}")

            return {
                "label": best["label"] if is_match else "unknown",
                "distance": float(best["distance"]),
                "is_match": is_match
            }

        # Process all detections
        results = []
        label_winners = {}

        for i, detection in enumerate(detections):
            embedding = detection["embedding"]
            facial_area = detection.get("facial_area", {})
            # Scale bounding box back to original image size
            facial_area = scale_facial_area(facial_area, scale)
            match = find_best_match(embedding, i)

            results.append({
                "index": i,
                "facial_area": facial_area,
                "match": match
            })

            # Track best match for each label (to handle duplicates)
            if match["is_match"] and match["label"] != "unknown":
                label = match["label"]
                if label not in label_winners or match["distance"] < label_winners[label]["distance"]:
                    label_winners[label] = {"index": i, "distance": match["distance"]}

        # Build final matches list
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

        response = {
            "success": True,
            "matches": matches,
            "face_count": len(detections),
            "recognized_count": len(label_winners)
        }
        return jsonify(convert_to_native(response))

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/verify", methods=["POST"])
def verify_faces():
    """
    Verify if two faces belong to the same person.
    Expects JSON with:
    - 'image1_path' or 'image1_base64'
    - 'image2_path' or 'image2_base64'
    """
    try:
        data = request.get_json()

        # Load first image
        if "image1_path" in data:
            img1 = data["image1_path"]
        elif "image1_base64" in data:
            img1 = load_image_from_base64(data["image1_base64"])
        else:
            return jsonify({"error": "image1_path or image1_base64 required"}), 400

        # Load second image
        if "image2_path" in data:
            img2 = data["image2_path"]
        elif "image2_base64" in data:
            img2 = load_image_from_base64(data["image2_base64"])
        else:
            return jsonify({"error": "image2_path or image2_base64 required"}), 400

        result = DeepFace.verify(
            img1_path=img1,
            img2_path=img2,
            model_name=MODEL_NAME,
            detector_backend=DETECTOR_BACKEND,
            distance_metric=DISTANCE_METRIC
        )

        response = {
            "success": True,
            "verified": bool(result["verified"]),
            "distance": float(result["distance"]),
            "threshold": float(result["threshold"]),
            "model": result["model"],
            "detector": result["detector_backend"]
        }
        return jsonify(convert_to_native(response))

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/diagnose", methods=["POST"])
def diagnose_matching():
    """
    Diagnostic endpoint to analyze why a face might not be matching.
    Expects JSON with:
    - 'image_path' or 'image_base64': The photo to analyze
    - 'enrolled_faces': List of {rollNumber, name, descriptors: [[...]]}
    Returns detailed matching analysis for each detected face
    """
    try:
        data = request.get_json()
        
        if "image_path" in data:
            img = load_image_from_path(data["image_path"], for_group_photo=True)
        elif "image_base64" in data:
            img = load_image_from_base64(data["image_base64"])
        else:
            return jsonify({"error": "Either 'image_path' or 'image_base64' is required"}), 400

        enrolled_faces = data.get("enrolled_faces", [])
        if not enrolled_faces:
            return jsonify({"error": "No enrolled faces provided"}), 400

        # Preprocess and detect
        processed_img, scale = preprocess_for_detection(img)
        detections = detect_faces_robust(processed_img, MODEL_NAME, DETECTOR_BACKEND)

        if not detections:
            return jsonify({
                "success": True,
                "message": "No faces detected in the image",
                "faces": [],
                "recommendations": ["Try a clearer photo with better lighting"]
            })

        # Analyze each face
        face_analyses = []
        
        for i, detection in enumerate(detections):
            embedding = detection["embedding"]
            embedding_np = np.array(embedding)
            embedding_dim = len(embedding)
            facial_area = detection.get("facial_area", {})
            facial_area = scale_facial_area(facial_area, scale)
            
            # Calculate distances to ALL enrolled faces
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
                    avg_dist = sum(distances_to_person) / len(distances_to_person)
                    all_distances.append({
                        "rollNumber": roll_number,
                        "name": name,
                        "minDistance": round(min_dist, 4),
                        "avgDistance": round(avg_dist, 4),
                        "numDescriptors": len(distances_to_person),
                        "wouldMatch": min_dist <= FACE_MATCH_THRESHOLD
                    })
            
            # Sort by minimum distance
            all_distances.sort(key=lambda x: x["minDistance"])
            
            # Determine match status
            best = all_distances[0] if all_distances else None
            second_best = all_distances[1] if len(all_distances) > 1 else None
            
            if best:
                gap = (second_best["minDistance"] - best["minDistance"]) if second_best else float("inf")
                
                # Apply same logic as matching
                if best["minDistance"] <= 0.35:
                    required_gap = 0.01
                elif best["minDistance"] <= 0.45:
                    required_gap = 0.02
                elif best["minDistance"] <= 0.55:
                    required_gap = 0.03
                else:
                    required_gap = FACE_MATCH_GAP
                
                is_match = best["minDistance"] <= FACE_MATCH_THRESHOLD and gap >= required_gap
                
                # Generate recommendations
                recommendations = []
                if not is_match:
                    if best["minDistance"] > FACE_MATCH_THRESHOLD:
                        recommendations.append(f"Distance {best['minDistance']:.3f} exceeds threshold {FACE_MATCH_THRESHOLD}")
                        recommendations.append(f"Consider re-enrolling {best['name']} with a photo similar to how they appear here")
                        if best["numDescriptors"] < 3:
                            recommendations.append(f"{best['name']} only has {best['numDescriptors']} enrollment photo(s). Add more photos with different angles/lighting")
                    elif gap < required_gap:
                        recommendations.append(f"Gap between top matches ({gap:.3f}) is too small (need {required_gap:.3f})")
                        recommendations.append("The face is too similar to multiple enrolled people")
                
                face_analyses.append({
                    "faceIndex": i,
                    "facialArea": facial_area,
                    "bestMatch": best,
                    "secondBestMatch": second_best,
                    "gap": round(gap, 4),
                    "requiredGap": required_gap,
                    "isMatch": is_match,
                    "matchedTo": best["name"] if is_match else "Unknown",
                    "allCandidates": all_distances[:5],  # Top 5
                    "recommendations": recommendations
                })
            else:
                face_analyses.append({
                    "faceIndex": i,
                    "facialArea": facial_area,
                    "bestMatch": None,
                    "isMatch": False,
                    "matchedTo": "Unknown",
                    "recommendations": ["No valid enrolled faces to compare against"]
                })

        response = {
            "success": True,
            "faceCount": len(detections),
            "threshold": FACE_MATCH_THRESHOLD,
            "maxGap": FACE_MATCH_GAP,
            "faces": face_analyses
        }
        return jsonify(convert_to_native(response))

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # Pre-load the model on startup
    print("Pre-loading DeepFace model...")
    try:
        # Create a dummy image to trigger model loading
        dummy_img = np.zeros((224, 224, 3), dtype=np.uint8)
        dummy_img[50:174, 50:174] = 128  # Add some content
        DeepFace.represent(
            img_path=dummy_img,
            model_name=MODEL_NAME,
            detector_backend=DETECTOR_BACKEND,
            enforce_detection=False
        )
        print(f"Model {MODEL_NAME} loaded successfully")
    except Exception as e:
        print(f"Model pre-load note: {e}")

    print("Starting DeepFace service on port 5001...")
    app.run(host="0.0.0.0", port=5001, debug=False)
