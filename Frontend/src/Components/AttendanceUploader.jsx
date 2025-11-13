import React, { useState } from "react";

const AttendanceUploader = () => {
  const [file, setFile] = useState(null);
  const [markedStudents, setMarkedStudents] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    // Clear previous results when a new file is selected
    setMarkedStudents([]);
    setMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setMessage("Please select a photo to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("groupPhoto", file);

    setLoading(true); // Show loading message
    setMessage("Uploading and processing... This may take a moment.");

    try {
      const res = await fetch("http://localhost:5000/attendance/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setLoading(false); // Hide loading message

      if (res.status === 200 && data.success) {
        setMessage("Attendance marked successfully!");
        setMarkedStudents(data.markedStudents || []);
      } else {
        setMessage(data.error || "An error occurred.");
        setMarkedStudents([]);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
      setMessage("Upload failed. Server might be down.");
      setMarkedStudents([]);
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
        <button type_="submit" disabled={loading}>
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
    </div>
  );
};

export default AttendanceUploader;
