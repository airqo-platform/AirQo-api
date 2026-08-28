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

// Exercises the real router (routes/v2/sites.routes.js) mounted on a real
// Express app with real validators — only the controller layer is stubbed.
// Scoped to the new GET /picker route only (see ut_readings.routes.js for
// the rationale on driving requests through supertest rather than asserting
// on router internals). The existing ut_sites.routes.js predates the v2
// refactor and targets modules that no longer exist (@controllers/create-site,
// @routes/v2/sites) — left untouched here since fixing it is a separate,
// unrelated concern from the /picker route this file covers.
describe("sites.routes.js /picker (mounted at /api/v2/devices/sites)", () => {
  const BASE = "/api/v2/devices/sites";
  const validGroupId = "624d2f9a994194001ddccbb6";

  // Every method sites.routes.js references directly at module-load time —
  // all must exist on the stub or router.get()/router.post() throws while
  // building the route table, before a single request is ever made.
  const controllerMethods = [
    "createApproximateCoordinates",
    "delete",
    "findNearestSite",
    "generateMetadata",
    "getMySites",
    "getSiteCountSummary",
    "getSiteDetailsById",
    "list",
    "listDataAvailableSites",
    "listForComparisonPicker",
    "listNearestWeatherStation",
    "listNotTransmittingSites",
    "listOperationalSites",
    "listSummary",
    "listTransmittingSites",
    "listWeatherStations",
    "refresh",
    "register",
    "update",
    "updateManySites",
  ];

  let siteController;

  const buildApp = (controllerOverrides = {}) => {
    siteController = {};
    controllerMethods.forEach((method) => {
      siteController[method] = sinon.stub().callsFake((req, res) => {
        res.status(200).json({ success: true, calledWith: method });
      });
    });
    Object.assign(siteController, controllerOverrides);

    const router = proxyquire("@routes/v2/sites.routes", {
      "@controllers/site.controller": siteController,
    });

    const app = express();
    app.use(express.json());
    app.use(BASE, router);
    return app;
  };

  describe("GET /picker", () => {
    it("reaches listForComparisonPicker for a valid group_id", async () => {
      const app = buildApp();

      const res = await request(app)
        .get(`${BASE}/picker`)
        .query({ group_id: validGroupId });

      expect(res.status).to.equal(200);
      expect(siteController.listForComparisonPicker).to.have.been.calledOnce;
    });

    it("returns 400 and never reaches the controller when group_id is missing", async () => {
      const app = buildApp();

      const res = await request(app).get(`${BASE}/picker`);

      expect(res.status).to.equal(400);
      expect(siteController.listForComparisonPicker).to.not.have.been.called;
    });

    it("returns 400 when group_id is not a valid ObjectId", async () => {
      const app = buildApp();

      const res = await request(app)
        .get(`${BASE}/picker`)
        .query({ group_id: "not-an-object-id" });

      expect(res.status).to.equal(400);
      expect(siteController.listForComparisonPicker).to.not.have.been.called;
    });

    it("returns 400 when limit exceeds the 80 cap", async () => {
      const app = buildApp();

      const res = await request(app)
        .get(`${BASE}/picker`)
        .query({ group_id: validGroupId, limit: 81 });

      expect(res.status).to.equal(400);
      expect(siteController.listForComparisonPicker).to.not.have.been.called;
    });

    it("returns 400 when limit is below 1", async () => {
      const app = buildApp();

      const res = await request(app)
        .get(`${BASE}/picker`)
        .query({ group_id: validGroupId, limit: 0 });

      expect(res.status).to.equal(400);
      expect(siteController.listForComparisonPicker).to.not.have.been.called;
    });

    it("returns 400 when skip is negative", async () => {
      const app = buildApp();

      const res = await request(app)
        .get(`${BASE}/picker`)
        .query({ group_id: validGroupId, skip: -1 });

      expect(res.status).to.equal(400);
      expect(siteController.listForComparisonPicker).to.not.have.been.called;
    });

    it("returns 400 for an invalid sort_by value", async () => {
      const app = buildApp();

      const res = await request(app)
        .get(`${BASE}/picker`)
        .query({ group_id: validGroupId, sort_by: "name" });

      expect(res.status).to.equal(400);
      expect(siteController.listForComparisonPicker).to.not.have.been.called;
    });

    it("returns 400 for an invalid sort_order value", async () => {
      const app = buildApp();

      const res = await request(app)
        .get(`${BASE}/picker`)
        .query({ group_id: validGroupId, sort_order: "up" });

      expect(res.status).to.equal(400);
      expect(siteController.listForComparisonPicker).to.not.have.been.called;
    });

    it("accepts valid sort_by/sort_order/limit/skip/search combinations", async () => {
      const app = buildApp();

      const res = await request(app).get(`${BASE}/picker`).query({
        group_id: validGroupId,
        sort_by: "city",
        sort_order: "desc",
        limit: 10,
        skip: 5,
        search: "kampala",
      });

      expect(res.status).to.equal(200);
      expect(siteController.listForComparisonPicker).to.have.been.calledOnce;
    });
  });
});
