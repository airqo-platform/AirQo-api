const schedule = require("node-schedule");
const axios = require("axios");
const nodemailer = require("nodemailer");

// the job to run every minute
const job = schedule.scheduleJob("* * * * *", async () => {
  try {
    // Fetch data from the API or database
    const response = await axios.get("your-api-endpoint");
    const value = response.data.value; // Extract the value from the response

    // Check if the value is below the threshold
    const threshold = 10; // the preset threshold which will come from the database
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

// Function to send an alert email
function sendAlertEmail(subject, message) {
  const transporter = nodemailer.createTransport({
    service: "your-email-service",
    auth: {
      user: "your-email@example.com",
      pass: "your-email-password",
    },
  });

  const mailOptions = {
    from: "your-email@example.com",
    to: "recipient@example.com",
    subject: subject,
    text: message,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Email error:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
}
