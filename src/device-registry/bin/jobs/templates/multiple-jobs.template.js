// ====================================
// MULTIPLE CRON JOBS IN ONE FILE TEMPLATE
// ====================================

const cron = require("node-cron");
// ... your other imports

// 1. Define SEPARATE job identifications
const JOB_1_NAME = "first-job-name"; // 👈 Change this
const JOB_2_NAME = "second-job-name"; // 👈 Change this
const JOB_1_SCHEDULE = "30 */2 * * *"; // 👈 Change this
const JOB_2_SCHEDULE = "0 8 * * *"; // 👈 Change this

// 2. Your existing job functions (unchanged)
const firstJobFunction = async () => {
  try {
    console.log("Running first job...");
    // Your existing job logic here
  } catch (error) {
    console.error("First job error:", error.message);
  }
};

const secondJobFunction = async () => {
  try {
    console.log("Running second job...");
    // Your existing job logic here
  } catch (error) {
    console.error("Second job error:", error.message);
  }
};

// 3. Create and register BOTH jobs
const startAllJobs = () => {
  // Create BOTH job instances
  const firstJobInstance = cron.schedule(JOB_1_SCHEDULE, firstJobFunction, {
    scheduled: true,
  });

  const secondJobInstance = cron.schedule(JOB_2_SCHEDULE, secondJobFunction, {
    scheduled: true,
  });

  // Initialize global registry
  if (!global.cronJobs) {
    global.cronJobs = {};
  }

  // Register FIRST job
  global.cronJobs[JOB_1_NAME] = {
    job: firstJobInstance,
    stop: async () => {
      firstJobInstance.stop();
      firstJobInstance.destroy();
      delete global.cronJobs[JOB_1_NAME];
    },
  };

  // Register SECOND job
  global.cronJobs[JOB_2_NAME] = {
    job: secondJobInstance,
    stop: async () => {
      secondJobInstance.stop();
      secondJobInstance.destroy();
      delete global.cronJobs[JOB_2_NAME];
    },
  };

  console.log(`✅ ${JOB_1_NAME} started`);
  console.log(`✅ ${JOB_2_NAME} started`);
};

// 4. Start all jobs
startAllJobs();
