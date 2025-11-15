import React, { useState, useEffect } from "react"; // 👈 useMemo ko yahaan se hata diya hai

// Helper function jo aaj ki date ko YYYY-MM-DD format mein deta hai
const getTodayDateString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0"); // January is 0!
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const ManualAttendance = () => {
  // 👇 --- NAYI STATE LOGIC --- 👇
  // Yeh hamara naya "single source of truth" hai
  // Ismein sabhi students aur unka 'isPresent' status hoga
  const [studentListWithStatus, setStudentListWithStatus] = useState([]);
  // 👆 --- END NAYI STATE LOGIC --- 👆

  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // 👇 --- NAYI DATA FETCHING LOGIC --- 👇
  // Yeh effect ab [selectedDate] par depend karega
  // Yeh 'allStudents' aur 'attendanceRecords' dono ko fetch karega aur merge karega
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setMessage("");
      try {
        // 1. Sabhi students ko fetch karein (cache-buster ke saath)
        const studentsRes = await fetch(
          `http://localhost:5000/enroll?t=${new Date().getTime()}`
        );
        if (!studentsRes.ok) throw new Error("Failed to fetch students");
        const allStudents = await studentsRes.json();

        // 2. Us date ke attendance records fetch karein (cache-buster ke saath)
        const attendanceRes = await fetch(
          `http://localhost:5000/attendance?date=${selectedDate}&t=${new Date().getTime()}`
        );
        if (!attendanceRes.ok) throw new Error("Failed to fetch attendance");
        const attendanceRecords = await attendanceRes.json();

        // 3. Data ko merge karein
        const presentRollNumbers = new Set(
          attendanceRecords.map((record) => record.rollNo)
        );
        const mergedList = allStudents.map((student) => ({
          ...student,
          isPresent: presentRollNumbers.has(student.rollNumber),
        }));

        // 4. Naya "single source of truth" set karein
        setStudentListWithStatus(mergedList);
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setMessage(`Error: ${err.message}`);
      }
      setLoading(false);
    };

    fetchData();
  }, [selectedDate]); // Yeh tab run hoga jab 'selectedDate' change hogi
  // 👆 --- END NAYI DATA FETCHING LOGIC --- 👆

  // 👇 --- NAYA TOGGLE LOGIC (OPTIMISTIC UI) --- 👇
  const toggleAttendance = async (studentToToggle) => {
    const { rollNumber, name, isPresent } = studentToToggle;

    // 1. Optimistic UI Update: UI ko *turant* update karein
    // Hum maan lete hain ki API call success hogi
    setStudentListWithStatus((currentList) =>
      currentList.map((student) =>
        student.rollNumber === rollNumber
          ? { ...student, isPresent: !student.isPresent } // Status ko flip karein
          : student
      )
    );

    // Message ko bhi turant update karein
    setMessage(
      `Student ${name} marked ${isPresent ? "Absent" : "Present"} successfully.`
    );

    // 2. Ab API call ko background mein karein
    try {
      const apiDate = selectedDate;
      let res;
      if (isPresent) {
        // Agar pehle 'Present' tha, toh UNMARK (DELETE) karein
        res = await fetch("http://localhost:5000/attendance/unmark", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rollNumber: rollNumber, date: apiDate }),
        });
      } else {
        // Agar pehle 'Absent' tha, toh MARK (POST) karein
        res = await fetch("http://localhost:5000/attendance/mark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rollNumber: rollNumber,
            name: name,
            date: apiDate,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        // Agar API fail hoti hai, toh Error throw karein
        throw new Error(data.error || "API call failed");
      }

      // Success! Kuch karne ki zaroorat nahi hai, UI pehle hi update ho chuka hai.
    } catch (err) {
      // 3. Rollback: Agar API fail hoti hai
      console.error("Failed to toggle attendance:", err);
      setMessage(`Error: Failed to mark ${name}. Please try again.`);

      // UI ko purani state par wapas set karein
      setStudentListWithStatus((currentList) =>
        currentList.map((student) =>
          student.rollNumber === rollNumber
            ? { ...student, isPresent: isPresent } // Purana status wapas laayein
            : student
        )
      );
    }
  };
  // 👆 --- END NAYA TOGGLE LOGIC --- 👆

  return (
    <div style={{ padding: "20px" }}>
      <h2>Manual Attendance Sheet</h2>

      {/* Date Picker */}
      <div style={{ margin: "20px 0" }}>
        <label
          htmlFor="attendance-date"
          style={{ marginRight: "10px", fontSize: "1.1em" }}
        >
          Select Date:
        </label>
        <input
          type="date"
          id="attendance-date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{ padding: "8px", fontSize: "1em" }}
        />
      </div>

      {message && <p style={{ color: "blue" }}>{message}</p>}

      {/* Students ki Table */}
      {loading ? (
        <p>Loading data...</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "20px",
          }}
        >
          <thead>
            <tr style={{ background: "#f0f0f0" }}>
              <th style={tableCellStyle}>Name</th>
              <th style={tableCellStyle}>Roll Number</th>
              <th style={tableCellStyle}>Status</th>
              <th style={tableCellStyle}>Action</th>
            </tr>
          </thead>
          <tbody>
            {studentListWithStatus.map((student) => (
              <tr key={student._id} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={tableCellStyle}>{student.name}</td>
                <td style={tableCellStyle}>{student.rollNumber}</td>
                <td style={tableCellStyle}>
                  {student.isPresent ? (
                    <span style={{ color: "green", fontWeight: "bold" }}>
                      Present
                    </span>
                  ) : (
                    <span style={{ color: "red" }}>Absent</span>
                  )}
                </td>
                <td style={tableCellStyle}>
                  <button
                    onClick={() => toggleAttendance(student)}
                    style={
                      student.isPresent ? absentButtonStyle : presentButtonStyle
                    }
                  >
                    {student.isPresent ? "Mark Absent" : "Mark Present"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

// CSS Styles (inline)
const tableCellStyle = {
  padding: "12px 15px",
  textAlign: "left",
};

const baseButtonStyle = {
  padding: "8px 12px",
  border: "none",
  borderRadius: "5px",
  color: "white",
  cursor: "pointer",
  fontSize: "0.9em",
};

const presentButtonStyle = {
  ...baseButtonStyle,
  background: "#28a745", // Green
};

const absentButtonStyle = {
  ...baseButtonStyle,
  background: "#dc3545", // Red
};

export default ManualAttendance;
