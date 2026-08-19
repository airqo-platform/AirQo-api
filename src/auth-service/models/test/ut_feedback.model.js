require("module-alias/register");
const rewire = require("rewire");
const mongoose = require("mongoose");

// Register Feedback model without a live DB connection
try {
  const _feedbackMod = rewire("@models/Feedback");
  const FeedbackSchema = _feedbackMod.__get__("FeedbackSchema");
  if (!mongoose.modelNames().includes("feedbacks")) {
    mongoose.model("feedbacks", FeedbackSchema);
  }
} catch (_) {}

// Patch getModelByTenant to return the in-memory model
const database = require("@config/database");
const _origGetModelByTenant = database.getModelByTenant;
database.getModelByTenant = (tenant, modelName, schema) => {
  const key = modelName + "s";
  if (mongoose.modelNames().includes(key)) {
    return mongoose.model(key);
  }
  if (mongoose.modelNames().includes(modelName)) {
    return mongoose.model(modelName);
  }
  return mongoose.model(modelName, schema);
};

const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const httpStatus = require("http-status");
const FeedbackModel = require("@models/Feedback");

describe("FeedbackModel", () => {
  after(() => {
    database.getModelByTenant = _origGetModelByTenant;
  });
  afterEach(() => {
    sinon.restore();
  });

  describe("Static Method: register", () => {
    it("should create a feedback and return success", async () => {
      const args = {
        email: "user@example.com",
        subject: "Test subject",
        message: "Test message",
        tenant: "airqo",
      };

      const createStub = sinon
        .stub(FeedbackModel("airqo"), "create")
        .resolves({ ...args, _id: new mongoose.Types.ObjectId() });

      const result = await FeedbackModel("airqo").register(args);

      expect(result).to.be.an("object");
      expect(result.success).to.equal(true);

      createStub.restore();
    });

    it("should handle duplicate key error from create", async () => {
      const createStub = sinon
        .stub(FeedbackModel("airqo"), "create")
        .throws({ code: 11000, keyValue: { email: "user@example.com" }, message: "dup key" });

      const result = await FeedbackModel("airqo").register({
        email: "user@example.com",
        subject: "s",
        message: "m",
        tenant: "airqo",
      });

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.CONFLICT);

      createStub.restore();
    });
  });

  describe("Static Method: list", () => {
    it("should list feedbacks with pagination metadata", async () => {
      const feedbacks = [
        { _id: new mongoose.Types.ObjectId(), email: "a@b.com", subject: "s", message: "m", tenant: "airqo" },
      ];

      const model = FeedbackModel("airqo");
      const countStub = sinon.stub(model, "countDocuments").resolves(1);
      const findStub = sinon.stub(model, "find").returns({
        sort: sinon.stub().returnsThis(),
        skip: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        lean: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(feedbacks),
      });

      const result = await model.list({ skip: 0, limit: 10, filter: {} });

      expect(result.success).to.equal(true);
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.be.an("array").with.lengthOf(1);
      expect(result.meta).to.have.property("total", 1);

      countStub.restore();
      findStub.restore();
    });

    it("should handle list error", async () => {
      const model = FeedbackModel("airqo");
      const countStub = sinon.stub(model, "countDocuments").throws(new Error("DB error"));

      const result = await model.list({ skip: 0, limit: 10, filter: {} });

      expect(result.success).to.equal(false);

      countStub.restore();
    });
  });

  describe("Static Method: findSingle", () => {
    it("should return found feedback", async () => {
      const feedbackId = new mongoose.Types.ObjectId();
      const model = FeedbackModel("airqo");
      const findOneStub = sinon.stub(model, "findOne").returns({
        lean: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves({ _id: feedbackId, email: "a@b.com", subject: "s", message: "m" }),
      });

      const result = await model.findSingle({ _id: feedbackId });

      expect(result.success).to.equal(true);

      findOneStub.restore();
    });

    it("should return not found when feedback does not exist", async () => {
      const model = FeedbackModel("airqo");
      const findOneStub = sinon.stub(model, "findOne").returns({
        lean: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(null),
      });

      const result = await model.findSingle({ _id: "nonexistent" });

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.NOT_FOUND);

      findOneStub.restore();
    });
  });

  describe("Static Method: modify", () => {
    it("should update a feedback and return success", async () => {
      const feedbackId = new mongoose.Types.ObjectId();
      const updatedDoc = { _id: feedbackId, status: "resolved" };
      const model = FeedbackModel("airqo");

      const findOneAndUpdateStub = sinon
        .stub(model, "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves({ ...updatedDoc, _doc: updatedDoc }) });

      const result = await model.modify({
        filter: { _id: feedbackId },
        update: { status: "resolved" },
      });

      expect(result.success).to.equal(true);

      findOneAndUpdateStub.restore();
    });

    it("should return not found when no matching document", async () => {
      const model = FeedbackModel("airqo");
      const findOneAndUpdateStub = sinon
        .stub(model, "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves(null) });

      const result = await model.modify({
        filter: { _id: "nonexistent" },
        update: { status: "resolved" },
      });

      expect(result.success).to.equal(false);

      findOneAndUpdateStub.restore();
    });
  });

  describe("Static Method: addWatcher", () => {
    it("should add a watcher and return success", async () => {
      const feedbackId = new mongoose.Types.ObjectId();
      const updatedDoc = {
        _id: feedbackId,
        watchers: [{ email: "watcher@example.com" }],
      };
      const model = FeedbackModel("airqo");

      const findOneAndUpdateStub = sinon
        .stub(model, "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves({ ...updatedDoc, _doc: updatedDoc }) });

      const result = await model.addWatcher(
        { _id: feedbackId },
        { email: "watcher@example.com" }
      );

      expect(result.success).to.equal(true);

      findOneAndUpdateStub.restore();
    });

    it("should return conflict when watcher already exists", async () => {
      const feedbackId = new mongoose.Types.ObjectId();
      const model = FeedbackModel("airqo");

      const findOneAndUpdateStub = sinon
        .stub(model, "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves(null) });

      const existsStub = sinon.stub(model, "exists").resolves({ _id: feedbackId });

      const result = await model.addWatcher(
        { _id: feedbackId },
        { email: "watcher@example.com" }
      );

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.CONFLICT);

      findOneAndUpdateStub.restore();
      existsStub.restore();
    });
  });

  describe("Static Method: bulkModifyStatus", () => {
    it("should bulk update status with valid transitions", async () => {
      const id1 = new mongoose.Types.ObjectId().toString();
      const model = FeedbackModel("airqo");

      const findByIdStub = sinon.stub(model, "findById").returns({
        lean: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves({ _id: id1, status: "pending", email: "a@b.com", subject: "s", watchers: [] }),
      });

      const findOneAndUpdateStub = sinon
        .stub(model, "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves({ _id: id1, status: "resolved" }) });

      const transitions = { pending: ["resolved", "in_progress"] };
      const result = await model.bulkModifyStatus([id1], "resolved", transitions);

      expect(result.succeeded).to.be.an("array").with.lengthOf(1);
      expect(result.failed).to.be.an("array").with.lengthOf(0);

      findByIdStub.restore();
      findOneAndUpdateStub.restore();
    });

    it("should fail items where transition is not allowed", async () => {
      const id1 = new mongoose.Types.ObjectId().toString();
      const model = FeedbackModel("airqo");

      const findByIdStub = sinon.stub(model, "findById").returns({
        lean: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves({ _id: id1, status: "resolved" }),
      });

      const transitions = { pending: ["resolved"] };
      const result = await model.bulkModifyStatus([id1], "pending", transitions);

      expect(result.failed).to.be.an("array").with.lengthOf(1);

      findByIdStub.restore();
    });
  });

  describe("instance method: toJSON", () => {
    it("should return all expected fields", () => {
      const feedbackData = {
        _id: new mongoose.Types.ObjectId(),
        email: "test@example.com",
        subject: "Test subject",
        message: "Test message",
        category: "general",
        platform: "web",
        status: "pending",
        tenant: "airqo",
        actionable: true,
        reminderCount: 0,
        replies: [],
        watchers: [],
      };

      const instance = new (FeedbackModel("airqo"))(feedbackData);
      const result = instance.toJSON();

      expect(result).to.have.property("_id");
      expect(result).to.have.property("email", "test@example.com");
      expect(result).to.have.property("subject", "Test subject");
      expect(result).to.have.property("message", "Test message");
      expect(result).to.have.property("status", "pending");
      expect(result).to.have.property("tenant", "airqo");
    });
  });
});
