require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const request = require("supertest");
const express = require("express");
const router = require("@routes/v1/cohorts");

// Mocking the required modules
const createCohortController = require("@controllers/create-cohort");
const mongoose = require("mongoose");
const NetworkSchema = require("@models/Network");
const { getModelByTenant } = require("@config/database");

describe("Cohort Router", () => {
  let app;

  before(() => {
    // Create a new express app and use the router
    app = express();
    app.use(router);
  });

  describe("DELETE /:cohort_id", () => {
    it("should call createCohortController.delete with the correct parameters", async () => {
      const deleteSpy = sinon.spy(createCohortController, "delete");

      await request(app)
        .delete("/your-path/123")
        .query({ tenant: "airqo" });

      expect(deleteSpy.calledOnce).to.be.true;
      expect(deleteSpy.firstCall.args[0].params.cohort_id).to.equal("123");
      expect(deleteSpy.firstCall.args[0].query.tenant).to.equal("airqo");

      deleteSpy.restore();
    });
  });

  describe("PUT /:cohort_id", () => {
    it("should call createCohortController.update with the correct parameters", async () => {
      const updateSpy = sinon.spy(createCohortController, "update");

      await request(app)
        .put("/your-path/123")
        .query({ tenant: "airqo" })
        .send({
          name: "Test Cohort",
          description: "Test description",
          network: "test_network",
        });

      expect(updateSpy.calledOnce).to.be.true;
      expect(updateSpy.firstCall.args[0].params.cohort_id).to.equal("123");
      expect(updateSpy.firstCall.args[0].query.tenant).to.equal("airqo");
      expect(updateSpy.firstCall.args[0].body.name).to.equal("Test Cohort");
      expect(updateSpy.firstCall.args[0].body.description).to.equal(
        "Test description"
      );
      expect(updateSpy.firstCall.args[0].body.network).to.equal("test_network");

      updateSpy.restore();
    });
  });

  // Add more test cases for other routes

  describe("Error handling", () => {
    it("should return 404 if route not found", async () => {
      const response = await request(app).get("/invalid-route");

      expect(response.status).to.equal(404);
      expect(response.body.message).to.equal("Not Found");
    });
  });
});
