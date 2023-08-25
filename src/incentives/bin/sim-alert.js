const Queue = require("bull");
const isEmpty = require("is-empty");
const logger = require("log4js").getLogger();

const dataBalanceThreshold = 10; // Set the data balance threshold in MB
/**
 * can this data threshold be picked from each individual sim card?
 */

// Create a new Bull queue
const simStatusQueue = new Queue("simStatusQueue", {
  redis: {
    port: 6379,
    host: "localhost", // Redis server details
  },
});

// Function to check SIM status
const checkStatus = async (sim_id) => {
  // existing checkStatus function logic here
  // ...

  //if balance is below threshold
  if (jsonOutput.balance < dataBalanceThreshold) {
    logger.warn(
      `SIM with ID ${sim_id} has low data balance: ${jsonOutput.balance} MB`
    );
    // Add code here to log the SIM status
    // ...
  }

  // Return the response or any other relevant data
  // ...
};

// Add a job to the queue that runs every 30 minutes
simStatusQueue.add(
  {},
  {
    repeat: { every: 30 * 60 * 1000 }, // Repeat every 30 minutes
  }
);

// Process the job
simStatusQueue.process(async (job) => {
  // Fetch a list of SIMs from your database
  const simList = await fetchSimsFromDatabase(); // Implement this function

  // Loop through the SIMs and check their status
  for (const sim of simList) {
    await checkStatus(sim._id);
  }
});

// Log any job processing errors
simStatusQueue.on("failed", (job, error) => {
  logger.error(`Job ${job.id} failed: ${error}`);
});
