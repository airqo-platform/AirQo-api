const nodemailer = require("nodemailer");
const xoauth2 = require("xoauth2");
const constants = require("../config/constants");

//create a nodemail transport
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: `${process.env.MAIL_USER}`,
    pass: `${process.env.MAIL_PASS}`
  }
});

module.exports = transporter;
