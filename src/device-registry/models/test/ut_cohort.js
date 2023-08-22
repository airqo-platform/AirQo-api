require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const cohortSchema = require("@models/cohort"); // Replace with the actual path to your cohortSchema.js file

describe("Cohort Model", () => {
  let Cohort;
  let createStub;
  let findOneAndUpdateStub;
  let findOneAndRemoveStub;

  beforeEach(() => {
    // Create a mock Cohort model
    Cohort = mongoose.model("Cohort", cohortSchema);

    // Stub the model methods
    createStub = sinon.stub(Cohort, "create");
    findOneAndUpdateStub = sinon.stub(Cohort, "findOneAndUpdate");
    findOneAndRemoveStub = sinon.stub(Cohort, "findOneAndRemove");
  });

  afterEach(() => {
    // Restore the original model methods
    createStub.restore();
    findOneAndUpdateStub.restore();
    findOneAndRemoveStub.restore();
  });

  describe("register", () => {
    it("should register a new cohort with default network and sanitized name", async () => {
      // Test implementation for the register method
    });

    it("should handle validation errors when registering a new cohort", async () => {
      // Test implementation for handling validation errors in register method
    });

    // Add more tests for the register method as needed
  });

  describe("list", () => {
    it("should list cohorts with filters and device information", async () => {
      // Test implementation for the list method
    });

    // Add more tests for the list method as needed
  });

  describe("modify", () => {
    it("should modify a cohort", async () => {
      // Test implementation for the modify method
    });

    // Add more tests for the modify method as needed
  });

  describe("remove", () => {
    it("should remove a cohort", async () => {
      // Test implementation for the remove method
    });

    // Add more tests for the remove method as needed
  });

  // Add more describe blocks for other static methods if available
});
