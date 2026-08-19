require("module-alias/register");
const rewire = require("rewire");
const mongoose = require("mongoose");

// Bootstrap in-memory model registration so factory works without DB
try {
  const _schema = rewire("@models/Defaults").__get__("DefaultsSchema");
  if (!mongoose.modelNames().includes("defaults")) {
    mongoose.model("defaults", _schema);
  }
} catch (_) {}

const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const httpStatus = require("http-status");
const DefaultsModel = require("@models/Defaults");

describe("DefaultsModel - Statics", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("register", () => {
    it("should create a new default and return success response", async () => {
      const args = {
        pollutant: "CO2",
        frequency: "hourly",
        user: new mongoose.Types.ObjectId(),
        chartType: "line",
        chartTitle: "Default Chart",
      };
      const createdData = { ...args, _id: new mongoose.Types.ObjectId() };

      const createStub = sinon
        .stub(DefaultsModel("airqo"), "create")
        .resolves(createdData);

      const result = await DefaultsModel("airqo").register(args);

      expect(result).to.be.an("object").that.includes({
        success: true,
        message: "default created successfully with no issues detected",
        status: httpStatus.OK,
      });
      expect(result).to.have.property("data").that.is.an("object");

      createStub.restore();
    });

    it("should handle duplicate values and return conflict response", async () => {
      const args = { pollutant: "CO2", user: new mongoose.Types.ObjectId() };

      const createStub = sinon
        .stub(DefaultsModel("airqo"), "create")
        .throws({ code: 11000, keyValue: { pollutant: "CO2" }, message: "dup key" });

      const result = await DefaultsModel("airqo").register(args);

      expect(result).to.be.an("object").that.includes({
        success: false,
        message: "duplicate values provided",
        status: httpStatus.CONFLICT,
      });
      expect(result).to.have.property("errors").that.is.an("object");

      createStub.restore();
    });
  });

  describe("list", () => {
    it("should return a list of defaults", async () => {
      const mockDefaults = [{ pollutant: "CO2", frequency: "hourly" }];

      const findStub = sinon
        .stub(DefaultsModel("airqo"), "find")
        .returns({
          sort: sinon.stub().returnsThis(),
          skip: sinon.stub().returnsThis(),
          limit: sinon.stub().returnsThis(),
          exec: sinon.stub().resolves(mockDefaults),
        });
      const countStub = sinon
        .stub(DefaultsModel("airqo"), "countDocuments")
        .resolves(1);

      const result = await DefaultsModel("airqo").list({ filter: {}, skip: 0, limit: 20 });

      expect(result).to.be.an("object").that.includes({
        success: true,
        message: "successfully listed the defaults",
        status: httpStatus.OK,
      });
      expect(result).to.have.property("data").that.is.an("array");

      findStub.restore();
      countStub.restore();
    });

    it("should return error response on failure", async () => {
      const findStub = sinon
        .stub(DefaultsModel("airqo"), "find")
        .throws(new Error("DB error"));

      const result = await DefaultsModel("airqo").list({ filter: {} });

      expect(result.success).to.be.false;

      findStub.restore();
    });
  });

  describe("modify", () => {
    it("should modify the default and return success response", async () => {
      const defaultData = {
        _id: new mongoose.Types.ObjectId(),
        pollutant: "CO2",
        frequency: "daily",
      };

      const findOneAndUpdateStub = sinon
        .stub(DefaultsModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves({ ...defaultData, _doc: defaultData }) });

      const result = await DefaultsModel("airqo").modify({
        filter: { pollutant: "CO2" },
        update: { frequency: "daily" },
      });

      expect(result).to.be.an("object").that.includes({
        success: true,
        message: "successfully modified the default",
        status: httpStatus.OK,
      });
      expect(result).to.have.property("data").that.is.an("object");

      findOneAndUpdateStub.restore();
    });

    it("should handle not found and return not found response", async () => {
      const findOneAndUpdateStub = sinon
        .stub(DefaultsModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves(null) });

      const result = await DefaultsModel("airqo").modify({
        filter: { pollutant: "nonexistent" },
        update: { frequency: "daily" },
      });

      expect(result).to.be.an("object").that.includes({
        success: false,
        status: httpStatus.BAD_REQUEST,
      });
      expect(result.message).to.include("does not exist");

      findOneAndUpdateStub.restore();
    });
  });

  describe("remove", () => {
    it("should remove the default and return success response", async () => {
      const defaultData = {
        _id: new mongoose.Types.ObjectId(),
        user: new mongoose.Types.ObjectId(),
        chartTitle: "Default Chart",
      };

      const findOneAndRemoveStub = sinon
        .stub(DefaultsModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves({ ...defaultData, _doc: defaultData }) });

      const result = await DefaultsModel("airqo").remove({
        filter: { _id: defaultData._id },
      });

      expect(result).to.be.an("object").that.includes({
        success: true,
        message: "successfully removed the default",
        status: httpStatus.OK,
      });
      expect(result).to.have.property("data").that.is.an("object");

      findOneAndRemoveStub.restore();
    });

    it("should handle not found and return not found response", async () => {
      const findOneAndRemoveStub = sinon
        .stub(DefaultsModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves(null) });

      const result = await DefaultsModel("airqo").remove({
        filter: { _id: "nonexistent" },
      });

      expect(result).to.be.an("object").that.includes({
        success: false,
        status: httpStatus.BAD_REQUEST,
      });
      expect(result.message).to.include("does not exist");

      findOneAndRemoveStub.restore();
    });
  });
});

describe("DefaultsModel - Methods", () => {
  describe("toJSON", () => {
    it("should return the JSON representation of the default object", () => {
      const defaultId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      const createdAt = new Date();

      const defaultObj = new (DefaultsModel("airqo"))({
        _id: defaultId,
        pollutant: "CO2",
        frequency: "hourly",
        user: userId,
        chartType: "line",
        chartTitle: "Default Chart",
        chartSubTitle: "Default Chart Subtitle",
        createdAt,
      });

      const result = defaultObj.toJSON();

      expect(result).to.be.an("object");
      expect(result._id.toString()).to.equal(defaultId.toString());
      expect(result).to.have.property("pollutant", "CO2");
      expect(result).to.have.property("frequency", "hourly");
      expect(result).to.have.property("chartType", "line");
      expect(result).to.have.property("chartTitle", "Default Chart");
    });

    it("should include expected fields in the JSON representation", () => {
      const defaultObj = new (DefaultsModel("airqo"))({
        pollutant: "CO2",
        frequency: "hourly",
        user: new mongoose.Types.ObjectId(),
        chartType: "line",
        chartTitle: "Test Chart",
      });

      const result = defaultObj.toJSON();

      expect(result).to.have.property("_id");
      expect(result).to.have.property("pollutant");
      expect(result).to.have.property("frequency");
    });
  });
});
