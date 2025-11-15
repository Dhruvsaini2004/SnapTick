// backend/models/Student.js
const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rollNumber: { type: String, required: true, unique: true },
  image: { type: String }, // Yeh "latest photo" dikhayega

  // 👇 --- YEH HAI NAYA SCHEMA --- 👇
  // Wapas 'faceDescriptor' (singular) par aa gaye
  faceDescriptor: { type: [Number] }, 
  // Yeh count karega ki yeh kitni photos ka average hai
  descriptorCount: { type: Number, default: 0 },
  // 👆 --- END OF CHANGE --- 👆

  dateAdded: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Student", studentSchema);