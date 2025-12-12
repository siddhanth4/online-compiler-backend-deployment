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



// index.js
// Defensive Express app entry. Export app (no app.listen here) so serverless platforms can import it.

console.log("INDEX: starting module load —", new Date().toISOString());

process.on("unhandledRejection", (reason, p) => {
  console.error("INDEX: unhandledRejection at:", p, "reason:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("INDEX: uncaughtException:", err && err.stack ? err.stack : err);
});

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const { generateFile } = require("./generateFile");
const { addJobToQueue, startLocalWorkerIfNeeded } = require("./jobQueue");
const Job = require("./models/Job");

const app = express();
console.log("INDEX: express app created");

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
    console.error("MongoDB connection failed (continuing without DB):", err && err.message ? err.message : err);
    // do not throw — serverless must not crash during init
  }
}

// Call once at cold-start (non-blocking)
connectToDatabaseIfNeeded();

// Start local worker if needed (no-op when REDIS_URL + bull used)
startLocalWorkerIfNeeded();

// ensure db connection attempt on each request if not connected
app.use((req, res, next) => {
  if (!isConnected) connectToDatabaseIfNeeded();
  next();
});

// POST /run
app.post("/run", async (req, res) => {
  const { language = "cpp", code } = req.body;
  if (typeof code !== "string" || code.trim().length === 0) {
    return res.status(400).json({ success: false, error: "Empty code body!" });
  }

  try {
    const filepath = await generateFile(language, code);

    // If DB available, create Job document; otherwise create a lightweight object
    let jobDoc = null;
    if (isConnected) {
      jobDoc = await new Job({ language, filepath }).save();
    } else {
      jobDoc = { _id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, language, filepath, status: "pending" };
    }

    const jobId = jobDoc._id;
    await addJobToQueue(jobId, { language, filepath, useDb: isConnected });

    return res.status(201).json({ jobId });
  } catch (err) {
  // Log the full error server-side (Vercel logs)
  console.error("Run error (full):", err && (err.stack || err));

  // Build a safe, predictable error payload to return to the frontend
  const safeErr = {
    message: err && err.message ? err.message : "Unknown server error",
    details: err && err.details ? err.details : undefined,
  };

  // If the error came from child_process, it may have stderr/stdout fields
  if (err && typeof err === "object") {
    if (err.stderr) safeErr.stderr = String(err.stderr);
    if (err.stdout) safeErr.stdout = String(err.stdout);
  }

  return res.status(500).json({ success: false, error: safeErr });
}
});

// GET /status?id=...
app.get("/status", async (req, res) => {
  const jobId = req.query.id;
  if (!jobId) return res.status(400).json({ success: false, error: "missing id query param" });

  try {
    if (!isConnected) {
      return res.status(200).json({ success: true, job: { _id: jobId, status: "unknown", note: "DB not configured. Use MONGO_URI to enable persistent job status." } });
    }
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ success: false, error: "couldn't find job" });
    return res.status(200).json({ success: true, job });
  } catch (err) {
    console.error("Status error:", err && (err.stack || err));
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// Health check
app.get("/", (req, res) => res.json({ status: "ok" }));

// Export app for serverless (CommonJS) and also add default for ESM importers
module.exports = app;
module.exports.default = app;
