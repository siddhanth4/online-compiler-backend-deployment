// api/index.js
// Defensive shim for Vercel: try to import the app and log any error clearly.
try {
  console.log("API SHIM: loading ../index.js");
  const app = require("../index.js"); // adjust if path differs
  console.log("API SHIM: app loaded, exporting");
  // Export either the app (express function) or a wrapper function
  if (typeof app === "function") {
    module.exports = app;
  } else if (app && typeof app.default === "function") {
    module.exports = app.default;
  } else {
    // fallback: export a handler that returns an error but logs details
    console.error("API SHIM: Unexpected app export shape:", typeof app);
    module.exports = (req, res) => {
      res.status(500).json({ error: "App export shape invalid. Check server logs." });
    };
  }
} catch (err) {
  console.error("API SHIM: failed to require ../index.js ->", err && err.stack ? err.stack : err);
  module.exports = (req, res) => {
    res.status(500).json({ error: "Server import error. Check logs." });
  };
}
