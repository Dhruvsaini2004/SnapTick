// backend/server.js
const express = require("express");
const cors = require("cors");
const connectDB = require("./db");
const enrollRoute = require("./routes/enroll");
const attendanceRoute = require("./routes/attendance");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// connect database
connectDB();

// routes
app.use("/enroll", enrollRoute);

app.use("/attendance", attendanceRoute);


app.get("/", (req, res) => {
  res.send("Server + MongoDB working + Enroll API ready!");
});

app.listen(5000, () => {
  console.log("✅ Server running on http://localhost:5000");
});


