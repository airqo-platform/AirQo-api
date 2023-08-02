require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const { describe } = require("mocha");
const mongoose = require("mongoose");
const photoSchema = require("@models/Photo");

describe("Photo Model Unit Tests", () => {
  let Photo;

  before(async () => {
    // Connect to the test database
    await mongoose.connect("mongodb://localhost:27017/test-db", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    Photo = mongoose.model("Photo", photoSchema);
  });

  after(async () => {
    // Close the database connection after all tests
    await mongoose.connection.close();
  });

  describe("Schema Definition", () => {
    it("Should be a valid Mongoose model", () => {
      expect(Photo).to.be.a("function");
    });

    it("Should have the required 'image_url' field", () => {
      const imageUrlField = Photo.schema.obj.image_url;
      expect(imageUrlField).to.exist;
      expect(imageUrlField.type).to.equal(String);
      expect(imageUrlField.required).to.be.true;
    });

    it("Should have the required 'image_code' field", () => {
      const imageCodeField = Photo.schema.obj.image_code;
      expect(imageCodeField).to.exist;
      expect(imageCodeField.type).to.equal(String);
      expect(imageCodeField.required).to.be.true;
    });

    // Add more tests for other fields in the schema if necessary
  });

  describe("Pre Save Hook", () => {
    // Add your pre save hook tests here
  });

  describe("Unique Validator Plugin", () => {
    // Add your unique validator plugin tests here
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
