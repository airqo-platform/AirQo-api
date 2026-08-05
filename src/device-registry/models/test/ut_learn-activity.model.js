require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const httpStatus = require("http-status");
const path = require("path");
const proxyquire = require("proxyquire");

describe("LearnActivity Model", () => {
  let Model;

  before(() => {
    const LearnActivityModel = proxyquire(
      path.resolve(__dirname, "../LearnActivity"),
      {
        "@config/database": {
          getModelByTenant: (_tenant, name, schema) => {
            try { return mongoose.model(name, schema); }
            catch (_) { return mongoose.model(name); }
          },
        },
      }
    );
    Model = LearnActivityModel("airqo");
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("Schema fields", () => {
    it("should define lesson_id as required ObjectId", () => {
      const path = Model.schema.path("lesson_id");
      expect(path).to.exist;
      expect(path.isRequired).to.be.true;
    });

    it("should define type with valid enum values", () => {
      const path = Model.schema.path("type");
      expect(path.enumValues).to.include.members(["article", "video", "image", "quiz"]);
      expect(path.isRequired).to.be.true;
    });

    it("should define order as required Number with min 1", () => {
      const path = Model.schema.path("order");
      expect(path.isRequired).to.be.true;
      expect(path.instance).to.equal("Number");
    });

    it("should define payload as required Mixed", () => {
      const path = Model.schema.path("payload");
      expect(path.isRequired).to.be.true;
    });
  });

  describe("Static method: register", () => {
    it("should return success on successful create", async () => {
      const lessonId = new mongoose.Types.ObjectId();
      const fakeDoc = {
        _id: new mongoose.Types.ObjectId(),
        _doc: { lesson_id: lessonId, type: "article", order: 1, payload: { body: "text" } },
      };
      sinon.stub(Model, "create").resolves(fakeDoc);
      const next = sinon.spy();

      const result = await Model.register(
        { lesson_id: lessonId, type: "article", order: 1, payload: { body: "text" } },
        next
      );

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.CREATED);
      expect(result.message).to.equal("activity created");
    });

    it("should call next with CONFLICT and duplicate value on 11000 error", async () => {
      const error = new Error("dup");
      error.code = 11000;
      error.keyPattern = { lesson_id: 1, order: 1 };
      sinon.stub(Model, "create").rejects(error);
      const next = sinon.spy();

      await Model.register({}, next);

      expect(next.calledOnce).to.be.true;
      const httpError = next.firstCall.args[0];
      expect(httpError.statusCode).to.equal(httpStatus.CONFLICT);
      expect(JSON.stringify(httpError.errors)).to.include("duplicate value");
    });

    it("should call next with CONFLICT and field message on validation error", async () => {
      const error = new Error("val");
      error.errors = { type: { message: "type is required" } };
      sinon.stub(Model, "create").rejects(error);
      const next = sinon.spy();

      await Model.register({}, next);

      expect(next.calledOnce).to.be.true;
      const httpError = next.firstCall.args[0];
      expect(httpError.statusCode).to.equal(httpStatus.CONFLICT);
      expect(JSON.stringify(httpError.errors)).to.include("type is required");
    });
  });

  describe("Static method: list", () => {
    it("should return sorted activities on success", async () => {
      const fakeActivities = [
        { _id: "1", type: "article", order: 1 },
        { _id: "2", type: "video", order: 2 },
      ];
      const fakeQuery = {
        sort: sinon.stub().returnsThis(),
        skip: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        lean: sinon.stub().resolves(fakeActivities),
      };
      sinon.stub(Model, "find").returns(fakeQuery);
      const next = sinon.spy();

      const result = await Model.list({}, next);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(fakeActivities);
    });

    it("should call next when find throws", async () => {
      sinon.stub(Model, "find").throws(new Error("db error"));
      const next = sinon.spy();

      await Model.list({}, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("Static method: modify", () => {
    it("should return success when record is found and updated", async () => {
      const fakeUpdated = { _id: "1", _doc: { type: "video", order: 1 } };
      sinon.stub(Model, "findOneAndUpdate").resolves(fakeUpdated);
      const next = sinon.spy();

      const result = await Model.modify(
        { filter: { _id: "1" }, update: { type: "video" } },
        next
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully modified the activity");
    });

    it("should call next with BAD_REQUEST when no record found", async () => {
      sinon.stub(Model, "findOneAndUpdate").resolves(null);
      const next = sinon.spy();

      await Model.modify({ filter: { _id: "nonexistent" }, update: {} }, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("Static method: remove", () => {
    it("should return success when record is removed", async () => {
      const fakeRemoved = { _id: "1", _doc: { type: "article", order: 1 } };
      sinon.stub(Model, "findOneAndRemove").returns({
        exec: sinon.stub().resolves(fakeRemoved),
      });
      const next = sinon.spy();

      const result = await Model.remove({ filter: { _id: "1" } }, next);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully removed the activity");
    });

    it("should call next when no record found", async () => {
      sinon.stub(Model, "findOneAndRemove").returns({
        exec: sinon.stub().resolves(null),
      });
      const next = sinon.spy();

      await Model.remove({ filter: { _id: "nonexistent" } }, next);

      expect(next.calledOnce).to.be.true;
    });
  });
});
