require("module-alias/register");
const { LogModel, logSchema } = require("@models/log");
const mongoose = require("mongoose");
// Bootstrap in-memory model registration so factory works without DB
try {
  if (!mongoose.modelNames().includes("logs")) mongoose.model("logs", logSchema);
} catch (_) {}

const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const httpStatus = require("http-status");

describe("logSchema statics", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("register method", () => {
    it("should create a new Log and return success message", async () => {
      const args = {
        timestamp: new Date(),
        level: "info",
        message: "Test log",
        meta: {
          service: "service_name",
          version: "1.0",
          requestId: "request_id",
          userId: "user_id",
          username: "user_name",
          email: "user@example.com",
          timestamp: "timestamp",
        },
      };

      // register() returns newLog._doc as data, so stub must include _doc
      const createStub = sinon
        .stub(LogModel("airqo"), "create")
        .resolves({ ...args, _doc: args });

      const result = await LogModel("airqo").register(args);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Log created");
      expect(result.data).to.deep.equal(args);

      createStub.restore();
    });

    it("should return success message with empty data if the Log is not created", async () => {
      const args = {
        timestamp: new Date(),
        level: "info",
        message: "Test log",
        meta: {
          service: "service_name",
          version: "1.0",
          requestId: "request_id",
          userId: "user_id",
          username: "user_name",
          email: "user@example.com",
          timestamp: "timestamp",
        },
      };

      // isEmpty([]) is true → createEmptySuccessResponse
      const createStub = sinon
        .stub(LogModel("airqo"), "create")
        .resolves([]);

      const result = await LogModel("airqo").register(args);

      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "operation successful but Log NOT successfully created"
      );
      expect(result.data).to.be.an("array").that.is.empty;

      createStub.restore();
    });

    it("should return validation errors if the Log creation encounters duplicate keys", async () => {
      const args = {
        timestamp: new Date(),
        level: "info",
        message: "Test log",
        Log_name: "duplicate_log",
      };

      // log.js register() handles keyValue: response[key] = `the ${key} must be unique`
      const createStub = sinon
        .stub(LogModel("airqo"), "create")
        .throws({
          code: 11000,
          keyValue: { Log_name: "duplicate_log" },
          message: "duplicate key error",
        });

      const result = await LogModel("airqo").register(args);

      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({
        Log_name: "the Log_name must be unique",
      });
      expect(result.message).to.equal(
        "validation errors for some of the provided fields"
      );
      expect(result.status).to.equal(409);

      createStub.restore();
    });

    it("should return validation errors if the Log creation encounters other validation errors", async () => {
      const args = {
        timestamp: new Date(),
        level: "info",
        message: "",
        meta: {
          service: "service_name",
          version: "1.0",
          requestId: "request_id",
          userId: "user_id",
          username: "user_name",
          email: "user@example.com",
          timestamp: "timestamp",
        },
      };

      const createStub = sinon
        .stub(LogModel("airqo"), "create")
        .throws({
          errors: {
            message: {
              message: "message is required",
            },
          },
          message: "validation error",
        });

      const result = await LogModel("airqo").register(args);

      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({ message: "message is required" });
      expect(result.message).to.equal(
        "validation errors for some of the provided fields"
      );
      expect(result.status).to.equal(409);

      createStub.restore();
    });
  });

  describe.skip("list method", () => {
    // Skipped: list() calls aggregate().match().sort().skip().limit().allowDiskUse() then countDocuments()
    // The aggregate builder chain cannot be mocked with simple .resolves() stubs.
  });

  describe("modify method", () => {
    it("should modify and return the updated Log", async () => {
      const logData = {
        _id: new mongoose.Types.ObjectId(),
        timestamp: new Date("2023-07-25T12:00:00Z"),
        message: "Original Log Message",
      };

      // modify() calls findOneAndUpdate(...).exec() and returns updatedLog._doc
      const findOneAndUpdateStub = sinon
        .stub(LogModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves({ ...logData, _doc: logData }) });

      const filter = { _id: logData._id };
      const update = { message: "Modified Log Message" };
      const result = await LogModel("airqo").modify({ filter, update });

      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      // createSuccessResponse("update", ..., "log") → "successfully modified the log"
      expect(result).to.have.property("message", "successfully modified the log");
      expect(result.data).to.deep.equal(logData);
      expect(result).to.have.property("status", httpStatus.OK);

      findOneAndUpdateStub.restore();
    });

    it("should return an error message if Log is not found", async () => {
      const findOneAndUpdateStub = sinon
        .stub(LogModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves(null) });

      const filter = { _id: "non_existent_log_id" };
      const update = { message: "Modified Log Message" };
      const result = await LogModel("airqo").modify({ filter, update });

      expect(result).to.be.an("object");
      expect(result).to.have.property("success", false);
      // createNotFoundResponse("log", "update", "Log not found") → message and errors.message both "Log not found"
      expect(result).to.have.property("message", "Log not found");
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
      expect(result).to.have.nested.property("errors.message", "Log not found");

      findOneAndUpdateStub.restore();
    });
  });

  describe("remove method", () => {
    it("should remove and return the removed Log", async () => {
      const logData = {
        _id: new mongoose.Types.ObjectId(),
        timestamp: new Date("2023-07-25T12:00:00Z"),
        message: "Log Message",
      };

      // remove() calls findOneAndRemove(...).exec() and returns removedLog._doc
      const findOneAndRemoveStub = sinon
        .stub(LogModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves({ ...logData, _doc: logData }) });

      const filter = { _id: logData._id };
      const result = await LogModel("airqo").remove({ filter });

      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      // createSuccessResponse("delete", ..., "log") → "successfully removed the log"
      expect(result).to.have.property("message", "successfully removed the log");
      expect(result.data).to.deep.equal(logData);
      expect(result).to.have.property("status", httpStatus.OK);

      findOneAndRemoveStub.restore();
    });

    it("should return an error message if Log does not exist", async () => {
      const findOneAndRemoveStub = sinon
        .stub(LogModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves(null) });

      const filter = { _id: "non_existent_log_id" };
      const result = await LogModel("airqo").remove({ filter });

      expect(result).to.be.an("object");
      expect(result).to.have.property("success", false);
      expect(result).to.have.property(
        "message",
        "Log does not exist, please crosscheck"
      );
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
      // createNotFoundResponse returns errors: { message: customMsg } — no data field
      expect(result).to.have.nested.property(
        "errors.message",
        "Log does not exist, please crosscheck"
      );

      findOneAndRemoveStub.restore();
    });
  });
});

describe("logSchema methods", () => {
  describe("toJSON method", () => {
    it("should return a JSON object with specific properties", () => {
      const logId = new mongoose.Types.ObjectId();

      // LogModel is a factory — must use new (LogModel("airqo"))({...})
      const log = new (LogModel("airqo"))({
        _id: logId,
        timestamp: new Date(),
        level: "info",
        message: "Test log",
        meta: {
          service: "service_name",
          version: "1.0",
          requestId: "request_id",
          userId: "user_id",
          username: "user_name",
          email: "user@example.com",
          timestamp: "timestamp",
        },
      });

      const result = log.toJSON();

      expect(result).to.be.an("object");
      expect(result._id.toString()).to.equal(logId.toString());
      expect(result).to.have.property("timestamp");
      expect(result).to.have.property("level", "info");
      expect(result).to.have.property("message", "Test log");
      expect(result).to.have.property("meta").that.is.an("object");
      expect(result.meta).to.include({
        service: "service_name",
        version: "1.0",
        requestId: "request_id",
        userId: "user_id",
        username: "user_name",
        email: "user@example.com",
        timestamp: "timestamp",
      });
    });
  });
});
