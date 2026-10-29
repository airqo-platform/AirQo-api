require("module-alias/register");
process.env.NODE_ENV = "development";
const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const { expect } = chai;
const proxyquire = require("proxyquire");
const express = require("express");
const request = require("supertest");

chai.use(sinonChai);

// Exercises the real router (routes/v2/health.routes.js) mounted on a real
// Express app — only the controller layer is stubbed, matching the approach
// used for readings.routes.js so this stays valid across internal refactors.
describe("health.routes.js (mounted at /api/v2/devices/health)", () => {
  const BASE = "/api/v2/devices/health";

  let healthController;

  const buildApp = (controllerOverrides = {}) => {
    healthController = {
      check: sinon.stub().callsFake((req, res) => {
        res.status(200).json({ success: true, calledWith: "check" });
      }),
      ready: sinon.stub().callsFake((req, res) => {
        res.status(200).json({ success: true, calledWith: "ready" });
      }),
      getJobMetrics: sinon.stub().callsFake((req, res) => {
        res.status(200).json({ success: true, calledWith: "getJobMetrics" });
      }),
    };
    Object.assign(healthController, controllerOverrides);

    const router = proxyquire("@routes/v2/health.routes", {
      "@controllers/health.controller": healthController,
    });

    const app = express();
    app.use(express.json());
    app.use(BASE, router);
    return app;
  };

  describe("GET /ready", () => {
    it("reaches healthController.ready and returns 200 when the controller reports ready", async () => {
      const app = buildApp();

      const res = await request(app).get(`${BASE}/ready`);

      expect(res.status).to.equal(200);
      expect(healthController.ready).to.have.been.calledOnce;
    });

    it("returns 503 when the controller reports not ready", async () => {
      const app = buildApp({
        ready: sinon.stub().callsFake((req, res) => {
          res.status(503).json({ success: false, status: "not_ready" });
        }),
      });

      const res = await request(app).get(`${BASE}/ready`);

      expect(res.status).to.equal(503);
      expect(healthController.ready).to.have.been.calledOnce;
    });

    it("does not require any query params (no tenant validation on the readiness route)", async () => {
      const app = buildApp();

      const res = await request(app).get(`${BASE}/ready`).query({ foo: "bar" });

      expect(res.status).to.equal(200);
      expect(healthController.ready).to.have.been.calledOnce;
    });
  });
});
