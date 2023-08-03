require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const { describe } = require("mocha");
const mongoose = require("mongoose");
const activitySchema = require("@models/SiteActivity");

describe("Activity Model Unit Tests", () => {
  let Activity;

  before(async () => {
    // Connect to the test database
    await mongoose.connect("mongodb://localhost:27017/test-db", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    Activity = mongoose.model("Activity", activitySchema);
  });

  after(async () => {
    // Close the database connection after all tests
    await mongoose.connection.close();
  });

  describe("Schema Definition", () => {
    it("Should be a valid Mongoose model", () => {
      expect(Activity).to.be.a("function");
    });

    it("Should have the required 'email' field", () => {
      const emailField = Activity.schema.obj.email;
      expect(emailField).to.exist;
      expect(emailField.type).to.equal(String);
      expect(emailField.required).to.be.true;
    });

    it("Should have a unique 'email' field", () => {
      const emailField = Activity.schema.obj.email;
      expect(emailField.unique).to.be.true;
    });

    it("Should validate the 'email' field as a valid email", () => {
      const emailField = Activity.schema.obj.email;
      const invalidEmail = "invalid-email";
      const validEmail = "test@example.com";

      expect(emailField.validate.validator(invalidEmail)).to.be.false;
      expect(emailField.validate.validator(validEmail)).to.be.true;
    });

    // Add more tests for other fields in the schema if necessary
  });

  describe("Instance Methods", () => {
    // Add your instance method tests here
  });

  describe("Static Methods", () => {
    // Add your static method tests here
  });

  describe("Static Method 'register'", () => {
    // Add your 'register' method tests here
  });

  describe("Static Method 'list'", () => {
    // Add your 'list' method tests here
  });

  describe("Static Method 'modify'", () => {
    // Add your 'modify' method tests here
  });

  describe("Static Method 'remove'", () => {
    // Add your 'remove' method tests here
  });
});
