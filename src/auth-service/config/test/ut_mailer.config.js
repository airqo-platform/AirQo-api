require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const { expect } = chai;
const nodemailer = require("nodemailer");
const {
  directTransporter,
  queueTransporter,
} = require("@config/mailer.config");

// Replace "path/to" with the actual path to the required modules and files.

describe("Nodemailer Configuration", () => {
  describe("Direct Transporter", () => {
    it("should create a direct transporter with the correct service", () => {
      expect(directTransporter.options.service).to.equal("gmail");
    });

    it("should use environment variables for authentication", () => {
      expect(directTransporter.options.auth.user).to.equal(
        process.env.MAIL_USER,
      );
      expect(directTransporter.options.auth.pass).to.equal(
        process.env.MAIL_PASS,
      );
    });

    it("should have the correct transporter type", () => {
      expect(directTransporter instanceof nodemailer.Transporter).to.be.true;
    });
  });

  describe("Queue Transporter", () => {
    it("should create a queue transporter with the correct service", () => {
      expect(queueTransporter.options.service).to.equal("gmail");
    });

    it("should have the correct transporter type", () => {
      expect(queueTransporter instanceof nodemailer.Transporter).to.be.true;
    });
  });
});
