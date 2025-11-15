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
      // Cache-buster add kiya
      const res = await fetch(`http://localhost:5000/enroll?t=${new Date().getTime()}`);
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

    setMessage("Enrolling student..."); // Loading message

    try {
      const res = await fetch("http://localhost:5000/enroll", {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();

      // 👇 --- YEH HAI AAPKA FIX --- 👇
      // Check karein ki response OK (2xx) hai ya nahi
      if (!res.ok) {
        // Agar OK nahi hai (jaise 400 ya 500 error), toh backend ka message dikhayein
        throw new Error(data.error || 'Something went wrong');
      }
      // 👆 --- END OF FIX --- 👆

      setMessage(data.message || "Error occurred");
      setName("");
      setRollNumber("");
      setImage(null);
      e.target.reset(); // Form ko reset karein
      fetchStudents();
    } catch (err) {
      console.error("Backend Error:", err.message);
      // Ab error message ko screen par red color mein dikhayein
      setMessage(`Error: ${err.message}`); 
    }
  };

  // 🔹 Start editing a student
  const startEdit = (student) => {
    // Editing state ko reset karein
    setName("");
    setRollNumber("");
    setImage(null);
    setEditing({ ...student, image: null });
  };

  // 🔹 Handle student update
  const handleUpdate = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("name", editing.name);
    formData.append("rollNumber", editing.rollNumber);
    if (editing.image) formData.append("image", editing.image);

    setMessage("Updating student..."); // Loading message

    try {
      const res = await fetch(`http://localhost:5000/enroll/${editing._id}`, {
        method: "PUT",
        body: formData,
      });
      
      const data = await res.json();

      // 👇 --- YEH HAI AAPKA FIX --- 👇
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }
      // 👆 --- END OF FIX --- 👆

      setMessage(data.message || "Error updating student");
      setEditing(null);
      fetchStudents();
    } catch (err) {
      console.error("Backend Error:", err.message);
      setMessage(`Error: ${err.message}`);
    }
  };

  // 🔹 Handle student deletion
  const handleDelete = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/enroll/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }
      setMessage(data.message || "Error deleting student");
      fetchStudents();
    } catch (err) {
      console.error("Backend Error:", err.message);
      setMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      {/* Naya form, 'editing' state ke upar move ho gaya */}
      {!editing ? (
      <h2>Enroll Student</h2>
      ) : (
      <h2>Update Student: {editing.name}</h2>
      )}

      {/* Ek hi form 'Create' aur 'Update' dono ke liye */}
      <form onSubmit={editing ? handleUpdate : handleSubmit}>
        <input
          type="text"
          placeholder="Name"
          value={editing ? editing.name : name}
          onChange={(e) => editing ? setEditing({ ...editing, name: e.target.value }) : setName(e.target.value)}
          required
        />
        <br />
        <br />
        <input
          type="text"
          placeholder="Roll Number"
          value={editing ? editing.rollNumber : rollNumber}
          onChange={(e) => editing ? setEditing({ ...editing, rollNumber: e.target.value }) : setRollNumber(e.target.value)}
          required
        />
        <br />
        <br />
        <input
          type="file"
          accept="image/*"
          // Form reset karne ke liye
          key={editing ? 'edit-file' : (image ? image.name : 'file-input')} 
          onChange={(e) => editing ? setEditing({ ...editing, image: e.target.files[0] }) : setImage(e.target.files[0])}
          required={!editing} // Update karte waqt image optional hai
        />
        <br />
        <br />
        <button type="submit">{editing ? 'Update Student' : 'Enroll Student'}</button>
        {editing && (
          <button type="button" onClick={() => setEditing(null)} style={{ marginLeft: "10px" }}>
            Cancel Edit
          </button>
        )}
      </form>

      {/* Message ko yahaan dikhayein */}
      {message && (
        <p style={{ color: message.startsWith('Error:') ? 'red' : 'green' }}>
          {message}
        </p>
      )}

      <hr />

      <h3>Enrolled Students:</h3>
      <ul style={{display:"flex",gap:"2vw"}}>
        {students.map((s) => (
          <li key={s._id} style={{ marginBottom: "20px"}}>
            <strong>{s.name}</strong> ({s.rollNumber}) <br />
            {/* 👇 --- YEH HAI AAPKA TYPO FIX --- 👇 */}
            <img
              src={`http://localhost:5000/uploads/${s.image}`}
              alt={s.name}
              width="100"
              style={{ borderRadius: "10px", margin: "10px 0" }}
            />
            <br />
            <button onClick={() => startEdit(s)}>Edit</button>
            {/* 👇 --- YEH HAI AAPKA TYPO FIX --- 👇 */}
            <button
              onClick={() => handleDelete(s._id)}
              style={{ marginLeft: "5px" }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default EnrollForm;