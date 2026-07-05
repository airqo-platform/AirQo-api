require("module-alias/register");
const rewire = require("rewire");
const mongoose = require("mongoose");

// Register FeedbackWebhook model without a live DB connection
try {
  const _webhookMod = rewire("@models/FeedbackWebhook");
  const FeedbackWebhookSchema = _webhookMod.__get__("FeedbackWebhookSchema");
  if (!mongoose.modelNames().includes("feedbackWebhooks")) {
    mongoose.model("feedbackWebhooks", FeedbackWebhookSchema);
  }
} catch (_) {}

// Patch getModelByTenant to return in-memory model
const database = require("@config/database");
if (database.getModelByTenant.__isPatched !== true) {
  const _orig = database.getModelByTenant;
  database.getModelByTenant = (tenant, modelName, schema) => {
    const plural = modelName + "s";
    if (mongoose.modelNames().includes(plural)) return mongoose.model(plural);
    if (mongoose.modelNames().includes(modelName)) return mongoose.model(modelName);
    try {
      return mongoose.model(modelName, schema);
    } catch (_) {
      return mongoose.model(modelName);
    }
  };
  database.getModelByTenant.__isPatched = true;
}

const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const httpStatus = require("http-status");
const { FeedbackWebhookModel, WEBHOOK_EVENTS } = require("@models/FeedbackWebhook");

describe("FeedbackWebhookModel", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("WEBHOOK_EVENTS constant", () => {
    it("should export the expected event types", () => {
      expect(WEBHOOK_EVENTS).to.be.an("array").that.includes("feedback.submitted");
      expect(WEBHOOK_EVENTS).to.include("feedback.status_changed");
    });
  });

  describe("Static Method: register", () => {
    it("should create a webhook and return success without secret in response", async () => {
      const args = {
        name: "My Webhook",
        url: "https://example.com/hook",
        events: ["feedback.submitted"],
        secret: "mysupersecret16ch",
        tenant: "airqo",
      };

      const createdDoc = {
        ...args,
        _id: new mongoose.Types.ObjectId(),
        toObject: () => ({ name: "My Webhook", url: "https://example.com/hook", _id: new mongoose.Types.ObjectId() }),
      };

      const createStub = sinon
        .stub(FeedbackWebhookModel("airqo"), "create")
        .resolves(createdDoc);

      const result = await FeedbackWebhookModel("airqo").register(args);

      expect(result.success).to.equal(true);
      if (result.data) {
        expect(result.data).to.not.have.property("secret");
      }

      createStub.restore();
    });

    it("should handle duplicate key error", async () => {
      const createStub = sinon
        .stub(FeedbackWebhookModel("airqo"), "create")
        .throws({ code: 11000, keyValue: { name: "My Webhook" }, message: "dup key" });

      const result = await FeedbackWebhookModel("airqo").register({
        name: "My Webhook",
        url: "https://example.com/hook",
        events: ["feedback.submitted"],
        secret: "mysupersecret16ch",
        tenant: "airqo",
      });

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.CONFLICT);

      createStub.restore();
    });
  });

  describe("Static Method: list", () => {
    it("should list webhooks with pagination metadata", async () => {
      const model = FeedbackWebhookModel("airqo");
      const countStub = sinon.stub(model, "countDocuments").resolves(2);
      const findStub = sinon.stub(model, "find").returns({
        select: sinon.stub().returnsThis(),
        sort: sinon.stub().returnsThis(),
        skip: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        lean: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves([
          { _id: "id1", name: "Hook A" },
          { _id: "id2", name: "Hook B" },
        ]),
      });

      const result = await model.list({ skip: 0, limit: 10, filter: {} });

      expect(result.success).to.equal(true);
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.be.an("array").with.lengthOf(2);
      expect(result.meta.total).to.equal(2);

      countStub.restore();
      findStub.restore();
    });

    it("should handle list error", async () => {
      const model = FeedbackWebhookModel("airqo");
      const countStub = sinon.stub(model, "countDocuments").throws(new Error("DB failure"));

      const result = await model.list({ skip: 0, limit: 10, filter: {} });

      expect(result.success).to.equal(false);

      countStub.restore();
    });
  });

  describe("Static Method: findSingle", () => {
    it("should return a found webhook", async () => {
      const model = FeedbackWebhookModel("airqo");
      const findOneStub = sinon.stub(model, "findOne").returns({
        select: sinon.stub().returnsThis(),
        lean: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves({ _id: "id1", name: "Hook A", url: "https://x.com" }),
      });

      const result = await model.findSingle({ _id: "id1" });

      expect(result.success).to.equal(true);

      findOneStub.restore();
    });

    it("should return not found when webhook does not exist", async () => {
      const model = FeedbackWebhookModel("airqo");
      const findOneStub = sinon.stub(model, "findOne").returns({
        select: sinon.stub().returnsThis(),
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
    it("should update a webhook and return success", async () => {
      const webhookId = new mongoose.Types.ObjectId();
      const updatedDoc = { _id: webhookId, name: "Updated Hook", active: false };
      const model = FeedbackWebhookModel("airqo");

      const findOneAndUpdateStub = sinon
        .stub(model, "findOneAndUpdate")
        .returns({
          select: sinon.stub().returnsThis(),
          exec: sinon.stub().resolves({ ...updatedDoc, _doc: updatedDoc }),
        });

      const result = await model.modify({
        filter: { _id: webhookId },
        update: { active: false },
      });

      expect(result.success).to.equal(true);

      findOneAndUpdateStub.restore();
    });

    it("should return not found when webhook does not exist", async () => {
      const model = FeedbackWebhookModel("airqo");
      const findOneAndUpdateStub = sinon
        .stub(model, "findOneAndUpdate")
        .returns({
          select: sinon.stub().returnsThis(),
          exec: sinon.stub().resolves(null),
        });

      const result = await model.modify({ filter: { _id: "none" }, update: { active: false } });

      expect(result.success).to.equal(false);

      findOneAndUpdateStub.restore();
    });
  });

  describe("Static Method: remove", () => {
    it("should delete a webhook and return success", async () => {
      const webhookId = new mongoose.Types.ObjectId();
      const deletedDoc = {
        _id: webhookId,
        name: "Hook A",
        toObject: () => ({ _id: webhookId, name: "Hook A" }),
      };
      const model = FeedbackWebhookModel("airqo");

      const findOneAndDeleteStub = sinon
        .stub(model, "findOneAndDelete")
        .returns({ exec: sinon.stub().resolves(deletedDoc) });

      const result = await model.remove({ _id: webhookId });

      expect(result.success).to.equal(true);
      if (result.data) {
        expect(result.data).to.not.have.property("secret");
      }

      findOneAndDeleteStub.restore();
    });

    it("should return not found when no webhook matched", async () => {
      const model = FeedbackWebhookModel("airqo");
      const findOneAndDeleteStub = sinon
        .stub(model, "findOneAndDelete")
        .returns({ exec: sinon.stub().resolves(null) });

      const result = await model.remove({ _id: "nonexistent" });

      expect(result.success).to.equal(false);

      findOneAndDeleteStub.restore();
    });
  });

  describe("Static Method: findActiveForEvent", () => {
    it("should return active webhooks for an event", async () => {
      const model = FeedbackWebhookModel("airqo");
      const findStub = sinon.stub(model, "find").returns({
        lean: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves([{ _id: "id1", name: "Hook A", secret: "s", url: "https://x.com" }]),
      });

      const result = await model.findActiveForEvent("airqo", "feedback.submitted");

      expect(result).to.be.an("array").with.lengthOf(1);

      findStub.restore();
    });

    it("should return empty array when an error occurs", async () => {
      const model = FeedbackWebhookModel("airqo");
      const findStub = sinon.stub(model, "find").returns({
        lean: sinon.stub().returnsThis(),
        exec: sinon.stub().throws(new Error("DB error")),
      });

      const result = await model.findActiveForEvent("airqo", "feedback.submitted");

      expect(result).to.be.an("array").with.lengthOf(0);

      findStub.restore();
    });
  });
});
