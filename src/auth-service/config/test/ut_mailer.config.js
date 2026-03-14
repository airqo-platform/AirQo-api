require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const { expect } = chai;
const nodemailer = require("nodemailer");
const {
  directTransporter,
  queueTransporter,
} = require("@config/mailer.config");

describe("Nodemailer Configuration", () => {
  describe("Direct Transporter", () => {
    it("should create a direct transporter with the correct service", () => {
      expect(directTransporter.options.service).to.equal("gmail");
    });

    it("should use environment variables for authentication", () => {
      // Ensure the environment variables are actually set before testing
      expect(process.env.MAIL_USER).to.be.a("string").and.not.be.empty;
      expect(process.env.MAIL_PASS).to.be.a("string").and.not.be.empty;

      expect(directTransporter.options.auth.user).to.equal(
        process.env.MAIL_USER,
      );
      expect(directTransporter.options.auth.pass).to.equal(
        process.env.MAIL_PASS,
      );
    });

    it("should have a sendMail method", () => {
      // Behavioral check: ensure it has the core method of a transporter
      expect(directTransporter).to.have.property("sendMail");
      expect(directTransporter.sendMail).to.be.a("function");
    });
  });

  describe("Queue Transporter", () => {
    it("should create a queue transporter with the correct service", () => {
      expect(queueTransporter.options.service).to.equal("gmail");
    });

    it("should have a sendMail method", () => {
      expect(queueTransporter).to.have.property("sendMail");
      expect(queueTransporter.sendMail).to.be.a("function");
    });
  });
});
