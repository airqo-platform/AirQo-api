require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const httpStatus = require("http-status");
const path = require("path");
const proxyquire = require("proxyquire");

describe("LearnCourse Model", () => {
  let Model;

  before(() => {
    const LearnCourseModel = proxyquire(
      path.resolve(__dirname, "../LearnCourse"),
      {
        "@config/database": {
          getModelByTenant: (_tenant, name, schema) => {
            try { return mongoose.model(name, schema); }
            catch (_) { return mongoose.model(name); }
          },
        },
      }
    );
    Model = LearnCourseModel("airqo");
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("Schema fields", () => {
    it("should define course_number as required Number with min 1", () => {
      const path = Model.schema.path("course_number");
      expect(path).to.exist;
      expect(path.isRequired).to.be.true;
      expect(path.instance).to.equal("Number");
    });

    it("should define title as required with maxlength 120", () => {
      const path = Model.schema.path("title");
      expect(path.isRequired).to.be.true;
    });

    it("should define plain_title_key as required", () => {
      const path = Model.schema.path("plain_title_key");
      expect(path.isRequired).to.be.true;
    });

    it("should set published default to false", () => {
      const path = Model.schema.path("published");
      expect(path.defaultValue).to.equal(false);
    });

    it("should define cover_image_url as optional", () => {
      const path = Model.schema.path("cover_image_url");
      expect(path).to.exist;
      expect(path.isRequired).to.not.be.true;
    });
  });

  describe("Static method: register", () => {
    it("should return success with CREATED status", async () => {
      const fakeDoc = {
        _id: new mongoose.Types.ObjectId(),
        _doc: { course_number: 1, title: "Intro", plain_title_key: "intro" },
      };
      sinon.stub(Model, "create").resolves(fakeDoc);
      const next = sinon.spy();

      const result = await Model.register(
        { course_number: 1, title: "Intro", plain_title_key: "intro" },
        next
      );

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.CREATED);
      expect(result.message).to.equal("course created");
    });

    it("should call next on duplicate course_number (11000)", async () => {
      const error = new Error("dup");
      error.code = 11000;
      error.keyPattern = { course_number: 1 };
      sinon.stub(Model, "create").rejects(error);
      const next = sinon.spy();

      await Model.register({ course_number: 1 }, next);

      expect(next.calledOnce).to.be.true;
    });

    it("should call next on validation error", async () => {
      const error = new Error("val");
      error.errors = { title: { message: "title is required" } };
      sinon.stub(Model, "create").rejects(error);
      const next = sinon.spy();

      await Model.register({}, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("Static method: list", () => {
    it("should return courses sorted by course_number", async () => {
      const fakeCourses = [
        { _id: "1", course_number: 1, title: "Intro" },
        { _id: "2", course_number: 2, title: "Advanced" },
      ];
      const fakeQuery = {
        sort: sinon.stub().returnsThis(),
        skip: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        lean: sinon.stub().resolves(fakeCourses),
      };
      sinon.stub(Model, "find").returns(fakeQuery);
      const next = sinon.spy();

      const result = await Model.list({}, next);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(fakeCourses);
    });

    it("should call next when find throws", async () => {
      sinon.stub(Model, "find").throws(new Error("db error"));
      const next = sinon.spy();

      await Model.list({}, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("Static method: modify", () => {
    it("should return success when record updated", async () => {
      const fakeUpdated = { _id: "1", _doc: { title: "New Title" } };
      sinon.stub(Model, "findOneAndUpdate").resolves(fakeUpdated);
      const next = sinon.spy();

      const result = await Model.modify(
        { filter: { _id: "1" }, update: { title: "New Title" } },
        next
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully modified the course");
    });

    it("should call next with BAD_REQUEST when record not found", async () => {
      sinon.stub(Model, "findOneAndUpdate").resolves(null);
      const next = sinon.spy();

      await Model.modify({ filter: {}, update: {} }, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("Static method: remove", () => {
    it("should return success when course removed", async () => {
      const fakeRemoved = { _id: "1", _doc: { title: "Intro" } };
      sinon.stub(Model, "findOneAndRemove").returns({
        exec: sinon.stub().resolves(fakeRemoved),
      });
      const next = sinon.spy();

      const result = await Model.remove({ filter: { _id: "1" } }, next);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully removed the course");
    });

    it("should call next when not found", async () => {
      sinon.stub(Model, "findOneAndRemove").returns({
        exec: sinon.stub().resolves(null),
      });
      const next = sinon.spy();

      await Model.remove({ filter: {} }, next);

      expect(next.calledOnce).to.be.true;
    });
  });
});
