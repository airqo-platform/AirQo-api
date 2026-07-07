require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const rewire = require("rewire");
const mongoose = require("mongoose");
const httpStatus = require("http-status");
const SelfieModel = require("@models/Selfie");

// Register the schema in-memory so the factory returns the cached model
// (via mongoose.model("selfies")) instead of hitting getModelByTenant,
// which would try to open a real per-tenant DB connection.
const _SelfieSchema = rewire("@models/Selfie").__get__("SelfieSchema");
if (!mongoose.modelNames().includes("selfies")) {
  mongoose.model("selfies", _SelfieSchema);
}

const VALID_URL =
  "https://res.cloudinary.com/airqo/image/upload/v123/clean_air_forum_selfies/abc.jpg";

describe("SelfieSchema", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("schema validation", () => {
    it("rejects a non-Cloudinary imageUrl", () => {
      const doc = new (mongoose.model("selfies"))({
        eventId: "event-1",
        imageUrl: "https://example.com/not-cloudinary.jpg",
      });
      const err = doc.validateSync();
      expect(err.errors.imageUrl).to.exist;
    });

    it("rejects a Cloudinary URL missing the clean_air_forum_selfies path segment", () => {
      const doc = new (mongoose.model("selfies"))({
        eventId: "event-1",
        imageUrl:
          "https://res.cloudinary.com/airqo/image/upload/v123/some_other_folder/abc.jpg",
      });
      const err = doc.validateSync();
      expect(err.errors.imageUrl).to.exist;
    });

    it("accepts a well-formed Cloudinary selfie URL", () => {
      const doc = new (mongoose.model("selfies"))({
        eventId: "event-1",
        imageUrl: VALID_URL,
      });
      const err = doc.validateSync();
      expect(err).to.be.undefined;
    });

    it("requires eventId", () => {
      const doc = new (mongoose.model("selfies"))({
        imageUrl: VALID_URL,
      });
      const err = doc.validateSync();
      expect(err.errors.eventId).to.exist;
    });

    it("defaults hidden to false", () => {
      const doc = new (mongoose.model("selfies"))({
        eventId: "event-1",
        imageUrl: VALID_URL,
      });
      expect(doc.hidden).to.equal(false);
    });
  });

  describe("register method", () => {
    it("creates a selfie and returns a success response", async () => {
      const args = { eventId: "event-1", imageUrl: VALID_URL };
      sinon.stub(SelfieModel("airqo"), "create").resolves(args);

      const result = await SelfieModel("airqo").register(args);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("selfie submitted");
      expect(result.data).to.deep.equal(args);
    });

    it("returns an error response when create throws", async () => {
      sinon
        .stub(SelfieModel("airqo"), "create")
        .throws(new Error("DB error"));

      const result = await SelfieModel("airqo").register({});

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("list method", () => {
    function stubAggregate(resolvedData) {
      const chainable = {
        match: sinon.stub().returnsThis(),
        project: sinon.stub().returnsThis(),
        sort: sinon.stub().returnsThis(),
        skip: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(resolvedData),
      };
      sinon.stub(SelfieModel("airqo"), "aggregate").returns(chainable);
      return chainable;
    }

    it("projects out user_id, guest_id, hiddenBy and hiddenAt", async () => {
      const chainable = stubAggregate([
        { _id: "1", eventId: "event-1", imageUrl: VALID_URL },
      ]);
      sinon.stub(SelfieModel("airqo"), "countDocuments").resolves(1);

      await SelfieModel("airqo").list({ filter: { eventId: "event-1" } });

      expect(chainable.project.calledOnce).to.be.true;
      const projection = chainable.project.firstCall.args[0];
      expect(projection).to.deep.equal({
        user_id: 0,
        guest_id: 0,
        hiddenBy: 0,
        hiddenAt: 0,
      });
    });

    it("returns data, respects skip/limit and computes pagination meta", async () => {
      const mockData = [{ _id: "1" }, { _id: "2" }];
      stubAggregate(mockData);
      sinon.stub(SelfieModel("airqo"), "countDocuments").resolves(25);

      const result = await SelfieModel("airqo").list({
        filter: {},
        skip: 20,
        limit: 10,
      });

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(mockData);
      expect(result.meta).to.deep.equal({
        total: 25,
        skip: 20,
        limit: 10,
        page: 3,
        pages: 3,
      });
    });

    it("returns an error response when aggregate throws", async () => {
      sinon
        .stub(SelfieModel("airqo"), "aggregate")
        .throws(new Error("DB error"));

      const result = await SelfieModel("airqo").list({ filter: {} });

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("modify method", () => {
    it("returns an error and never calls findOneAndUpdate when filter is empty", async () => {
      const findOneAndUpdateStub = sinon.stub(
        SelfieModel("airqo"),
        "findOneAndUpdate"
      );

      const result = await SelfieModel("airqo").modify({
        filter: {},
        update: { $set: { hidden: true } },
      });

      expect(result.success).to.be.false;
      expect(findOneAndUpdateStub.called).to.be.false;
    });

    it("returns an error and never calls findOneAndUpdate when filter is omitted", async () => {
      const findOneAndUpdateStub = sinon.stub(
        SelfieModel("airqo"),
        "findOneAndUpdate"
      );

      const result = await SelfieModel("airqo").modify({
        update: { $set: { hidden: true } },
      });

      expect(result.success).to.be.false;
      expect(findOneAndUpdateStub.called).to.be.false;
    });

    it("updates and returns the modified selfie when a filter is provided", async () => {
      const docData = { _id: "1", hidden: true };
      sinon
        .stub(SelfieModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves(docData) });

      const result = await SelfieModel("airqo").modify({
        filter: { _id: "1" },
        update: { $set: { hidden: true } },
      });

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully modified the selfie");
      expect(result.data).to.deep.equal(docData);
    });

    it("returns a not-found response when no document matches", async () => {
      sinon
        .stub(SelfieModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves(null) });

      const result = await SelfieModel("airqo").modify({
        filter: { _id: "missing" },
        update: { $set: { hidden: true } },
      });

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
    });
  });

  describe("findOne method", () => {
    // Regression test: this static's name shadows Mongoose's built-in
    // Model.findOne. The implementation must delegate to
    // mongoose.Model.findOne.call(this, filter) -- calling `this.findOne(...)`
    // from inside this static would recurse into itself forever.
    it("does not recurse into itself and returns the matched document", async () => {
      sinon.stub(mongoose.Model, "findOne").returns({
        exec: sinon.stub().resolves({ _id: "1", eventId: "event-1" }),
      });

      const result = await SelfieModel("airqo").findOne({
        filter: { _id: "1" },
      });

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal({ _id: "1", eventId: "event-1" });
    });

    it("returns a not-found response when no document matches", async () => {
      sinon.stub(mongoose.Model, "findOne").returns({
        exec: sinon.stub().resolves(null),
      });

      const result = await SelfieModel("airqo").findOne({
        filter: { _id: "missing" },
      });

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
    });
  });

  describe("remove method", () => {
    it("removes and returns the deleted selfie", async () => {
      const docData = { _id: "1" };
      sinon
        .stub(SelfieModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves(docData) });

      const result = await SelfieModel("airqo").remove({
        filter: { _id: "1" },
      });

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(docData);
    });

    it("returns a not-found response when no document matches", async () => {
      sinon
        .stub(SelfieModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves(null) });

      const result = await SelfieModel("airqo").remove({
        filter: { _id: "missing" },
      });

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
    });
  });

  describe("removeMany method", () => {
    it("returns the deleted count on success", async () => {
      sinon
        .stub(SelfieModel("airqo"), "deleteMany")
        .returns({ exec: sinon.stub().resolves({ deletedCount: 3 }) });

      const result = await SelfieModel("airqo").removeMany({
        filter: { createdAt: { $lt: new Date() } },
      });

      expect(result.success).to.be.true;
      expect(result.data.deletedCount).to.equal(3);
    });

    it("returns an error response when deleteMany throws", async () => {
      sinon
        .stub(SelfieModel("airqo"), "deleteMany")
        .throws(new Error("DB error"));

      const result = await SelfieModel("airqo").removeMany({ filter: {} });

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
