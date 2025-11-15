import React, { useState } from "react";

const AttendanceUploader = () => {
  const [file, setFile] = useState(null);
  const [markedStudents, setMarkedStudents] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [markedImageUrl, setMarkedImageUrl] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMarkedStudents([]);
    setMessage("");
    setMarkedImageUrl("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setMessage("Please select a photo to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("groupPhoto", file);

    setLoading(true);
    setMessage("Uploading and processing... This may take a moment.");
    setMarkedImageUrl("");

    try {
      const res = await fetch("http://localhost:5000/attendance/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setLoading(false);

      if (res.status === 200 && data.success) {
        setMessage("Attendance marked successfully!");
        setMarkedStudents(data.markedStudents || []);

        // 👇 --- THIS IS THE FIX --- 👇
        // Hum URL ke aage time add kar rahe hain taaki browser hamesha nayi image load kare
        setMarkedImageUrl(
          data.markedImageUrl
            ? `${data.markedImageUrl}?t=${new Date().getTime()}`
            : ""
        );
        // 👆 --- END OF FIX --- 👆
      } else {
        setMessage(data.error || "An error occurred.");
        setMarkedStudents([]);
        setMarkedImageUrl("");
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
      setMessage("Upload failed. Server might be down.");
      setMarkedStudents([]);
      setMarkedImageUrl("");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Mark Lecture Attendance</h2>
      <p>Upload a group photo of the class to mark attendance.</p>

      <form onSubmit={handleSubmit}>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Processing..." : "Upload and Mark"}
        </button>
      </form>

      {message && <p>{message}</p>}

      {markedStudents.length > 0 && (
        <div>
          <h3>✅ Students Marked Present:</h3>
          <ul>
            {markedStudents.map((name, index) => (
              <li key={index}>{name}</li>
            ))}
          </ul>
        </div>
      )}

      {markedImageUrl && (
        <div style={{ marginTop: "20px" }}>
          <h3>Result:</h3>
          <img
            src={markedImageUrl}
            alt="Marked attendance"
            style={{
              maxWidth: "600px",
              width: "100%",
              borderRadius: "10px",
              border: "1px solid #ddd",
            }}
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        </div>
      )}
    </div>
  );
};

export default AttendanceUploader;
