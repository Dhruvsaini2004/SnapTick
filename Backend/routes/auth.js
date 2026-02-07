// backend/routes/auth.js
const express = require("express");
const jwt = require("jsonwebtoken");
const Teacher = require("../models/teacher");

const router = express.Router();

// JWT Secret - MUST be set in environment variables for production
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("⚠️  WARNING: JWT_SECRET not set in environment variables!");
  console.error("⚠️  Using insecure default - DO NOT use in production!");
}
const SECURE_JWT_SECRET = JWT_SECRET || "dev-only-insecure-key-" + Math.random().toString(36);
const JWT_EXPIRES_IN = "7d";

// Generate JWT token
function generateToken(teacher) {
  return jwt.sign(
    { 
      id: teacher._id, 
      email: teacher.email, 
      name: teacher.name,
      role: teacher.role 
    },
    SECURE_JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Middleware to verify JWT token
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECURE_JWT_SECRET);
    req.teacher = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// POST /auth/register - Register a new teacher
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Check if email already exists
    const existingTeacher = await Teacher.findOne({ email: email.toLowerCase() });
    if (existingTeacher) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Create new teacher
    const teacher = new Teacher({
      name,
      email: email.toLowerCase(),
      password
    });

    await teacher.save();

    const token = generateToken(teacher);

    res.status(201).json({
      message: "Registration successful",
      token,
      teacher: teacher.toJSON()
    });

  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Failed to register" });
  }
});

// POST /auth/login - Login teacher
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find teacher by email
    const teacher = await Teacher.findOne({ email: email.toLowerCase() });
    if (!teacher) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check if account is active
    if (!teacher.isActive) {
      return res.status(403).json({ error: "Account is deactivated" });
    }

    // Verify password
    const isMatch = await teacher.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Update last login
    teacher.lastLogin = new Date();
    await teacher.save();

    const token = generateToken(teacher);

    res.status(200).json({
      message: "Login successful",
      token,
      teacher: teacher.toJSON()
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to login" });
  }
});

// GET /auth/verify - Verify token and get current teacher
router.get("/verify", authMiddleware, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.teacher.id);
    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    res.status(200).json({
      valid: true,
      teacher: teacher.toJSON()
    });

  } catch (error) {
    console.error("Verify error:", error);
    res.status(500).json({ error: "Failed to verify token" });
  }
});

// GET /auth/teachers - Get all teachers (admin only)
router.get("/teachers", authMiddleware, async (req, res) => {
  try {
    const teachers = await Teacher.find({}, "-password");
    res.status(200).json(teachers);
  } catch (error) {
    console.error("Fetch teachers error:", error);
    res.status(500).json({ error: "Failed to fetch teachers" });
  }
});

// PUT /auth/change-password - Change password
router.put("/change-password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const teacher = await Teacher.findById(req.teacher.id);
    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const isMatch = await teacher.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    teacher.password = newPassword;
    await teacher.save();

    res.status(200).json({ message: "Password changed successfully" });

  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// Export router and middleware
module.exports = router;
module.exports.authMiddleware = authMiddleware;
