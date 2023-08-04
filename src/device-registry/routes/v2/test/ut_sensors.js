require("module-alias/register");
const express = require("express");
const request = require("supertest");
const { expect } = require("chai");
const sinon = require("sinon");

// Import the modules to be tested
const sensorController = require("@controllers/create-sensor");
const constants = require("@config/constants");
const mongoose = require("mongoose");

// Import the Express Router to be tested
const router = require("@routes/v2/sensors");

// Test data (if needed)
const testTenant = "test_tenant";
const testId = "test_id";
const testObjectId = new mongoose.Types.ObjectId();

describe("Sensor Router", () => {
  // Mock the headers middleware
  const mockHeaders = (req, res, next) => {
    next();
  };

  beforeEach(() => {
    sinon.restore();
  });

  describe("Middleware", () => {
    it("should call the headers middleware", async () => {
      sinon.stub(router, "use").callsFake(mockHeaders);
      const app = express();
      app.use("/", router);
      await request(app).get("/");
      expect(router.use.calledWith(mockHeaders)).to.be.true;
    });
  });

  // Add more describe blocks and tests for each endpoint

  describe("GET /", () => {
    it("should call sensorController.list function", async () => {
      const listStub = sinon.stub(sensorController, "list");
      const app = express();
      app.use("/", router);
      await request(app).get("/");
      expect(listStub.calledOnce).to.be.true;
      listStub.restore();
    });

    // Add more tests for query parameters and error cases if needed
  });

  describe("POST /", () => {
    // Add tests for the "POST /" endpoint
  });

  describe("PUT /", () => {
    // Add tests for the "PUT /" endpoint
  });

  describe("DELETE /", () => {
    // Add tests for the "DELETE /" endpoint
  });
});
