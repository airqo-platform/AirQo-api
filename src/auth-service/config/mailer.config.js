const nodemailer = require("nodemailer");

// Transporter for immediate, high-priority emails (fail-fast)
const directTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: `${process.env.MAIL_USER}`,
    pass: `${process.env.MAIL_PASS}`,
  },
  connectionTimeout: 5000, // 5 seconds for quick sends
  socketTimeout: 5000, // 5 seconds
});

// Transporter for background queue processing (longer timeout for resilience)
const queueTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: `${process.env.MAIL_USER}`,
    pass: `${process.env.MAIL_PASS}`,
  },
  connectionTimeout: 20000, // 20 seconds
  socketTimeout: 20000, // 20 seconds
});

module.exports = { directTransporter, queueTransporter };
