const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: `${process.env.MAIL_USER}`,
    pass: `${process.env.MAIL_PASS}`,
  },
});

module.exports = transporter;
