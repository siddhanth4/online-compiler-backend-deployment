// const mongoose = require("mongoose");

// const JobSchema = mongoose.Schema({
//   language: {
//     type: String,
//     required: true,
//     enum: ["cpp", "py"],
//   },
//   filepath: {
//     type: String,
//     required: true,
//   },
//   submittedAt: {
//     type: Date,
//     default: Date.now,
//   },
//   startedAt: {
//     type: Date,
//   },
//   completedAt: {
//     type: Date,
//   },
//   status: {
//     type: String,
//     default: "pending",
//     enum: ["pending", "success", "error"],
//   },
//   output: {
//     type: String,
//   },
// });

// // default export
// module.exports = mongoose.model("job", JobSchema);

// models/Job.js
const mongoose = require("mongoose");

const JobSchema = new mongoose.Schema({
  language: { type: String, required: true, enum: ["cpp", "py"] },
  filepath: { type: String, required: true },
  submittedAt: { type: Date, default: Date.now },
  startedAt: { type: Date },
  completedAt: { type: Date },
  status: { type: String, default: "pending", enum: ["pending", "success", "error"] },
  output: { type: String }
});

module.exports = mongoose.models?.Job || mongoose.model("Job", JobSchema);
