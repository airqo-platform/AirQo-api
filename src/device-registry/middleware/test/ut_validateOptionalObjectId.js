require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const { BadRequestError } = require("@utils/errors");
const validateOptionalObjectId = require("@middleware/validateOptionalObjectId");

describe("validateOptionalObjectId", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      query: {},
    };
    res = {};
    next = sinon.spy();
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should call next() if the field is not present in the query", () => {
    const middleware = validateOptionalObjectId("testField");
    middleware(req, res, next);
    expect(next.calledOnce).to.be.true;
    expect(next.args[0]).to.be.empty;
  });

  it("should validate a single valid ObjectId", () => {
    const validObjectId = new mongoose.Types.ObjectId().toString();
    req.query.testField = validObjectId;
    const middleware = validateOptionalObjectId("testField");
    middleware(req, res, next);
    expect(next.calledOnce).to.be.true;
    expect(next.args[0]).to.be.empty;
  });

  it("should validate multiple valid ObjectIds", () => {
    const validObjectIds = [
      new mongoose.Types.ObjectId().toString(),
      new mongoose.Types.ObjectId().toString(),
    ];
    req.query.testField = validObjectIds.join(",");
    const middleware = validateOptionalObjectId("testField");
    middleware(req, res, next);
    expect(next.calledOnce).to.be.true;
    expect(next.args[0]).to.be.empty;
  });

  it("should throw BadRequestError for a single invalid ObjectId", () => {
    req.query.testField = "invalidObjectId";
    const middleware = validateOptionalObjectId("testField");
    expect(() => middleware(req, res, next)).to.throw(BadRequestError);
    expect(next.called).to.be.false;
    try {
      middleware(req, res, next);
    } catch (error) {
      expect(error).to.be.instanceOf(BadRequestError);
      expect(error.message).to.equal("Validation failed for testField");
      expect(error.errors).to.deep.equal([
        "Invalid testField format: invalidObjectId",
      ]);
    }
  });

  it("should throw BadRequestError for multiple ObjectIds with some invalid", () => {
    const validObjectId = new mongoose.Types.ObjectId().toString();
    req.query.testField = `${validObjectId},invalidObjectId`;
    const middleware = validateOptionalObjectId("testField");
    expect(() => middleware(req, res, next)).to.throw(BadRequestError);
    expect(next.called).to.be.false;
    try {
      middleware(req, res, next);
    } catch (error) {
      expect(error).to.be.instanceOf(BadRequestError);
      expect(error.message).to.equal("Validation failed for testField");
      expect(error.errors).to.deep.equal([
        "Invalid testField format: invalidObjectId",
      ]);
    }
  });

  it("should handle an array of ObjectIds in the query", () => {
    const validObjectId = new mongoose.Types.ObjectId().toString();
    req.query.testField = [validObjectId, "invalidObjectId"];
    const middleware = validateOptionalObjectId("testField");
    expect(() => middleware(req, res, next)).to.throw(BadRequestError);
    expect(next.called).to.be.false;
    try {
      middleware(req, res, next);
    } catch (error) {
      expect(error).to.be.instanceOf(BadRequestError);
      expect(error.message).to.equal("Validation failed for testField");
      expect(error.errors).to.deep.equal([
        "Invalid testField format: invalidObjectId",
      ]);
    }
  });
});
