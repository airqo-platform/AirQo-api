require("module-alias/register");
const express = require("express");
const chai = require("chai");
const sinon = require("sinon");
const { expect } = chai;
const { createSandbox } = sinon;
const request = require("supertest");

const app = express();

// Import your event controller here
const eventController = require("@controllers/create-event");

// Import your router here
const router = require("@routes/v1/events");

describe("Event Router", () => {
  let sandbox;

  before(() => {
    sandbox = createSandbox();
    app.use(router);
  });

  afterEach(() => {
    sandbox.restore();
  });

  /******************** create-event use-case *******************************/
  describe("GET /running", () => {
    it("should return 200 with a list of running devices", async () => {
      // Mock the eventController.listRunningDevices function
      sandbox.stub(eventController, "listRunningDevices").resolves([]);

      const response = await request(app).get("/running");

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an("array");
    });

    it("should return 400 if invalid query parameters are provided", async () => {
      const response = await request(app)
        .get("/running")
        .query({
          startTime: "2023-01-01T00:00:00Z",
          endTime: "invalid-date",
        });

      expect(response.status).to.equal(400);
    });
  });

  describe("GET /good", () => {
    // Add similar tests as above for the /good route
    // Mock the eventController.listGood function
  });

  describe("GET /moderate", () => {
    // Add similar tests as above for the /moderate route
    // Mock the eventController.listModerate function
  });

  describe("GET /u4sg", () => {
    // Add similar tests as above for the /u4sg route
    // Mock the eventController.listU4sg function
  });
});
