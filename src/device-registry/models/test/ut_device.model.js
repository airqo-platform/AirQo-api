require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const deviceSchema = require("@models/Device"); // Replace with the actual path to your deviceSchema.js file

describe("Device Model", () => {
  let Device;
  let createStub;
  let findOneAndUpdateStub;
  let findOneAndRemoveStub;

  beforeEach(() => {
    // Create a mock Device model
    Device = mongoose.model("Device", deviceSchema);

    // Stub the model methods
    createStub = sinon.stub(Device, "create");
    findOneAndUpdateStub = sinon.stub(Device, "findOneAndUpdate");
    findOneAndRemoveStub = sinon.stub(Device, "findOneAndRemove");
  });

  afterEach(() => {
    // Restore the original model methods
    createStub.restore();
    findOneAndUpdateStub.restore();
    findOneAndRemoveStub.restore();
  });

  describe("register", () => {
    it("should register a new device with default network and sanitized name", async () => {
      // Test implementation for the register method
    });

    it("should handle validation errors when registering a new device", async () => {
      // Test implementation for handling validation errors in register method
    });

    // Add more tests for the register method as needed
  });

  describe("list", () => {
    it("should list devices with filters and related site and cohort information", async () => {
      // Test implementation for the list method
    });

    // Add more tests for the list method as needed
  });

  describe("modify", () => {
    it("should modify a device", async () => {
      // Test implementation for the modify method
    });

    // Add more tests for the modify method as needed
  });

  describe("encryptKeys", () => {
    it("should encrypt the writeKey and readKey of a device", async () => {
      // Test implementation for the encryptKeys method
    });

    // Add more tests for the encryptKeys method as needed
  });

  describe("remove", () => {
    it("should remove a device", async () => {
      // Test implementation for the remove method
    });

    // Add more tests for the remove method as needed
  });

  // Add more describe blocks for other static methods if available
});
