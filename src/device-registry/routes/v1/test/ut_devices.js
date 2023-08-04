require("module-alias/register");
const express = require("express");
const request = require("supertest");
const { expect } = require("chai");
const sinon = require("sinon");
const deviceController = require("@controllers/create-device");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const router = require("@routes/v1/devices");

// Test data (if needed)
const testTenant = "test_tenant";
const testId = "test_id";
const testObjectId = new mongoose.Types.ObjectId();

describe("Device Router", () => {
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

  describe("POST /bulk/update", () => {
    it("should call deviceController.bulkUpdate function", async () => {
      const bulkUpdateStub = sinon.stub(deviceController, "bulkUpdate");
      const app = express();
      app.use("/", router);
      await request(app).post("/bulk/update");
      expect(bulkUpdateStub.calledOnce).to.be.true;
      bulkUpdateStub.restore();
    });

    // Add more tests for query parameters, request body, and error cases if needed
  });

  // Add more describe blocks and tests for other endpoints such as "/bulk/add", "/decrypt", "/decrypt/bulk", "/encrypt", "/count", and "/"
});
