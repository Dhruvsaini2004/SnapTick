// backend/routes/enroll.js
const express = require("express");
const multer = require("multer");
const Student = require("../models/student");
const faceapi = require('face-api.js');
const canvas = require('canvas');
const path = require('path');
const fs = require('fs');

// Monkey patch for face-api.js
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const router = express.Router();
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// 'routes' se ek folder bahar (../) jaakar 'face-models' dhoondho
const FACE_MODELS_PATH = path.join(__dirname, '../face-models');

(async () => {
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(FACE_MODELS_PATH);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(FACE_MODELS_PATH);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(FACE_MODELS_PATH);
    console.log("✅ face-api models loaded for enrollment");
})();


// route: POST /enroll (CREATE)
// Pehli baar enroll karte waqt
router.post("/", upload.single("image"), async (req, res) => {
 try {
    const { name, rollNumber } = req.body;
    const imagePath = req.file ? req.file.path : ""; 
    if (!imagePath) return res.status(400).json({ error: "Image file is required" });

    const absoluteImagePath = path.join(__dirname, '../', imagePath);
    const img = await canvas.loadImage(absoluteImagePath);

    const detection = await faceapi
      .detectSingleFace(img, new faceapi.SsdMobilenetv1Options())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      if (fs.existsSync(absoluteImagePath)) fs.unlinkSync(absoluteImagePath);
      return res.status(400).json({ error: "No face detected in the image." });
    }

    const descriptor = Array.from(detection.descriptor);

    const student = new Student({ 
        name, 
        rollNumber, 
        image: req.file.filename,
        faceDescriptor: descriptor, // Pehla descriptor save karein
        descriptorCount: 1          // Count ko 1 set karein
    });
    
    await student.save();
    res.status(201).json({ message: "Student enrolled successfully!", student });
 } catch (error) {
    console.error(error);
    if (req.file && fs.existsSync(path.join(__dirname, '../', req.file.path))) {
      fs.unlinkSync(path.join(__dirname, '../', req.file.path));
    }
    res.status(500).json({ error: "Failed to enroll student" });
 }
});


// route: PUT /enroll/:id (UPDATE / ADD PHOTO & AVERAGE)
// 👇 --- YEH ROUTE POORI TARAH BADAL GAYA HAI (AVERAGE LOGIC) --- 👇
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, rollNumber } = req.body;

    const student = await Student.findById(id);
    if (!student) {
        return res.status(404).json({ error: "Student not found" });
    }
    student.name = name;
    student.rollNumber = rollNumber;

    if (req.file) {
      const imagePath = req.file.path;
      student.image = req.file.filename; 

      const absoluteImagePath = path.join(__dirname, '../', imagePath);
      const img = await canvas.loadImage(absoluteImagePath);

      const detection = await faceapi
        .detectSingleFace(img, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        if (fs.existsSync(absoluteImagePath)) fs.unlinkSync(absoluteImagePath);
        return res.status(400).json({ error: "No face detected in the new image." });
      }
      
      const newDescriptor = Array.from(detection.descriptor);
      
      // --- YEH HAI NAYA AVERAGE LOGIC ---
      const oldDescriptor = student.faceDescriptor;
      const oldCount = student.descriptorCount || 0;

      if (oldCount === 0 || !oldDescriptor || oldDescriptor.length === 0) {
        // Agar purana data nahi hai, toh ise pehla descriptor maan lein
        student.faceDescriptor = newDescriptor;
        student.descriptorCount = 1;
      } else {
        // Agar purana data hai, toh naya average calculate karein
        const newCount = oldCount + 1;
        const newAverageDescriptor = [];
        
        // Har 128 number ke liye average nikaalein
        for (let i = 0; i < newDescriptor.length; i++) {
          const oldAvgValue = oldDescriptor[i] || 0;
          const newAvg = ((oldAvgValue * oldCount) + newDescriptor[i]) / newCount;
          newAverageDescriptor.push(newAvg);
        }
        
        student.faceDescriptor = newAverageDescriptor;
        student.descriptorCount = newCount;
      }
      // --- END OF AVERAGE LOGIC ---
    }

    const updatedStudent = await student.save();
    res.status(200).json({ message: "Student updated successfully (new photo added)", student: updatedStudent });

  } catch (error) {
    console.error(error);
    if (req.file && fs.existsSync(path.join(__dirname, '../', req.file.path))) {
      fs.unlinkSync(path.join(__dirname, '../', req.file.path));
    }
    res.status(500).json({ error: "Failed to update student" });
  }
});
// 👆 --- YEH ROUTE POORI TARAH BADAL GAYA HAI --- 👆


// ✅ route: GET /enroll (Same hai)
router.get("/", async (req, res) => {
  try {
    const students = await Student.find();
    res.status(200).json(students);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

// route: DELETE /enroll/:id (Same hai)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedStudent = await Student.findByIdAndDelete(id);
    if (!deletedStudent) return res.status(404).json({ error: "Student not found" });
    res.status(200).json({ message: "Student deleted successfully" });
  } catch (error) {
    console.error("❌ Delete error:", error);
    res.status(500).json({ error: "Failed to delete student" });
  }
});

module.exports = router;