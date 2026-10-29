require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
// .noCallThru() so the @models/CronLock fake below stays a pure fake -- see
// ut_mailer.util.js for the rationale (getModelByTenant throws synchronously
// without a live DB connection, so the real model can't be obtained and then
// stubbed with sinon).
const proxyquire = require("proxyquire").noCallThru();

describe("acquireCronLock", () => {
  let createStub;
  let CronLockModelStub;
  let warnStub;
  let acquireCronLock;

  beforeEach(() => {
    createStub = sinon.stub();
    CronLockModelStub = sinon.stub().returns({ create: createStub });
    warnStub = sinon.stub();

    ({ acquireCronLock } = proxyquire("../cron-lock.util", {
      "@models/CronLock": CronLockModelStub,
      log4js: { getLogger: () => ({ warn: warnStub }) },
    }));
  });

  it("returns true when the lock insert succeeds", async () => {
    createStub.resolves({});

    const result = await acquireCronLock("airqo", "some-job");

    expect(result).to.equal(true);
    expect(CronLockModelStub.calledOnceWith("airqo")).to.be.true;
    expect(createStub.calledOnce).to.be.true;
    const [{ lockKey }] = createStub.firstCall.args;
    expect(lockKey).to.match(/^some-job:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("returns false without warning when another pod already holds the lock (E11000)", async () => {
    const duplicateKeyError = Object.assign(new Error("E11000 duplicate key"), {
      code: 11000,
    });
    createStub.rejects(duplicateKeyError);

    const result = await acquireCronLock("airqo", "some-job");

    expect(result).to.equal(false);
    expect(warnStub.called).to.be.false;
  });

  it("fails closed and logs a warning on an unexpected DB error", async () => {
    const dbError = new Error("connection timed out");
    createStub.rejects(dbError);

    const result = await acquireCronLock("airqo", "some-job");

    expect(result).to.equal(false);
    expect(warnStub.calledOnce).to.be.true;
    expect(warnStub.firstCall.args[0]).to.include("some-job");
    expect(warnStub.firstCall.args[0]).to.include("connection timed out");
  });
});
