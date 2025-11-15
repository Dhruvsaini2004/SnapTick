import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import EnrollForm from "./components/EnrollForm";
import FaceDetection, {
  stopFaceDetectionCamera,
} from "./components/FaceDetection";
import AttendanceUploader from "./components/AttendanceUploader"; 
import ManualAttendance from "./components/ManualAttendance"; 

function App() {
  return (
    <div style={{ padding: "20px" }}>
      <h1>🎓 Attendance System</h1>
      <nav style={{ marginBottom: "20px" }}>
        <Link
          to="/"
          style={{ marginRight: "15px" }}
          onClick={() => stopFaceDetectionCamera()} 
        >
          Home / Enroll
        </Link>
        <Link
          to="/attendance"
          style={{ marginRight: "15px" }}
          onClick={() => stopFaceDetectionCamera()}
        >
          Mark (Upload)
        </Link>

        {/* 👇 YEH HAI SAHI LINK (BINA FALTU LINE KE) 👇 */}
        <Link
          to="/manual"
          style={{ marginRight: "15px" }}
          onClick={() => stopFaceDetectionCamera()}
        >
          Mark (Manual)
        </Link>

        <Link
          to="/facedetection"
          onClick={() => stopFaceDetectionCamera()}
        >
          Real-time (Test)
        </Link>
      </nav>

      <Routes>
        <Route path="/" element={<EnrollForm />} />
        <Route path="/attendance" element={<AttendanceUploader />} />
        <Route path="/manual" element={<ManualAttendance />} />
        <Route path="/facedetection" element={<FaceDetection />} />
      </Routes>
    </div>
  );
}

export default App;