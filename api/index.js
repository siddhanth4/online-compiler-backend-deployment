// api/index.js — robust shim, logs import error to runtime logs
// Place this at repository root under the "api" folder: /api/index.js

const tryPaths = [
  "../index.js",    // if api/ is a subfolder and index.js is at repo root
  "./index.js",     // if shim accidentally at repo root and index.js in same folder
  "../server/app.js", // common if server files live under server/
  "./server/app.js" // alternate
];

function loadApp() {
  for (const p of tryPaths) {
    try {
      console.log(`API SHIM: attempting require("${p}")`);
      const mod = require(p);
      // Accept app exported as module.exports = app OR export default
      if (typeof mod === "function") {
        console.log(`API SHIM: loaded function from ${p}`);
        return mod;
      }
      if (mod && typeof mod.default === "function") {
        console.log(`API SHIM: loaded default function from ${p}`);
        return mod.default;
      }
      // if it's an object likely exported as { app } or similar, try to find express app
      if (mod && (typeof mod.app === "function")) {
        console.log(`API SHIM: loaded .app from ${p}`);
        return mod.app;
      }
      console.warn(`API SHIM: require("${p}") returned unexpected shape:`, Object.keys(mod || {}));
      // still return the module so Vercel may try to handle it; caller will handle shape mismatch.
      return mod;
    } catch (err) {
      console.error(`API SHIM: require("${p}") failed — ${err && err.message ? err.message : err}`);
      // continue to next path
    }
  }
  // none worked — throw to cause shim fallback
  throw new Error("API SHIM: failed to load server module from any path; check paths and logs.");
}

try {
  const app = loadApp();
  if (typeof app === "function") {
    module.exports = app;
  } else if (app && typeof app.default === "function") {
    module.exports = app.default;
  } else {
    console.error("API SHIM: loaded module is not a function (Express app). Export shape:", typeof app, Object.keys(app || {}));
    // respond with helpful json rather than crashing the process
    module.exports = (req, res) => {
      res.status(500).json({ error: "Server loaded but exported an unexpected shape. Check runtime logs." });
    };
  }
} catch (err) {
  console.error("API SHIM: fatal import error (full stack):", err && err.stack ? err.stack : err);
  module.exports = (req, res) => {
    res.status(500).json({ error: "Server import error. Check logs." });
  };
}
