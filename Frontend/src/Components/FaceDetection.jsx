import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import * as faceapi from "face-api.js";

const FaceDetection = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [knownFaces, setKnownFaces] = useState([]);
  const [matchedName, setMatchedName] = useState("");
  const intervalRef = useRef(null);
  const location = useLocation(); // 👈 track route changes

  // Load models
  const loadModels = async () => {
    const MODEL_URL = "/models";
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    await loadKnownFaces();
    startVideo();
  };

  // Load stored student images & descriptors
  const loadKnownFaces = async () => {
    const res = await fetch("http://localhost:5000/enroll");
    const students = await res.json();

    const labeledDescriptors = await Promise.all(
      students.map(async (s) => {
        const imgUrl = `http://localhost:5000/uploads/${s.image}`;
        const img = await faceapi.fetchImage(imgUrl);
        const detections = await faceapi
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detections) return null;
        return new faceapi.LabeledFaceDescriptors(s.name, [detections.descriptor]);
      })
    );

    setKnownFaces(labeledDescriptors.filter(Boolean));
  };

  // Start webcam
  const startVideo = () => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        videoRef.current.srcObject = stream;
      })
      .catch((err) => console.error("Camera error:", err));
  };

  // Compare faces continuously
  const handleVideoPlay = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);

    const faceMatcher = new faceapi.FaceMatcher(knownFaces, 0.5);

    intervalRef.current = setInterval(async () => {
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      const resized = faceapi.resizeResults(detections, displaySize);
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

      resized.forEach((d) => {
        const bestMatch = faceMatcher.findBestMatch(d.descriptor);
        setMatchedName(bestMatch.toString());
        const box = d.detection.box;
        const drawBox = new faceapi.draw.DrawBox(box, {
          label: bestMatch.toString(),
        });
        drawBox.draw(canvas);
      });
    }, 500);
  };

  // ✅ Stop camera and detection loop
  const stopCamera = () => {
    console.log("🧹 Stopping camera & clearing interval...");
    if (intervalRef.current) clearInterval(intervalRef.current);
    const video = videoRef.current;
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }
  };

  // Load models initially
  useEffect(() => {
    loadModels();
    return stopCamera; // cleanup on unmount
  }, []);

  // 👇 Detect route change & stop camera when leaving /facedetection
  useEffect(() => {
    if (location.pathname !== "/facedetection") {
      stopCamera();
    }
  }, [location]);

  return (
    <div style={{ textAlign: "center" }}>
      <h2>🧠 Face Recognition</h2>
      <video
        ref={videoRef}
        autoPlay
        muted
        width="640"
        height="480"
        onPlay={handleVideoPlay}
        style={{ borderRadius: "10px" }}
      />
      <canvas
        ref={canvasRef}
        width="640"
        height="480"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          margin: "auto",
        }}
      />
      <h3 style={{ marginTop: "10px" }}>
        {matchedName ? `✅ ${matchedName}` : "Looking for faces..."}
      </h3>
    </div>
  );
};

export default FaceDetection;

export const stopFaceDetectionCamera = () => {
  const videos = document.querySelectorAll("video");
  videos.forEach((video) => {
    if (video.srcObject) {
      video.srcObject.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
  });
  console.log("✅ Camera stopped (manual navigation)");
};

