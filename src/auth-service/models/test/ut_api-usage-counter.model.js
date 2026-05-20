require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const mongoose = require("mongoose");
const ApiUsageCounterModel = require("@models/ApiUsageCounter");

describe("ApiUsageCounterSchema", () => {
  let Model;

  before(() => {
    Model = ApiUsageCounterModel("airqo");
  });

  describe("schema field validation", () => {
    it("should reject a document missing user_id", () => {
      const doc = new Model({
        period: "hourly",
        window_key: "2026052014",
        expires_at: new Date(),
      });
      const err = doc.validateSync();
      expect(err).to.exist;
      expect(err.errors).to.have.property("user_id");
    });

    it("should reject a document with an invalid period value", () => {
      const doc = new Model({
        user_id: new mongoose.Types.ObjectId(),
        period: "weekly",
        window_key: "2026052014",
        expires_at: new Date(),
      });
      const err = doc.validateSync();
      expect(err).to.exist;
      expect(err.errors).to.have.property("period");
    });

    it("should reject a document missing window_key", () => {
      const doc = new Model({
        user_id: new mongoose.Types.ObjectId(),
        period: "daily",
        expires_at: new Date(),
      });
      const err = doc.validateSync();
      expect(err).to.exist;
      expect(err.errors).to.have.property("window_key");
    });

    it("should reject a document missing expires_at", () => {
      const doc = new Model({
        user_id: new mongoose.Types.ObjectId(),
        period: "monthly",
        window_key: "202605",
      });
      const err = doc.validateSync();
      expect(err).to.exist;
      expect(err.errors).to.have.property("expires_at");
    });

    it("should default count to 0 when not provided", () => {
      const doc = new Model({
        user_id: new mongoose.Types.ObjectId(),
        period: "hourly",
        window_key: "2026052014",
        expires_at: new Date(),
      });
      expect(doc.count).to.equal(0);
    });

    it("should pass validation for a fully valid document", () => {
      const doc = new Model({
        user_id: new mongoose.Types.ObjectId(),
        period: "daily",
        window_key: "20260520",
        count: 5,
        expires_at: new Date(Date.now() + 86400000 * 3),
      });
      const err = doc.validateSync();
      expect(err).to.be.undefined;
    });
  });

  describe("index definitions", () => {
    it("should define a unique compound index on {user_id, period, window_key}", () => {
      const indexes = Model.schema.indexes();
      const compound = indexes.find(
        ([fields, opts]) =>
          fields.user_id === 1 &&
          fields.period === 1 &&
          fields.window_key === 1 &&
          opts.unique === true
      );
      expect(compound).to.exist;
    });

    it("should define a TTL index on expires_at with expireAfterSeconds: 0", () => {
      const indexes = Model.schema.indexes();
      const ttl = indexes.find(
        ([fields, opts]) =>
          fields.expires_at === 1 && opts.expireAfterSeconds === 0
      );
      expect(ttl).to.exist;
    });
  });
});
