// backend/server.js
const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const connectDB = require("./db");
const enrollRoute = require("./routes/enroll");
const attendanceRoute = require("./routes/attendance");
const authRoute = require("./routes/auth");
const classroomRoute = require("./routes/classroom");

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// Security headers with helmet (configured for API usage)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow serving images cross-origin
  contentSecurityPolicy: false // Disable CSP for API server
}));

// Rate limiting - prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 100 : 1000, // Stricter in production
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 20 : 100, // 20 attempts per 15 min in production
  message: { error: "Too many login attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false
});

// CORS configuration - strict in production
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from: ${origin}`);
      if (isProduction) {
        callback(new Error('Not allowed by CORS'));
      } else {
        callback(null, true); // Allow in development
      }
    }
  },
  credentials: true
}));

// JSON body parser with size limit for large face descriptor payloads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving with absolute paths
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/models", express.static(path.join(__dirname, "face-models")));

// connect database
connectDB();

// routes
app.use("/auth", authLimiter, authRoute); // Stricter rate limit for auth
app.use("/classroom", classroomRoute);
app.use("/enroll", enrollRoute);
app.use("/attendance", attendanceRoute);

app.get("/", (req, res) => {
  res.send("SnapTick API Server - Ready!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}${isProduction ? ' (production)' : ' (development)'}`);
});
