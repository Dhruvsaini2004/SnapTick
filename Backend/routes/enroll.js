// backend/routes/enroll.js
const express = require("express");
const multer = require("multer");
const Student = require("../models/student");
const Classroom = require("../models/classroom");
const { authMiddleware } = require("./auth");
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const router = express.Router();

// Use absolute path for uploads directory
const UPLOADS_DIR = path.join(__dirname, '../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
   destination: (req, file, cb) => cb(null, UPLOADS_DIR),
   filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

// File size limit constant
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Maximum number of training samples (embeddings) per student
// This prevents database bloat and keeps matching efficient
const MAX_TRAINING_SAMPLES = 10;

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

// Helper to validate MongoDB ObjectId
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// DeepFace service URL
const DEEPFACE_SERVICE_URL = process.env.DEEPFACE_URL || "http://localhost:5001";

/**
 * Call DeepFace service to extract face embedding from an image
 * @param {string} imagePath - Absolute path to the image file
 * @returns {Promise<{embedding: number[], facial_area: object}>}
 */
async function extractFaceEmbedding(imagePath) {
  // Ensure we have an absolute path
  const absolutePath = path.isAbsolute(imagePath) ? imagePath : path.join(UPLOADS_DIR, imagePath);
  
  console.log(`[DeepFace] Sending image path: ${absolutePath}`);
  
  // Create abort controller for timeout (60 seconds for face processing)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  
  try {
    const response = await fetch(`${DEEPFACE_SERVICE_URL}/extract-embedding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_path: absolutePath }),
      signal: controller.signal
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[DeepFace] Error response:`, data);
      throw new Error(data.error || "Failed to extract face embedding");
    }

    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error("Face processing timed out. Please try with a smaller image.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

console.log("DeepFace enrollment route initialized (using service at " + DEEPFACE_SERVICE_URL + ")");

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
    return { valid: false, error: "You can only enroll students in your own classrooms" };
  }

  return { valid: true, classroom };
}


// route: POST /enroll (CREATE) - Requires authentication
router.post("/", authMiddleware, upload.single("image"), async (req, res) => {
 try {
    console.log("[Enroll] Request received");
    const { name, rollNumber, classroomId } = req.body;
    const teacherId = req.teacher.id;
    console.log(`[Enroll] name=${name}, rollNumber=${rollNumber}, classroomId=${classroomId}`);

    if (!name || !rollNumber) {
      return res.status(400).json({ error: "name and rollNumber are required" });
    }

    // Verify classroom
    console.log("[Enroll] Verifying classroom...");
    const classroomCheck = await verifyClassroom(classroomId, teacherId);
    if (!classroomCheck.valid) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: classroomCheck.error });
    }
    console.log("[Enroll] Classroom verified");

    const imagePath = req.file ? req.file.path : ""; 
    console.log(`[Enroll] Image path: ${imagePath}`);
    if (!imagePath) return res.status(400).json({ error: "Image file is required" });

    // req.file.path is already absolute since we use UPLOADS_DIR
    const absoluteImagePath = imagePath;
    
    // Check if student with same roll number exists for this classroom
    const existingStudent = await Student.findOne({ rollNumber, classroomId });
    if (existingStudent) {
      if (fs.existsSync(absoluteImagePath)) fs.unlinkSync(absoluteImagePath);
      return res.status(409).json({ error: "Roll number already exists in this classroom" });
    }

    // Use DeepFace service to extract face embedding
    console.log("[Enroll] Calling DeepFace service...");
    let faceData;
    try {
      faceData = await extractFaceEmbedding(absoluteImagePath);
      console.log("[Enroll] DeepFace returned successfully");
    } catch (error) {
      console.error("[Enroll] DeepFace error:", error.message);
      if (fs.existsSync(absoluteImagePath)) fs.unlinkSync(absoluteImagePath);
      return res.status(400).json({ error: error.message || "No face detected in the image." });
    }

    const descriptor = faceData.embedding;

    const student = new Student({ 
        name, 
        rollNumber, 
        image: req.file.filename,
        faceDescriptors: [descriptor],
        faceDescriptor: descriptor,
        descriptorCount: 1,
        teacherId,
        classroomId
    });
    
    await student.save();
    res.status(201).json({ message: "Student enrolled successfully!", student });
  } catch (error) {
    console.error("Enroll error:", error.message);
    console.error("Stack:", error.stack);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    if (error.message === "Only image files are allowed") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Failed to enroll student" });
  }
});


// route: PUT /enroll/:id (UPDATE) - Requires authentication
router.put("/:id", authMiddleware, upload.single("image"), async (req, res) => {
   try {
    const { id } = req.params;
    const { name, rollNumber } = req.body;
    const teacherId = req.teacher.id;

    if (!name || !rollNumber) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: "name and rollNumber are required" });
    }

    const student = await Student.findById(id);
    if (!student) {
        return res.status(404).json({ error: "Student not found" });
    }

    // Verify teacher owns this student
    if (student.teacherId.toString() !== teacherId) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ error: "You can only update your own students" });
    }

    // Check for duplicate roll number in the same classroom
    const existingStudent = await Student.findOne({
      rollNumber,
      classroomId: student.classroomId,
      _id: { $ne: id },
    });
    if (existingStudent) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(409).json({ error: "Roll number already exists in this classroom" });
    }
    student.name = name;
    student.rollNumber = rollNumber;

    if (req.file) {
      const imagePath = req.file.path;
      student.image = req.file.filename; 

      // req.file.path is already absolute since we use UPLOADS_DIR
      const absoluteImagePath = imagePath;

      // Use DeepFace service to extract face embedding
      let faceData;
      try {
        faceData = await extractFaceEmbedding(absoluteImagePath);
      } catch (error) {
        if (fs.existsSync(absoluteImagePath)) fs.unlinkSync(absoluteImagePath);
        return res.status(400).json({ error: error.message || "No face detected in the new image." });
      }
      
      const newDescriptor = faceData.embedding;

      if (!student.faceDescriptors || student.faceDescriptors.length === 0) {
        student.faceDescriptors = [newDescriptor];
      } else if (student.faceDescriptors.length >= MAX_TRAINING_SAMPLES) {
        // At limit - replace oldest descriptor with new one (FIFO)
        student.faceDescriptors = [...student.faceDescriptors.slice(1), newDescriptor];
        console.log(`[Update] ${student.rollNumber} at max samples (${MAX_TRAINING_SAMPLES}), replaced oldest`);
      } else {
        student.faceDescriptors = [...student.faceDescriptors, newDescriptor];
      }

      student.faceDescriptor = newDescriptor;
      student.descriptorCount = student.faceDescriptors.length;
     }

    const updatedStudent = await student.save();
    res.status(200).json({ message: "Student updated successfully (new photo added)", student: updatedStudent });

  } catch (error) {
    console.error("Update error:", error);
    if (req.file && fs.existsSync(path.join(__dirname, '../', req.file.path))) {
      fs.unlinkSync(path.join(__dirname, '../', req.file.path));
    }
    if (error.message === "Only image files are allowed") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to update student" });
  }
});


// route: GET /enroll - Get students for the logged-in teacher (optionally filtered by classroomId)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const teacherId = req.teacher.id;
    const { classroomId } = req.query;

    const query = { teacherId };
    if (classroomId) {
      query.classroomId = classroomId;
    }

    const students = await Student.find(query);
    res.status(200).json(students);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

// route: GET /enroll/descriptors - Get descriptors for teacher's students (optionally filtered by classroomId)
router.get("/descriptors", authMiddleware, async (req, res) => {
  try {
    const teacherId = req.teacher.id;
    const { classroomId } = req.query;

    const query = { teacherId };
    if (classroomId) {
      query.classroomId = classroomId;
    }

    const students = await Student.find(query, "name rollNumber faceDescriptors faceDescriptor classroomId");
    const payload = students.map((student) => ({
      name: student.name,
      rollNumber: student.rollNumber,
      classroomId: student.classroomId,
      descriptors:
        student.faceDescriptors && student.faceDescriptors.length > 0
          ? student.faceDescriptors
          : student.faceDescriptor
            ? [student.faceDescriptor]
            : [],
    }));
    res.status(200).json(payload);
  } catch (error) {
    console.error("Descriptor fetch error:", error);
    res.status(500).json({ error: "Failed to fetch face descriptors" });
  }
});

// route: POST /enroll/:id/add-photo - Add more photos for better recognition
router.post("/:id/add-photo", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.teacher.id;

    if (!req.file) {
      return res.status(400).json({ error: "Image file is required" });
    }

    const student = await Student.findById(id);
    if (!student) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ error: "Student not found" });
    }

    // Verify teacher owns this student
    if (student.teacherId.toString() !== teacherId) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ error: "You can only add photos to your own students" });
    }

    const imagePath = req.file.path;
    // req.file.path is already absolute since we use UPLOADS_DIR
    const absoluteImagePath = imagePath;

    // Use DeepFace service to extract face embedding
    let faceData;
    try {
      faceData = await extractFaceEmbedding(absoluteImagePath);
    } catch (error) {
      if (fs.existsSync(absoluteImagePath)) fs.unlinkSync(absoluteImagePath);
      return res.status(400).json({ error: error.message || "No face detected in the image." });
    }

    const newDescriptor = faceData.embedding;

    // Check if at training sample limit
    const currentCount = student.faceDescriptors?.length || 0;
    if (currentCount >= MAX_TRAINING_SAMPLES) {
      if (fs.existsSync(absoluteImagePath)) fs.unlinkSync(absoluteImagePath);
      return res.status(400).json({ 
        error: `Maximum of ${MAX_TRAINING_SAMPLES} photos reached. Use "Reset Photos" to start fresh.`,
        photoCount: currentCount,
        maxPhotos: MAX_TRAINING_SAMPLES
      });
    }

    // Add new descriptor to the array
    if (!student.faceDescriptors || student.faceDescriptors.length === 0) {
      student.faceDescriptors = [newDescriptor];
    } else {
      student.faceDescriptors = [...student.faceDescriptors, newDescriptor];
    }

    student.faceDescriptor = newDescriptor;
    student.descriptorCount = student.faceDescriptors.length;
    student.image = req.file.filename;

    const updatedStudent = await student.save();

    res.status(200).json({
      message: `Photo added successfully! Student now has ${student.descriptorCount}/${MAX_TRAINING_SAMPLES} photos.`,
      student: updatedStudent,
      photoCount: student.descriptorCount,
      maxPhotos: MAX_TRAINING_SAMPLES
    });

  } catch (error) {
    console.error("Add photo error:", error);
    if (req.file && fs.existsSync(path.join(__dirname, '../', req.file.path))) {
      fs.unlinkSync(path.join(__dirname, '../', req.file.path));
    }
    res.status(500).json({ error: "Failed to add photo" });
  }
});


// route: DELETE /enroll/:id - Delete student
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.teacher.id;
    
    const student = await Student.findById(id);
    
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Verify teacher owns this student
    if (student.teacherId.toString() !== teacherId) {
      return res.status(403).json({ error: "You can only delete your own students" });
    }

    // Delete the student's image file if it exists
    if (student.image) {
      const imagePath = path.join(__dirname, '../uploads', student.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Student.findByIdAndDelete(id);
    res.status(200).json({ message: "Student deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: "Failed to delete student" });
  }
});


// route: DELETE /enroll/:id/reset-photos - Reset all photos, keep only the latest
router.delete("/:id/reset-photos", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.teacher.id;
    
    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Verify teacher owns this student
    if (student.teacherId.toString() !== teacherId) {
      return res.status(403).json({ error: "You can only reset photos for your own students" });
    }

    if (!student.faceDescriptors || student.faceDescriptors.length === 0) {
      return res.status(400).json({ error: "Student has no photos to reset" });
    }

    // Keep only the last descriptor
    const lastDescriptor = student.faceDescriptors[student.faceDescriptors.length - 1];
    student.faceDescriptors = [lastDescriptor];
    student.faceDescriptor = lastDescriptor;
    student.descriptorCount = 1;

    const updatedStudent = await student.save();

    res.status(200).json({
      message: "Photos reset successfully. Only the latest photo is kept.",
      student: updatedStudent,
      photoCount: 1
    });

  } catch (error) {
    console.error("Reset photos error:", error);
    res.status(500).json({ error: "Failed to reset photos" });
  }
});


// route: POST /enroll/re-embed - Re-process all student photos with current model (ArcFace)
// Use this after switching recognition models to update all embeddings
router.post("/re-embed", authMiddleware, async (req, res) => {
  try {
    const teacherId = req.teacher.id;
    const { classroomId } = req.body;

    // Build query
    const query = { teacherId };
    if (classroomId) {
      query.classroomId = classroomId;
    }

    const students = await Student.find(query);
    
    if (students.length === 0) {
      return res.status(404).json({ error: "No students found" });
    }

    const results = {
      total: students.length,
      success: 0,
      failed: 0,
      skipped: 0,
      details: []
    };

    console.log(`[Re-embed] Processing ${students.length} students with new model...`);

    for (const student of students) {
      // Check if student has an image
      if (!student.image) {
        results.skipped++;
        results.details.push({
          rollNumber: student.rollNumber,
          name: student.name,
          status: "skipped",
          reason: "No image file"
        });
        continue;
      }

      const imagePath = path.join(UPLOADS_DIR, student.image);
      
      // Check if image file exists
      if (!fs.existsSync(imagePath)) {
        results.skipped++;
        results.details.push({
          rollNumber: student.rollNumber,
          name: student.name,
          status: "skipped",
          reason: "Image file not found"
        });
        continue;
      }

      try {
        // Extract new embedding using current model (ArcFace)
        console.log(`[Re-embed] Processing ${student.rollNumber}: ${student.name}...`);
        const faceData = await extractFaceEmbedding(imagePath);
        const newDescriptor = faceData.embedding;

        // Update student with new embedding
        student.faceDescriptors = [newDescriptor];
        student.faceDescriptor = newDescriptor;
        student.descriptorCount = 1;
        await student.save();

        results.success++;
        results.details.push({
          rollNumber: student.rollNumber,
          name: student.name,
          status: "success",
          embeddingSize: newDescriptor.length
        });
        console.log(`[Re-embed] ✅ ${student.rollNumber} updated successfully`);

      } catch (error) {
        results.failed++;
        results.details.push({
          rollNumber: student.rollNumber,
          name: student.name,
          status: "failed",
          reason: error.message
        });
        console.error(`[Re-embed] ❌ ${student.rollNumber} failed: ${error.message}`);
      }
    }

    console.log(`[Re-embed] Complete: ${results.success} success, ${results.failed} failed, ${results.skipped} skipped`);

    res.status(200).json({
      message: `Re-embedding complete: ${results.success}/${results.total} students updated`,
      results
    });

  } catch (error) {
    console.error("Re-embed error:", error);
    res.status(500).json({ error: "Failed to re-embed students" });
  }
});


module.exports = router;
