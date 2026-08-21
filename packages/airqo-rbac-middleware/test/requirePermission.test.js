const chai = require("chai");
const sinon = require("sinon");
const axios = require("axios");
const expect = chai.expect;

const { requirePermission } = require("../src/requirePermission");

const buildRes = () => {
  const res = {};
  res.status = sinon.stub().returns(res);
  res.json = sinon.stub().returns(res);
  return res;
};

const buildReq = (overrides = {}) => ({
  headers: {},
  originalUrl: "/api/v2/devices/cohorts/abc/devices",
  ip: "127.0.0.1",
  ...overrides,
});

describe("requirePermission middleware", () => {
  let axiosGetStub;
  const KILL_SWITCH_ENV = "TEST_RBAC_ENFORCEMENT_ENABLED";

  beforeEach(() => {
    axiosGetStub = sinon.stub(axios, "get");
    delete process.env[KILL_SWITCH_ENV];
  });

  afterEach(() => {
    axiosGetStub.restore();
    delete process.env[KILL_SWITCH_ENV];
  });

  it("throws synchronously if no permission string is provided", () => {
    expect(() => requirePermission()).to.throw(/non-empty permission string/);
  });

  it("returns 401 when no Authorization header is present", async () => {
    const middleware = requirePermission("DEVICE_UPDATE", {
      authServiceUrl: "http://auth-service.local",
    });
    const req = buildReq();
    const res = buildRes();
    const next = sinon.spy();

    await middleware(req, res, next);

    expect(res.status.calledWith(401)).to.be.true;
    expect(next.called).to.be.false;
  });

  it("fails closed (403) when authServiceUrl is not configured", async () => {
    const middleware = requirePermission("DEVICE_UPDATE", {
      authServiceUrl: undefined,
      logger: { warn: sinon.spy(), error: sinon.spy() },
    });
    const req = buildReq({ headers: { authorization: "JWT sometoken" } });
    const res = buildRes();
    const next = sinon.spy();

    await middleware(req, res, next);

    expect(res.status.calledWith(403)).to.be.true;
    expect(next.called).to.be.false;
  });

  it("fails closed (403) when auth-service is unreachable (network error)", async () => {
    axiosGetStub.rejects(new Error("connect ECONNREFUSED"));

    const middleware = requirePermission("DEVICE_UPDATE", {
      authServiceUrl: "http://auth-service.local",
      logger: { warn: sinon.spy(), error: sinon.spy() },
    });
    const req = buildReq({ headers: { authorization: "JWT sometoken" } });
    const res = buildRes();
    const next = sinon.spy();

    await middleware(req, res, next);

    expect(res.status.calledWith(403)).to.be.true;
    expect(next.called).to.be.false;
  });

  it("propagates auth-service's explicit rejection status/message", async () => {
    // axios rejects (rather than resolves) for non-2xx responses — this
    // mirrors what auth-service actually returns for an invalid token
    // (a real 401), exercising verifyTokenClient's err.response branch.
    axiosGetStub.rejects({
      response: {
        status: 401,
        data: { success: false, status: 401, message: "Token expired" },
      },
    });

    const middleware = requirePermission("DEVICE_UPDATE", {
      authServiceUrl: "http://auth-service.local",
    });
    const req = buildReq({ headers: { authorization: "JWT sometoken" } });
    const res = buildRes();
    const next = sinon.spy();

    await middleware(req, res, next);

    expect(res.status.calledWith(401)).to.be.true;
    expect(res.json.firstCall.args[0].message).to.equal("Token expired");
    expect(next.called).to.be.false;
  });

  it("calls next() when the token's permissions include the required permission", async () => {
    axiosGetStub.resolves({
      data: {
        success: true,
        data: { permissions: ["DEVICE_VIEW", "DEVICE_UPDATE"] },
      },
    });

    const middleware = requirePermission("DEVICE_UPDATE", {
      authServiceUrl: "http://auth-service.local",
    });
    const req = buildReq({ headers: { authorization: "JWT sometoken" } });
    const res = buildRes();
    const next = sinon.spy();

    await middleware(req, res, next);

    expect(next.calledOnce).to.be.true;
    expect(res.status.called).to.be.false;
  });

  it("returns 403 when the token's permissions do not include the required permission", async () => {
    axiosGetStub.resolves({
      data: {
        success: true,
        data: { permissions: ["DEVICE_VIEW"] },
      },
    });

    const middleware = requirePermission("DEVICE_UPDATE", {
      authServiceUrl: "http://auth-service.local",
      logger: { warn: sinon.spy(), error: sinon.spy() },
    });
    const req = buildReq({ headers: { authorization: "JWT sometoken" } });
    const res = buildRes();
    const next = sinon.spy();

    await middleware(req, res, next);

    expect(res.status.calledWith(403)).to.be.true;
    expect(next.called).to.be.false;
  });

  it("bypasses the check and logs a warning when the kill switch is set to false", async () => {
    process.env[KILL_SWITCH_ENV] = "false";
    const warnSpy = sinon.spy();

    const middleware = requirePermission("DEVICE_UPDATE", {
      authServiceUrl: "http://auth-service.local",
      killSwitchEnv: KILL_SWITCH_ENV,
      logger: { warn: warnSpy, error: sinon.spy() },
    });
    const req = buildReq({ headers: { authorization: "JWT sometoken" } });
    const res = buildRes();
    const next = sinon.spy();

    await middleware(req, res, next);

    expect(next.calledOnce).to.be.true;
    expect(res.status.called).to.be.false;
    expect(axiosGetStub.called).to.be.false;
    expect(warnSpy.calledOnce).to.be.true;
  });
});
