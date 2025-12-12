// const { exec } = require("child_process");

// const executePy = (filepath) => {
//   return new Promise((resolve, reject) => {
//     exec(
//       `python ${filepath}`,
//       (error, stdout, stderr) => {
//         error && reject({ error, stderr });
//         stderr && reject(stderr);
//         resolve(stdout);
//       }
//     );
//   });
// };

// module.exports = {
//   executePy,
// };



// executePy.js
const { exec } = require("child_process");

const executePy = (filepath) => {
  return new Promise((resolve, reject) => {
    exec(`python ${filepath}`, (error, stdout, stderr) => {
      if (error) return reject({ error, stderr });
      if (stderr) return reject({ stderr });
      resolve(stdout);
    });
  });
};

module.exports = { executePy };
