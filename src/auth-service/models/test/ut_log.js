require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const mongoose = require("mongoose");
const logSchema = require("@models/log");

// Replace this with the actual import path for your Log model if applicable
const LogModel = mongoose.model("Log", logSchema);

describe("logSchema statics", () => {
  describe("register method", () => {
    it("should create a new Log and return success message", async () => {
      // Mock input data for the Log to be created
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

      // Mock the Log.create method to return a successful result
      const createStub = sinon.stub(LogModel, "create").resolves(args);

      // Call the register method
      const result = await LogModel.register(args);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Log created");
      expect(result.data).to.deep.equal(args);

      // Restore the stubbed method
      createStub.restore();
    });

    it("should return success message with empty data if the Log is not created", async () => {
      // Mock input data for the Log (this time we'll return an empty data array)
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

      // Mock the Log.create method to return an empty data array
      const createStub = sinon.stub(LogModel, "create").resolves([]);

      // Call the register method
      const result = await LogModel.register(args);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "operation successful but Log NOT successfully created"
      );
      expect(result.data).to.be.an("array").that.is.empty;

      // Restore the stubbed method
      createStub.restore();
    });

    it("should return validation errors if the Log creation encounters duplicate keys", async () => {
      // Mock input data for the Log with duplicate keys (Log_name and Log_code)
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
        Log_name: "duplicate_log",
      };

      // Mock the Log.create method to throw a duplicate key error
      const createStub = sinon.stub(LogModel, "create").throws({
        code: 11000,
        keyValue: { Log_name: "duplicate_log" },
      });

      // Call the register method
      const result = await LogModel.register(args);

      // Assertions
      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({
        Log_name: "Log_name must be unique",
      });
      expect(result.message).to.equal(
        "validation errors for some of the provided fields"
      );
      expect(result.status).to.equal(409);

      // Restore the stubbed method
      createStub.restore();
    });

    it("should return validation errors if the Log creation encounters other validation errors", async () => {
      // Mock input data for the Log with invalid values
      const args = {
        timestamp: new Date(),
        level: "info",
        message: "", // Empty message (invalid)
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

      // Mock the Log.create method to throw a validation error
      const createStub = sinon.stub(LogModel, "create").throws({
        errors: {
          message: {
            message: "message is required",
          },
        },
      });

      // Call the register method
      const result = await LogModel.register(args);

      // Assertions
      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({ message: "message is required" });
      expect(result.message).to.equal(
        "validation errors for some of the provided fields"
      );
      expect(result.status).to.equal(409);

      // Restore the stubbed method
      createStub.restore();
    });

    // Add more test cases to cover additional scenarios
  });
  describe("list method", () => {
    it("should return a list of logs with default values", async () => {
      // Sample logs data
      const logsData = [
        {
          _id: "log_id_1",
          timestamp: new Date("2023-07-25T12:00:00Z"),
          message: "Log 1",
        },
        {
          _id: "log_id_2",
          timestamp: new Date("2023-07-26T12:00:00Z"),
          message: "Log 2",
        },
        // Add more log data as needed
      ];

      // Stub the aggregate method of the model to return the sample data
      const aggregateStub = sinon
        .stub(LogModel, "aggregate")
        .resolves(logsData);

      // Call the list method with default parameters
      const result = await LogModel.list();

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property("data");
      expect(result.data)
        .to.be.an("array")
        .and.to.have.lengthOf(logsData.length);
      expect(result.data).to.deep.equal(logsData);
      expect(result).to.have.property(
        "message",
        "successfully listed the logs"
      );
      expect(result).to.have.property("status", httpStatus.OK);

      // Restore the aggregate method to its original implementation
      aggregateStub.restore();
    });

    it("should return an empty list when logs are not found", async () => {
      // Stub the aggregate method of the model to return an empty array
      const aggregateStub = sinon.stub(LogModel, "aggregate").resolves([]);

      // Call the list method with default parameters
      const result = await LogModel.list();

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property("data");
      expect(result.data).to.be.an("array").and.to.be.empty;
      expect(result).to.have.property(
        "message",
        "logs not found for this operation"
      );
      expect(result).to.have.property("status", httpStatus.OK);

      // Restore the aggregate method to its original implementation
      aggregateStub.restore();
    });

    // Add more test cases to cover other scenarios
  });
  describe("modify method", () => {
    it("should modify and return the updated Log", async () => {
      // Sample log data
      const logData = {
        _id: "log_id_1",
        timestamp: new Date("2023-07-25T12:00:00Z"),
        message: "Original Log Message",
      };

      // Stub the findOneAndUpdate method of the model to return the updated log
      const findOneAndUpdateStub = sinon
        .stub(LogModel, "findOneAndUpdate")
        .resolves(logData);

      // Call the modify method with sample filter and update
      const filter = { _id: "log_id_1" };
      const update = { message: "Modified Log Message" };
      const result = await LogModel.modify({ filter, update });

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property(
        "message",
        "successfully modified the Log"
      );
      expect(result).to.have.property("data").that.deep.equals(logData);
      expect(result).to.have.property("status", httpStatus.OK);

      // Restore the findOneAndUpdate method to its original implementation
      findOneAndUpdateStub.restore();
    });

    it("should return an error message if Log is not found", async () => {
      // Stub the findOneAndUpdate method of the model to return null (Log not found)
      const findOneAndUpdateStub = sinon
        .stub(LogModel, "findOneAndUpdate")
        .resolves(null);

      // Call the modify method with sample filter and update
      const filter = { _id: "non_existent_log_id" };
      const update = { message: "Modified Log Message" };
      const result = await LogModel.modify({ filter, update });

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", false);
      expect(result).to.have.property("message", "Log not found");
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
      expect(result).to.have.nested.property("errors.message", "bad request");

      // Restore the findOneAndUpdate method to its original implementation
      findOneAndUpdateStub.restore();
    });

    // Add more test cases to cover other scenarios
  });
  describe("remove method", () => {
    it("should remove and return the removed Log", async () => {
      // Sample log data
      const logData = {
        _id: "log_id_1",
        timestamp: new Date("2023-07-25T12:00:00Z"),
        message: "Log Message",
      };

      // Stub the findOneAndRemove method of the model to return the removed log
      const findOneAndRemoveStub = sinon
        .stub(LogModel, "findOneAndRemove")
        .resolves(logData);

      // Call the remove method with sample filter
      const filter = { _id: "log_id_1" };
      const result = await LogModel.remove({ filter });

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property(
        "message",
        "successfully removed the Log"
      );
      expect(result).to.have.property("data").that.deep.equals(logData);
      expect(result).to.have.property("status", httpStatus.OK);

      // Restore the findOneAndRemove method to its original implementation
      findOneAndRemoveStub.restore();
    });

    it("should return an error message if Log does not exist", async () => {
      // Stub the findOneAndRemove method of the model to return null (Log not found)
      const findOneAndRemoveStub = sinon
        .stub(LogModel, "findOneAndRemove")
        .resolves(null);

      // Call the remove method with sample filter
      const filter = { _id: "non_existent_log_id" };
      const result = await LogModel.remove({ filter });

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", false);
      expect(result).to.have.property(
        "message",
        "Log does not exist, please crosscheck"
      );
      expect(result).to.have.property("data", []);
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);
      expect(result).to.have.nested.property(
        "errors.message",
        "Log does not exist, please crosscheck"
      );

      // Restore the findOneAndRemove method to its original implementation
      findOneAndRemoveStub.restore();
    });

    // Add more test cases to cover other scenarios
  });
  // Add more tests for other static methods if applicable
});

describe("logSchema methods", () => {
  describe("toJSON method", () => {
    it("should return a JSON object with specific properties", () => {
      // Create a new instance of logSchema with mock data
      const log = new LogModel({
        _id: "some_id",
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

      // Call the toJSON method on the log instance
      const result = log.toJSON();

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("_id", "some_id");
      expect(result).to.have.property("timestamp");
      expect(result).to.have.property("level", "info");
      expect(result).to.have.property("message", "Test log");
      expect(result).to.have.property("meta").that.deep.equal({
        service: "service_name",
        version: "1.0",
        requestId: "request_id",
        userId: "user_id",
        username: "user_name",
        email: "user@example.com",
        timestamp: "timestamp",
      });
      // Add more assertions to verify the result
    });

    // Add more test cases to cover additional scenarios
  });

  // Add more tests for other methods if applicable
});
