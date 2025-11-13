// backend/models/Student.js
const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rollNumber: { type: String, required: true, unique: true },
  image: { type: String }, // filename or image URL

  // 👇 THIS IS THE NEW LINE WE ARE ADDING
  faceDescriptor: { type: [Number] }, // Stores the 128-point face data

  dateAdded: { type: Date, default: Date.Now },
});

module.exports = mongoose.model("Student", studentSchema);