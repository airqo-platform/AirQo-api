require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire");

describe("check-active-statuses job", () => {
  let job;
  let deviceModel;
  let shouldAllowLog;
  let fakeLogger;
  let cronInstance;
  let cronSchedule;

  before(() => {
    deviceModel = {
      countDocuments: sinon.stub(),
      aggregate: sinon.stub(),
    };
    shouldAllowLog = sinon.stub();
    fakeLogger = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
    };
    cronInstance = { stop: sinon.stub() };
    cronSchedule = sinon.stub().returns(cronInstance);

    // The job schedules itself and builds a LogThrottleManager (DB-backed) on
    // import, so every external dependency is replaced before loading it.
    job = proxyquire("@bin/jobs/check-active-statuses", {
      "@models/Device": Object.assign(() => deviceModel, {
        "@noCallThru": true,
      }),
      "@utils/common": {
        getSchedule: (schedule) => schedule,
        LogThrottleManager: function() {
          this.shouldAllowLog = shouldAllowLog;
        },
        "@noCallThru": true,
      },
      "@utils/shared": {
        logText: () => {},
        logObject: () => {},
        "@noCallThru": true,
      },
      "node-cron": { schedule: cronSchedule, "@noCallThru": true },
      log4js: { getLogger: () => fakeLogger, "@noCallThru": true },
    });
  });

  after(() => {
    if (global.cronJobs) delete global.cronJobs[job.JOB_NAME];
  });

  beforeEach(() => {
    deviceModel.countDocuments.reset();
    deviceModel.aggregate.reset();
    shouldAllowLog.reset();
    shouldAllowLog.resolves(true);
    Object.values(fakeLogger).forEach((s) => s.resetHistory());
    delete global.isShuttingDown;
  });

  afterEach(() => {
    delete global.isShuttingDown;
  });

  // countDocuments is called as: [0] active & not deployed, [1] active &
  // missing status, [2] total active.
  const stubCounts = ({ incorrect, missing, total }) => {
    deviceModel.countDocuments.onCall(0).resolves(incorrect);
    deviceModel.countDocuments.onCall(1).resolves(missing);
    deviceModel.countDocuments.onCall(2).resolves(total);
  };

  // aggregate is called as: [0] names with incorrect status, [1] names missing status.
  const stubNames = ({ incorrect = [], missing = [] }) => {
    deviceModel.aggregate.onCall(0).resolves(incorrect.map((n) => ({ _id: n })));
    deviceModel.aggregate.onCall(1).resolves(missing.map((n) => ({ _id: n })));
  };

  describe("on load", () => {
    it("schedules itself and registers in global.cronJobs", () => {
      expect(cronSchedule.calledOnce).to.be.true;
      expect(cronSchedule.firstCall.args[0]).to.equal(job.JOB_SCHEDULE);
      expect(global.cronJobs[job.JOB_NAME]).to.include({
        name: job.JOB_NAME,
        schedule: job.JOB_SCHEDULE,
      });
    });
  });

  describe("checkActiveStatuses", () => {
    it("does nothing when the log throttle denies the run", async () => {
      shouldAllowLog.resolves(false);

      await job.checkActiveStatuses();

      expect(deviceModel.countDocuments.called).to.be.false;
      expect(fakeLogger.warn.called).to.be.false;
    });

    it("does nothing while the application is shutting down", async () => {
      global.isShuttingDown = true;

      await job.checkActiveStatuses();

      expect(deviceModel.countDocuments.called).to.be.false;
    });

    it("only counts active devices", async () => {
      stubCounts({ incorrect: 0, missing: 0, total: 10 });
      stubNames({});

      await job.checkActiveStatuses();

      deviceModel.countDocuments.getCalls().forEach((call) => {
        expect(call.args[0]).to.have.property("isActive", true);
      });
      expect(deviceModel.countDocuments.firstCall.args[0].status).to.deep.equal(
        { $ne: "deployed" },
      );
    });

    it("treats missing, null and empty statuses as missing", async () => {
      stubCounts({ incorrect: 0, missing: 0, total: 10 });
      stubNames({});

      await job.checkActiveStatuses();

      const missingStatusFilter = { $in: [null, ""] };
      expect(deviceModel.countDocuments.secondCall.args[0]).to.deep.equal({
        isActive: true,
        status: missingStatusFilter,
      });
      expect(deviceModel.aggregate.secondCall.args[0][0]).to.deep.equal({
        $match: { isActive: true, status: missingStatusFilter },
      });
    });

    it("warns with device names and percentages when statuses are wrong", async () => {
      stubCounts({ incorrect: 2, missing: 1, total: 8 });
      stubNames({
        incorrect: ["aq_g5_01", "aq_g5_02"],
        missing: ["aq_g5_03"],
      });

      await job.checkActiveStatuses();

      expect(fakeLogger.warn.calledTwice).to.be.true;
      const [incorrectMsg] = fakeLogger.warn.firstCall.args;
      const [missingMsg] = fakeLogger.warn.secondCall.args;
      expect(incorrectMsg).to.include("aq_g5_01, aq_g5_02").and.include("25.00%");
      expect(missingMsg).to.include("aq_g5_03").and.include("12.50%");
      expect(fakeLogger.error.called).to.be.false;
    });

    it("stays quiet when every active device is correctly deployed", async () => {
      stubCounts({ incorrect: 0, missing: 0, total: 8 });
      stubNames({});

      await job.checkActiveStatuses();

      expect(fakeLogger.warn.called).to.be.false;
      expect(fakeLogger.error.called).to.be.false;
    });

    it("logs and swallows database errors", async () => {
      deviceModel.countDocuments.rejects(new Error("connection lost"));

      await job.checkActiveStatuses();

      expect(fakeLogger.error.called).to.be.true;
      expect(fakeLogger.error.firstCall.args[0]).to.include("connection lost");
    });
  });

  describe("stopJob", () => {
    it("stops the cron schedule and unregisters the job", async () => {
      await job.stopJob();

      expect(cronInstance.stop.calledOnce).to.be.true;
      expect(global.cronJobs).to.not.have.property(job.JOB_NAME);
    });
  });
});
