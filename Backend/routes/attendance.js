// Backend/routes/attendance.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { createCanvas, loadImage } = require("canvas");
const Attendance = require("../models/attendance");
const Student = require("../models/student");
const Classroom = require("../models/classroom");
const { authMiddleware } = require("./auth");

// Use absolute path for uploads directory
const UPLOADS_DIR = path.join(__dirname, '../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Only image files are allowed"));
        }
        cb(null, true);
    },
});

// DeepFace service URL
const DEEPFACE_SERVICE_URL = process.env.DEEPFACE_URL || "http://localhost:5001";

// Maximum number of training samples (embeddings) per student
// This prevents database bloat and keeps matching efficient
const MAX_TRAINING_SAMPLES = 10;

console.log("DeepFace attendance route initialized (using service at " + DEEPFACE_SERVICE_URL + ")");

/**
 * Clean up old marked images to prevent storage bloat
 * Deletes marked-*.jpg files older than the specified age
 */
function cleanupOldMarkedImages(maxAgeMinutes = 30) {
    try {
        const files = fs.readdirSync(UPLOADS_DIR);
        const now = Date.now();
        let deletedCount = 0;

        for (const file of files) {
            if (file.startsWith("marked-")) {
                const filePath = path.join(UPLOADS_DIR, file);
                const stats = fs.statSync(filePath);
                const ageMinutes = (now - stats.mtimeMs) / (1000 * 60);

                if (ageMinutes > maxAgeMinutes) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            }
        }

        if (deletedCount > 0) {
            console.log(`[Cleanup] Deleted ${deletedCount} old marked image(s)`);
        }
    } catch (err) {
        console.error("[Cleanup] Error cleaning old marked images:", err.message);
    }
}

// Run cleanup on startup and every 30 minutes
cleanupOldMarkedImages();
setInterval(() => cleanupOldMarkedImages(), 30 * 60 * 1000);

/**
 * Call DeepFace service to match faces in a group photo against enrolled faces
 * @param {string} imagePath - Absolute path to the group photo
 * @param {Array} enrolledFaces - Array of {rollNumber, descriptors}
 * @returns {Promise<{matches: Array, face_count: number}>}
 */
async function matchFaces(imagePath, enrolledFaces) {
    // Ensure we have an absolute path
    const absolutePath = path.isAbsolute(imagePath) ? imagePath : path.join(UPLOADS_DIR, imagePath);
    
    console.log(`[DeepFace] Sending image path for matching: ${absolutePath}`);
    
    const response = await fetch(`${DEEPFACE_SERVICE_URL}/match-faces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            image_path: absolutePath,
            enrolled_faces: enrolledFaces
        })
    });

    const data = await response.json();

    if (!response.ok) {
        console.error(`[DeepFace] Error response:`, data);
        throw new Error(data.error || "Failed to match faces");
    }

    return data;
}

/**
 * Verify that the classroom exists and belongs to the teacher
 */
async function verifyClassroom(classroomId, teacherId) {
    if (!classroomId) {
        return { valid: false, error: "classroomId is required" };
    }

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
        return { valid: false, error: "Classroom not found" };
    }

    if (classroom.teacherId.toString() !== teacherId) {
        return { valid: false, error: "You can only manage attendance for your own classrooms" };
    }

    return { valid: true, classroom };
}

// POST /attendance/upload - Upload group photo for attendance detection (requires auth)
// Now returns detections for review instead of marking attendance immediately
router.post("/upload", authMiddleware, upload.single("groupPhoto"), async (req, res) => {
    let absoluteImagePath = "";
    try {
        const teacherId = req.teacher.id;
        const { classroomId } = req.body;

        if (!req.file) return res.status(400).json({ error: "No group photo file uploaded." });

        // Verify classroom
        const classroomCheck = await verifyClassroom(classroomId, teacherId);
        if (!classroomCheck.valid) {
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({ error: classroomCheck.error });
        }

        const groupImagePath = req.file.path;
        
        // Only get students for this classroom
        const students = await Student.find({ classroomId });

        // Prepare enrolled faces for DeepFace service
        const enrolledFaces = students
            .map((s) => {
                const descriptors =
                    s.faceDescriptors && s.faceDescriptors.length > 0
                        ? s.faceDescriptors
                        : s.faceDescriptor
                          ? [s.faceDescriptor]
                          : [];

                if (descriptors.length === 0) return null;
                return { rollNumber: s.rollNumber, descriptors };
            })
            .filter(Boolean);
        
        if (enrolledFaces.length === 0) {
            if (fs.existsSync(groupImagePath)) fs.unlinkSync(groupImagePath);
            return res.status(400).json({ error: "No students are enrolled with face data in this classroom." });
        }

        // groupImagePath is already absolute since we use UPLOADS_DIR
        absoluteImagePath = groupImagePath;

        // Call DeepFace service to match faces
        let matchResult;
        try {
            matchResult = await matchFaces(absoluteImagePath, enrolledFaces);
        } catch (error) {
            if (fs.existsSync(absoluteImagePath)) fs.unlinkSync(absoluteImagePath);
            return res.status(500).json({ error: error.message || "Failed to process faces" });
        }

        // Load image for drawing bounding boxes
        const groupImg = await loadImage(absoluteImagePath);
        const outCanvas = createCanvas(groupImg.width, groupImg.height);
        const ctx = outCanvas.getContext('2d');
        ctx.drawImage(groupImg, 0, 0);

        const studentMap = new Map(
            students.map((student) => [student.rollNumber, student])
        );

        // Build detection results for review
        const detections = [];

        // Process matches from DeepFace service
        for (let i = 0; i < matchResult.matches.length; i++) {
            const match = matchResult.matches[i];
            const facial_area = match.facial_area;
            const box = {
                x: facial_area.x || 0,
                y: facial_area.y || 0,
                width: facial_area.w || 100,
                height: facial_area.h || 100
            };

            const isRecognized = match.is_recognized;
            const rollNumber = match.roll_number;
            const student = isRecognized ? studentMap.get(rollNumber) : null;
            const label = isRecognized && student ? student.name : "Unknown";
            const strokeColor = isRecognized ? "#16a34a" : "#dc2626";

            // Draw bounding box
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x, box.y, box.width, box.height);

            // Draw label
            const fontSize = Math.max(18, Math.round(box.height / 12));
            const padding = Math.max(4, Math.round(fontSize * 0.25));
            ctx.font = `${fontSize}px Arial`;
            const textWidth = ctx.measureText(label).width;
            const textHeight = fontSize + padding * 2;
            const labelX = Math.max(0, Math.min(box.x - (ctx.lineWidth / 2), outCanvas.width - textWidth - padding * 2));
            const labelY = Math.max(0, box.y - textHeight);

            ctx.fillStyle = strokeColor;
            ctx.fillRect(labelX, labelY, textWidth + padding * 2, textHeight);
            ctx.fillStyle = "#ffffff";
            ctx.fillText(label, labelX + padding, labelY + fontSize + (padding / 2));

            // Calculate confidence (invert distance: lower distance = higher confidence)
            // Distance range: 0 (same) to 1+ (different)
            // Confidence: 100% at distance 0, 0% at distance 0.8+
            const confidence = Math.max(0, Math.min(100, Math.round((1 - match.distance / 0.8) * 100)));

            // Add to detections for review
            detections.push({
                faceIndex: i,
                facialArea: box,
                match: {
                    studentId: student ? student._id.toString() : null,
                    name: label,
                    rollNumber: rollNumber !== "unknown" ? rollNumber : null,
                    distance: match.distance,
                    confidence: confidence,
                    status: isRecognized ? "matched" : "unknown"
                },
                embedding: match.embedding // Include embedding for corrections
            });
        }

        // Save the annotated image
        const newImageName = `marked-${req.file.filename}`;
        const newImageSavePath = path.join(UPLOADS_DIR, newImageName);
        const buffer = outCanvas.toBuffer('image/jpeg');
        fs.writeFileSync(newImageSavePath, buffer);
        
        // Clean up original image
        if (fs.existsSync(absoluteImagePath)) {
            fs.unlinkSync(absoluteImagePath);
        }

        // Schedule cleanup of marked image after 10 minutes (extended for review time)
        setTimeout(() => {
            if (fs.existsSync(newImageSavePath)) {
                fs.unlinkSync(newImageSavePath);
                console.log(`[Cleanup] Deleted marked image: ${newImageName}`);
            }
        }, 10 * 60 * 1000);

        // Get enrolled students for correction dropdown
        const enrolledStudents = students.map(s => ({
            _id: s._id.toString(),
            name: s.name,
            rollNumber: s.rollNumber
        }));

        res.json({ 
            success: true,
            reviewMode: true,
            detections,
            markedImageUrl: `http://localhost:5000/uploads/${newImageName}`,
            faceCount: matchResult.face_count,
            recognizedCount: matchResult.recognized_count,
            classroomId,
            classroomName: classroomCheck.classroom.name,
            enrolledStudents
        });

    } catch (err) {
        console.error("Attendance error:", err);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        if (absoluteImagePath && fs.existsSync(absoluteImagePath)) {
            fs.unlinkSync(absoluteImagePath);
        }
        if (err.message === "Only image files are allowed") {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: "Error processing attendance" });
    }
});


// POST /attendance/confirm - Confirm detected faces and mark attendance (requires auth)
// Called after user reviews detections from /upload
router.post("/confirm", authMiddleware, async (req, res) => {
    try {
        const teacherId = req.teacher.id;
        const { classroomId, confirmations } = req.body;

        if (!classroomId) {
            return res.status(400).json({ error: "classroomId is required" });
        }

        if (!confirmations || !Array.isArray(confirmations)) {
            return res.status(400).json({ error: "confirmations array is required" });
        }

        // Verify classroom
        const classroomCheck = await verifyClassroom(classroomId, teacherId);
        if (!classroomCheck.valid) {
            return res.status(400).json({ error: classroomCheck.error });
        }

        // Get current date for attendance
        const now = new Date();
        const startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        const attendanceDate = new Date(startDate);

        // Get existing attendance records for today
        const existingRecords = await Attendance.find({
            date: { $gte: startDate, $lte: endDate },
            teacherId,
            classroomId
        }, "rollNo");
        const existingRollNumbers = new Set(existingRecords.map(r => r.rollNo));

        // Process each confirmation
        const markedStudents = [];
        let trainedCount = 0;
        const uniqueRollNumbers = new Set();

        for (const confirmation of confirmations) {
            const { faceIndex, studentId, action, addToTraining, embedding } = confirmation;

            // Skip faces marked as "skip" (not enrolled)
            if (action === "skip") {
                continue;
            }

            // Must have a studentId for confirm/correct actions
            if (!studentId) {
                continue;
            }

            // Find the student
            const student = await Student.findOne({ _id: studentId, classroomId });
            if (!student) {
                console.log(`[Confirm] Student not found: ${studentId}`);
                continue;
            }

            // Mark attendance (avoid duplicates)
            if (!uniqueRollNumbers.has(student.rollNumber) && !existingRollNumbers.has(student.rollNumber)) {
                try {
                    await Attendance.create({
                        studentName: student.name,
                        rollNo: student.rollNumber,
                        date: attendanceDate,
                        classroomId,
                        teacherId
                    });
                    markedStudents.push({
                        studentName: student.name,
                        rollNo: student.rollNumber
                    });
                    uniqueRollNumbers.add(student.rollNumber);
                    existingRollNumbers.add(student.rollNumber);
                } catch (error) {
                    if (error && error.code === 11000) {
                        // Duplicate - already marked
                        existingRollNumbers.add(student.rollNumber);
                    } else {
                        throw error;
                    }
                }
            }

            // Add embedding to student's training data if requested
            if (addToTraining && embedding && Array.isArray(embedding)) {
                try {
                    // Initialize faceDescriptors array if it doesn't exist
                    if (!student.faceDescriptors) {
                        student.faceDescriptors = [];
                    }
                    
                    // Check if we've hit the training sample limit
                    if (student.faceDescriptors.length >= MAX_TRAINING_SAMPLES) {
                        console.log(`[Confirm] ${student.name} (${student.rollNumber}) has reached max training samples (${MAX_TRAINING_SAMPLES}), skipping`);
                    } else {
                        // Add the new embedding
                        student.faceDescriptors.push(embedding);
                        student.descriptorCount = student.faceDescriptors.length;
                        await student.save();
                        
                        trainedCount++;
                        console.log(`[Confirm] Added training data for ${student.name} (${student.rollNumber}), now has ${student.descriptorCount}/${MAX_TRAINING_SAMPLES} photos`);
                    }
                } catch (error) {
                    console.error(`[Confirm] Failed to add training data for ${student.rollNumber}:`, error.message);
                }
            }
        }

        res.json({
            success: true,
            markedCount: markedStudents.length,
            trainedCount,
            markedStudents,
            message: `Marked attendance for ${markedStudents.length} student(s)${trainedCount > 0 ? `, added ${trainedCount} training sample(s)` : ''}`
        });

    } catch (err) {
        console.error("Confirm attendance error:", err);
        res.status(500).json({ error: "Error confirming attendance" });
    }
});


// --- MANUAL ATTENDANCE ROUTES ---

// GET /attendance - Get attendance records for a classroom
router.get("/", authMiddleware, async (req, res) => {
    try {
        const { date, classroomId } = req.query;
        const teacherId = req.teacher.id;

        if (!date) return res.status(400).json({ error: "Date query parameter is required." });
        if (!classroomId) return res.status(400).json({ error: "classroomId query parameter is required." });

        // Verify classroom belongs to teacher
        const classroomCheck = await verifyClassroom(classroomId, teacherId);
        if (!classroomCheck.valid) {
            return res.status(400).json({ error: classroomCheck.error });
        }
        
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        
        const records = await Attendance.find({ 
            date: { $gte: startDate, $lte: endDate },
            teacherId,
            classroomId
        });
        res.status(200).json(records);
    } catch (error) {
        console.error("Fetching attendance error:", error);
        res.status(500).json({ error: "Failed to fetch attendance records." });
    }
});

// POST /attendance/mark - Mark attendance manually
router.post("/mark", authMiddleware, async (req, res) => {
    try {
        const { rollNumber, name, date, classroomId } = req.body;
        const teacherId = req.teacher.id;

        if (!rollNumber || !name || !date || !classroomId) {
            return res.status(400).json({ error: "rollNumber, name, date, and classroomId are required." });
        }

        // Verify classroom belongs to teacher
        const classroomCheck = await verifyClassroom(classroomId, teacherId);
        if (!classroomCheck.valid) {
            return res.status(400).json({ error: classroomCheck.error });
        }
        
        const specificDate = new Date(date);
        const startDate = new Date(new Date(specificDate).setHours(0, 0, 0, 0));
        const endDate = new Date(new Date(specificDate).setHours(23, 59, 59, 999));
        const attendanceDate = new Date(startDate);

        const existingRecord = await Attendance.findOne({ 
            rollNo: rollNumber, 
            date: { $gte: startDate, $lte: endDate },
            teacherId,
            classroomId
        });
        
        if (existingRecord) {
            return res.status(200).json({ message: "Student already marked present.", record: existingRecord });
        }

        const newRecord = new Attendance({
            studentName: name,
            rollNo: rollNumber,
            date: attendanceDate,
            classroomId,
            teacherId
        });
        try {
            await newRecord.save();
        } catch (error) {
            if (error && error.code === 11000) {
                const existing = await Attendance.findOne({
                    rollNo: rollNumber,
                    date: { $gte: startDate, $lte: endDate },
                    teacherId,
                    classroomId
                });
                return res.status(200).json({ message: "Student already marked present.", record: existing });
            }
            throw error;
        }
        res.status(201).json({ message: "Student marked present successfully.", record: newRecord });
    } catch (error) {
        console.error("Manual mark error:", error);
        res.status(500).json({ error: "Failed to mark student." });
    }
});

// DELETE /attendance/unmark - Unmark attendance
router.delete("/unmark", authMiddleware, async (req, res) => {
    try {
        const { rollNumber, date, classroomId } = req.body;
        const teacherId = req.teacher.id;

        if (!rollNumber || !date || !classroomId) {
            return res.status(400).json({ error: "rollNumber, date, and classroomId are required." });
        }

        // Verify classroom belongs to teacher
        const classroomCheck = await verifyClassroom(classroomId, teacherId);
        if (!classroomCheck.valid) {
            return res.status(400).json({ error: classroomCheck.error });
        }

        const specificDate = new Date(date);
        const startDate = new Date(new Date(specificDate).setHours(0, 0, 0, 0));
        const endDate = new Date(new Date(specificDate).setHours(23, 59, 59, 999));

        const result = await Attendance.findOneAndDelete({ 
            rollNo: rollNumber, 
            date: { $gte: startDate, $lte: endDate },
            teacherId,
            classroomId
        });
        
        if (!result) {
            return res.status(404).json({ error: "No attendance record found for this student on this date." });
        }

        res.status(200).json({ message: "Student unmarked successfully." });
    } catch (error) {
        console.error("Manual unmark error:", error);
        res.status(500).json({ error: "Failed to unmark student." });
    }
});

// POST /attendance/diagnose - Diagnose face matching issues (requires auth)
router.post("/diagnose", authMiddleware, upload.single("groupPhoto"), async (req, res) => {
    let absoluteImagePath = "";
    try {
        const teacherId = req.teacher.id;
        const { classroomId } = req.body;

        if (!req.file) return res.status(400).json({ error: "No group photo file uploaded." });

        // Verify classroom
        const classroomCheck = await verifyClassroom(classroomId, teacherId);
        if (!classroomCheck.valid) {
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({ error: classroomCheck.error });
        }

        const groupImagePath = req.file.path;
        absoluteImagePath = groupImagePath;
        
        // Get students for this classroom
        const students = await Student.find({ classroomId });
        
        // Prepare enrolled faces for DeepFace service
        const enrolledFaces = students
            .map((s) => {
                const descriptors =
                    s.faceDescriptors && s.faceDescriptors.length > 0
                        ? s.faceDescriptors
                        : s.faceDescriptor
                          ? [s.faceDescriptor]
                          : [];

                if (descriptors.length === 0) return null;
                return { 
                    rollNumber: s.rollNumber, 
                    name: s.name,
                    descriptors 
                };
            })
            .filter(Boolean);
        
        if (enrolledFaces.length === 0) {
            if (fs.existsSync(groupImagePath)) fs.unlinkSync(groupImagePath);
            return res.status(400).json({ error: "No students are enrolled with face data in this classroom." });
        }

        // Call DeepFace diagnose endpoint
        const response = await fetch(`${DEEPFACE_SERVICE_URL}/diagnose`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                image_path: absoluteImagePath,
                enrolled_faces: enrolledFaces
            })
        });

        const diagnosisResult = await response.json();
        
        // Clean up uploaded image
        if (fs.existsSync(absoluteImagePath)) {
            fs.unlinkSync(absoluteImagePath);
        }

        if (!response.ok) {
            return res.status(500).json({ error: diagnosisResult.error || "Failed to diagnose" });
        }

        res.json({ 
            success: true, 
            classroomId,
            classroomName: classroomCheck.classroom.name,
            enrolledStudents: enrolledFaces.map(f => ({ 
                rollNumber: f.rollNumber, 
                name: f.name,
                numPhotos: f.descriptors.length 
            })),
            ...diagnosisResult
        });

    } catch (err) {
        console.error("Diagnose error:", err);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        if (absoluteImagePath && fs.existsSync(absoluteImagePath)) {
            fs.unlinkSync(absoluteImagePath);
        }
        res.status(500).json({ error: "Error diagnosing face matching" });
    }
});

module.exports = router;
