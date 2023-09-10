const schedule = require("node-schedule");
const axios = require("axios");
const { sendAlertEmail } = require("@utils/emailSender");

function createScheduledJob(jobConfig) {
  return schedule.scheduleJob(jobConfig.schedule, async () => {
    try {
      // Fetch data from the API or database
      const response = await axios.get(jobConfig.apiEndpoint);
      const value = response.data.value; // Extract the value from the response
      // Get the threshold
      const threshold = await jobConfig.getThreshold();
      // Check if the value is below the threshold
      if (value < threshold) {
        // Send an alert
        sendAlertEmail(
          "Value Below Threshold",
          `Value: ${value} is below the threshold.`
        );
      }
    } catch (error) {
      console.error("Error:", error);
    }
  });
}

module.exports = createScheduledJob;
