require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const httpStatus = require("http-status");
const path = require("path");
const proxyquire = require("proxyquire");

describe("LearnLesson Model", () => {
  let Model;

  before(() => {
    const LearnLessonModel = proxyquire(
      path.resolve(__dirname, "../LearnLesson"),
      {
        "@config/database": {
          getModelByTenant: (_tenant, name, schema) => {
            try { return mongoose.model(name, schema); }
            catch (_) { return mongoose.model(name); }
          },
        },
      }
    );
    Model = LearnLessonModel("airqo");
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("Schema fields", () => {
    it("should define unit_id as required ObjectId ref", () => {
      const path = Model.schema.path("unit_id");
      expect(path).to.exist;
      expect(path.isRequired).to.be.true;
    });

    it("should define title as required with maxlength 120", () => {
      const path = Model.schema.path("title");
      expect(path.isRequired).to.be.true;
    });

    it("should define plain_title_key as required", () => {
      const path = Model.schema.path("plain_title_key");
      expect(path.isRequired).to.be.true;
    });

    it("should define lesson_order as required Number", () => {
      const path = Model.schema.path("lesson_order");
      expect(path.isRequired).to.be.true;
      expect(path.instance).to.equal("Number");
    });

    it("should define cover_image_url and completion_message as optional", () => {
      expect(Model.schema.path("cover_image_url").isRequired).to.not.be.true;
      expect(Model.schema.path("completion_message").isRequired).to.not.be.true;
    });
  });

  describe("Static method: register", () => {
    it("should return success with CREATED status", async () => {
      const unitId = new mongoose.Types.ObjectId();
      const fakeDoc = {
        _id: new mongoose.Types.ObjectId(),
        _doc: { unit_id: unitId, title: "Lesson 1", plain_title_key: "lesson_1", lesson_order: 1 },
      };
      sinon.stub(Model, "create").resolves(fakeDoc);
      const next = sinon.spy();

      const result = await Model.register(
        { unit_id: unitId, title: "Lesson 1", plain_title_key: "lesson_1", lesson_order: 1 },
        next
      );

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.CREATED);
      expect(result.message).to.equal("lesson created");
    });

    it("should call next on duplicate lesson_order within unit (11000)", async () => {
      const error = new Error("dup");
      error.code = 11000;
      error.keyPattern = { unit_id: 1, lesson_order: 1 };
      sinon.stub(Model, "create").rejects(error);
      const next = sinon.spy();

      await Model.register({}, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("Static method: list", () => {
    it("should return lessons sorted by lesson_order", async () => {
      const fakeLessons = [
        { lesson_order: 1, title: "First" },
        { lesson_order: 2, title: "Second" },
      ];
      const fakeQuery = {
        sort: sinon.stub().returnsThis(),
        skip: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        lean: sinon.stub().resolves(fakeLessons),
      };
      sinon.stub(Model, "find").returns(fakeQuery);
      const next = sinon.spy();

      const result = await Model.list({}, next);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(fakeLessons);
    });

    it("should call next when find throws", async () => {
      sinon.stub(Model, "find").throws(new Error("db error"));
      const next = sinon.spy();

      await Model.list({}, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("Static method: modify", () => {
    it("should return success when lesson is updated", async () => {
      const fakeUpdated = { _id: "l1", _doc: { title: "Updated" } };
      sinon.stub(Model, "findOneAndUpdate").resolves(fakeUpdated);
      const next = sinon.spy();

      const result = await Model.modify(
        { filter: { _id: "l1" }, update: { title: "Updated" } },
        next
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully modified the lesson");
    });

    it("should call next with BAD_REQUEST when lesson not found", async () => {
      sinon.stub(Model, "findOneAndUpdate").resolves(null);
      const next = sinon.spy();

      await Model.modify({ filter: {}, update: {} }, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("Static method: remove", () => {
    it("should return success when lesson removed", async () => {
      const fakeRemoved = { _id: "l1", _doc: { title: "Lesson 1" } };
      sinon.stub(Model, "findOneAndRemove").returns({
        exec: sinon.stub().resolves(fakeRemoved),
      });
      const next = sinon.spy();

      const result = await Model.remove({ filter: { _id: "l1" } }, next);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully removed the lesson");
    });

    it("should call next when lesson not found", async () => {
      sinon.stub(Model, "findOneAndRemove").returns({
        exec: sinon.stub().resolves(null),
      });
      const next = sinon.spy();

      await Model.remove({ filter: {} }, next);

      expect(next.calledOnce).to.be.true;
    });
  });
});
