require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const chai = require("chai");
chai.use(sinonChai);
const httpStatus = require("http-status");
const proxyquire = require("proxyquire");

describe("healthUtil.getReadiness", () => {
  let healthUtil;
  let getConnectionStatusStub;
  let next;

  beforeEach(() => {
    getConnectionStatusStub = sinon.stub();
    next = sinon.stub();

    healthUtil = proxyquire("@utils/health.util", {
      "@config/database": { getConnectionStatus: getConnectionStatusStub },
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it("returns 200 and success:true when all DB pools are connected", async () => {
    const dbStatus = {
      ready: true,
      command: "connected",
      query: "connected",
      snapshot: "connected",
    };
    getConnectionStatusStub.returns(dbStatus);

    const result = await healthUtil.getReadiness({}, next);

    expect(result.success).to.be.true;
    expect(result.status).to.equal(httpStatus.OK);
    expect(result.data).to.deep.equal({ status: "ready", database: dbStatus });
    expect(next).to.not.have.been.called;
  });

  it("returns 503 and success:false when a DB pool is not connected", async () => {
    const dbStatus = {
      ready: false,
      command: "connected",
      query: "connecting",
      snapshot: "not_initialized",
    };
    getConnectionStatusStub.returns(dbStatus);

    const result = await healthUtil.getReadiness({}, next);

    expect(result.success).to.be.false;
    expect(result.status).to.equal(httpStatus.SERVICE_UNAVAILABLE);
    expect(result.data).to.deep.equal({
      status: "not_ready",
      database: dbStatus,
    });
    expect(next).to.not.have.been.called;
  });

  it("propagates via next(err) and returns undefined when getConnectionStatus throws", async () => {
    getConnectionStatusStub.throws(new Error("boom"));

    const result = await healthUtil.getReadiness({}, next);

    expect(result).to.be.undefined;
    expect(next).to.have.been.calledOnce;
    expect(next.firstCall.args[0].message).to.equal("Internal Server Error");
  });
});
