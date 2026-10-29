require("module-alias/register");
const rewire = require("rewire");
const sinon = require("sinon");
const chai = require("chai");
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const expect = chai.expect;

const rewirePreferencesLog = rewire("../preferences-log-job");
const logUserPreferences = rewirePreferencesLog.__get__("logUserPreferences");

describe("logUserPreferences", () => {
  let origUserModel;
  let origAcquireCronLock;
  let origLogger;
  let origLogText;
  let aggregateStub;
  let execStub;
  let loggerStub;
  let logTextStub;

  // Builds a UserModel("airqo") mock supporting the chain used by the job:
  // .aggregate([...]).exec(). `execResult` is either the array the
  // aggregation pipeline resolves to (the job only ever reads results[0]),
  // or a function suitable for sinon's callsFake, used to simulate a
  // rejection.
  function makeUserModelMock(execResult) {
    execStub =
      typeof execResult === "function"
        ? sinon.stub().callsFake(execResult)
        : sinon.stub().resolves(execResult);
    aggregateStub = sinon.stub().returns({ exec: execStub });
    return () => ({ aggregate: aggregateStub });
  }

  beforeEach(() => {
    origUserModel = rewirePreferencesLog.__get__("UserModel");
    origAcquireCronLock = rewirePreferencesLog.__get__("acquireCronLock");
    origLogger = rewirePreferencesLog.__get__("logger");
    origLogText = rewirePreferencesLog.__get__("logText");

    // The real acquireCronLock is a first-writer-wins, minute-granularity DB
    // lock (see utils/common/cron-lock.util.js); without stubbing it, only
    // one test per wall-clock minute would actually acquire it and every
    // other test's logUserPreferences() call would silently no-op.
    rewirePreferencesLog.__set__(
      "acquireCronLock",
      sinon.stub().resolves(true)
    );

    loggerStub = {
      info: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
      debug: sinon.stub(),
    };
    logTextStub = sinon.stub();
    rewirePreferencesLog.__set__("logger", loggerStub);
    rewirePreferencesLog.__set__("logText", logTextStub);
  });

  afterEach(() => {
    rewirePreferencesLog.__set__("UserModel", origUserModel);
    rewirePreferencesLog.__set__("acquireCronLock", origAcquireCronLock);
    rewirePreferencesLog.__set__("logger", origLogger);
    rewirePreferencesLog.__set__("logText", origLogText);
    sinon.restore();
  });

  describe("successful execution", () => {
    it("logs the percentage of users without selected sites when some are missing", async () => {
      rewirePreferencesLog.__set__(
        "UserModel",
        makeUserModelMock([
          { totalUsersInGroup: 4, usersWithoutSelectedSites: 3 },
        ])
      );

      await logUserPreferences();

      expect(aggregateStub).to.have.been.calledOnce;
      expect(loggerStub.info).to.have.been.calledOnce;
      expect(loggerStub.info).to.have.been.calledWithMatch(
        /3\/4 \(75\.00%\)/
      );
      // Only the initial "Starting..." message goes through logText here.
      expect(logTextStub).to.have.been.calledOnce;
    });

    it("logs an all-set message when every user has selected sites", async () => {
      rewirePreferencesLog.__set__(
        "UserModel",
        makeUserModelMock([
          { totalUsersInGroup: 5, usersWithoutSelectedSites: 0 },
        ])
      );

      await logUserPreferences();

      expect(loggerStub.info).to.not.have.been.called;
      // "Starting..." plus the all-set confirmation message.
      expect(logTextStub).to.have.been.calledTwice;
      expect(logTextStub).to.have.been.calledWithMatch(
        /Customised Locations/
      );
    });
  });

  describe("no users found", () => {
    it("logs that no users were found in the default group", async () => {
      rewirePreferencesLog.__set__("UserModel", makeUserModelMock([]));

      await logUserPreferences();

      expect(loggerStub.info).to.have.been.calledOnce;
      expect(loggerStub.info).to.have.been.calledWithMatch(
        /No users found/
      );
    });
  });

  describe("error handling", () => {
    it("does not throw when the aggregation rejects", async () => {
      rewirePreferencesLog.__set__(
        "UserModel",
        makeUserModelMock(() => Promise.reject(new Error("Test error")))
      );

      await logUserPreferences();

      expect(loggerStub.error).to.have.been.calledOnce;
      expect(loggerStub.error).to.have.been.calledWithMatch(
        /Error in logUserPreferences/
      );
    });
  });

  describe("cron lock not acquired", () => {
    it("skips the run entirely when another pod already holds the lock", async () => {
      rewirePreferencesLog.__set__(
        "acquireCronLock",
        sinon.stub().resolves(false)
      );
      rewirePreferencesLog.__set__("UserModel", makeUserModelMock([]));

      await logUserPreferences();

      expect(aggregateStub).to.not.have.been.called;
    });
  });
});
