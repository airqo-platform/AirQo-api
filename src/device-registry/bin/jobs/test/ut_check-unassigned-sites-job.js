require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire");

const PRODUCTION = "PRODUCTION ENVIRONMENT";

describe("check-unassigned-sites job", () => {
  let siteModel;
  let shouldAllowLog;
  let fakeLogger;
  let cronInstance;
  let cronSchedule;
  const loadedJobNames = new Set();

  // The job schedules itself and builds a LogThrottleManager (DB-backed) on
  // import, so every external dependency is replaced before loading it.
  // It also only runs in production, so the environment is configurable.
  const loadJob = (environment = PRODUCTION) => {
    const job = proxyquire.noPreserveCache()(
      "@bin/jobs/check-unassigned-sites-job",
      {
        "@config/constants": { ENVIRONMENT: environment },
        "@models/Site": Object.assign(() => siteModel, { "@noCallThru": true }),
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
      },
    );
    loadedJobNames.add(job.JOB_NAME);
    return job;
  };

  // Shape of the $facet aggregation result the job reads.
  const facetResult = ({ total, unassigned = [] }) => [
    {
      totalActiveSites: total ? [{ count: total }] : [],
      unassignedSites: unassigned.map((name) => ({ _id: name })),
    },
  ];

  beforeEach(() => {
    siteModel = { aggregate: sinon.stub() };
    shouldAllowLog = sinon.stub().resolves(true);
    fakeLogger = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
    };
    cronInstance = { stop: sinon.stub() };
    cronSchedule = sinon.stub().returns(cronInstance);
    delete global.isShuttingDown;
  });

  afterEach(() => {
    delete global.isShuttingDown;
  });

  after(() => {
    loadedJobNames.forEach((name) => {
      if (global.cronJobs) delete global.cronJobs[name];
    });
  });

  describe("on load", () => {
    it("schedules itself and registers in global.cronJobs", () => {
      const job = loadJob();

      expect(cronSchedule.calledOnce).to.be.true;
      expect(cronSchedule.firstCall.args[0]).to.equal(job.JOB_SCHEDULE);
      expect(global.cronJobs[job.JOB_NAME]).to.include({
        name: job.JOB_NAME,
        schedule: job.JOB_SCHEDULE,
      });
    });
  });

  describe("checkUnassignedSites", () => {
    it("does nothing outside production", async () => {
      const job = loadJob("STAGING ENVIRONMENT");

      await job.checkUnassignedSites();

      expect(siteModel.aggregate.called).to.be.false;
    });

    it("does nothing while the application is shutting down", async () => {
      const job = loadJob();
      global.isShuttingDown = true;

      await job.checkUnassignedSites();

      expect(siteModel.aggregate.called).to.be.false;
    });

    it("only considers online sites", async () => {
      const job = loadJob();
      siteModel.aggregate.resolves(facetResult({ total: 4 }));

      await job.checkUnassignedSites();

      const [pipeline] = siteModel.aggregate.firstCall.args;
      expect(pipeline[0]).to.deep.equal({ $match: { isOnline: true } });
    });

    it("reports the percentage and names of sites with no grid", async () => {
      const job = loadJob();
      siteModel.aggregate.resolves(
        facetResult({ total: 4, unassigned: ["site_a", "site_b"] }),
      );

      await job.checkUnassignedSites();

      expect(fakeLogger.info.calledOnce).to.be.true;
      const [message] = fakeLogger.info.firstCall.args;
      expect(message).to.include("50.00%").and.include("site_a, site_b");
      expect(fakeLogger.error.called).to.be.false;
    });

    it("stays quiet when every online site has a grid", async () => {
      const job = loadJob();
      siteModel.aggregate.resolves(facetResult({ total: 4 }));

      await job.checkUnassignedSites();

      expect(fakeLogger.info.called).to.be.false;
      expect(fakeLogger.error.called).to.be.false;
    });

    it("logs and swallows database errors", async () => {
      const job = loadJob();
      siteModel.aggregate.rejects(new Error("connection lost"));

      await job.checkUnassignedSites();

      expect(fakeLogger.error.called).to.be.true;
      expect(fakeLogger.error.firstCall.args[0]).to.include("connection lost");
    });
  });

  describe("jobWrapper", () => {
    it("skips the run when the log throttle denies it", async () => {
      const job = loadJob();
      shouldAllowLog.resolves(false);

      await job.jobWrapper();

      expect(siteModel.aggregate.called).to.be.false;
    });

    it("still runs when the throttle check itself fails", async () => {
      const job = loadJob();
      shouldAllowLog.rejects(new Error("lock store unavailable"));
      siteModel.aggregate.resolves(facetResult({ total: 4 }));

      await job.jobWrapper();

      expect(siteModel.aggregate.calledOnce).to.be.true;
    });
  });

  describe("stop", () => {
    it("stops the cron schedule and unregisters the job", async () => {
      const job = loadJob();

      await global.cronJobs[job.JOB_NAME].stop();

      expect(cronInstance.stop.calledOnce).to.be.true;
      expect(global.cronJobs).to.not.have.property(job.JOB_NAME);
    });
  });
});
