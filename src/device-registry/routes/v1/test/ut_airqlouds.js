require("module-alias/register");
const express = require("express");
const request = require("supertest");
const { expect } = require("chai");
const sinon = require("sinon");

// Import the modules to be tested
const airqloudController = require("@controllers/create-airqloud");
const constants = require("@config/constants");
const mongoose = require("mongoose");

// Import the Express Router to be tested
const router = require("@routes/v1/airqlouds");
// Test data (if needed)
const testTenant = "test_tenant";
const testId = "test_id";
const testObjectId = new mongoose.Types.ObjectId();

describe("Airqloud Router", () => {
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

  describe("POST /", () => {
    it("should call airqloudController.register function", async () => {
      const registerStub = sinon.stub(airqloudController, "register");
      const app = express();
      app.use("/", router);
      await request(app).post("/");
      expect(registerStub.calledOnce).to.be.true;
      registerStub.restore();
    });

    // Add more tests for query parameters, request body, and error cases if needed
  });

  describe("PUT /refresh", () => {
    it("should call airqloudController.refresh function", async () => {
      const refreshStub = sinon.stub(airqloudController, "refresh");
      const app = express();
      app.use("/", router);
      await request(app).put("/refresh");
      expect(refreshStub.calledOnce).to.be.true;
      refreshStub.restore();
    });

    // Add more tests for query parameters and error cases if needed
  });

  describe("GET /", () => {
    it("should call airqloudController.list function", async () => {
      const listStub = sinon.stub(airqloudController, "list");
      const app = express();
      app.use("/", router);
      await request(app).get("/");
      expect(listStub.calledOnce).to.be.true;
      listStub.restore();
    });

    // Add more tests for query parameters and error cases if needed
  });

  // Add more describe blocks and tests for other endpoints such as "/summary", "/dashboard", and "/sites"
});
