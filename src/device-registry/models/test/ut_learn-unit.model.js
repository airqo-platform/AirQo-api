require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const httpStatus = require("http-status");
const path = require("path");
const proxyquire = require("proxyquire");

describe("LearnUnit Model", () => {
  let Model;

  before(() => {
    const LearnUnitModel = proxyquire(
      path.resolve(__dirname, "../LearnUnit"),
      {
        "@config/database": {
          getModelByTenant: (_tenant, name, schema) => {
            try { return mongoose.model(name, schema); }
            catch (_) { return mongoose.model(name); }
          },
        },
      }
    );
    Model = LearnUnitModel("airqo");
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("Schema fields", () => {
    it("should define course_id as required ObjectId ref", () => {
      const path = Model.schema.path("course_id");
      expect(path).to.exist;
      expect(path.isRequired).to.be.true;
    });

    it("should define title as required String", () => {
      const path = Model.schema.path("title");
      expect(path.isRequired).to.be.true;
    });

    it("should define plain_title_key as required", () => {
      const path = Model.schema.path("plain_title_key");
      expect(path.isRequired).to.be.true;
    });

    it("should define unit_order as required Number", () => {
      const path = Model.schema.path("unit_order");
      expect(path.isRequired).to.be.true;
      expect(path.instance).to.equal("Number");
    });
  });

  describe("Static method: register", () => {
    it("should return success with CREATED status", async () => {
      const courseId = new mongoose.Types.ObjectId();
      const fakeDoc = {
        _id: new mongoose.Types.ObjectId(),
        _doc: { course_id: courseId, title: "Unit 1", plain_title_key: "unit_1", unit_order: 1 },
      };
      sinon.stub(Model, "create").resolves(fakeDoc);
      const next = sinon.spy();

      const result = await Model.register(
        { course_id: courseId, title: "Unit 1", plain_title_key: "unit_1", unit_order: 1 },
        next
      );

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.CREATED);
      expect(result.message).to.equal("unit created");
    });

    it("should call next on duplicate unit_order within course (11000)", async () => {
      const error = new Error("dup");
      error.code = 11000;
      error.keyPattern = { course_id: 1, unit_order: 1 };
      sinon.stub(Model, "create").rejects(error);
      const next = sinon.spy();

      await Model.register({}, next);

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
    it("should return units sorted by unit_order", async () => {
      const fakeUnits = [
        { unit_order: 1, title: "Unit 1" },
        { unit_order: 2, title: "Unit 2" },
      ];
      const fakeQuery = {
        sort: sinon.stub().returnsThis(),
        skip: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        lean: sinon.stub().resolves(fakeUnits),
      };
      sinon.stub(Model, "find").returns(fakeQuery);
      const next = sinon.spy();

      const result = await Model.list({}, next);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(fakeUnits);
    });

    it("should call next when find throws", async () => {
      sinon.stub(Model, "find").throws(new Error("db error"));
      const next = sinon.spy();

      await Model.list({}, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("Static method: modify", () => {
    it("should return success when unit is updated", async () => {
      const fakeUpdated = { _id: "u1", _doc: { title: "Updated Unit" } };
      sinon.stub(Model, "findOneAndUpdate").resolves(fakeUpdated);
      const next = sinon.spy();

      const result = await Model.modify(
        { filter: { _id: "u1" }, update: { title: "Updated Unit" } },
        next
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully modified the unit");
    });

    it("should call next when unit not found", async () => {
      sinon.stub(Model, "findOneAndUpdate").resolves(null);
      const next = sinon.spy();

      await Model.modify({ filter: {}, update: {} }, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("Static method: remove", () => {
    it("should return success when unit is removed", async () => {
      const fakeRemoved = { _id: "u1", _doc: { title: "Unit 1" } };
      sinon.stub(Model, "findOneAndRemove").returns({
        exec: sinon.stub().resolves(fakeRemoved),
      });
      const next = sinon.spy();

      const result = await Model.remove({ filter: { _id: "u1" } }, next);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully removed the unit");
    });

    it("should call next when unit not found", async () => {
      sinon.stub(Model, "findOneAndRemove").returns({
        exec: sinon.stub().resolves(null),
      });
      const next = sinon.spy();

      await Model.remove({ filter: {} }, next);

      expect(next.calledOnce).to.be.true;
    });
  });
});
