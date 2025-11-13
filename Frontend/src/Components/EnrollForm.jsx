import React, { useState, useEffect } from "react";

const EnrollForm = () => {
  const [name, setName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [image, setImage] = useState(null);
  const [message, setMessage] = useState("");
  const [students, setStudents] = useState([]);
  const [editing, setEditing] = useState(null); // currently editing student

  // 🔹 Fetch all enrolled students
  const fetchStudents = async () => {
    try {
      const res = await fetch("http://localhost:5000/enroll");
      const data = await res.json();
      setStudents(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // 🔹 Handle enrollment submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("name", name);
    formData.append("rollNumber", rollNumber);
    formData.append("image", image);

    try {
      const res = await fetch("http://localhost:5000/enroll", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setMessage(data.message || "Error occurred");
      setName("");
      setRollNumber("");
      setImage(null);
      fetchStudents();
    } catch (err) {
      console.error(err);
      setMessage("Error occurred");
    }
  };

  // 🔹 Start editing a student
  const startEdit = (student) => {
    setEditing({ ...student, image: null });
  };

  // 🔹 Handle student update
  const handleUpdate = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("name", editing.name);
    formData.append("rollNumber", editing.rollNumber);
    if (editing.image) formData.append("image", editing.image);

    try {
      const res = await fetch(`http://localhost:5000/enroll/${editing._id}`, {
        method: "PUT",
        body: formData,
      });
      const data = await res.json();
      setMessage(data.message || "Error updating student");
      setEditing(null);
      fetchStudents();
    } catch (err) {
      console.error(err);
      setMessage("Error updating student");
    }
  };

  // 🔹 Handle student deletion
  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this student?"
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`http://localhost:5000/enroll/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      setMessage(data.message || "Error deleting student");
      fetchStudents();
    } catch (err) {
      console.error(err);
      setMessage("Error deleting student");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Enroll Student</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <br />
        <br />
        <input
          type="text"
          placeholder="Roll Number"
          value={rollNumber}
          onChange={(e) => setRollNumber(e.target.value)}
          required
        />
        <br />
        <br />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImage(e.target.files[0])}
          required
        />
        <br />
        <br />
        <button type="submit">Enroll</button>
      </form>

      <p>{message}</p>

      <hr />

      <h3>Enrolled Students:</h3>
      <ul>
        {students.map((s) => (
          <li key={s._id} style={{ marginBottom: "20px" }}>
            <strong>{s.name}</strong> ({s.rollNumber}) <br />
            <img
              src={`http://localhost:5000/uploads/${s.image}`}
              alt={s.name}
              width="100"
              style={{ borderRadius: "10px", margin: "10px 0" }}
            />
            <br />
            {/* Edit & Delete Buttons */}
            <button onClick={() => startEdit(s)}>Edit</button>
            <button
              onClick={() => handleDelete(s._id)}
              style={{ marginLeft: "5px" }}
            >
              Delete
            </button>
            {/* Edit Form */}
            {editing && editing._id === s._id && (
              <form onSubmit={handleUpdate} style={{ marginTop: "10px" }}>
                <input
                  type="text"
                  placeholder="Name"
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  required
                />
                <br />
                <br />
                <input
                  type="text"
                  placeholder="Roll Number"
                  value={editing.rollNumber}
                  onChange={(e) =>
                    setEditing({ ...editing, rollNumber: e.target.value })
                  }
                  required
                />
                <br />
                <br />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setEditing({ ...editing, image: e.target.files[0] })
                  }
                />
                <br />
                <br />
                <button type="submit">Update</button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  style={{ marginLeft: "5px" }}
                >
                  Cancel
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default EnrollForm;
