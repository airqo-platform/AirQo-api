require("module-alias/register");
const express = require("express");
const { expect } = require("chai");
const sinon = require("sinon");
const request = require("supertest");
const eventController = require("@controllers/create-event");
const router = require("@routes/v2/events");
const constants = require("@config/constants");

describe("Event Routes", () => {
  let app;

  before(() => {
    app = express();
    app.use("/", router);
  });

  describe("GET /running", () => {
    it("should respond with a list of running devices", async () => {
      const controllerStub = sinon
        .stub(eventController, "listRunningDevices")
        .resolves([]);
      const response = await request(app).get("/running?tenant=example");
      expect(response.status).to.equal(200);
      expect(controllerStub.calledOnce).to.be.true;
      controllerStub.restore();
    });

    it("should handle validation errors", async () => {
      const response = await request(app).get("/running");
      expect(response.status).to.equal(400);
      expect(response.body).to.have.property("errors");
    });
  });

  describe("GET /good", () => {
    // Similar test cases as above...
  });

  describe("GET /moderate", () => {
    // Similar test cases as above...
  });

  describe("GET /u4sg", () => {
    // Similar test cases as above...
  });
});
