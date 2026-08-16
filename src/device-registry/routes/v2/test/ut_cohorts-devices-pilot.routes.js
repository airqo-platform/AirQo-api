require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const express = require("express");
const request = require("supertest");
const proxyquire = require("proxyquire");

const realController = require("@controllers/cohort.controller");

const VALID_COHORT_ID = "507f1f77bcf86cd799439011";
const VALID_DEVICE_ID = "507f1f77bcf86cd799439012";

/**
 * Loads a fresh copy of cohorts.routes.js with the real controller (minus
 * assignManyDevicesToCohort, which is stubbed) and a stubbed
 * @airqo-packages/rbac-middleware, so this test isolates route wiring —
 * i.e. "is the new pilot route gated by requirePermission and does the old
 * route remain ungated" — from both the controller/util business logic
 * (covered elsewhere) and the requirePermission middleware's own logic
 * (covered by packages/airqo-rbac-middleware/test/requirePermission.test.js).
 */
const loadRoutesWithStubs = ({ assignManyDevicesStub, requirePermissionMiddlewareFactory }) => {
  const controllerStub = {
    ...realController,
    assignManyDevicesToCohort: assignManyDevicesStub,
  };

  const cohortsRoutes = proxyquire("@routes/v2/cohorts.routes", {
    "@controllers/cohort.controller": controllerStub,
    "@airqo-packages/rbac-middleware": {
      requirePermission: requirePermissionMiddlewareFactory,
    },
  });

  const app = express();
  app.use(express.json());
  app.use("/cohorts", cohortsRoutes);
  return app;
};

describe("cohorts.routes.js — RBAC pilot route (POST /:cohort_id/devices)", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("calls the controller when requirePermission grants access", async () => {
    const assignManyDevicesStub = sinon.stub().callsFake((req, res) => {
      res.status(200).json({ success: true, data: { assigned: [], already_assigned: [] } });
    });
    const requirePermissionMiddlewareFactory = sinon
      .stub()
      .returns((req, res, next) => next());

    const app = loadRoutesWithStubs({
      assignManyDevicesStub,
      requirePermissionMiddlewareFactory,
    });

    const response = await request(app)
      .post(`/cohorts/${VALID_COHORT_ID}/devices`)
      .send({ device_ids: [VALID_DEVICE_ID] });

    expect(requirePermissionMiddlewareFactory.calledWith("DEVICE_UPDATE")).to.equal(true);
    expect(assignManyDevicesStub.calledOnce).to.equal(true);
    expect(response.status).to.equal(200);
  });

  it("never reaches the controller when requirePermission denies access", async () => {
    const assignManyDevicesStub = sinon.stub();
    const requirePermissionMiddlewareFactory = sinon.stub().returns((req, res) => {
      res.status(403).json({
        success: false,
        message: "Insufficient permissions",
        status: 403,
        errors: { message: "This action requires the 'DEVICE_UPDATE' permission" },
      });
    });

    const app = loadRoutesWithStubs({
      assignManyDevicesStub,
      requirePermissionMiddlewareFactory,
    });

    const response = await request(app)
      .post(`/cohorts/${VALID_COHORT_ID}/devices`)
      .send({ device_ids: [VALID_DEVICE_ID] });

    expect(response.status).to.equal(403);
    expect(assignManyDevicesStub.called).to.equal(false);
  });

  it("still returns validation errors for a malformed body before reaching requirePermission", async () => {
    const assignManyDevicesStub = sinon.stub();
    const requirePermissionMiddlewareFactory = sinon.stub().returns((req, res, next) => next());

    const app = loadRoutesWithStubs({
      assignManyDevicesStub,
      requirePermissionMiddlewareFactory,
    });

    const response = await request(app)
      .post(`/cohorts/${VALID_COHORT_ID}/devices`)
      .send({ device_ids: "not-an-array" });

    expect(response.status).to.equal(400);
    expect(assignManyDevicesStub.called).to.equal(false);
    expect(requirePermissionMiddlewareFactory.called).to.equal(true); // factory runs at route-definition time regardless
  });

  it("leaves the existing POST /:cohort_id/assign-devices route ungated (no RBAC check today)", async () => {
    const assignManyDevicesStub = sinon.stub().callsFake((req, res) => {
      res.status(200).json({ success: true, data: { assigned: [], already_assigned: [] } });
    });
    // requirePermission is stubbed but must never be invoked as a per-request
    // middleware for the OLD route, since that route doesn't reference it.
    const requirePermissionMiddlewareFactory = sinon.stub().returns((req, res, next) => {
      throw new Error("requirePermission should not run for the pre-existing assign-devices route");
    });

    const app = loadRoutesWithStubs({
      assignManyDevicesStub,
      requirePermissionMiddlewareFactory,
    });

    const response = await request(app)
      .post(`/cohorts/${VALID_COHORT_ID}/assign-devices`)
      .send({ device_ids: [VALID_DEVICE_ID] });

    expect(response.status).to.equal(200);
    expect(assignManyDevicesStub.calledOnce).to.equal(true);
  });
});
