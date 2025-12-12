// const express = require("express");
// const cors = require("cors");
// const mongoose = require("mongoose");

// const app = express();

// // Middleware
// app.use(cors());
// app.use(express.urlencoded({ extended: true }));
// app.use(express.json());

// // Connect to MongoDB
// mongoose.connect("mongodb://localhost/compilerdb")
// .then(() => {
//   console.log("Successfully connected to MongoDB: compilerdb");
// })
// .catch((err) => {
//   console.error("MongoDB connection error:", err);
// });

// // Import other modules
// const { generateFile } = require("./generateFile");
// const { addJobToQueue } = require("./jobQueue");
// const Job = require("./models/Job");

// // Define routes
// app.post("/run", async (req, res) => {
//   const { language = "cpp", code } = req.body;

//   console.log(language, "Length:", code.length);

//   if (code === undefined) {
//     return res.status(400).json({ success: false, error: "Empty code body!" });
//   }

//   // Generate a C++ file with content from the request
//   const filepath = await generateFile(language, code);
  
//   // Write into DB
//   const job = await new Job({ language, filepath }).save();
//   const jobId = job["_id"];
  
//   addJobToQueue(jobId);
//   res.status(201).json({ jobId });
// });

// app.get("/status", async (req, res) => {
//   const jobId = req.query.id;

//   if (jobId === undefined) {
//     return res.status(400).json({ success: false, error: "missing id query param" });
//   }

//   const job = await Job.findById(jobId);

//   if (!job) {
//     return res.status(400).json({ success: false, error: "couldn't find job" });
//   }

//   return res.status(200).json({ success: true, job });
// });

// // Start the server
// app.listen(5000, () => {
//   console.log(`Listening on port 5000!`);
// });








// Add these near the top of index.js
process.on("unhandledRejection", (reason, p) => {
  console.error("Unhandled Rejection at:", p, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});


// index.js
// CommonJS style for simplicity with your current package.json

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config();

const app = express();

// Bring in modules (these files also updated below)
const { generateFile } = require("./generateFile");
const { addJobToQueue, startLocalWorkerIfNeeded } = require("./jobQueue");
const Job = require("./models/Job"); // ensure models/Job.js exists

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// safe DB connect — only attempt if MONGO_URI provided
let isConnected = false;
async function connectToDatabaseIfNeeded() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.warn("MONGO_URI not provided — skipping MongoDB connection.");
    return;
  }
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }
  try {
    await mongoose.connect(mongoUri, {});
    isConnected = true;
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection failed (continuing without DB):", err.message || err);
    // Do not throw — serverless must not crash during init
  }
}

// Call once at cold-start (non-blocking)
connectToDatabaseIfNeeded();

// If using local in-memory worker, start it (noop if using Redis-backed bull)
startLocalWorkerIfNeeded();

// Middleware ensures DB connect attempt before processing (non-blocking connection attempt)
app.use((req, res, next) => {
  if (!isConnected) {
    // Try connect but do not await — avoid blocking serverless cold start
    connectToDatabaseIfNeeded();
  }
  next();
});

// POST /run
app.post("/run", async (req, res) => {
  const { language = "cpp", code } = req.body;
  if (typeof code !== "string" || code.trim().length === 0) {
    return res.status(400).json({ success: false, error: "Empty code body!" });
  }

  try {
    // Save code to file
    const filepath = await generateFile(language, code);

    // If DB available, create Job document; otherwise create a lightweight object
    let jobDoc = null;
    if (isConnected) {
      jobDoc = await new Job({ language, filepath }).save();
    } else {
      // Create a pseudo job id using timestamp+random for non-DB mode
      jobDoc = { _id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, language, filepath, status: "pending" };
    }

    const jobId = jobDoc._id;
    // enqueue job (Bull if configured, or local immediate handler)
    await addJobToQueue(jobId, { language, filepath, useDb: isConnected });

    res.status(201).json({ jobId });
  } catch (err) {
    console.error("Run error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// GET /status?id=...
app.get("/status", async (req, res) => {
  const jobId = req.query.id;
  if (!jobId) return res.status(400).json({ success: false, error: "missing id query param" });

  try {
    if (!isConnected) {
      // If DB not connected, we can't fetch job — return helpful message
      return res.status(200).json({ success: true, job: { _id: jobId, status: "unknown", note: "DB not configured. Use MONGO_URI to enable persistent job status." } });
    }
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ success: false, error: "couldn't find job" });
    return res.status(200).json({ success: true, job });
  } catch (err) {
    console.error("Status error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// Health
app.get("/", (req, res) => res.json({ status: "ok" }));

// Export app for serverless platforms
module.exports = app;
