require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const express = require("express");
const request = require("supertest");
const createCohortController = require("@controllers/create-cohort");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { logElement, logText, logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- cohorts-route-v2`);
const { getModelByTenant } = require("@config/database");
const NetworkSchema = require("@models/Network");

const app = express();
app.use(express.json());

/*************************** Mocked Data ***************************/
// Replace with relevant mocked data

/*************************** Unit Test ***************************/
describe("Cohort Controller", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("DELETE /cohorts/:cohort_id", () => {
    it("should delete a cohort", async () => {
      const deleteStub = sinon.stub(createCohortController, "delete");
      // Replace with relevant implementation and expected response

      const response = await request(app).delete("/cohorts/:cohort_id");

      // Add assertions based on expected response and function calls
      expect(response.status).to.equal(200);
    });
  });

  describe("PUT /cohorts/:cohort_id", () => {
    it("should update a cohort", async () => {
      const updateStub = sinon.stub(createCohortController, "update");
      // Replace with relevant implementation and expected response

      const response = await request(app).put("/cohorts/:cohort_id");

      // Add assertions based on expected response and function calls
      expect(response.status).to.equal(200);
    });
  });

  describe("POST /cohorts", () => {
    it("should create a new cohort", async () => {
      const createStub = sinon.stub(createCohortController, "create");
      // Replace with relevant implementation and expected response

      const response = await request(app).post("/cohorts");

      // Add assertions based on expected response and function calls
      expect(response.status).to.equal(200);
    });
  });

  describe("GET /cohorts", () => {
    it("should list cohorts", async () => {
      const listStub = sinon.stub(createCohortController, "list");
      // Replace with relevant implementation and expected response

      const response = await request(app).get("/cohorts");

      // Add assertions based on expected response and function calls
      expect(response.status).to.equal(200);
    });
  });

  describe("GET /cohorts/summary", () => {
    it("should list cohort summaries", async () => {
      const listSummaryStub = sinon.stub(createCohortController, "listSummary");
      // Replace with relevant implementation and expected response

      const response = await request(app).get("/cohorts/summary");

      // Add assertions based on expected response and function calls
      expect(response.status).to.equal(200);
    });
  });

  describe("GET /cohorts/dashboard", () => {
    it("should list cohort dashboard data", async () => {
      const listDashboardStub = sinon.stub(
        createCohortController,
        "listDashboard"
      );
      // Replace with relevant implementation and expected response

      const response = await request(app).get("/cohorts/dashboard");

      // Add assertions based on expected response and function calls
      expect(response.status).to.equal(200);
    });
  });

  describe("PUT /cohorts/:cohort_id/assign-device/:device_id", () => {
    it("should assign a device to a cohort", async () => {
      const assignOneDeviceStub = sinon.stub(
        createCohortController,
        "assignOneDeviceToCohort"
      );
      // Replace with relevant implementation and expected response

      const response = await request(app).put(
        "/cohorts/:cohort_id/assign-device/:device_id"
      );

      // Add assertions based on expected response and function calls
      expect(response.status).to.equal(200);
    });
  });

  describe("GET /cohorts/:cohort_id/assigned-devices", () => {
    it("should list assigned devices for a cohort", async () => {
      const listAssignedDevicesStub = sinon.stub(
        createCohortController,
        "listAssignedDevices"
      );
      // Replace with relevant implementation and expected response

      const response = await request(app).get(
        "/cohorts/:cohort_id/assigned-devices"
      );

      // Add assertions based on expected response and function calls
      expect(response.status).to.equal(200);
    });
  });

  describe("GET /cohorts/:cohort_id/available-devices", () => {
    it("should list available devices for a cohort", async () => {
      const listAvailableDevicesStub = sinon.stub(
        createCohortController,
        "listAvailableDevices"
      );
      // Replace with relevant implementation and expected response

      const response = await request(app).get(
        "/cohorts/:cohort_id/available-devices"
      );

      // Add assertions based on expected response and function calls
      expect(response.status).to.equal(200);
    });
  });

  describe("POST /cohorts/:cohort_id/assign-devices", () => {
    it("should assign multiple devices to a cohort", async () => {
      const assignManyDevicesStub = sinon.stub(
        createCohortController,
        "assignManyDevicesToCohort"
      );
      // Replace with relevant implementation and expected response

      const response = await request(app).post(
        "/cohorts/:cohort_id/assign-devices"
      );

      // Add assertions based on expected response and function calls
      expect(response.status).to.equal(200);
    });
  });

  describe("DELETE /cohorts/:cohort_id/unassign-many-devices", () => {
    it("should unassign multiple devices from a cohort", async () => {
      const unassignManyDevicesStub = sinon.stub(
        createCohortController,
        "unAssignManyDevicesFromCohort"
      );
      // Replace with relevant implementation and expected response

      const response = await request(app).delete(
        "/cohorts/:cohort_id/unassign-many-devices"
      );

      // Add assertions based on expected response and function calls
      expect(response.status).to.equal(200);
    });
  });

  describe("DELETE /cohorts/:cohort_id/unassign-device/:device_id", () => {
    it("should unassign a device from a cohort", async () => {
      const unassignOneDeviceStub = sinon.stub(
        createCohortController,
        "unAssignOneDeviceFromCohort"
      );
      // Replace with relevant implementation and expected response

      const response = await request(app).delete(
        "/cohorts/:cohort_id/unassign-device/:device_id"
      );

      // Add assertions based on expected response and function calls
      expect(response.status).to.equal(200);
    });
  });

  describe("POST /cohorts/networks", () => {
    it("should create a new network", async () => {
      const createNetworkStub = sinon.stub(
        createCohortController,
        "createNetwork"
      );
      // Replace with relevant implementation and expected response

      const response = await request(app).post("/cohorts/networks");

      // Add assertions based on expected response and function calls
      expect(response.status).to.equal(200);
    });
  });

  describe("PUT /cohorts/networks/:net_id", () => {
    it("should update a network", async () => {
      const updateNetworkStub = sinon.stub(
        createCohortController,
        "updateNetwork"
      );
      // Replace with relevant implementation and expected response

      const response = await request(app).put("/cohorts/networks/:net_id");

      // Add assertions based on expected response and function calls
      expect(response.status).to.equal(200);
    });
  });

  describe("DELETE /cohorts/networks/:net_id", () => {
    it("should delete a network", async () => {
      const deleteNetworkStub = sinon.stub(
        createCohortController,
        "deleteNetwork"
      );
      // Replace with relevant implementation and expected response

      const response = await request(app).delete("/cohorts/networks/:net_id");

      // Add assertions based on expected response and function calls
      expect(response.status).to.equal(200);
    });
  });

  describe("GET /cohorts/networks", () => {
    it("should list networks", async () => {
      const listNetworksStub = sinon.stub(
        createCohortController,
        "listNetworks"
      );
      // Replace with relevant implementation and expected response

      const response = await request(app).get("/cohorts/networks");

      // Add assertions based on expected response and function calls
      expect(response.status).to.equal(200);
    });
  });

  describe("GET /cohorts/networks/:net_id", () => {
    it("should get a specific network", async () => {
      const getNetworkStub = sinon.stub(createCohortController, "listNetworks");
      // Replace with relevant implementation and expected response

      const response = await request(app).get("/cohorts/networks/:net_id");

      // Add assertions based on expected response and function calls
      expect(response.status).to.equal(200);
    });
  });
});
