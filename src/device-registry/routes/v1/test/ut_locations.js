require("module-alias/register");
const express = require("express");
const request = require("supertest");
const { expect } = require("chai");
const sinon = require("sinon");
const locationController = require("@controllers/create-location");
const constants = require("@config/constants");
const createAirQloudUtil = require("@utils/create-location");
const router = require("@routes/v1/locations");

// Test data (if needed)
const testTenant = "test_tenant";
const testId = "test_id";
const testObjectId = new mongoose.Types.ObjectId();

describe("Location Router", () => {
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

  describe("POST /locations", () => {
    it("should call locationController.register function", async () => {
      const registerStub = sinon.stub(locationController, "register");
      const app = express();
      app.use("/", router);
      await request(app)
        .post("/")
        .send({
          tenant: testTenant,
          name: "Test Location",
          // Add other necessary request body properties here
        });
      expect(registerStub.calledOnce).to.be.true;
      registerStub.restore();
    });

    // Add more tests for different scenarios and validation checks if needed
  });

  describe("GET /locations", () => {
    it("should call locationController.list function", async () => {
      const listStub = sinon.stub(locationController, "list");
      const app = express();
      app.use("/", router);
      await request(app)
        .get("/")
        .query({ tenant: testTenant });
      expect(listStub.calledOnce).to.be.true;
      listStub.restore();
    });

    // Add more tests for different scenarios and query parameters if needed
  });

  // Add more describe blocks and tests for other endpoints such as "/locations/summary", "PUT /locations", and "DELETE /locations"
});
