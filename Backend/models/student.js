// Model: Student
const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rollNumber: { type: String, required: true },
  image: { type: String },

  // Face embeddings (legacy + current formats)
  faceDescriptors: { type: [[Number]], default: [] },
  faceDescriptor: { type: [Number] },
  descriptorCount: { type: Number, default: 0 },

  // Ownership and classroom linkage
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
  classroomId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom", required: true },

  dateAdded: { type: Date, default: Date.now },
});

// Ensure roll numbers are unique within a classroom
studentSchema.index({ rollNumber: 1, classroomId: 1 }, { unique: true });

module.exports = mongoose.model("Student", studentSchema);
