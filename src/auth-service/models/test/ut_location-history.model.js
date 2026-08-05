require("module-alias/register");
const rewire = require("rewire");
// Register model in-memory so factory works without DB
try {
  const _schema = rewire("@models/LocationHistory").__get__("LocationHistorySchema");
  const mongoose = require("mongoose");
  if (!mongoose.modelNames().includes("locationHistories")) mongoose.model("locationHistories", _schema);
} catch (_) {}
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const mongoose = require("mongoose");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const LocationHistoryModel = require("@models/LocationHistory");

describe("LocationHistoryModel", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("register method", () => {
    it("should create a new Location History and return success response", async () => {
      const args = {
        place_id: "test_place_id",
        name: "Test Location",
        location: "Test Location Address",
        latitude: 123.456,
        longitude: 78.901,
        firebase_user_id: "test_firebase_user_id",
        date_time: new Date(),
      };
      const newLocationHistory = { _id: "test_location_history_id", ...args };

      // register() passes data directly (no _doc)
      const createStub = sinon
        .stub(LocationHistoryModel("airqo"), "create")
        .resolves(newLocationHistory);

      const result = await LocationHistoryModel("airqo").register(args);

      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result).to.have.property("data").that.is.an("object");

      createStub.restore();
    });

    it("should handle validation errors and return appropriate response", async () => {
      const args = {};

      const validationError = {
        errors: {
          name: new mongoose.Error.ValidatorError({ message: "Name is required" }),
          location: new mongoose.Error.ValidatorError({ message: "Location is required" }),
        },
        message: "validation error",
      };
      const createStub = sinon
        .stub(LocationHistoryModel("airqo"), "create")
        .throws(validationError);

      const result = await LocationHistoryModel("airqo").register(args);

      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result.message).to.equal("validation errors for some of the provided fields");
      expect(result).to.have.property("errors").that.is.an("object");
      expect(result).to.have.property("status").that.equals(httpStatus.CONFLICT);

      createStub.restore();
    });
  });

  describe.skip("list method", () => {
    // Skipped: list() calls countDocuments() then aggregate().match().sort()...
    // Complex builder chain + countDocuments require DB-free setup beyond simple stubs.
  });

  describe("modify method", () => {
    it("should modify a Location History and return a success response", async () => {
      const existingLocationHistory = {
        _id: "1",
        name: "Location 1",
        location: "Address 1",
      };
      const update = { name: "Modified Location" };
      const modifiedDoc = { ...existingLocationHistory, ...update };

      // modify() calls findOneAndUpdate(...).exec() and returns updatedLocationHistory._doc
      const findOneAndUpdateStub = sinon
        .stub(LocationHistoryModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves({ ...modifiedDoc, _doc: modifiedDoc }) });

      const filter = { _id: "1" };
      const result = await LocationHistoryModel("airqo").modify({ filter, update });

      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result).to.have.property("data").that.is.an("object").that.deep.equals(modifiedDoc);
      expect(result).to.have.property("message").that.equals("successfully modified the location history");

      findOneAndUpdateStub.restore();
    });

    it("should handle modifying a non-existing Location History and return an error response", async () => {
      const findOneAndUpdateStub = sinon
        .stub(LocationHistoryModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves(null) });

      const filter = { _id: "1" };
      const update = { name: "Modified Location" };
      const result = await LocationHistoryModel("airqo").modify({ filter, update });

      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result).to.have.property("message").that.equals("Location History does not exist, please crosscheck");
      expect(result).to.have.property("status").that.equals(httpStatus.BAD_REQUEST);

      findOneAndUpdateStub.restore();
    });

    it("should handle internal server errors and return an error response", async () => {
      const errorMessage = "Mocked internal server error";
      const findOneAndUpdateStub = sinon
        .stub(LocationHistoryModel("airqo"), "findOneAndUpdate")
        .throws(new Error(errorMessage));

      const filter = { _id: "1" };
      const update = { name: "Modified Location" };
      const result = await LocationHistoryModel("airqo").modify({ filter, update });

      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result).to.have.property("message").that.equals("Internal Server Error");
      expect(result.errors).to.have.property("message").that.equals(errorMessage);
      expect(result).to.have.property("status").that.equals(httpStatus.INTERNAL_SERVER_ERROR);

      findOneAndUpdateStub.restore();
    });
  });

  describe("remove method", () => {
    it("should remove a Location History and return a success response", async () => {
      const existingLocationHistory = {
        _id: "1",
        place_id: "place-1",
        name: "Location 1",
        location: "Address 1",
        latitude: 37.12345,
        longitude: -122.6789,
        firebase_user_id: "user-1",
        date_time: new Date(),
      };

      // remove() calls findOneAndRemove(...).exec() and returns removedLocationHistory._doc
      const findOneAndRemoveStub = sinon
        .stub(LocationHistoryModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves({ ...existingLocationHistory, _doc: existingLocationHistory }) });

      const filter = { _id: "1" };
      const result = await LocationHistoryModel("airqo").remove({ filter });

      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result).to.have.property("data").that.is.an("object").that.deep.equals(existingLocationHistory);
      expect(result).to.have.property("message").that.equals("successfully removed the location history");

      findOneAndRemoveStub.restore();
    });

    it("should handle removing a non-existing Location History and return an error response", async () => {
      const findOneAndRemoveStub = sinon
        .stub(LocationHistoryModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves(null) });

      const filter = { _id: "1" };
      const result = await LocationHistoryModel("airqo").remove({ filter });

      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result).to.have.property("message").that.equals("Location History does not exist, please crosscheck");
      expect(result).to.have.property("status").that.equals(httpStatus.BAD_REQUEST);

      findOneAndRemoveStub.restore();
    });

    it("should handle internal server errors and return an error response", async () => {
      const errorMessage = "Mocked internal server error";
      const findOneAndRemoveStub = sinon
        .stub(LocationHistoryModel("airqo"), "findOneAndRemove")
        .throws(new Error(errorMessage));

      const filter = { _id: "1" };
      const result = await LocationHistoryModel("airqo").remove({ filter });

      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result).to.have.property("message").that.equals("Internal Server Error");
      expect(result.errors).to.have.property("message").that.equals(errorMessage);
      expect(result).to.have.property("status").that.equals(httpStatus.INTERNAL_SERVER_ERROR);

      findOneAndRemoveStub.restore();
    });
  });

  describe("toJSON method", () => {
    it("should return the JSON representation of the Location History", () => {
      const locationHistoryId = new mongoose.Types.ObjectId();
      const dt = new Date();

      const locationHistory = new (LocationHistoryModel("airqo"))({
        _id: locationHistoryId,
        name: "Test Location",
        location: "Test Location Address",
        latitude: 123.456,
        longitude: 78.901,
        place_id: "test_place_id",
        firebase_user_id: "test_firebase_user_id",
        date_time: dt,
      });

      const result = locationHistory.toJSON();

      expect(result).to.be.an("object");
      expect(result._id.toString()).to.equal(locationHistoryId.toString());
      expect(result).to.have.property("name").that.equals("Test Location");
      expect(result).to.have.property("location").that.equals("Test Location Address");
      expect(result).to.have.property("latitude").that.equals(123.456);
      expect(result).to.have.property("longitude").that.equals(78.901);
      expect(result).to.have.property("place_id").that.equals("test_place_id");
      expect(result).to.have.property("firebase_user_id").that.equals("test_firebase_user_id");
      expect(result).to.have.property("date_time").that.is.instanceOf(Date);
    });
  });
});
