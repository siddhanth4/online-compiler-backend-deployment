const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const outputPath = path.join(__dirname, "outputs");

if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath, { recursive: true });
}

const executeCpp = (filepath) => {
  const jobId = path.basename(filepath).split(".")[0];
  const outPath = path.join(outputPath, `${jobId}.out`);

  return new Promise((resolve, reject) => {
    // Compile the C++ file
    exec(`g++ ${filepath} -o ${outPath}`, (error, stdout, stderr) => {
      if (error) {
        return reject({ error, stderr });
      }

      // Execute the compiled output file
      const executeCommand = process.platform === "win32" 
        ? outPath  // Directly use the output path on Windows
        : `./${jobId}.out`; // Use ./ for Unix-like systems

      exec(executeCommand, { cwd: outputPath }, (execError, execStdout, execStderr) => {
        if (execError) {
          return reject({ execError, execStderr });
        }
        resolve(execStdout);
      });
    });
  });
};

module.exports = {
  executeCpp,
};
