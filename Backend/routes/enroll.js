// backend/routes/enroll.js
const express = require("express");
const multer = require("multer");
const Student = require("../models/student");

// 👇 --- THESE ARE THE NEW IMPORTS --- 👇
const faceapi = require('face-api.js');
const canvas = require('canvas');
const path = require('path');
const fs = require('fs');

// Monkey patch for face-api.js
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });
// 👆 --- END OF NEW IMPORTS --- 👆

const router = express.Router();

// setup multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// 👇 --- THIS IS THE NEW MODEL LOADER --- 👇
const MODEL_URL = path.join(__dirname, "../models"); // This path is for mongoose models

// 👇 --- THIS IS THE CORRECTED PATH TO YOUR AI MODELS --- 👇
const FACE_MODELS_PATH = path.join(__dirname, '../face-models');

(async () => {
  await faceapi.nets.tinyFaceDetector.loadFromDisk(FACE_MODELS_PATH);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(FACE_MODELS_PATH);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(FACE_MODELS_PATH);
  console.log("✅ face-api models loaded for enrollment");
})();
// 👆 --- END OF MODEL LOADER --- 👆


// route: POST /enroll
// 👇 --- THIS IS THE UPDATED POST ROUTE --- 👇
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { name, rollNumber } = req.body;
    const imagePath = req.file ? req.file.path : ""; // 👈 Use req.file.path

    if (!imagePath) {
      return res.status(400).json({ error: "Image file is required" });
    }

    // 👇 --- START OF NEW LOGIC --- 👇
    // 1. Load the uploaded image
    const img = await canvas.loadImage(imagePath);

    // 2. Detect face and generate descriptor
    const detection = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      // If no face is found, stop and tell the user.
      // We should also delete the uploaded file to avoid clutter.
      fs.unlinkSync(imagePath); // Delete the unusable image
      return res.status(400).json({ error: "No face detected in the image. Please upload a clear photo." });
    }

    const descriptor = detection.descriptor;
    // 👆 --- END OF NEW LOGIC --- 👆

    const student = new Student({
      name,
      rollNumber,
      image: req.file.filename,
      faceDescriptor: Array.from(descriptor) // 👈 THIS IS THE FIX
    });

    await student.save();

    res.status(201).json({ message: "Student enrolled successfully!", student });
  } catch (error) {
    console.error(error);
    // If an error occurs (e.g., duplicate roll number), delete the uploaded image
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: "Failed to enroll student" });
  }
});
// 👆 --- END OF UPDATED POST ROUTE --- 👆


// ✅ route: GET /enroll
// THIS IS YOUR ORIGINAL, GOOD-TO-GO GET ROUTE
router.get("/", async (req, res) => {
  try {
    const students = await Student.find();
    res.status(200).json(students);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

// route: PUT /enroll/:id
// 👇 --- THIS IS THE UPDATED PUT ROUTE --- 👇
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, rollNumber } = req.body;

    // Build updated fields
    const updateData = { name, rollNumber };

    // 👇 --- START OF NEW LOGIC --- 👇
    // If a new image is uploaded, we MUST generate a new descriptor
    if (req.file) {
      const imagePath = req.file.path;
      updateData.image = req.file.filename; // Save new filename

      // 1. Load the new image
      const img = await canvas.loadImage(imagePath);

      // 2. Detect face and generate descriptor
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        // If no face, delete the bad file and stop
        fs.unlinkSync(imagePath);
        return res.status(400).json({ error: "No face detected in the new image." });
      }

      // 3. Add the new descriptor to our update data
      updateData.faceDescriptor = Array.from(detection.descriptor);
    }
    // 👆 --- END OF NEW LOGIC --- 👆

    const updatedStudent = await Student.findByIdAndUpdate(id, updateData, { new: true });

    if (!updatedStudent) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.status(200).json({ message: "Student updated successfully", student: updatedStudent });
  } catch (error) {
    console.error(error);
    // If error, delete the new image if it exists
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: "Failed to update student" });
  }
});
// 👆 --- END OF UPDATED PUT ROUTE --- 👆


// route: DELETE /enroll/:id
// THIS IS YOUR ORIGINAL, GOOD-TO-GO DELETE ROUTE
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const deletedStudent = await Student.findByIdAndDelete(id);

    if (!deletedStudent) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.status(200).json({ message: "Student deleted successfully" });
  } catch (error) {
    console.error("❌ Delete error:", error);
    res.status(500).json({ error: "Failed to delete student" });
  }
});


module.exports = router;