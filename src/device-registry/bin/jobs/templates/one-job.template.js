// ====================================
// SIMPLE CRON JOB TEMPLATE
// ====================================

const cron = require("node-cron");
// ... your other imports

// 1. Define job identification
const JOB_NAME = "your-job-name"; // 👈 Change this
const JOB_SCHEDULE = "*/5 * * * *"; // 👈 Change this

// 2. Your existing job function (unchanged)
const yourJobFunction = async () => {
  try {
    // Your existing job logic here
    console.log("Running your job...");
  } catch (error) {
    console.error("Job error:", error.message);
  }
};

// 3. Create and register the job
const startYourJob = () => {
  // Create the cron job instance 👇 THIS IS THE cronJobInstance!
  const cronJobInstance = cron.schedule(JOB_SCHEDULE, yourJobFunction, {
    scheduled: true,
  });

  // Initialize global registry
  if (!global.cronJobs) {
    global.cronJobs = {};
  }

  // Register for cleanup 👇 USING cronJobInstance HERE!
  global.cronJobs[JOB_NAME] = {
    job: cronJobInstance,
    stop: async () => {
      cronJobInstance.stop(); // 👈 Stop scheduling
      cronJobInstance.destroy(); // 👈 Clean up resources
      delete global.cronJobs[JOB_NAME]; // 👈 Remove from registry
    },
  };

  console.log(`✅ ${JOB_NAME} started`);
};

// 4. Start the job
startYourJob();
