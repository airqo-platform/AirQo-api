require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const mongoose = require("mongoose");
const httpStatus = require("http-status");
const constants = require("@config/constants");

const LocationHistorySchema = require("@models/LocationHistory");
const LocationHistoryModel = mongoose.model(
  "locationHistories",
  LocationHistorySchema
);

describe("LocationHistoryModel", () => {
  describe("register method", () => {
    it("should create a new Location History and return success response", async () => {
      // Mock the arguments for the register method
      const args = {
        place_id: "test_place_id",
        name: "Test Location",
        location: "Test Location Address",
        latitude: 123.456,
        longitude: 78.901,
        reference_site: "test_reference_site_id",
        firebase_user_id: "test_firebase_user_id",
        date_time: new Date(),
      };

      // Mock the LocationHistoryModel.create method
      const newLocationHistory = {
        _id: "test_location_history_id",
        ...args,
      };
      sinon
        .stub(LocationHistoryModel, "create")
        .returns(Promise.resolve(newLocationHistory));

      // Call the method
      const result = await LocationHistoryModel.register(args);

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result).to.have.property("data").that.is.an("object");
      // Add more assertions for the response data if needed

      // Restore the stub
      LocationHistoryModel.create.restore();
    });

    it("should handle validation errors and return appropriate response", async () => {
      // Mock the arguments for the register method with missing required fields
      const args = {
        // Missing required fields: name, location, latitude, longitude, firebase_user_id, date_time
      };

      // Mock the LocationHistoryModel.create method to throw a validation error
      const validationError = {
        errors: {
          name: new mongoose.Error.ValidatorError({
            message: "Name is required",
          }),
          location: new mongoose.Error.ValidatorError({
            message: "Location is required",
          }),
          latitude: new mongoose.Error.ValidatorError({
            message: "Latitude is required",
          }),
          longitude: new mongoose.Error.ValidatorError({
            message: "Longitude is required",
          }),
          firebase_user_id: new mongoose.Error.ValidatorError({
            message: "Firebase User ID is required",
          }),
          date_time: new mongoose.Error.ValidatorError({
            message: "Date Time is required",
          }),
        },
      };
      sinon.stub(LocationHistoryModel, "create").throws(validationError);

      // Call the method
      const result = await LocationHistoryModel.register(args);

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result)
        .to.have.property("message")
        .that.equals("validation errors for some of the provided fields");
      expect(result).to.have.property("errors").that.is.an("object");
      expect(result.errors)
        .to.have.property("name")
        .that.equals("Name is required");
      expect(result.errors)
        .to.have.property("location")
        .that.equals("Location is required");
      expect(result.errors)
        .to.have.property("latitude")
        .that.equals("Latitude is required");
      expect(result.errors)
        .to.have.property("longitude")
        .that.equals("Longitude is required");
      expect(result.errors)
        .to.have.property("firebase_user_id")
        .that.equals("Firebase User ID is required");
      expect(result.errors)
        .to.have.property("date_time")
        .that.equals("Date Time is required");
      expect(result)
        .to.have.property("status")
        .that.equals(httpStatus.CONFLICT);

      // Restore the stub
      LocationHistoryModel.create.restore();
    });
  });

  describe("list method", () => {
    it("should return a list of Location Histories with success response", async () => {
      // Mock the arguments for the list method
      const skip = 0;
      const limit = 10;
      const filter = { category: "test_category" };

      // Mock the aggregation result
      const locationHistories = [
        { _id: "1", name: "Location 1", location: "Address 1" },
        { _id: "2", name: "Location 2", location: "Address 2" },
        // Add more mock data as needed
      ];
      const aggregationResult = locationHistories;

      // Mock the aggregate method to return the aggregation result
      sinon.stub(LocationHistoryModel, "aggregate").returns({
        match: sinon.stub().returnsThis(),
        sort: sinon.stub().returnsThis(),
        project: sinon.stub().returnsThis(),
        skip: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        allowDiskUse: sinon.stub().returns(Promise.resolve(aggregationResult)),
      });

      // Call the method
      const result = await LocationHistoryModel.list({ skip, limit, filter });

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result)
        .to.have.property("data")
        .that.is.an("array")
        .with.lengthOf(locationHistories.length);
      // Add more assertions for the response data if needed

      // Restore the stub
      LocationHistoryModel.aggregate.restore();
    });

    it("should handle an empty list and return a success response with an empty array", async () => {
      // Mock the arguments for the list method
      const skip = 0;
      const limit = 10;
      const filter = { category: "test_category" };

      // Mock an empty aggregation result
      const aggregationResult = [];

      // Mock the aggregate method to return the empty aggregation result
      sinon.stub(LocationHistoryModel, "aggregate").returns({
        match: sinon.stub().returnsThis(),
        sort: sinon.stub().returnsThis(),
        project: sinon.stub().returnsThis(),
        skip: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        allowDiskUse: sinon.stub().returns(Promise.resolve(aggregationResult)),
      });

      // Call the method
      const result = await LocationHistoryModel.list({ skip, limit, filter });

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result)
        .to.have.property("data")
        .that.is.an("array")
        .with.lengthOf(0);
      expect(result)
        .to.have.property("message")
        .that.equals("no Location Histories exist");
      // Add more assertions for the response data if needed

      // Restore the stub
      LocationHistoryModel.aggregate.restore();
    });

    it("should handle internal server errors and return an error response", async () => {
      // Mock the arguments for the list method
      const skip = 0;
      const limit = 10;
      const filter = { category: "test_category" };

      // Mock the aggregate method to throw an error
      const errorMessage = "Mocked internal server error";
      sinon
        .stub(LocationHistoryModel, "aggregate")
        .throws(new Error(errorMessage));

      // Call the method
      const result = await LocationHistoryModel.list({ skip, limit, filter });

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result)
        .to.have.property("message")
        .that.equals("internal server error");
      expect(result).to.have.property("errors").that.is.an("object");
      expect(result.errors)
        .to.have.property("message")
        .that.equals(errorMessage);
      expect(result)
        .to.have.property("status")
        .that.equals(httpStatus.INTERNAL_SERVER_ERROR);

      // Restore the stub
      LocationHistoryModel.aggregate.restore();
    });
  });

  describe("modify method", () => {
    it("should modify a Location History and return a success response", async () => {
      // Mock the arguments for the modify method
      const filter = { _id: "1" };
      const update = { name: "Modified Location" };

      // Mock the findOneAndUpdate result (existing location history to be modified)
      const existingLocationHistory = {
        _id: "1",
        name: "Location 1",
        location: "Address 1",
      };
      const modifiedLocationHistory = { ...existingLocationHistory, ...update };
      sinon.stub(LocationHistoryModel, "findOneAndUpdate").returns({
        exec: sinon.stub().returns(Promise.resolve(modifiedLocationHistory)),
      });

      // Call the method
      const result = await LocationHistoryModel.modify({ filter, update });

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result)
        .to.have.property("data")
        .that.is.an("object")
        .that.deep.equals(modifiedLocationHistory);
      expect(result)
        .to.have.property("message")
        .that.equals("successfully modified the Location History");
      // Add more assertions for the response data if needed

      // Restore the stub
      LocationHistoryModel.findOneAndUpdate.restore();
    });

    it("should handle modifying a non-existing Location History and return an error response", async () => {
      // Mock the arguments for the modify method
      const filter = { _id: "1" };
      const update = { name: "Modified Location" };

      // Mock the findOneAndUpdate result (no existing location history found to modify)
      sinon.stub(LocationHistoryModel, "findOneAndUpdate").returns({
        exec: sinon.stub().returns(Promise.resolve(null)),
      });

      // Call the method
      const result = await LocationHistoryModel.modify({ filter, update });

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result)
        .to.have.property("message")
        .that.equals("Location History does not exist, please crosscheck");
      expect(result).to.have.property("errors").that.is.an("object");
      expect(result.errors)
        .to.have.property("message")
        .that.equals("Location History does not exist, please crosscheck");
      expect(result)
        .to.have.property("status")
        .that.equals(httpStatus.BAD_REQUEST);

      // Restore the stub
      LocationHistoryModel.findOneAndUpdate.restore();
    });

    it("should handle internal server errors and return an error response", async () => {
      // Mock the arguments for the modify method
      const filter = { _id: "1" };
      const update = { name: "Modified Location" };

      // Mock the findOneAndUpdate method to throw an error
      const errorMessage = "Mocked internal server error";
      sinon
        .stub(LocationHistoryModel, "findOneAndUpdate")
        .throws(new Error(errorMessage));

      // Call the method
      const result = await LocationHistoryModel.modify({ filter, update });

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result)
        .to.have.property("message")
        .that.equals("Internal Server Error");
      expect(result).to.have.property("errors").that.is.an("object");
      expect(result.errors)
        .to.have.property("message")
        .that.equals(errorMessage);
      expect(result)
        .to.have.property("status")
        .that.equals(httpStatus.INTERNAL_SERVER_ERROR);

      // Restore the stub
      LocationHistoryModel.findOneAndUpdate.restore();
    });
  });

  describe("remove method", () => {
    it("should remove a Location History and return a success response", async () => {
      // Mock the arguments for the remove method
      const filter = { _id: "1" };

      // Mock the findOneAndRemove result (existing location history to be removed)
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
      sinon.stub(LocationHistoryModel, "findOneAndRemove").returns({
        exec: sinon.stub().returns(Promise.resolve(existingLocationHistory)),
      });

      // Call the method
      const result = await LocationHistoryModel.remove({ filter });

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result)
        .to.have.property("data")
        .that.is.an("object")
        .that.deep.equals(existingLocationHistory);
      expect(result)
        .to.have.property("message")
        .that.equals("successfully removed the Location History");
      // Add more assertions for the response data if needed

      // Restore the stub
      LocationHistoryModel.findOneAndRemove.restore();
    });

    it("should handle removing a non-existing Location History and return an error response", async () => {
      // Mock the arguments for the remove method
      const filter = { _id: "1" };

      // Mock the findOneAndRemove result (no existing location history found to remove)
      sinon.stub(LocationHistoryModel, "findOneAndRemove").returns({
        exec: sinon.stub().returns(Promise.resolve(null)),
      });

      // Call the method
      const result = await LocationHistoryModel.remove({ filter });

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result)
        .to.have.property("message")
        .that.equals("Location History does not exist, please crosscheck");
      expect(result).to.have.property("errors").that.is.an("object");
      expect(result.errors)
        .to.have.property("message")
        .that.equals("Location History does not exist, please crosscheck");
      expect(result)
        .to.have.property("status")
        .that.equals(httpStatus.BAD_REQUEST);

      // Restore the stub
      LocationHistoryModel.findOneAndRemove.restore();
    });

    it("should handle internal server errors and return an error response", async () => {
      // Mock the arguments for the remove method
      const filter = { _id: "1" };

      // Mock the findOneAndRemove method to throw an error
      const errorMessage = "Mocked internal server error";
      sinon
        .stub(LocationHistoryModel, "findOneAndRemove")
        .throws(new Error(errorMessage));

      // Call the method
      const result = await LocationHistoryModel.remove({ filter });

      // Assertions
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result)
        .to.have.property("message")
        .that.equals("Internal Server Error");
      expect(result).to.have.property("errors").that.is.an("object");
      expect(result.errors)
        .to.have.property("message")
        .that.equals(errorMessage);
      expect(result)
        .to.have.property("status")
        .that.equals(httpStatus.INTERNAL_SERVER_ERROR);

      // Restore the stub
      LocationHistoryModel.findOneAndRemove.restore();
    });
  });

  describe("toJSON method", () => {
    it("should return the JSON representation of the Location History", () => {
      // Mock a Location History instance
      const locationHistory = new LocationHistoryModel({
        _id: "test_location_history_id",
        name: "Test Location",
        location: "Test Location Address",
        latitude: 123.456,
        longitude: 78.901,
        place_id: "test_place_id",
        reference_site: "test_reference_site_id",
        firebase_user_id: "test_firebase_user_id",
        date_time: new Date(),
      });

      // Call the toJSON method
      const result = locationHistory.toJSON();

      // Assertions
      expect(result).to.be.an("object");
      expect(result)
        .to.have.property("_id")
        .that.equals("test_location_history_id");
      expect(result).to.have.property("name").that.equals("Test Location");
      expect(result)
        .to.have.property("location")
        .that.equals("Test Location Address");
      expect(result).to.have.property("latitude").that.equals(123.456);
      expect(result).to.have.property("longitude").that.equals(78.901);
      expect(result).to.have.property("place_id").that.equals("test_place_id");
      expect(result)
        .to.have.property("reference_site")
        .that.equals("test_reference_site_id");
      expect(result)
        .to.have.property("firebase_user_id")
        .that.equals("test_firebase_user_id");
      expect(result).to.have.property("date_time").that.is.instanceOf(Date);

      // Ensure only the specified properties are included in the JSON representation
      expect(Object.keys(result)).to.have.lengthOf(9);
    });
  });
});
