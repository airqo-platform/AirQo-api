const nodemailer = require("nodemailer");
const xoauth2 = require("xoauth2");
const constants = require("../constants");

let transporter = nodemailer.createTransport({
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
});
