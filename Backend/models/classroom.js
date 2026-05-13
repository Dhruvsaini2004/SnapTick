// Model: Classroom
const mongoose = require("mongoose");

const classroomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: "" },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index to speed up teacher lookups
classroomSchema.index({ teacherId: 1 });

// Prevent duplicate classroom names per teacher
classroomSchema.index({ teacherId: 1, name: 1 }, { unique: true });

// Keep updatedAt current on save
classroomSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Classroom", classroomSchema);
