// backend/models/Student.js
const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rollNumber: { type: String, required: true },
  image: { type: String },

  // Face descriptor storage
  faceDescriptors: { type: [[Number]], default: [] },
  faceDescriptor: { type: [Number] },
  descriptorCount: { type: Number, default: 0 },

  // Teacher/Classroom association
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
  classroomId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom", required: true },

  dateAdded: { type: Date, default: Date.now },
});

// Compound unique index: rollNumber is unique per classroom
studentSchema.index({ rollNumber: 1, classroomId: 1 }, { unique: true });

module.exports = mongoose.model("Student", studentSchema);
