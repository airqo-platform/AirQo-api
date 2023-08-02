require("module-alias/register");
const express = require("express");
const request = require("supertest");
const { expect } = require("chai");
const sinon = require("sinon");

// Import the modules to be tested
const siteController = require("@controllers/create-site");
const createSiteUtil = require("@utils/create-site");
const constants = require("@config/constants");
const mongoose = require("mongoose");

// Import the Express Router to be tested
const router = require("@routes/v2/sites"); // Update this with the path to your actual router file

// Test data (if needed)
const testTenant = "test_tenant";
const testId = "test_id";
const testLatLong = "test_lat_long";
const testGeneratedName = "test_generated_name";
const testObjectId = new mongoose.Types.ObjectId();

describe("Site Router", () => {
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

  describe("GET /", () => {
    it("should call siteController.list function", async () => {
      const listStub = sinon.stub(siteController, "list");
      const app = express();
      app.use("/", router);
      await request(app).get("/");
      expect(listStub.calledOnce).to.be.true;
      listStub.restore();
    });

    // Add more tests for query parameters and error cases if needed
  });

  describe("GET /summary", () => {
    // Add tests for the "GET /summary" endpoint
  });

  describe("GET /weather", () => {
    // Add tests for the "GET /weather" endpoint
  });

  describe("GET /weather/nearest", () => {
    // Add tests for the "GET /weather/nearest" endpoint
  });

  describe("GET /airqlouds/", () => {
    // Add tests for the "GET /airqlouds/" endpoint
  });

  describe("POST /", () => {
    // Add tests for the "POST /" endpoint
  });

  describe("POST /metadata", () => {
    // Add tests for the "POST /metadata" endpoint
  });

  describe("PUT /", () => {
    // Add tests for the "PUT /" endpoint
  });

  describe("PUT /refresh", () => {
    // Add tests for the "PUT /refresh" endpoint
  });

  describe("DELETE /", () => {
    // Add tests for the "DELETE /" endpoint
  });

  describe("GET /nearest", () => {
    // Add tests for the "GET /nearest" endpoint
  });
});
