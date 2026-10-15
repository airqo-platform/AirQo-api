require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const rewire = require("rewire");
const { expect } = chai;

const notificationUtil = rewire("@utils/notification.util");

// Chainable, thenable stand-in for a mongoose Query from find()/findById().
const leanQuery = (result) => {
  const query = {
    select: () => query,
    lean: () => query,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    cursor: () => (async function* () {
      for (const item of result) yield item;
    })(),
  };
  return query;
};

describe("notification util", () => {
  let origNotificationModel;
  let origUserModel;
  let origGroupModel;
  let createManyStub;

  beforeEach(() => {
    origNotificationModel = notificationUtil.__get__("NotificationModel");
    origUserModel = notificationUtil.__get__("UserModel");
    origGroupModel = notificationUtil.__get__("GroupModel");
    createManyStub = sinon.stub().callsFake(async (docs) => ({
      success: true,
      data: { insertedCount: docs.length },
    }));
  });

  afterEach(() => {
    notificationUtil.__set__("NotificationModel", origNotificationModel);
    notificationUtil.__set__("UserModel", origUserModel);
    notificationUtil.__set__("GroupModel", origGroupModel);
    sinon.restore();
  });

  describe("notifyUsers()", () => {
    it("dedupes recipients, drops empty ids and leaves defaults to the schema", async () => {
      notificationUtil.__set__("NotificationModel", () => ({
        createMany: createManyStub,
      }));

      const result = await notificationUtil.notifyUsers({
        tenant: "airqo",
        user_ids: ["u1", "u1", null, "u2"],
        title: "Hello",
        message: "World",
      });

      expect(result.success).to.equal(true);
      expect(result.data.insertedCount).to.equal(2);
      const docs = createManyStub.firstCall.args[0];
      expect(docs.map((d) => d.user_id)).to.deep.equal(["u1", "u2"]);
      expect(docs[0]).to.not.have.property("category");
      expect(docs[0]).to.not.have.property("expires_at");
    });

    it("returns early without touching the DB when there are no recipients", async () => {
      notificationUtil.__set__("NotificationModel", () => ({
        createMany: createManyStub,
      }));

      const result = await notificationUtil.notifyUsers({
        tenant: "airqo",
        user_ids: [],
        title: "t",
        message: "m",
      });

      expect(result.data.insertedCount).to.equal(0);
      sinon.assert.notCalled(createManyStub);
    });

    it("never throws when the DB write fails", async () => {
      notificationUtil.__set__("NotificationModel", () => ({
        createMany: sinon.stub().rejects(new Error("db down")),
      }));

      const result = await notificationUtil.notifyUsers({
        tenant: "airqo",
        user_ids: ["u1"],
        title: "t",
        message: "m",
      });

      expect(result.success).to.equal(false);
      expect(result.message).to.equal("db down");
    });

    it("inserts large audiences in batches of 1000", async () => {
      notificationUtil.__set__("NotificationModel", () => ({
        createMany: createManyStub,
      }));
      const user_ids = Array.from({ length: 2500 }, (_, i) => `u${i}`);

      const result = await notificationUtil.notifyUsers({
        tenant: "airqo",
        user_ids,
        title: "t",
        message: "m",
      });

      expect(result.data.insertedCount).to.equal(2500);
      expect(createManyStub.callCount).to.equal(3);
      expect(createManyStub.firstCall.args[0]).to.have.length(1000);
      expect(createManyStub.thirdCall.args[0]).to.have.length(500);
    });
  });

  describe("user inbox operations", () => {
    it("list scopes to the current user and applies read/category filters", async () => {
      const listStub = sinon.stub().resolves({ success: true, data: [] });
      notificationUtil.__set__("NotificationModel", () => ({ list: listStub }));

      await notificationUtil.list(
        {
          user: { _id: "me" },
          query: {
            tenant: "airqo",
            limit: 20,
            skip: 0,
            read: "false",
            category: "announcement",
          },
        },
        sinon.stub(),
      );

      expect(listStub.firstCall.args[0]).to.deep.equal({
        filter: { user_id: "me", read: false, category: "announcement" },
        limit: 20,
        skip: 0,
      });
    });

    it("markRead and delete can only target the caller's own notifications", async () => {
      const markReadStub = sinon.stub().resolves({ success: true });
      const removeStub = sinon.stub().resolves({ success: true });
      notificationUtil.__set__("NotificationModel", () => ({
        markRead: markReadStub,
        remove: removeStub,
      }));
      const request = {
        user: { _id: "me" },
        query: { tenant: "airqo" },
        params: { notification_id: "n1" },
      };

      await notificationUtil.markRead(request, sinon.stub());
      await notificationUtil.delete(request, sinon.stub());

      expect(markReadStub.firstCall.args[0].filter).to.deep.equal({
        _id: "n1",
        user_id: "me",
      });
      expect(removeStub.firstCall.args[0].filter).to.deep.equal({
        _id: "n1",
        user_id: "me",
      });
    });
  });

  describe("sendToGroup()", () => {
    it("returns 404 when the group does not exist", async () => {
      notificationUtil.__set__("GroupModel", () => ({
        findById: () => leanQuery(null),
      }));

      const result = await notificationUtil.sendToGroup(
        {
          user: { _id: "admin" },
          query: { tenant: "airqo" },
          params: { grp_id: "g1" },
          body: { title: "t", message: "m" },
        },
        sinon.stub(),
      );

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
    });

    it("notifies every member of the group, tagged with group and broadcast ids", async () => {
      notificationUtil.__set__("GroupModel", () => ({
        findById: () => leanQuery({ _id: "g1", grp_title: "Org" }),
      }));
      notificationUtil.__set__("UserModel", () => ({
        find: () => leanQuery([{ _id: "m1" }, { _id: "m2" }]),
      }));
      notificationUtil.__set__("NotificationModel", () => ({
        createMany: createManyStub,
      }));

      const result = await notificationUtil.sendToGroup(
        {
          user: { _id: "admin" },
          query: { tenant: "airqo" },
          params: { grp_id: "g1" },
          body: { title: "Maintenance", message: "Sensors offline Friday" },
        },
        sinon.stub(),
      );

      expect(result.status).to.equal(httpStatus.CREATED);
      expect(result.data.recipients).to.equal(2);
      expect(result.data.delivered).to.equal(2);
      const docs = createManyStub.firstCall.args[0];
      expect(docs[0]).to.include({
        category: "announcement",
        group_id: "g1",
        sender_id: "admin",
        broadcast_id: result.data.broadcast_id,
      });
    });
  });

  describe("broadcast()", () => {
    it("audience 'users' only notifies users that exist, ignoring repeated ids", async () => {
      notificationUtil.__set__("UserModel", () => ({
        find: () => leanQuery([{ _id: "u1" }]),
      }));
      notificationUtil.__set__("NotificationModel", () => ({
        createMany: createManyStub,
      }));

      const result = await notificationUtil.broadcast(
        {
          user: { _id: "admin" },
          query: { tenant: "airqo" },
          body: {
            audience: "users",
            user_ids: ["u1", "missing", "u1"],
            title: "t",
            message: "m",
          },
        },
        sinon.stub(),
      );

      expect(result.status).to.equal(httpStatus.CREATED);
      expect(result.data.delivered).to.equal(1);
      expect(result.data.not_found).to.equal(1);
    });

    it("audience 'all' responds 202 and fans out to verified users in the background", async () => {
      const findStub = sinon
        .stub()
        .returns(leanQuery([{ _id: "u1" }, { _id: "u2" }, { _id: "u3" }]));
      notificationUtil.__set__("UserModel", () => ({
        countDocuments: sinon.stub().resolves(3),
        find: findStub,
      }));
      notificationUtil.__set__("NotificationModel", () => ({
        createMany: createManyStub,
      }));

      const result = await notificationUtil.broadcast(
        {
          user: { _id: "admin" },
          query: { tenant: "airqo" },
          body: { audience: "all", title: "t", message: "m" },
        },
        sinon.stub(),
      );

      expect(result.status).to.equal(httpStatus.ACCEPTED);
      expect(result.data.recipients).to.equal(3);
      expect(findStub.firstCall.args[0]).to.deep.equal({ verified: true });

      // Let the background fan-out finish (bounded so a hang fails the test).
      const delivered = () =>
        createManyStub
          .getCalls()
          .reduce((sum, call) => sum + call.args[0].length, 0);
      for (let i = 0; i < 50 && delivered() < 3; i++) {
        await new Promise((resolve) => setImmediate(resolve));
      }
      expect(delivered()).to.equal(3);
    });
  });
});
