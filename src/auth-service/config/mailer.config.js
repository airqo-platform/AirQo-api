const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: `${process.env.MAIL_USER}`,
    pass: `${process.env.MAIL_PASS}`,
  },
  connectionTimeout: 5000, // 5 seconds
  socketTimeout: 5000, // 5 seconds
});

module.exports = transporter;
