const nodemailer = require("nodemailer");

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

module.exports = {
  sendAlertEmail,
};
