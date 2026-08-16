require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const express = require("express");
const request = require("supertest");
const proxyquire = require("proxyquire");

const realController = require("@controllers/cohort.controller");

const VALID_COHORT_ID = "507f1f77bcf86cd799439011";
const VALID_DEVICE_ID = "507f1f77bcf86cd799439012";
const VALID_NET_ID = "507f1f77bcf86cd799439013";

/**
 * Mounts the real cohorts.routes.js router with one or more controller
 * methods stubbed (the real controller module is spread so every route
 * still has a valid handler function to bind to at registration time —
 * only the methods under test are overridden). @airqo-packages/rbac-middleware
 * is left real; none of the routes covered here reference requirePermission
 * (that's covered separately by ut_cohorts-devices-pilot.routes.js).
 */
const mountRoutesWithControllerStub = (controllerOverrides) => {
  const controllerStub = { ...realController, ...controllerOverrides };
  const cohortsRoutes = proxyquire("@routes/v2/cohorts.routes", {
    "@controllers/cohort.controller": controllerStub,
  });

  const app = express();
  app.use(express.json());
  app.use("/cohorts", cohortsRoutes);
  return app;
};

const okStub = () =>
  sinon.stub().callsFake((req, res) => {
    res.status(200).json({ success: true, message: "ok" });
  });

describe("cohorts.routes.js", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("DELETE /cohorts/:cohort_id", () => {
    it("should call the delete controller for a valid cohort_id", async () => {
      const deleteStub = okStub();
      const app = mountRoutesWithControllerStub({ delete: deleteStub });

      const response = await request(app).delete(`/cohorts/${VALID_COHORT_ID}`);

      expect(response.status).to.equal(200);
      expect(deleteStub.calledOnce).to.equal(true);
    });

    it("should reject a non-ObjectId cohort_id with a 400 before reaching the controller", async () => {
      const deleteStub = okStub();
      const app = mountRoutesWithControllerStub({ delete: deleteStub });

      const response = await request(app).delete("/cohorts/not-an-object-id");

      expect(response.status).to.equal(400);
      expect(deleteStub.called).to.equal(false);
    });
  });

  describe("PUT /cohorts/:cohort_id/name", () => {
    it("should call updateName for a valid rename request", async () => {
      const updateNameStub = okStub();
      const app = mountRoutesWithControllerStub({ updateName: updateNameStub });

      const response = await request(app)
        .put(`/cohorts/${VALID_COHORT_ID}/name`)
        .send({
          name: "renamed-cohort",
          confirm_update: "true",
          update_reason: "Correcting a typo in the original cohort name",
        });

      expect(response.status).to.equal(200);
      expect(updateNameStub.calledOnce).to.equal(true);
    });
  });

  describe("PUT /cohorts/:cohort_id", () => {
    it("should call update for a valid update request", async () => {
      const updateStub = okStub();
      const app = mountRoutesWithControllerStub({ update: updateStub });

      const response = await request(app)
        .put(`/cohorts/${VALID_COHORT_ID}`)
        .send({ description: "an updated description" });

      expect(response.status).to.equal(200);
      expect(updateStub.calledOnce).to.equal(true);
    });
  });

  describe("POST /cohorts", () => {
    it("should call create for a valid new cohort", async () => {
      const createStub = okStub();
      const app = mountRoutesWithControllerStub({ create: createStub });

      const response = await request(app)
        .post("/cohorts")
        .send({ name: "a new cohort" });

      expect(response.status).to.equal(200);
      expect(createStub.calledOnce).to.equal(true);
    });
  });

  describe("GET /cohorts", () => {
    it("should call list", async () => {
      const listStub = okStub();
      const app = mountRoutesWithControllerStub({ list: listStub });

      const response = await request(app).get("/cohorts");

      expect(response.status).to.equal(200);
      expect(listStub.calledOnce).to.equal(true);
    });
  });

  describe("GET /cohorts/summary", () => {
    it("should call listSummary", async () => {
      const listSummaryStub = okStub();
      const app = mountRoutesWithControllerStub({ listSummary: listSummaryStub });

      const response = await request(app).get("/cohorts/summary");

      expect(response.status).to.equal(200);
      expect(listSummaryStub.calledOnce).to.equal(true);
    });
  });

  describe("GET /cohorts/dashboard", () => {
    it("should call listDashboard", async () => {
      const listDashboardStub = okStub();
      const app = mountRoutesWithControllerStub({ listDashboard: listDashboardStub });

      const response = await request(app).get("/cohorts/dashboard");

      expect(response.status).to.equal(200);
      expect(listDashboardStub.calledOnce).to.equal(true);
    });
  });

  describe("GET /cohorts/users", () => {
    it("should call listUserCohorts", async () => {
      const listUserCohortsStub = okStub();
      const app = mountRoutesWithControllerStub({
        listUserCohorts: listUserCohortsStub,
      });

      const response = await request(app).get("/cohorts/users");

      expect(response.status).to.equal(200);
      expect(listUserCohortsStub.calledOnce).to.equal(true);
    });
  });

  describe("PUT /cohorts/:cohort_id/assign-device/:device_id", () => {
    it("should call assignOneDeviceToCohort for valid ids", async () => {
      const assignOneDeviceStub = okStub();
      const app = mountRoutesWithControllerStub({
        assignOneDeviceToCohort: assignOneDeviceStub,
      });

      const response = await request(app).put(
        `/cohorts/${VALID_COHORT_ID}/assign-device/${VALID_DEVICE_ID}`
      );

      expect(response.status).to.equal(200);
      expect(assignOneDeviceStub.calledOnce).to.equal(true);
    });
  });

  describe("GET /cohorts/:cohort_id/assigned-devices", () => {
    it("should call listAssignedDevices for a valid cohort_id", async () => {
      const listAssignedDevicesStub = okStub();
      const app = mountRoutesWithControllerStub({
        listAssignedDevices: listAssignedDevicesStub,
      });

      const response = await request(app).get(
        `/cohorts/${VALID_COHORT_ID}/assigned-devices`
      );

      expect(response.status).to.equal(200);
      expect(listAssignedDevicesStub.calledOnce).to.equal(true);
    });
  });

  describe("GET /cohorts/:cohort_id/available-devices", () => {
    it("should call listAvailableDevices for a valid cohort_id", async () => {
      const listAvailableDevicesStub = okStub();
      const app = mountRoutesWithControllerStub({
        listAvailableDevices: listAvailableDevicesStub,
      });

      const response = await request(app).get(
        `/cohorts/${VALID_COHORT_ID}/available-devices`
      );

      expect(response.status).to.equal(200);
      expect(listAvailableDevicesStub.calledOnce).to.equal(true);
    });
  });

  describe("POST /cohorts/:cohort_id/assign-devices", () => {
    it("should call assignManyDevicesToCohort for a valid device_ids array", async () => {
      const assignManyDevicesStub = okStub();
      const app = mountRoutesWithControllerStub({
        assignManyDevicesToCohort: assignManyDevicesStub,
      });

      const response = await request(app)
        .post(`/cohorts/${VALID_COHORT_ID}/assign-devices`)
        .send({ device_ids: [VALID_DEVICE_ID] });

      expect(response.status).to.equal(200);
      expect(assignManyDevicesStub.calledOnce).to.equal(true);
    });
  });

  describe("DELETE /cohorts/:cohort_id/unassign-many-devices", () => {
    it("should call unAssignManyDevicesFromCohort for a valid device_ids array", async () => {
      const unassignManyDevicesStub = okStub();
      const app = mountRoutesWithControllerStub({
        unAssignManyDevicesFromCohort: unassignManyDevicesStub,
      });

      const response = await request(app)
        .delete(`/cohorts/${VALID_COHORT_ID}/unassign-many-devices`)
        .send({ device_ids: [VALID_DEVICE_ID] });

      expect(response.status).to.equal(200);
      expect(unassignManyDevicesStub.calledOnce).to.equal(true);
    });
  });

  describe("DELETE /cohorts/:cohort_id/unassign-device/:device_id", () => {
    it("should call unAssignOneDeviceFromCohort for valid ids", async () => {
      const unassignOneDeviceStub = okStub();
      const app = mountRoutesWithControllerStub({
        unAssignOneDeviceFromCohort: unassignOneDeviceStub,
      });

      const response = await request(app).delete(
        `/cohorts/${VALID_COHORT_ID}/unassign-device/${VALID_DEVICE_ID}`
      );

      expect(response.status).to.equal(200);
      expect(unassignOneDeviceStub.calledOnce).to.equal(true);
    });
  });

  describe("POST /cohorts/networks", () => {
    it("should call createNetwork for a valid network payload", async () => {
      const createNetworkStub = okStub();
      const app = mountRoutesWithControllerStub({
        createNetwork: createNetworkStub,
      });

      const response = await request(app)
        .post("/cohorts/networks")
        .send({
          admin_secret: "test-secret",
          net_name: "test-network",
          net_email: "network@example.com",
        });

      expect(response.status).to.equal(200);
      expect(createNetworkStub.calledOnce).to.equal(true);
    });
  });

  describe("PUT /cohorts/networks/:net_id", () => {
    it("should call updateNetwork for a valid net_id", async () => {
      const updateNetworkStub = okStub();
      const app = mountRoutesWithControllerStub({
        updateNetwork: updateNetworkStub,
      });

      const response = await request(app).put(`/cohorts/networks/${VALID_NET_ID}`);

      expect(response.status).to.equal(200);
      expect(updateNetworkStub.calledOnce).to.equal(true);
    });
  });

  describe("DELETE /cohorts/networks/:net_id", () => {
    it("should call deleteNetwork for a valid net_id", async () => {
      const deleteNetworkStub = okStub();
      const app = mountRoutesWithControllerStub({
        deleteNetwork: deleteNetworkStub,
      });

      const response = await request(app).delete(
        `/cohorts/networks/${VALID_NET_ID}`
      );

      expect(response.status).to.equal(200);
      expect(deleteNetworkStub.calledOnce).to.equal(true);
    });
  });

  describe("GET /cohorts/networks", () => {
    it("should call listNetworks", async () => {
      const listNetworksStub = okStub();
      const app = mountRoutesWithControllerStub({
        listNetworks: listNetworksStub,
      });

      const response = await request(app).get("/cohorts/networks");

      expect(response.status).to.equal(200);
      expect(listNetworksStub.calledOnce).to.equal(true);
    });
  });

  describe("GET /cohorts/networks/:net_id", () => {
    it("should call listNetworks for a specific net_id", async () => {
      const listNetworksStub = okStub();
      const app = mountRoutesWithControllerStub({
        listNetworks: listNetworksStub,
      });

      const response = await request(app).get(
        `/cohorts/networks/${VALID_NET_ID}`
      );

      expect(response.status).to.equal(200);
      expect(listNetworksStub.calledOnce).to.equal(true);
    });
  });

  describe("GET /cohorts/verify/:cohort_id", () => {
    it("should call verify for a valid cohort_id", async () => {
      const verifyStub = okStub();
      const app = mountRoutesWithControllerStub({ verify: verifyStub });

      const response = await request(app).get(
        `/cohorts/verify/${VALID_COHORT_ID}`
      );

      expect(response.status).to.equal(200);
      expect(verifyStub.calledOnce).to.equal(true);
    });
  });

  describe("POST /cohorts/from-cohorts", () => {
    it("should call createFromCohorts for a valid payload", async () => {
      const createFromCohortsStub = okStub();
      const app = mountRoutesWithControllerStub({
        createFromCohorts: createFromCohortsStub,
      });

      const response = await request(app)
        .post("/cohorts/from-cohorts")
        .send({ name: "merged-cohort", cohort_ids: [VALID_COHORT_ID] });

      expect(response.status).to.equal(200);
      expect(createFromCohortsStub.calledOnce).to.equal(true);
    });
  });

  describe("POST /cohorts/sites", () => {
    it("should call listSitesByCohort for a valid cohort_ids array", async () => {
      const listSitesByCohortStub = okStub();
      const app = mountRoutesWithControllerStub({
        listSitesByCohort: listSitesByCohortStub,
      });

      const response = await request(app)
        .post("/cohorts/sites")
        .send({ cohort_ids: [VALID_COHORT_ID] });

      expect(response.status).to.equal(200);
      expect(listSitesByCohortStub.calledOnce).to.equal(true);
    });
  });

  describe("POST /cohorts/devices", () => {
    it("should call listDevicesByCohort for a valid cohort_ids array", async () => {
      const listDevicesByCohortStub = okStub();
      const app = mountRoutesWithControllerStub({
        listDevicesByCohort: listDevicesByCohortStub,
      });

      const response = await request(app)
        .post("/cohorts/devices")
        .send({ cohort_ids: [VALID_COHORT_ID] });

      expect(response.status).to.equal(200);
      expect(listDevicesByCohortStub.calledOnce).to.equal(true);
    });
  });

  describe("POST /cohorts/cached-sites", () => {
    it("should call listCachedSitesByCohort for a valid cohort_ids array", async () => {
      const listCachedSitesByCohortStub = okStub();
      const app = mountRoutesWithControllerStub({
        listCachedSitesByCohort: listCachedSitesByCohortStub,
      });

      const response = await request(app)
        .post("/cohorts/cached-sites")
        .send({ cohort_ids: [VALID_COHORT_ID] });

      expect(response.status).to.equal(200);
      expect(listCachedSitesByCohortStub.calledOnce).to.equal(true);
    });
  });

  describe("POST /cohorts/cached-devices", () => {
    it("should call listCachedDevicesByCohort for a valid cohort_ids array", async () => {
      const listCachedDevicesByCohortStub = okStub();
      const app = mountRoutesWithControllerStub({
        listCachedDevicesByCohort: listCachedDevicesByCohortStub,
      });

      const response = await request(app)
        .post("/cohorts/cached-devices")
        .send({ cohort_ids: [VALID_COHORT_ID] });

      expect(response.status).to.equal(200);
      expect(listCachedDevicesByCohortStub.calledOnce).to.equal(true);
    });
  });

  describe("GET /cohorts/:cohort_id", () => {
    it("should call list (the catch-all handler) for a valid cohort_id", async () => {
      const listStub = okStub();
      const app = mountRoutesWithControllerStub({ list: listStub });

      const response = await request(app).get(`/cohorts/${VALID_COHORT_ID}`);

      expect(response.status).to.equal(200);
      expect(listStub.calledOnce).to.equal(true);
    });
  });
});
