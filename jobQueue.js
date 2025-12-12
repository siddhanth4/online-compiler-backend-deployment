// // const Queue = require("bull");

// // const Job = require("./models/Job");
// // const { executeCpp } = require("./executeCpp");
// // const { executePy } = require("./executePy");

// // const jobQueue = new Queue("job-runner-queue");
// // const NUM_WORKERS = 5;

// // jobQueue.process(NUM_WORKERS, async ({ data }) => {
// //   const jobId = data.id;
// //   const job = await Job.findById(jobId);
// //   if (job === undefined) {
// //     throw Error(`cannot find Job with id ${jobId}`);
// //   }
// //   try {
// //     let output;
// //     job["startedAt"] = new Date();
// //     if (job.language === "cpp") {
// //       output = await executeCpp(job.filepath);
// //     } else if (job.language === "py") {
// //       output = await executePy(job.filepath);
// //     }
// //     job["completedAt"] = new Date();
// //     job["output"] = output;
// //     job["status"] = "success";
// //     await job.save();
// //     return true;
// //   } catch (err) {
// //     job["completedAt"] = new Date();
// //     job["output"] = JSON.stringify(err);
// //     job["status"] = "error";
// //     await job.save();
// //     throw Error(JSON.stringify(err));
// //   }
// // });

// // jobQueue.on("failed", (error) => {
// //   console.error(error.data.id, error.failedReason);
// // });

// // const addJobToQueue = async (jobId) => {
// //   jobQueue.add({
// //     id: jobId,
// //   });
// // };

// // module.exports = {
// //   addJobToQueue,
// // };




// // jobQueue.js
// const Job = require("./models/Job");
// const { executeCpp } = require("./executeCpp");
// const { executePy } = require("./executePy");
// const Queue = (() => {
//   try {
//     return require("bull");
//   } catch (e) {
//     return null;
//   }
// })();

// let jobQueue = null;

// // If REDIS_URL present and bull available, use it.
// // Otherwise implement a simple immediate in-process runner (development only).
// if (process.env.REDIS_URL && Queue) {
//   jobQueue = new Queue("job-runner-queue", process.env.REDIS_URL);
//   const NUM_WORKERS = parseInt(process.env.NUM_WORKERS || "2", 10);

//   jobQueue.process(NUM_WORKERS, async (job) => {
//     const jobId = job.data.id;
//     return await processJobById(jobId);
//   });

//   jobQueue.on("failed", (job, err) => {
//     console.error("Job failed:", job?.data?.id, err);
//   });

//   async function addJobToQueue(jobId, meta = {}) {
//     await jobQueue.add({ id: jobId, meta });
//   }

//   module.exports = { addJobToQueue, startLocalWorkerIfNeeded: () => {} };

// } else {
//   // Fallback: in-memory immediate execution (development only).
//   console.warn("REDIS_URL not set or bull not installed — using in-memory immediate job runner. Not for production.");

//   async function processJobById(jobId, opts = {}) {
//     // opts: { language, filepath, useDb }
//     try {
//       // If DB mode, fetch job doc
//       const jobDoc = opts.useDb ? await Job.findById(jobId) : null;
//       const language = opts.language || (jobDoc && jobDoc.language) || "cpp";
//       const filepath = opts.filepath || (jobDoc && jobDoc.filepath);
//       if (!filepath) throw new Error("Missing filepath for job");

//       // mark started if DB
//       if (opts.useDb && jobDoc) {
//         jobDoc.startedAt = new Date();
//         await jobDoc.save();
//       }

//       let output;
//       if (language === "cpp") output = await executeCpp(filepath);
//       else if (language === "py") output = await executePy(filepath);
//       else throw new Error("Unsupported language");

//       if (opts.useDb && jobDoc) {
//         jobDoc.completedAt = new Date();
//         jobDoc.output = typeof output === "string" ? output : JSON.stringify(output);
//         jobDoc.status = "success";
//         await jobDoc.save();
//       }
//       return output;
//     } catch (err) {
//       if (opts.useDb) {
//         try {
//           const jobDoc = await Job.findById(jobId);
//           if (jobDoc) {
//             jobDoc.completedAt = new Date();
//             jobDoc.status = "error";
//             jobDoc.output = JSON.stringify(err);
//             await jobDoc.save();
//           }
//         } catch (ignore) {}
//       }
//       throw err;
//     }
//   }

//   async function addJobToQueue(jobId, meta = {}) {
//     // Run immediately (non-blocking)
//     setImmediate(async () => {
//       try {
//         await processJobById(jobId, meta);
//       } catch (err) {
//         console.error("In-memory job error for", jobId, err);
//       }
//     });
//   }

//   function startLocalWorkerIfNeeded() {
//     // noop for in-memory runner
//   }

//   module.exports = { addJobToQueue, startLocalWorkerIfNeeded };
// }



// jobQueue.js
const Job = require("./models/Job");
const { executeCpp } = require("./executeCpp");
const { executePy } = require("./executePy");

// Only load bull if REDIS_URL configured
let Queue = null;
if (process.env.REDIS_URL) {
  try {
    Queue = require("bull");
  } catch (e) {
    console.warn("bull failed to load:", e && e.message);
    Queue = null;
  }
}

let jobQueue = null;

if (process.env.REDIS_URL && Queue) {
  jobQueue = new Queue("job-runner-queue", process.env.REDIS_URL);
  const NUM_WORKERS = parseInt(process.env.NUM_WORKERS || "2", 10);

  jobQueue.process(NUM_WORKERS, async (job) => {
    const jobId = job.data.id;
    return await processJobById(jobId);
  });

  jobQueue.on("failed", (job, err) => {
    console.error("Job failed:", job?.data?.id, err);
  });

  async function addJobToQueue(jobId, meta = {}) {
    await jobQueue.add({ id: jobId, meta });
  }

  module.exports = { addJobToQueue, startLocalWorkerIfNeeded: () => {} };

} else {
  console.warn("REDIS_URL not set or bull not available — using in-memory immediate job runner (dev only).");

  async function processJobById(jobId, opts = {}) {
    try {
      const jobDoc = opts.useDb ? await Job.findById(jobId) : null;
      const language = opts.language || (jobDoc && jobDoc.language) || "cpp";
      const filepath = opts.filepath || (jobDoc && jobDoc.filepath);
      if (!filepath) throw new Error("Missing filepath for job");

      if (opts.useDb && jobDoc) {
        jobDoc.startedAt = new Date();
        await jobDoc.save();
      }

      let output;
      if (language === "cpp") output = await executeCpp(filepath);
      else if (language === "py") output = await executePy(filepath);
      else throw new Error("Unsupported language");

      if (opts.useDb && jobDoc) {
        jobDoc.completedAt = new Date();
        jobDoc.output = typeof output === "string" ? output : JSON.stringify(output);
        jobDoc.status = "success";
        await jobDoc.save();
      }
      return output;
    } catch (err) {
      if (opts.useDb) {
        try {
          const jobDoc = await Job.findById(jobId);
          if (jobDoc) {
            jobDoc.completedAt = new Date();
            jobDoc.status = "error";
            jobDoc.output = typeof err === "string" ? err : JSON.stringify(err);
            await jobDoc.save();
          }
        } catch (ignore) {}
      }
      throw err;
    }
  }

  async function addJobToQueue(jobId, meta = {}) {
    setImmediate(async () => {
      try {
        await processJobById(jobId, meta);
      } catch (err) {
        console.error("In-memory job error for", jobId, err && (err.stack || err));
      }
    });
  }

  function startLocalWorkerIfNeeded() {
    // no-op for in-memory runner
  }

  module.exports = { addJobToQueue, startLocalWorkerIfNeeded };
}
