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

// Exercises the real router (routes/v2/readings.routes.js) mounted on a real
// Express app with real validators — only the controller layer is stubbed.
// A previous version of this file mocked internal registration details
// (@routes/readings, @controllers/create-event, a router.get(path, controller)
// shape) that no longer match this file after the v2 refactor, so it broke
// silently (module-not-found) without ever running. Driving requests through
// supertest instead of asserting on router.get/post call shapes keeps this
// suite valid across future internal refactors of readings.routes.js, as long
// as the routes keep responding the same way over HTTP.
describe("readings.routes.js (mounted at /api/v2/devices/readings)", () => {
  const BASE = "/api/v2/devices/readings";
  const validSiteId1 = "624d2f9a994194001ddccbb6";
  const validSiteId2 = "623d84340e8054001eaaaa13";

  const controllerMethods = [
    "readingsForMap",
    "listForMap",
    "getBestAirQuality",
    "recentReadings",
    "getWorstReadingForDevices",
    "getWorstReadingForSites",
    "getHourlySiteReadings",
    "listReadingAverages",
    "fetchAndStoreData",
    "getNearestReadings",
    "getAirQualityRankingsHistory",
    "getAirQualityRankings",
    "getRepresentativeAirQualityForGrid",
    "getRepresentativeAirQualityForCohort",
  ];

  let eventController;

  const buildApp = (controllerOverrides = {}) => {
    eventController = {};
    controllerMethods.forEach((method) => {
      eventController[method] = sinon.stub().callsFake((req, res) => {
        res.status(200).json({ success: true, calledWith: method });
      });
    });
    Object.assign(eventController, controllerOverrides);

    const router = proxyquire("@routes/v2/readings.routes", {
      "@controllers/event.controller": eventController,
    });

    const app = express();
    app.use(express.json());
    app.use(BASE, router);
    return app;
  };

  describe("GET /recent", () => {
    it("reaches recentReadings for a comma-separated list of valid site_ids", async () => {
      const app = buildApp();

      const res = await request(app)
        .get(`${BASE}/recent`)
        .query({ site_id: `${validSiteId1},${validSiteId2}` });

      expect(res.status).to.equal(200);
      expect(eventController.recentReadings).to.have.been.calledOnce;
    });

    it("returns 400 and never reaches the controller when site_id is not a valid ObjectId", async () => {
      const app = buildApp();

      const res = await request(app)
        .get(`${BASE}/recent`)
        .query({ site_id: "not-an-object-id" });

      expect(res.status).to.equal(400);
      expect(eventController.recentReadings).to.not.have.been.called;
    });

    it("returns 400 when both device_id and site_id are provided", async () => {
      const app = buildApp();

      const res = await request(app)
        .get(`${BASE}/recent`)
        .query({ device_id: validSiteId1, site_id: validSiteId2 });

      expect(res.status).to.equal(400);
      expect(eventController.recentReadings).to.not.have.been.called;
    });
  });

  describe("POST /recent", () => {
    it("reaches recentReadings for a valid site_ids body array", async () => {
      const app = buildApp();

      const res = await request(app)
        .post(`${BASE}/recent`)
        .send({ site_ids: [validSiteId1, validSiteId2] });

      expect(res.status).to.equal(200);
      expect(eventController.recentReadings).to.have.been.calledOnce;
    });

    it("returns 400 and never reaches the controller when site_ids is missing", async () => {
      const app = buildApp();

      const res = await request(app).post(`${BASE}/recent`).send({});

      expect(res.status).to.equal(400);
      expect(eventController.recentReadings).to.not.have.been.called;
    });

    it("returns 400 for an empty site_ids array", async () => {
      const app = buildApp();

      const res = await request(app)
        .post(`${BASE}/recent`)
        .send({ site_ids: [] });

      expect(res.status).to.equal(400);
      expect(eventController.recentReadings).to.not.have.been.called;
    });

    it("returns 400 when site_ids contains an invalid ObjectId", async () => {
      const app = buildApp();

      const res = await request(app)
        .post(`${BASE}/recent`)
        .send({ site_ids: [validSiteId1, "not-an-object-id"] });

      expect(res.status).to.equal(400);
      expect(eventController.recentReadings).to.not.have.been.called;
    });

    it("returns 400 and never reaches the controller when device_id is supplied alongside a site_ids body", async () => {
      const app = buildApp();

      const res = await request(app)
        .post(`${BASE}/recent`)
        .query({ device_id: validSiteId1 })
        .send({ site_ids: [validSiteId1, validSiteId2] });

      expect(res.status).to.equal(400);
      expect(eventController.recentReadings).to.not.have.been.called;
    });

    it("normalizes site_ids onto req.query.site_id the same way GET /recent normalizes ?site_id=", async () => {
      const app = buildApp({
        recentReadings: sinon.stub().callsFake((req, res) => {
          res.status(200).json({
            success: true,
            siteIdTypes: req.query.site_id.map(
              (id) => id && id.constructor && id.constructor.name,
            ),
          });
        }),
      });

      const res = await request(app)
        .post(`${BASE}/recent`)
        .send({ site_ids: [validSiteId1, validSiteId2] });

      expect(res.status).to.equal(200);
      // commonValidations.objectId's sanitizer (run via the shared `recent`
      // validator) converts valid ObjectId strings to ObjectId instances —
      // ["String", "String"] here would mean POST skipped that sanitization.
      expect(res.body.siteIdTypes).to.deep.equal(["ObjectID", "ObjectID"]);
    });
  });

  describe("checkController safety net", () => {
    it("responds 500 instead of throwing when a route's controller function is missing", async () => {
      const app = buildApp({ recentReadings: undefined });

      const res = await request(app)
        .get(`${BASE}/recent`)
        .query({ site_id: validSiteId1 });

      expect(res.status).to.equal(500);
      expect(res.body.error).to.equal("Controller method not available");
    });
  });

  describe("other routes are wired to their controllers", () => {
    it("GET /map reaches readingsForMap", async () => {
      const app = buildApp();

      const res = await request(app).get(`${BASE}/map`);

      expect(res.status).to.equal(200);
      expect(eventController.readingsForMap).to.have.been.calledOnce;
    });

    it("GET /best-air-quality reaches getBestAirQuality", async () => {
      const app = buildApp();

      const res = await request(app).get(`${BASE}/best-air-quality`);

      expect(res.status).to.equal(200);
      expect(eventController.getBestAirQuality).to.have.been.calledOnce;
    });

    it("GET /worst/sites reaches getWorstReadingForSites", async () => {
      const app = buildApp();

      const res = await request(app)
        .get(`${BASE}/worst/sites`)
        .query({ site_id: validSiteId1 });

      expect(res.status).to.equal(200);
      expect(eventController.getWorstReadingForSites).to.have.been.calledOnce;
    });
  });
});
