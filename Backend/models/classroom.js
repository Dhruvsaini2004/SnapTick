// Backend/models/classroom.js
const mongoose = require("mongoose");

const classroomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: "" },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for fast lookup by teacher
classroomSchema.index({ teacherId: 1 });

// Compound unique: same teacher can't have two classrooms with identical names
classroomSchema.index({ teacherId: 1, name: 1 }, { unique: true });

// Update the updatedAt field on save
classroomSchema.pre("save", function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Classroom", classroomSchema);
