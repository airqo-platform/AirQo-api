require("module-alias/register");
const rewire = require("rewire");
const sinon = require("sinon");
const chai = require("chai");
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const expect = chai.expect;
const { mailer } = require("@utils/common");

const rewireIncompleteProfile = rewire("../incomplete-profile-job");
const checkStatus = rewireIncompleteProfile.__get__("checkStatus");

describe("checkStatus", () => {
  let origUserModel;
  let origAcquireCronLock;
  let findStub;
  let mailerStub;

  // Builds a UserModel("airqo") mock supporting the chain used by the job:
  // .find({...}).limit(n).skip(n).select("_id email").lean(). `batches` is
  // consumed in call order: the i-th call to find() resolves (via .lean())
  // to batches[i], and any call past the end of the array resolves to []
  // (ending the pagination while-loop).
  function makeUserModelMock(batches) {
    let call = 0;
    findStub = sinon.stub().callsFake(() => {
      const data = batches[call] !== undefined ? batches[call] : [];
      call++;
      return {
        limit: sinon.stub().returnsThis(),
        skip: sinon.stub().returnsThis(),
        select: sinon.stub().returnsThis(),
        lean: sinon.stub().resolves(data),
      };
    });
    return () => ({ find: findStub });
  }

  beforeEach(() => {
    origUserModel = rewireIncompleteProfile.__get__("UserModel");
    origAcquireCronLock = rewireIncompleteProfile.__get__("acquireCronLock");
    // The real acquireCronLock is a first-writer-wins, minute-granularity DB
    // lock (see utils/common/cron-lock.util.js); without stubbing it, only
    // one test per wall-clock minute would actually acquire it and every
    // other test's checkStatus() call would silently no-op.
    rewireIncompleteProfile.__set__(
      "acquireCronLock",
      sinon.stub().resolves(true)
    );
    mailerStub = sinon
      .stub(mailer, "updateProfileReminder")
      .resolves({ success: true, data: {} });
  });

  afterEach(() => {
    rewireIncompleteProfile.__set__("UserModel", origUserModel);
    rewireIncompleteProfile.__set__("acquireCronLock", origAcquireCronLock);
    mailerStub.restore();
    sinon.restore();
  });

  describe("successful execution", () => {
    it("emails every user returned by the incomplete-profile query", async () => {
      rewireIncompleteProfile.__set__(
        "UserModel",
        makeUserModelMock([
          [
            { _id: "user1", email: "user1@example.com" },
            { _id: "user2", email: "user2@example.com" },
          ], // batch 1
          [], // batch 2: ends the loop
        ])
      );

      await checkStatus();

      expect(findStub.callCount).to.equal(2);
      expect(mailerStub).to.have.been.calledTwice;
      expect(mailerStub).to.have.been.calledWithMatch({
        email: "user1@example.com",
      });
      expect(mailerStub).to.have.been.calledWithMatch({
        email: "user2@example.com",
      });
    });
  });

  describe("no users found", () => {
    it("does not attempt to send any email when the query returns nothing", async () => {
      rewireIncompleteProfile.__set__("UserModel", makeUserModelMock([[]]));

      await checkStatus();

      expect(findStub.callCount).to.equal(1);
      expect(mailerStub).to.not.have.been.called;
    });
  });

  describe("email sending failure", () => {
    it("continues processing remaining users when an email send rejects", async () => {
      rewireIncompleteProfile.__set__(
        "UserModel",
        makeUserModelMock([
          [
            { _id: "user1", email: "user1@example.com" },
            { _id: "user2", email: "user2@example.com" },
          ],
          [],
        ])
      );
      mailerStub.rejects(new Error("Test error"));

      await checkStatus();

      expect(mailerStub).to.have.been.calledTwice;
    });

    it("treats a { success: false } response as a failure without throwing", async () => {
      rewireIncompleteProfile.__set__(
        "UserModel",
        makeUserModelMock([[{ _id: "user1", email: "user1@example.com" }], []])
      );
      mailerStub.resolves({ success: false, message: "rejected" });

      await checkStatus();

      expect(mailerStub).to.have.been.calledOnce;
    });
  });

  describe("pagination", () => {
    it("advances skip by BATCH_SIZE across successive batches", async () => {
      rewireIncompleteProfile.__set__(
        "UserModel",
        makeUserModelMock([
          [{ _id: "user1", email: "user1@example.com" }], // skip 0
          [{ _id: "user2", email: "user2@example.com" }], // skip 100
          [], // skip 200: ends the loop
        ])
      );

      await checkStatus();

      expect(findStub.callCount).to.equal(3);
      expect(mailerStub).to.have.been.calledTwice;
    });
  });

  describe("internal server error", () => {
    it("does not throw when the find query rejects", async () => {
      rewireIncompleteProfile.__set__("UserModel", () => ({
        find: sinon.stub().returns({
          limit: sinon.stub().returnsThis(),
          skip: sinon.stub().returnsThis(),
          select: sinon.stub().returnsThis(),
          lean: sinon.stub().rejects(new Error("Test error")),
        }),
      }));

      await checkStatus();

      expect(mailerStub).to.not.have.been.called;
    });
  });

  describe("cron lock not acquired", () => {
    it("skips the run entirely when another pod already holds the lock", async () => {
      rewireIncompleteProfile.__set__(
        "acquireCronLock",
        sinon.stub().resolves(false)
      );
      rewireIncompleteProfile.__set__("UserModel", makeUserModelMock([]));

      await checkStatus();

      expect(findStub).to.not.have.been.called;
      expect(mailerStub).to.not.have.been.called;
    });
  });
});
