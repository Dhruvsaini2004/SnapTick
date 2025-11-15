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
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// 'routes' se ek folder bahar (../) jaakar 'face-models' dhoondho
const FACE_MODELS_PATH = path.join(__dirname, '../face-models');

(async () => {
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(FACE_MODELS_PATH); 
    await faceapi.nets.faceLandmark68Net.loadFromDisk(FACE_MODELS_PATH);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(FACE_MODELS_PATH);
    console.log("✅ face-api models loaded for attendance");
})();

// 📸 POST /attendance/upload
router.post("/upload", upload.single("groupPhoto"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No group photo file uploaded." });

        const groupImagePath = req.file.path;
        const students = await Student.find();

        // 👇 --- "Back to Basics" LOGIC --- 👇
        const labeledDescriptors = students
            // Sirf un students ko lein jinke paas 'faceDescriptor' (singular) hai
            .filter(s => s.faceDescriptor && s.faceDescriptor.length > 0) 
            .map(s => {
                // Har student ka 1 (average) descriptor Float32Array mein badlein
                return new faceapi.LabeledFaceDescriptors(s.rollNumber, [new Float32Array(s.faceDescriptor)]);
            });
        // 👆 --- END OF LOGIC --- 👆
        
        if (labeledDescriptors.length === 0) {
            const absoluteImagePathCheck = path.join(__dirname, '../', groupImagePath);
            if (fs.existsSync(absoluteImagePathCheck)) fs.unlinkSync(absoluteImagePathCheck);
            return res.status(400).json({ error: "No students are enrolled with face data." });
        }

        // Hum threshold ko wapas 0.55 par set kar rahe hain
        const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.55); 
        
        const absoluteImagePath = path.join(__dirname, '../', groupImagePath);
        const groupImg = await canvas.loadImage(absoluteImagePath);

        const detections = await faceapi
            .detectAllFaces(groupImg, new faceapi.SsdMobilenetv1Options())
            .withFaceLandmarks()
            .withFaceDescriptors();

        const results = detections.map((d) => faceMatcher.findBestMatch(d.descriptor));
        const markedStudents = [];
        const uniqueRollNumbers = new Set();
        const outCanvas = canvas.createCanvas(groupImg.width, groupImg.height);
        const ctx = outCanvas.getContext('2d');
        ctx.drawImage(groupImg, 0, 0); 

        for (let i = 0; i < results.length; i++) {
            const match = results[i];
            const detection = detections[i];
            const box = detection.detection.box;

            if (match.label !== "unknown") {
                const student = await Student.findOne({ rollNumber: match.label });
                const label = student ? student.name : match.label;
                
                ctx.strokeStyle = '#FF0000'; // Red
                ctx.lineWidth = 3;
                ctx.strokeRect(box.x, box.y, box.width, box.height);

                const fontSize = Math.max(18, Math.round(box.height / 12));
                ctx.font = `${fontSize}px Arial`;
                ctx.fillStyle = '#FF0000';
                const textWidth = ctx.measureText(label).width;
                const padding = fontSize / 4; 
                ctx.fillRect(box.x - (ctx.lineWidth / 2), box.y - (fontSize + padding * 2), textWidth + (padding * 2), fontSize + (padding * 2));
                ctx.fillStyle = 'white';
                ctx.fillText(label, box.x + padding, box.y - padding);

                if (student && !uniqueRollNumbers.has(student.rollNumber)) {
                    await Attendance.create({
                        studentName: student.name,
                        rollNo: student.rollNumber,
                        date: new Date()
                    });
                    markedStudents.push(student.name);
                    uniqueRollNumbers.add(student.rollNumber);
                }
            }
        }

        const newImageName = `marked-${req.file.filename}`;
        const newImageSavePath = path.join(__dirname, '../uploads', newImageName);
        const buffer = outCanvas.toBuffer('image/jpeg');
        fs.writeFileSync(newImageSavePath, buffer);
        
        if (fs.existsSync(absoluteImagePath)) {
            fs.unlinkSync(absoluteImagePath);
        }

        res.json({ 
            success: true, 
            markedStudents,
            markedImageUrl: `http://localhost:5000/uploads/${newImageName}`
        });

    } catch (err) {
        console.error("❌ Attendance error:", err);
        if (req.file && fs.existsSync(path.join(__dirname, '../', req.file.path))) {
            fs.unlinkSync(path.join(__dirname, '../', req.file.path));
        }
        res.status(500).json({ error: "Error processing attendance" });
    }
});


// --- MANUAL ATTENDANCE ROUTES ---

router.get("/", async (req, res) => {
    try {
        const { date } = req.query; 
        if (!date) return res.status(400).json({ error: "Date query parameter is required." });
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        const records = await Attendance.find({ date: { $gte: startDate, $lte: endDate } });
        res.status(200).json(records);
    } catch (error) {
        console.error("❌ Fetching attendance error:", error);
        res.status(500).json({ error: "Failed to fetch attendance records." });
    }
});

router.post("/mark", async (req, res) => {
    try {
        const { rollNumber, name, date } = req.body;
        if (!rollNumber || !name || !date) return res.status(400).json({ error: "rollNumber, name, and date are required." });
        
        const specificDate = new Date(date);
        const startDate = new Date(new Date(specificDate).setHours(0, 0, 0, 0));
        const endDate = new Date(new Date(specificDate).setHours(23, 59, 59, 999));

        const existingRecord = await Attendance.findOne({ rollNo: rollNumber, date: { $gte: startDate, $lte: endDate } });
        if (existingRecord) return res.status(200).json({ message: "Student already marked present.", record: existingRecord });

        const newRecord = new Attendance({ studentName: name, rollNo: rollNumber, date: new Date(date) });
        await newRecord.save();
        res.status(201).json({ message: "Student marked present successfully.", record: newRecord });
    } catch (error) {
        console.error("❌ Manual mark error:", error);
        res.status(500).json({ error: "Failed to mark student." });
    }
});

router.delete("/unmark", async (req, res) => {
    try {
        const { rollNumber, date } = req.body;
        if (!rollNumber || !date) return res.status(400).json({ error: "rollNumber and date are required." });

        const specificDate = new Date(date);
        const startDate = new Date(new Date(specificDate).setHours(0, 0, 0, 0));
        const endDate = new Date(new Date(specificDate).setHours(23, 59, 59, 999));

        const result = await Attendance.findOneAndDelete({ rollNo: rollNumber, date: { $gte: startDate, $lte: endDate } });
        if (!result) return res.status(404).json({ error: "No attendance record found for this student on this date." });

        res.status(200).json({ message: "Student unmarked successfully." });
    } catch (error) {
        console.error("❌ Manual unmark error:", error);
        res.status(500).json({ error: "Failed to unmark student." });
    }
});

module.exports = router;