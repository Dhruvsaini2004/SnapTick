import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import EnrollForm from "./components/EnrollForm";
import FaceDetection, {
  stopFaceDetectionCamera,
} from "./components/FaceDetection";
// 👇 1. IMPORT THE NEW COMPONENT
import AttendanceUploader from "./components/AttendanceUploader";

function App() {
  return (
    <div style={{ padding: "20px" }}>
            <h1>🎓 Attendance System</h1>     {" "}
      <nav style={{ marginBottom: "20px" }}>
               {" "}
        <Link
          to="/"
          style={{ marginRight: "15px" }}
          onClick={() => stopFaceDetectionCamera()}
        >
                    Home / Enroll        {" "}
        </Link>
        {/* 👇 3. ADD THE NEW LINK */}
        <Link
          to="/attendance"
          style={{ marginRight: "15px" }}
          onClick={() => stopFaceDetectionCamera()}
        >
                    Mark Attendance        {" "}
        </Link>
               {" "}
        <Link to="/facedetection" onClick={() => stopFaceDetectionCamera()}>
                    Real-time (Test)        {" "}
        </Link>
             {" "}
      </nav>
           {" "}
      <Routes>
                <Route path="/" element={<EnrollForm />} />
        {/* 👇 2. ADD THE NEW ROUTE */}
        <Route path="/attendance" element={<AttendanceUploader />} />
                <Route path="/facedetection" element={<FaceDetection />} />     {" "}
      </Routes>
         {" "}
    </div>
  );
}

export default App;
