// Backend/routes/attendance.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const faceapi = require('face-api.js');
const canvas = require("canvas");
const Attendance = require("../models/attendance");
const Student = require("../models/student");

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

// 🔹 Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// 🔹 Load face-api models on startup
const FACE_MODELS_PATH = path.join(__dirname, '../face-models');

(async () => {
    await faceapi.nets.tinyFaceDetector.loadFromDisk(FACE_MODELS_PATH);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(FACE_MODELS_PATH);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(FACE_MODELS_PATH);
    console.log("✅ face-api models loaded for attendance");
})();

// 📸 POST /attendance/upload
router.post("/upload", upload.single("groupPhoto"), async (req, res) => {
    try {
        // Handle no file uploaded
        if (!req.file) {
            return res.status(400).json({ error: "No group photo file uploaded." });
        }

        const groupImagePath = req.file.path;

        // 1. Load all enrolled students from DB
        const students = await Student.find();

        // 2. Filter for students who HAVE a saved descriptor
        const labeledDescriptors = students
            .filter(s => s.faceDescriptor && s.faceDescriptor.length > 0)
            .map(s => {
                // Convert the simple Array from DB back to a Float32Array
                return new faceapi.LabeledFaceDescriptors(s.rollNumber, [new Float32Array(s.faceDescriptor)])
            });

        if (labeledDescriptors.length === 0) {
            if (fs.existsSync(groupImagePath)) {
                fs.unlinkSync(groupImagePath); // Delete the uploaded photo
            }
            return res.status(400).json({ error: "No students are enrolled with face data. Please enroll students first." });
        }

        const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.5);
        const groupImg = await canvas.loadImage(groupImagePath);

        // Delete the group photo after loading it to save space
        if (fs.existsSync(groupImagePath)) {
            fs.unlinkSync(groupImagePath);
        }

        const detections = await faceapi
            .detectAllFaces(groupImg, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

        const results = detections.map((d) => faceMatcher.findBestMatch(d.descriptor));
        const markedStudents = [];
        const uniqueRollNumbers = new Set(); // To avoid marking the same student twice

        for (const match of results) {
            if (match.label !== "unknown") {

                // Find the student by 'rollNumber'
                const student = await Student.findOne({ rollNumber: match.label });

                if (student && !uniqueRollNumbers.has(student.rollNumber)) {
                    await Attendance.create({
                        studentName: student.name,
                        rollNo: student.rollNumber,
                    });
                    markedStudents.push(student.name);
                    uniqueRollNumbers.add(student.rollNumber);
                }
            }
        }

        res.json({ success: true, markedStudents });
    } catch (err) {
        console.error("❌ Attendance error:", err);
        // If an error happens, we should *still* delete the group photo if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: "Error processing attendance" });
    }
});

module.exports = router;