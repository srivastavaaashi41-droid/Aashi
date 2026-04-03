const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

// DB + Routes
const db = require("./db");
const userRoutes = require("./userRoutes");

const app = express();

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// ✅ API Routes
app.use("/api", userRoutes);

app.listen(3000, () => {
  console.log("✅ MySQL connected!");
  console.log("🚀 Server running at http://localhost:3000");
});
