require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const chai = require("chai");
chai.use(sinonChai);
const httpStatus = require("http-status");
const proxyquire = require("proxyquire");

describe("networkStatusController", () => {
  let controller;
  let networkStatusUtilStub;
  let sharedStub;

  const makeRes = () => {
    const res = {};
    res.status = sinon.stub().returns(res);
    res.json = sinon.stub().returns(res);
    res.headersSent = false;
    return res;
  };

  const makeReq = (overrides = {}) => ({
    query: { tenant: "airqo" },
    params: {},
    body: {},
    headers: {},
    ...overrides,
  });

  beforeEach(() => {
    networkStatusUtilStub = {
      createAlert: sinon.stub(),
      list: sinon.stub(),
      getStatistics: sinon.stub(),
      getHourlyTrends: sinon.stub(),
      getRecentAlerts: sinon.stub(),
      getUptimeSummary: sinon.stub(),
      getNetworkBreakdown: sinon.stub(),
      getCohortBreakdown: sinon.stub(),
    };

    sharedStub = {
      logObject: sinon.stub(),
      logText: sinon.stub(),
      logElement: sinon.stub(),
      HttpError: class HttpError extends Error {
        constructor(message, status, errors) {
          super(message);
          this.statusCode = status;
          this.errors = errors;
        }
      },
      extractErrorsFromRequest: sinon.stub().returns(null),
    };

    controller = proxyquire("@controllers/network-status.controller", {
      "@utils/network-status.util": networkStatusUtilStub,
      "@utils/shared": sharedStub,
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("create", () => {
    it("should return 201 with alert data on success", async () => {
      networkStatusUtilStub.createAlert.resolves({
        success: true,
        data: { _id: "alert-1", status: "OK" },
        message: "Network status alert created",
        status: httpStatus.CREATED,
      });
      const req = makeReq({ body: { status: "OK", message: "ok" } });
      const res = makeRes();
      const next = sinon.spy();

      await controller.create(req, res, next);

      expect(res.status.calledWith(httpStatus.CREATED)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.success).to.be.true;
    });

    it("should call next when extractErrorsFromRequest returns errors", async () => {
      sharedStub.extractErrorsFromRequest.returns({ field: "error" });
      const req = makeReq();
      const res = makeRes();
      const next = sinon.spy();

      await controller.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(networkStatusUtilStub.createAlert.called).to.be.false;
    });

    it("should return failure response when util returns success=false", async () => {
      networkStatusUtilStub.createAlert.resolves({
        success: false,
        message: "validation failed",
        status: httpStatus.BAD_REQUEST,
        errors: { message: "bad data" },
      });
      const req = makeReq({ body: {} });
      const res = makeRes();
      const next = sinon.spy();

      await controller.create(req, res, next);

      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.success).to.be.false;
    });

    it("should not respond when res.headersSent is true", async () => {
      networkStatusUtilStub.createAlert.resolves({
        success: true,
        data: {},
        status: httpStatus.CREATED,
      });
      const req = makeReq();
      const res = makeRes();
      res.headersSent = true;
      const next = sinon.spy();

      await controller.create(req, res, next);

      expect(res.json.called).to.be.false;
    });

    it("should call next with HttpError when createAlert throws unexpectedly", async () => {
      networkStatusUtilStub.createAlert.rejects(new Error("unexpected failure"));
      const req = makeReq({ body: { status: "OK" } });
      const res = makeRes();
      const next = sinon.spy();

      await controller.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(res.json.called).to.be.false;
    });
  });

  describe("list", () => {
    it("should return 200 with alerts array on success", async () => {
      networkStatusUtilStub.list.resolves({
        success: true,
        data: [{ _id: "a1" }, { _id: "a2" }],
        message: "successfully retrieved the network status alerts",
        status: httpStatus.OK,
      });
      const req = makeReq({ query: { tenant: "airqo" } });
      const res = makeRes();
      const next = sinon.spy();

      await controller.list(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.success).to.be.true;
      expect(jsonArgs.alerts).to.have.lengthOf(2);
    });

    it("should call next when validation fails", async () => {
      sharedStub.extractErrorsFromRequest.returns({ tenant: "invalid" });
      const req = makeReq();
      const res = makeRes();
      const next = sinon.spy();

      await controller.list(req, res, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("getStatistics", () => {
    it("should return statistics data on success", async () => {
      networkStatusUtilStub.getStatistics.resolves({
        success: true,
        data: [{ _id: null, totalAlerts: 5 }],
        status: httpStatus.OK,
      });
      const req = makeReq();
      const res = makeRes();
      const next = sinon.spy();

      await controller.getStatistics(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.success).to.be.true;
      expect(jsonArgs.statistics).to.exist;
    });
  });

  describe("getHourlyTrends", () => {
    it("should return trends data on success", async () => {
      networkStatusUtilStub.getHourlyTrends.resolves({
        success: true,
        data: [],
        status: httpStatus.OK,
      });
      const req = makeReq();
      const res = makeRes();
      const next = sinon.spy();

      await controller.getHourlyTrends(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.trends).to.deep.equal([]);
    });
  });

  describe("getRecentAlerts", () => {
    it("should return recent alerts on success", async () => {
      networkStatusUtilStub.getRecentAlerts.resolves({
        success: true,
        data: [{ _id: "recent-1" }],
        status: httpStatus.OK,
      });
      const req = makeReq();
      const res = makeRes();
      const next = sinon.spy();

      await controller.getRecentAlerts(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.alerts).to.have.lengthOf(1);
    });
  });

  describe("getUptimeSummary", () => {
    it("should return uptime summary on success", async () => {
      networkStatusUtilStub.getUptimeSummary.resolves({
        success: true,
        data: [],
        status: httpStatus.OK,
      });
      const req = makeReq();
      const res = makeRes();
      const next = sinon.spy();

      await controller.getUptimeSummary(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.summary).to.deep.equal([]);
    });
  });

  describe("getNetworkBreakdown", () => {
    it("should return network breakdown data on success", async () => {
      networkStatusUtilStub.getNetworkBreakdown.resolves({
        success: true,
        data: [{ _id: "airqo", avg_not_transmitting_percentage: 10 }],
        status: httpStatus.OK,
      });
      const req = makeReq();
      const res = makeRes();
      const next = sinon.spy();

      await controller.getNetworkBreakdown(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.data).to.have.lengthOf(1);
    });
  });

  describe("getCohortBreakdown", () => {
    it("should return cohort breakdown data on success", async () => {
      networkStatusUtilStub.getCohortBreakdown.resolves({
        success: true,
        data: [{ _id: "60f5a1b2c3d4e5f678901234", avg_not_transmitting_percentage: 10 }],
        status: httpStatus.OK,
      });
      const req = makeReq();
      const res = makeRes();
      const next = sinon.spy();

      await controller.getCohortBreakdown(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(networkStatusUtilStub.getCohortBreakdown.calledOnce).to.be.true;
      const jsonArgs = res.json.firstCall.args[0];
      expect(jsonArgs.data).to.have.lengthOf(1);
    });
  });
});
