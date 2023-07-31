require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const { expect } = chai;
const nodemailer = require("nodemailer");
const transporter = require("@config/mailer");

// Replace "path/to" with the actual path to the required modules and files.

describe("Nodemailer Configuration", () => {
  it("should create a transporter with the correct service", () => {
    expect(transporter.options.service).to.equal("gmail");
  });

  it("should use environment variables for authentication", () => {
    expect(transporter.options.auth.user).to.equal(process.env.MAIL_USER);
    expect(transporter.options.auth.pass).to.equal(process.env.MAIL_PASS);
  });

  it("should have the correct transporter type", () => {
    expect(transporter instanceof nodemailer.Transporter).to.be.true;
  });

  // Add more test cases to cover additional scenarios or configuration properties.
});

// Add more test cases to cover additional scenarios or configuration properties.
