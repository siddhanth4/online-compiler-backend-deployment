// const fs = require("fs");
// const path = require("path");
// const { v4: uuid } = require("uuid");

// const dirCodes = path.join(__dirname, "codes");

// if (!fs.existsSync(dirCodes)) {
//   fs.mkdirSync(dirCodes, { recursive: true });
// }

// const generateFile = async (format, content) => {
//   const jobId = uuid();
//   const filename = `${jobId}.${format}`;
//   const filepath = path.join(dirCodes, filename);
//   await fs.writeFileSync(filepath, content);
//   return filepath;
// };

// module.exports = {
//   generateFile,
// };



// // generateFile.js
// const fs = require("fs");
// const path = require("path");
// const { v4: uuid } = require("uuid");

// const dirCodes = path.join(__dirname, "codes");
// if (!fs.existsSync(dirCodes)) fs.mkdirSync(dirCodes, { recursive: true });

// const generateFile = async (format, content) => {
//   const jobId = uuid();
//   const filename = `${jobId}.${format}`;
//   const filepath = path.join(dirCodes, filename);
//   await fs.writeFileSync(filepath, content);
//   return filepath;
// };

// module.exports = { generateFile };

// generateFile.js
const fs = require("fs");
const path = require("path");
const { v4: uuid } = require("uuid");
const os = require("os");

/**
 * Generates a temporary file for the submitted code.
 * Uses the system temporary directory (os.tmpdir()) which is writable on serverless platforms.
 *
 * Returns absolute filepath (string).
 * NOTE: caller is responsible for cleaning up the file if needed.
 */

const dirCodes = path.join(os.tmpdir(), "oc_codes"); // e.g. /tmp/oc_codes

if (!fs.existsSync(dirCodes)) {
  try {
    fs.mkdirSync(dirCodes, { recursive: true });
  } catch (err) {
    console.error("generateFile: mkdirSync failed:", err && err.message ? err.message : err);
    throw err;
  }
}

const generateFile = async (format, content) => {
  const jobId = uuid();
  // make extension for cpp / py etc.
  const ext = format === "cpp" ? "cpp" : format === "py" ? "py" : String(format);
  const filename = `${jobId}.${ext}`;
  const filepath = path.join(dirCodes, filename);

  try {
    // atomically write file
    fs.writeFileSync(filepath, String(content), { encoding: "utf8", flag: "w" });
  } catch (err) {
    console.error("generateFile: writeFileSync failed:", err && err.message ? err.message : err);
    throw err;
  }

  return filepath;
};

module.exports = {
  generateFile,
};
