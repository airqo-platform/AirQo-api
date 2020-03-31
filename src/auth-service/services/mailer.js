const nodemailer = require("nodemailer");
const xoauth2 = require("xoauth2");
const constants = require("../config/constants");

const mailOptions = {
  from: process.env.MAIL_USER,
  to: "martin@airqo.net",
  subject: "Join AirQo Analytics",
  text: "Please review this new request"
};

const credentials = {
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
};

const credentials_2 = {
  service: "gmail",
  host: "smtp.gmail.com",
  secure: "true",
  port: "465",
  auth: {
    type: "OAuth2", //Authentication type
    user: "your_email@service.com", //For example, xyz@gmail.com
    clientId: "Your_ClientID",
    clientSecret: "Client_Secret",
    refreshToken: "Refresh_Token"
  }
};

const transporter = nodemailer.createTransport(credentials);

const sendEmail = async (to, content) => {
  try {
    const contacts = {
      from: process.env.MAIL_USER,
      to
    };
    const email = Object.assign({}, content, contacts);
    await transporter.sendMail(email);
  } catch (e) {
    console.log(e);
  }
};

transporter.sendMail(mailOptions, (e, r) => {
  if (e) {
    console.log(e);
  } else {
    console.log(r);
  }
  transporter.close();
});

module.exports = sendEmail;
