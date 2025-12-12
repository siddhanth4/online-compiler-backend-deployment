// api/index.js
// Shim for Vercel: export the Express app as the default handler.
// Use commonjs require to match your app.

const app = require("../index.js"); // adjust relative path if needed

// When Vercel calls the function it accepts module.exports = app
module.exports = app;
