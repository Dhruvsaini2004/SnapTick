// Backend/models/attendance.js
const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
    studentName: String,
    rollNo: String,
    date: { type: Date, default: Date.now },
    lectureId: String, // optional for later use
});

module.exports = mongoose.model("Attendance", attendanceSchema);
