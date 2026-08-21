require("module-alias/register");
const rewire = require("rewire");
const sinon = require("sinon");
const chai = require("chai");
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const expect = chai.expect;

const rewireActiveStatus = rewire("../active-status-job");
const checkStatus = rewireActiveStatus.__get__("checkStatus");

describe("checkStatus", () => {
  let origUserModel;
  let origAcquireCronLock;
  let findStub;
  let updateManyStub;

  // Builds a UserModel("airqo") mock supporting the chain used by the job:
  // .find({...}).limit(n).select("_id").lean() — and, separately,
  // .updateMany({...}, {...}). `batches` is consumed in call order: the i-th
  // call to find() resolves (via .lean()) to batches[i], and any call past
  // the end of the array resolves to [] (ending that pass's while-loop).
  function makeUserModelMock(batches) {
    let call = 0;
    findStub = sinon.stub().callsFake(() => {
      const data = batches[call] !== undefined ? batches[call] : [];
      call++;
      return {
        limit: sinon.stub().returnsThis(),
        select: sinon.stub().returnsThis(),
        lean: sinon.stub().resolves(data),
      };
    });
    updateManyStub = sinon.stub().resolves({ modifiedCount: 0 });
    return () => ({ find: findStub, updateMany: updateManyStub });
  }

  beforeEach(() => {
    origUserModel = rewireActiveStatus.__get__("UserModel");
    origAcquireCronLock = rewireActiveStatus.__get__("acquireCronLock");
    // The real acquireCronLock is a first-writer-wins, minute-granularity DB
    // lock (see utils/common/cron-lock.util.js); without stubbing it, only
    // one test per wall-clock minute would actually acquire it and every
    // other test's checkStatus() call would silently no-op.
    rewireActiveStatus.__set__(
      "acquireCronLock",
      sinon.stub().resolves(true)
    );
  });

  afterEach(() => {
    rewireActiveStatus.__set__("UserModel", origUserModel);
    rewireActiveStatus.__set__("acquireCronLock", origAcquireCronLock);
    sinon.restore();
  });

  describe("successful execution", () => {
    it("deactivates users found to be inactive in pass 1", async () => {
      rewireActiveStatus.__set__(
        "UserModel",
        makeUserModelMock([
          [{ _id: "user1" }, { _id: "user2" }, { _id: "user3" }], // pass 1 batch
          [], // pass 1 ends (all eligible users updated)
          [], // pass 2: nothing to reactivate
        ])
      );

      await checkStatus();

      expect(findStub.callCount).to.equal(3);
      expect(updateManyStub).to.have.been.calledOnce;
      expect(updateManyStub).to.have.been.calledWithMatch(
        { _id: { $in: ["user1", "user2", "user3"] } },
        { $set: { isActive: false } }
      );
    });
  });

  describe("no inactive users found", () => {
    it("does not call updateMany when both passes find nothing", async () => {
      rewireActiveStatus.__set__("UserModel", makeUserModelMock([[], []]));

      await checkStatus();

      expect(findStub.callCount).to.equal(2);
      expect(updateManyStub).to.not.have.been.called;
    });
  });

  describe("pagination", () => {
    it("keeps fetching batches within a pass until an empty page ends it", async () => {
      rewireActiveStatus.__set__(
        "UserModel",
        makeUserModelMock([
          [{ _id: "u1" }], // pass 1, batch 1
          [{ _id: "u2" }], // pass 1, batch 2 (updated users drop out, so skip stays 0)
          [], // pass 1 ends
          [], // pass 2: nothing to reactivate
        ])
      );

      await checkStatus();

      expect(findStub.callCount).to.equal(4);
      expect(updateManyStub.callCount).to.equal(2);
    });
  });

  describe("reactivation pass", () => {
    it("reactivates verified users with recent activity still marked inactive", async () => {
      rewireActiveStatus.__set__(
        "UserModel",
        makeUserModelMock([
          [], // pass 1: nothing to deactivate
          [{ _id: "user9" }], // pass 2 batch
          [], // pass 2 ends
        ])
      );

      await checkStatus();

      expect(updateManyStub).to.have.been.calledOnce;
      expect(updateManyStub).to.have.been.calledWithMatch(
        { _id: { $in: ["user9"] } },
        { $set: { isActive: true } }
      );
    });
  });

  describe("internal server error", () => {
    it("does not throw when the find query rejects", async () => {
      updateManyStub = sinon.stub().resolves({});
      rewireActiveStatus.__set__("UserModel", () => ({
        find: sinon.stub().returns({
          limit: sinon.stub().returnsThis(),
          select: sinon.stub().returnsThis(),
          lean: sinon.stub().rejects(new Error("Test error")),
        }),
        updateMany: updateManyStub,
      }));

      await checkStatus();

      expect(updateManyStub).to.not.have.been.called;
    });
  });

  describe("cron lock not acquired", () => {
    it("skips the run entirely when another pod already holds the lock", async () => {
      rewireActiveStatus.__set__(
        "acquireCronLock",
        sinon.stub().resolves(false)
      );
      rewireActiveStatus.__set__("UserModel", makeUserModelMock([]));

      await checkStatus();

      expect(findStub).to.not.have.been.called;
    });
  });
});
