// Backend/models/attendance.js
const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
    studentName: String,
    rollNo: String,
    date: { type: Date, default: Date.now },
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom", required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
});

// Unique: one attendance record per student per classroom per day
attendanceSchema.index({ rollNo: 1, classroomId: 1, teacherId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
