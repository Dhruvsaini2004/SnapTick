// backend/server.js
const express = require("express");
const path = require("path");
const cors = require("cors");
const connectDB = require("./db");
const enrollRoute = require("./routes/enroll");
const attendanceRoute = require("./routes/attendance");
const authRoute = require("./routes/auth");
const classroomRoute = require("./routes/classroom");

const app = express();

// CORS configuration - restrict in production
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from: ${origin}`);
      callback(null, true); // In dev, allow all. Change to callback(new Error('Not allowed')) in prod
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
app.use("/auth", authRoute);
app.use("/classroom", classroomRoute);
app.use("/enroll", enrollRoute);
app.use("/attendance", attendanceRoute);

app.get("/", (req, res) => {
  res.send("Server + MongoDB working + Auth + Classroom + Enroll API ready!");
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});
