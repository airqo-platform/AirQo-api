require("module-alias/register");
const rewire = require("rewire");
const sinon = require("sinon");
const chai = require("chai");
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const expect = chai.expect;

const rewirePreferencesUpdate = rewire("../preferences-update-job");
const updatePreferences = rewirePreferencesUpdate.__get__("updatePreferences");

const DEFAULT_GROUP = "652ee1f0c619ed8f6e08eec2";
const DEFAULT_AIRQLOUD = "61815b38e2dcb4002aad0771";
const DEFAULT_GRID = "61815b38e2dcb4002aad0771";
const DEFAULT_NETWORK = "63d8cd407bbdf30fb56b2ddb";

describe("updatePreferences", () => {
  let origUserModel;
  let origPreferenceModel;
  let origSelectedSiteModel;
  let origAcquireCronLock;
  let origConstants;
  let origLogger;
  let origLogText;
  let origLogObject;
  let loggerStub;
  let logTextStub;
  let logObjectStub;

  // Builds a UserModel("airqo") mock supporting the chain used by the job:
  // .find().limit(n).skip(n).select("_id group_roles").lean(). `batches` is
  // consumed in call order: the i-th call to find() resolves (via .lean())
  // to batches[i], and any call past the end of the array resolves to []
  // (ending the pagination while-loop).
  function makeUserModelMock(batches) {
    let call = 0;
    const findStub = sinon.stub().callsFake(() => {
      const data = batches[call] !== undefined ? batches[call] : [];
      call++;
      return {
        limit: sinon.stub().returnsThis(),
        skip: sinon.stub().returnsThis(),
        select: sinon.stub().returnsThis(),
        lean: sinon.stub().resolves(data),
      };
    });
    return { model: () => ({ find: findStub }), findStub };
  }

  // Builds a SelectedSiteModel("airqo") mock supporting
  // .find([...]).sort().limit().lean().
  function makeSelectedSiteModelMock(sites) {
    const findStub = sinon.stub().returns({
      sort: sinon.stub().returnsThis(),
      limit: sinon.stub().returnsThis(),
      lean: sinon.stub().resolves(sites),
    });
    return { model: () => ({ find: findStub }), findStub };
  }

  // Builds a PreferenceModel("airqo") mock supporting the read chain used
  // by the job (.find({...}).select().lean(), returning `existing`) plus
  // the two write calls (.create() / .findOneAndUpdate()), which by
  // default resolve successfully and can be overridden per-test.
  function makePreferenceModelMock({ existing = [] } = {}) {
    const findStub = sinon.stub().returns({
      select: sinon.stub().returnsThis(),
      lean: sinon.stub().resolves(existing),
    });
    const createStub = sinon.stub().resolves({});
    const findOneAndUpdateStub = sinon.stub().resolves({});
    return {
      model: () => ({
        find: findStub,
        create: createStub,
        findOneAndUpdate: findOneAndUpdateStub,
      }),
      findStub,
      createStub,
      findOneAndUpdateStub,
    };
  }

  beforeEach(() => {
    origUserModel = rewirePreferencesUpdate.__get__("UserModel");
    origPreferenceModel = rewirePreferencesUpdate.__get__("PreferenceModel");
    origSelectedSiteModel = rewirePreferencesUpdate.__get__(
      "SelectedSiteModel"
    );
    origAcquireCronLock = rewirePreferencesUpdate.__get__("acquireCronLock");
    origConstants = rewirePreferencesUpdate.__get__("constants");
    origLogger = rewirePreferencesUpdate.__get__("logger");
    origLogText = rewirePreferencesUpdate.__get__("logText");
    origLogObject = rewirePreferencesUpdate.__get__("logObject");

    // The test environment has no DEFAULT_GROUP/DEFAULT_AIRQLOUD/etc set,
    // which would make validateDefaultValues() abort the job before it
    // does anything. Override the module's `constants` binding with valid
    // ids so the job proceeds; validateDefaultValues() and the
    // defaultGroupId computation both re-read `constants` at call time, so
    // this takes effect even though it happens after the module loaded.
    rewirePreferencesUpdate.__set__("constants", {
      ...origConstants,
      DEFAULT_GROUP,
      DEFAULT_AIRQLOUD,
      DEFAULT_GRID,
      DEFAULT_NETWORK,
    });

    // The real acquireCronLock is a first-writer-wins, minute-granularity DB
    // lock (see utils/common/cron-lock.util.js); without stubbing it, only
    // one test per wall-clock minute would actually acquire it and every
    // other test's updatePreferences() call would silently no-op.
    rewirePreferencesUpdate.__set__(
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
    logObjectStub = sinon.stub();
    rewirePreferencesUpdate.__set__("logger", loggerStub);
    rewirePreferencesUpdate.__set__("logText", logTextStub);
    rewirePreferencesUpdate.__set__("logObject", logObjectStub);

    // A default sites pool with enough entries (NUMBER_OF_SITES_PER_USER =
    // 2) for the "not enough sites" guard to pass; individual tests
    // override this via SelectedSiteModel where relevant.
    const { model: selectedSiteModel } = makeSelectedSiteModelMock([
      { site_id: "site1" },
      { site_id: "site2" },
      { site_id: "site3" },
    ]);
    rewirePreferencesUpdate.__set__("SelectedSiteModel", selectedSiteModel);
  });

  afterEach(() => {
    rewirePreferencesUpdate.__set__("UserModel", origUserModel);
    rewirePreferencesUpdate.__set__("PreferenceModel", origPreferenceModel);
    rewirePreferencesUpdate.__set__(
      "SelectedSiteModel",
      origSelectedSiteModel
    );
    rewirePreferencesUpdate.__set__("acquireCronLock", origAcquireCronLock);
    rewirePreferencesUpdate.__set__("constants", origConstants);
    rewirePreferencesUpdate.__set__("logger", origLogger);
    rewirePreferencesUpdate.__set__("logText", origLogText);
    rewirePreferencesUpdate.__set__("logObject", origLogObject);
    sinon.restore();
  });

  function memberUser(id) {
    return { _id: id, group_roles: [{ group: DEFAULT_GROUP }] };
  }

  describe("successful execution", () => {
    it("creates a preference for a member user who doesn't have one yet", async () => {
      const { model: userModel } = makeUserModelMock([
        [memberUser("user1")],
        [],
      ]);
      const { model: preferenceModel, createStub, findOneAndUpdateStub } =
        makePreferenceModelMock({ existing: [] });
      rewirePreferencesUpdate.__set__("UserModel", userModel);
      rewirePreferencesUpdate.__set__("PreferenceModel", preferenceModel);

      await updatePreferences();

      expect(createStub).to.have.been.calledOnce;
      expect(createStub).to.have.been.calledWithMatch({ user_id: "user1" });
      expect(findOneAndUpdateStub).to.not.have.been.called;
    });

    it("updates an existing preference that has no selected sites yet", async () => {
      const { model: userModel } = makeUserModelMock([
        [memberUser("user2")],
        [],
      ]);
      const { model: preferenceModel, createStub, findOneAndUpdateStub } =
        makePreferenceModelMock({
          existing: [
            { _id: "pref2", user_id: "user2", selected_sites: [] },
          ],
        });
      rewirePreferencesUpdate.__set__("UserModel", userModel);
      rewirePreferencesUpdate.__set__("PreferenceModel", preferenceModel);

      await updatePreferences();

      expect(findOneAndUpdateStub).to.have.been.calledOnce;
      expect(findOneAndUpdateStub).to.have.been.calledWithMatch({
        user_id: "user2",
      });
      expect(createStub).to.not.have.been.called;
    });

    it("leaves a preference untouched when it already has selected sites", async () => {
      const { model: userModel } = makeUserModelMock([
        [memberUser("user3")],
        [],
      ]);
      const { model: preferenceModel, createStub, findOneAndUpdateStub } =
        makePreferenceModelMock({
          existing: [
            { _id: "pref3", user_id: "user3", selected_sites: ["site9"] },
          ],
        });
      rewirePreferencesUpdate.__set__("UserModel", userModel);
      rewirePreferencesUpdate.__set__("PreferenceModel", preferenceModel);

      await updatePreferences();

      expect(createStub).to.not.have.been.called;
      expect(findOneAndUpdateStub).to.not.have.been.called;
    });

    it("skips users who are not members of the default group", async () => {
      const nonMember = { _id: "user4", group_roles: [{ group: "other" }] };
      const { model: userModel } = makeUserModelMock([[nonMember], []]);
      const { model: preferenceModel, createStub, findOneAndUpdateStub } =
        makePreferenceModelMock({ existing: [] });
      rewirePreferencesUpdate.__set__("UserModel", userModel);
      rewirePreferencesUpdate.__set__("PreferenceModel", preferenceModel);

      await updatePreferences();

      expect(createStub).to.not.have.been.called;
      expect(findOneAndUpdateStub).to.not.have.been.called;
    });
  });

  describe("pagination", () => {
    it("keeps fetching batches of users until an empty page ends the loop", async () => {
      const { model: userModel, findStub } = makeUserModelMock([
        [memberUser("user1")],
        [memberUser("user2")],
        [],
      ]);
      const { model: preferenceModel, createStub } = makePreferenceModelMock({
        existing: [],
      });
      rewirePreferencesUpdate.__set__("UserModel", userModel);
      rewirePreferencesUpdate.__set__("PreferenceModel", preferenceModel);

      await updatePreferences();

      expect(findStub.callCount).to.equal(3);
      expect(createStub).to.have.been.calledTwice;
    });
  });

  describe("error handling", () => {
    it("logs but does not throw when creating a preference fails", async () => {
      const { model: userModel } = makeUserModelMock([
        [memberUser("user1")],
        [],
      ]);
      const { model: preferenceModel, createStub } = makePreferenceModelMock({
        existing: [],
      });
      createStub.rejects(new Error("Test error"));
      rewirePreferencesUpdate.__set__("UserModel", userModel);
      rewirePreferencesUpdate.__set__("PreferenceModel", preferenceModel);

      await updatePreferences();

      expect(loggerStub.error).to.have.been.calledWithMatch(
        /Failed to create preference/
      );
    });

    it("logs but does not throw when updating a preference fails", async () => {
      const { model: userModel } = makeUserModelMock([
        [memberUser("user2")],
        [],
      ]);
      const {
        model: preferenceModel,
        findOneAndUpdateStub,
      } = makePreferenceModelMock({
        existing: [{ _id: "pref2", user_id: "user2", selected_sites: [] }],
      });
      findOneAndUpdateStub.rejects(new Error("Test error"));
      rewirePreferencesUpdate.__set__("UserModel", userModel);
      rewirePreferencesUpdate.__set__("PreferenceModel", preferenceModel);

      await updatePreferences();

      expect(loggerStub.error).to.have.been.calledWithMatch(
        /Failed to update preference/
      );
    });

    it("logs via logObject when fetching users fails", async () => {
      rewirePreferencesUpdate.__set__("UserModel", () => ({
        find: sinon.stub().returns({
          limit: sinon.stub().returnsThis(),
          skip: sinon.stub().returnsThis(),
          select: sinon.stub().returnsThis(),
          lean: sinon.stub().rejects(new Error("Test error")),
        }),
      }));

      await updatePreferences();

      expect(logObjectStub).to.have.been.calledWith(
        "error",
        sinon.match.instanceOf(Error)
      );
      expect(loggerStub.error).to.have.been.calledWithMatch(
        /Error in updatePreferences/
      );
    });
  });

  describe("edge cases", () => {
    it("aborts without creating preferences when the selected-sites pool is too small", async () => {
      const { model: selectedSiteModel } = makeSelectedSiteModelMock([
        { site_id: "site1" },
      ]);
      const { model: preferenceModel, createStub } = makePreferenceModelMock({
        existing: [],
      });
      rewirePreferencesUpdate.__set__("SelectedSiteModel", selectedSiteModel);
      rewirePreferencesUpdate.__set__("PreferenceModel", preferenceModel);

      await updatePreferences();

      expect(createStub).to.not.have.been.called;
      expect(loggerStub.error).to.have.been.calledWithMatch(
        /Not enough selected sites/
      );
    });

    it("does nothing when no users are found", async () => {
      const { model: userModel } = makeUserModelMock([[]]);
      const { model: preferenceModel, createStub } = makePreferenceModelMock({
        existing: [],
      });
      rewirePreferencesUpdate.__set__("UserModel", userModel);
      rewirePreferencesUpdate.__set__("PreferenceModel", preferenceModel);

      await updatePreferences();

      expect(createStub).to.not.have.been.called;
    });
  });

  describe("missing critical default values", () => {
    it("aborts before acquiring the cron lock when a default constant is missing", async () => {
      rewirePreferencesUpdate.__set__("constants", {
        ...origConstants,
        DEFAULT_GROUP: "",
        DEFAULT_AIRQLOUD,
        DEFAULT_GRID,
        DEFAULT_NETWORK,
      });
      const acquireCronLockStub = sinon.stub().resolves(true);
      rewirePreferencesUpdate.__set__(
        "acquireCronLock",
        acquireCronLockStub
      );

      await updatePreferences();

      expect(acquireCronLockStub).to.not.have.been.called;
      expect(loggerStub.error).to.have.been.calledWithMatch(
        /Missing critical default values/
      );
    });
  });

  describe("cron lock not acquired", () => {
    it("skips the run entirely when another pod already holds the lock", async () => {
      rewirePreferencesUpdate.__set__(
        "acquireCronLock",
        sinon.stub().resolves(false)
      );
      const { model: userModel, findStub } = makeUserModelMock([]);
      rewirePreferencesUpdate.__set__("UserModel", userModel);

      await updatePreferences();

      expect(findStub).to.not.have.been.called;
    });
  });
});
