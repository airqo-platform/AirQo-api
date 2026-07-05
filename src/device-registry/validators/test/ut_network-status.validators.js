require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

const mockRequest = (query = {}, body = {}, params = {}) => ({
  query,
  body,
  params,
  headers: {},
  get: function(header) {
    return this.headers[header];
  },
});

// Run a middleware chain sequentially and resolve when done
const runMiddlewareChain = (chain, req) =>
  new Promise((resolve) => {
    let idx = 0;
    const res = {};
    const runNext = (err) => {
      if (err || idx >= chain.length) return resolve(err);
      const mw = chain[idx++];
      Promise.resolve(mw(req, res, runNext)).catch(runNext);
    };
    runNext();
  });

describe("networkStatusValidations", () => {
  let validations;
  let NetworkModelStub;

  before(() => {
    // Stub the NetworkModel used by validateNetwork to avoid real DB calls
    const networkNames = ["airqo", "iqair"];
    NetworkModelStub = sinon.stub().returns({
      distinct: sinon.stub().resolves(networkNames),
    });

    validations = require("@validators/network-status.validators");
  });

  afterEach(() => {
    sinon.restore();
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe("create", () => {
    const validBody = {
      checked_at: new Date().toISOString(),
      total_deployed_devices: 100,
      offline_devices_count: 10,
      offline_percentage: 10,
      status: "OK",
      message: "ok",
      threshold_exceeded: false,
      threshold_value: 35,
    };

    it("should pass with valid body", async () => {
      const req = mockRequest({}, validBody);
      await runMiddlewareChain(validations.create, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });

    it("should fail when checked_at is missing", async () => {
      const { checked_at, ...body } = validBody;
      const req = mockRequest({}, body);
      await runMiddlewareChain(validations.create, req);
      const errors = validationResult(req);
      expect(errors.isEmpty()).to.be.false;
      expect(errors.array().some((e) => e.msg.includes("checked_at"))).to.be.true;
    });

    it("should fail when checked_at is not a valid ISO date", async () => {
      const req = mockRequest({}, { ...validBody, checked_at: "not-a-date" });
      await runMiddlewareChain(validations.create, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when total_deployed_devices is missing", async () => {
      const { total_deployed_devices, ...body } = validBody;
      const req = mockRequest({}, body);
      await runMiddlewareChain(validations.create, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when total_deployed_devices is negative", async () => {
      const req = mockRequest({}, { ...validBody, total_deployed_devices: -1 });
      await runMiddlewareChain(validations.create, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when offline_devices_count exceeds total_deployed_devices", async () => {
      const req = mockRequest(
        {},
        { ...validBody, total_deployed_devices: 50, offline_devices_count: 100 }
      );
      await runMiddlewareChain(validations.create, req);
      const errors = validationResult(req);
      expect(errors.isEmpty()).to.be.false;
      expect(
        errors.array().some((e) => e.msg.includes("cannot exceed"))
      ).to.be.true;
    });

    it("should fail when status is not in [OK, WARNING, CRITICAL]", async () => {
      const req = mockRequest({}, { ...validBody, status: "UNKNOWN" });
      await runMiddlewareChain(validations.create, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when message is missing", async () => {
      const { message, ...body } = validBody;
      const req = mockRequest({}, body);
      await runMiddlewareChain(validations.create, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when threshold_exceeded is missing", async () => {
      const { threshold_exceeded, ...body } = validBody;
      const req = mockRequest({}, body);
      await runMiddlewareChain(validations.create, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when threshold_value is out of range", async () => {
      const req = mockRequest({}, { ...validBody, threshold_value: 110 });
      await runMiddlewareChain(validations.create, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should allow alert_type as optional string", async () => {
      const req = mockRequest({}, { ...validBody, alert_type: "NETWORK_STATUS" });
      await runMiddlewareChain(validations.create, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });
  });

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------

  describe("list", () => {
    it("should pass with no query params", async () => {
      const req = mockRequest({});
      await runMiddlewareChain(validations.list, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });

    it("should pass with valid tenant", async () => {
      const req = mockRequest({ tenant: "airqo" });
      await runMiddlewareChain(validations.list, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });

    it("should fail with invalid tenant", async () => {
      const req = mockRequest({ tenant: "invalid_tenant_xyz" });
      await runMiddlewareChain(validations.list, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when status is not OK/WARNING/CRITICAL", async () => {
      const req = mockRequest({ status: "UNKNOWN" });
      await runMiddlewareChain(validations.list, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when threshold_exceeded is not true or false string", async () => {
      const req = mockRequest({ threshold_exceeded: "yes" });
      await runMiddlewareChain(validations.list, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should pass when threshold_exceeded is 'true'", async () => {
      const req = mockRequest({ threshold_exceeded: "true" });
      await runMiddlewareChain(validations.list, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });

    it("should fail when end_date is before start_date", async () => {
      const req = mockRequest({
        start_date: "2025-06-01",
        end_date: "2025-01-01",
      });
      await runMiddlewareChain(validations.list, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should pass with valid date range", async () => {
      const req = mockRequest({
        start_date: "2025-01-01",
        end_date: "2025-06-01",
      });
      await runMiddlewareChain(validations.list, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });
  });

  // ---------------------------------------------------------------------------
  // getRecentAlerts
  // ---------------------------------------------------------------------------

  describe("getRecentAlerts", () => {
    it("should fail when hours is out of range (< 1)", async () => {
      const req = mockRequest({ hours: "0" });
      await runMiddlewareChain(validations.getRecentAlerts, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should fail when hours is out of range (> 168)", async () => {
      const req = mockRequest({ hours: "200" });
      await runMiddlewareChain(validations.getRecentAlerts, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should pass when hours is within range", async () => {
      const req = mockRequest({ hours: "24" });
      await runMiddlewareChain(validations.getRecentAlerts, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });
  });

  // ---------------------------------------------------------------------------
  // getUptimeSummary
  // ---------------------------------------------------------------------------

  describe("getUptimeSummary", () => {
    it("should fail when days is out of range (> 90)", async () => {
      const req = mockRequest({ days: "100" });
      await runMiddlewareChain(validations.getUptimeSummary, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });

    it("should pass when days is within range", async () => {
      const req = mockRequest({ days: "7" });
      await runMiddlewareChain(validations.getUptimeSummary, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });
  });

  // ---------------------------------------------------------------------------
  // getStatistics
  // ---------------------------------------------------------------------------

  describe("getStatistics", () => {
    it("should pass with no params", async () => {
      const req = mockRequest({});
      await runMiddlewareChain(validations.getStatistics, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });

    it("should fail with invalid tenant", async () => {
      const req = mockRequest({ tenant: "bad_tenant" });
      await runMiddlewareChain(validations.getStatistics, req);
      expect(validationResult(req).isEmpty()).to.be.false;
    });
  });

  // ---------------------------------------------------------------------------
  // getNetworkBreakdown
  // ---------------------------------------------------------------------------

  describe("getNetworkBreakdown", () => {
    it("should pass with no params", async () => {
      const req = mockRequest({});
      await runMiddlewareChain(validations.getNetworkBreakdown, req);
      expect(validationResult(req).isEmpty()).to.be.true;
    });
  });
});
