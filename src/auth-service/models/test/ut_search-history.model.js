require("module-alias/register");
const rewire = require("rewire");
// Register model in-memory so factory succeeds without DB
try {
  const _schema = rewire("/SearchHistory").__get__("SearchHistorySchema");
  const mongoose = require("mongoose");
  if (!mongoose.modelNames().includes("searchHistories")) mongoose.model("searchHistories", _schema);
} catch (_) {}
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const httpStatus = require("http-status");
const mongoose = require("mongoose");

const SearchHistoryModel = require("@models/SearchHistory");
const SearchHistorySchema = SearchHistoryModel; // alias for test compatibility
const constants = require("@config/constants");
const { Types: { ObjectId } } = require("mongoose");

describe("SearchHistorySchema", () => {
  describe("Schema definition", () => {
    it("should have the required fields defined", () => {
      const schemaKeys = Object.keys(SearchHistoryModel("airqo").schema.paths);
      const requiredFields = [
        "place_id",
        "name",
        "location",
        "latitude",
        "longitude",
        "firebase_user_id",
        "date_time",
      ];
      expect(schemaKeys).to.include.members(requiredFields);
    });

    it("should have the correct data types for each field", () => {
      const place_id = SearchHistoryModel("airqo").schema.paths.place_id.instance;
      const name = SearchHistoryModel("airqo").schema.paths.name.instance;
      const location = SearchHistoryModel("airqo").schema.paths.location.instance;
      const latitude = SearchHistoryModel("airqo").schema.paths.latitude.instance;
      const longitude = SearchHistoryModel("airqo").schema.paths.longitude.instance;
      const firebase_user_id =
        SearchHistoryModel("airqo").schema.paths.firebase_user_id.instance;
      const date_time = SearchHistoryModel("airqo").schema.paths.date_time.instance;

      expect(place_id).to.equal("String");
      expect(name).to.equal("String");
      expect(location).to.equal("String");
      expect(latitude).to.equal("Number");
      expect(longitude).to.equal("Number");
      expect(firebase_user_id).to.equal("String");
      expect(date_time).to.equal("Date");
    });

    it("should have the required validators set", () => {
      const place_id = SearchHistoryModel("airqo").schema.paths.place_id.validators;
      const name = SearchHistoryModel("airqo").schema.paths.name.validators;
      const location = SearchHistoryModel("airqo").schema.paths.location.validators;
      const latitude = SearchHistoryModel("airqo").schema.paths.latitude.validators;
      const longitude = SearchHistoryModel("airqo").schema.paths.longitude.validators;
      const firebase_user_id =
        SearchHistoryModel("airqo").schema.paths.firebase_user_id.validators;
      const date_time = SearchHistoryModel("airqo").schema.paths.date_time.validators;

      expect(place_id).to.not.be.empty;
      expect(name).to.not.be.empty;
      expect(location).to.not.be.empty;
      expect(latitude).to.not.be.empty;
      expect(longitude).to.not.be.empty;
      expect(firebase_user_id).to.not.be.empty;
      expect(date_time).to.not.be.empty;
    });
  });

  describe("Static methods", () => {
    describe("register", () => {
      it("should create a new Search History and return success response", async () => {
        const createStub = sinon.stub(SearchHistoryModel("airqo"), "create");
        const fakeSearchHistory = {
          place_id: "place123",
          name: "Test Place",
          location: "Test Location",
          latitude: 123.456,
          longitude: 78.901,
          firebase_user_id: "user123",
          date_time: new Date(),
        };
        createStub.resolves(fakeSearchHistory);

        const args = { ...fakeSearchHistory };
        const result = await SearchHistoryModel("airqo").register(args);

        expect(result).to.deep.equal({
          success: true,
          data: fakeSearchHistory,
          message: "Search History created",
          status: httpStatus.OK,
        });

        createStub.restore();
      });

      it("should handle an empty response from the database and return success response with an empty data array", async () => {
        const createStub = sinon.stub(SearchHistoryModel("airqo"), "create");
        const emptyResponse = null;
        createStub.resolves(emptyResponse);

        const args = {
          place_id: "place123",
          name: "Test Place",
          location: "Test Location",
          latitude: 123.456,
          longitude: 78.901,
          firebase_user_id: "user123",
          date_time: new Date(),
        };
        const result = await SearchHistoryModel("airqo").register(args);

        expect(result).to.deep.equal({
          success: true,
          data: [],
          message:
            "operation successful but Search History NOT successfully created",
          status: httpStatus.ACCEPTED,
        });

        createStub.restore();
      });

      it("should handle a unique constraint violation and return a conflict response", async () => {
        const createStub = sinon.stub(SearchHistoryModel("airqo"), "create");
        const uniqueConstraintViolationError = {
          keyValue: {
            place_id: "place123",
          },
        };
        createStub.rejects(uniqueConstraintViolationError);

        const args = {
          place_id: "place123",
          name: "Test Place",
          location: "Test Location",
          latitude: 123.456,
          longitude: 78.901,
          firebase_user_id: "user123",
          date_time: new Date(),
        };
        const result = await SearchHistoryModel("airqo").register(args);

        expect(result).to.deep.equal({
          success: false,
          error: { place_id: "the place_id must be unique" },
          errors: { place_id: "the place_id must be unique" },
          message: "validation errors for some of the provided fields",
          status: httpStatus.CONFLICT,
        });

        createStub.restore();
      });

      it("should handle other database-related errors and return an internal server error response", async () => {
        const createStub = sinon.stub(SearchHistoryModel("airqo"), "create");
        const otherDatabaseError = new Error("Some database error");
        createStub.rejects(otherDatabaseError);

        const args = {
          place_id: "place123",
          name: "Test Place",
          location: "Test Location",
          latitude: 123.456,
          longitude: 78.901,
          firebase_user_id: "user123",
          date_time: new Date(),
        };
        const result = await SearchHistoryModel("airqo").register(args);

        expect(result).to.deep.equal({
          success: false,
          message: "internal server error",
          errors: { message: "Some database error" },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        });

        createStub.restore();
      });
    });
    describe("list", () => {
      it("should return a list of Search Histories when data is available", async () => {
        const inclusionProjection =
          constants.SEARCH_HISTORIES_INCLUSION_PROJECTION;
        const exclusionProjection =
          constants.SEARCH_HISTORIES_EXCLUSION_PROJECTION("test_category");
        const skip = 0;
        const limit = 10;
        const filter = { category: "test_category" };

        const aggregateStub = sinon.stub(SearchHistoryModel("airqo"), "aggregate");
        const fakeSearchHistories = [
          { _id: ObjectId(), name: "Search 1" },
          { _id: ObjectId(), name: "Search 2" },
        ];
        aggregateStub.returnsThis();
        aggregateStub.withArgs().resolves(fakeSearchHistories);

        const result = await SearchHistoryModel("airqo").list({ skip, limit, filter });

        expect(result).to.deep.equal({
          success: true,
          data: fakeSearchHistories,
          message: "successfully listed the Search Histories",
          status: httpStatus.OK,
        });

        aggregateStub.restore();
      });

      it("should return an empty list when no Search Histories are available", async () => {
        const inclusionProjection =
          constants.SEARCH_HISTORIES_INCLUSION_PROJECTION;
        const exclusionProjection =
          constants.SEARCH_HISTORIES_EXCLUSION_PROJECTION("none");
        const skip = 0;
        const limit = 100;
        const filter = {};

        const aggregateStub = sinon.stub(SearchHistoryModel("airqo"), "aggregate");
        const emptySearchHistories = [];
        aggregateStub.returnsThis();
        aggregateStub.withArgs().resolves(emptySearchHistories);

        const result = await SearchHistoryModel("airqo").list({ skip, limit, filter });

        expect(result).to.deep.equal({
          success: true,
          message: "no Search Histories exist",
          data: [],
          status: httpStatus.OK,
        });

        aggregateStub.restore();
      });

      it("should handle database-related errors and return an internal server error response", async () => {
        const skip = 0;
        const limit = 100;
        const filter = {};

        const aggregateStub = sinon.stub(SearchHistoryModel("airqo"), "aggregate");
        const databaseError = new Error("Database error");
        aggregateStub.throws(databaseError);

        const result = await SearchHistoryModel("airqo").list({ skip, limit, filter });

        expect(result).to.deep.equal({
          success: false,
          message: "internal server error",
          errors: { message: databaseError.message },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        });

        aggregateStub.restore();
      });
    });
    describe("modify", () => {
      it("should successfully modify a Search History when it exists", async () => {
        const filter = { _id: ObjectId("1234567890abcdef12345678") };
        const update = { name: "Modified Search" };

        const findOneAndUpdateStub = sinon.stub(
          SearchHistorySchema,
          "findOneAndUpdate"
        );
        const modifiedSearchHistory = {
          _id: ObjectId("1234567890abcdef12345678"),
          name: "Modified Search",
          location: "Test Location",
        };
        findOneAndUpdateStub
          .withArgs(filter, update, { new: true })
          .resolves(modifiedSearchHistory);

        const result = await SearchHistoryModel("airqo").modify({ filter, update });

        expect(result).to.deep.equal({
          success: true,
          message: "successfully modified the Search History",
          data: modifiedSearchHistory,
          status: httpStatus.OK,
        });

        findOneAndUpdateStub.restore();
      });

      it("should handle the case when the Search History does not exist and return a bad request response", async () => {
        const filter = { _id: ObjectId("1234567890abcdef12345678") };
        const update = { name: "Modified Search" };

        const findOneAndUpdateStub = sinon.stub(
          SearchHistorySchema,
          "findOneAndUpdate"
        );
        findOneAndUpdateStub
          .withArgs(filter, update, { new: true })
          .resolves(null);

        const result = await SearchHistoryModel("airqo").modify({ filter, update });

        expect(result).to.deep.equal({
          success: false,
          message: "Search History does not exist, please crosscheck",
          errors: {
            message: "Search History does not exist, please crosscheck",
          },
          status: httpStatus.BAD_REQUEST,
        });

        findOneAndUpdateStub.restore();
      });

      it("should handle database-related errors and return an internal server error response", async () => {
        const filter = { _id: ObjectId("1234567890abcdef12345678") };
        const update = { name: "Modified Search" };

        const findOneAndUpdateStub = sinon.stub(
          SearchHistorySchema,
          "findOneAndUpdate"
        );
        const databaseError = new Error("Database error");
        findOneAndUpdateStub.throws(databaseError);

        const result = await SearchHistoryModel("airqo").modify({ filter, update });

        expect(result).to.deep.equal({
          success: false,
          message: "Internal Server Error",
          errors: { message: databaseError.message },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        });

        findOneAndUpdateStub.restore();
      });
    });
    describe("remove", () => {
      it("should successfully remove a Search History when it exists", async () => {
        const filter = { _id: ObjectId("1234567890abcdef12345678") };

        const findOneAndRemoveStub = sinon.stub(
          SearchHistorySchema,
          "findOneAndRemove"
        );
        const removedSearchHistory = {
          _id: ObjectId("1234567890abcdef12345678"),
          name: "Removed Search",
          location: "Test Location",
        };
        findOneAndRemoveStub
          .withArgs(filter, sinon.match.any)
          .resolves(removedSearchHistory);

        const result = await SearchHistoryModel("airqo").remove({ filter });

        expect(result).to.deep.equal({
          success: true,
          message: "successfully removed the Search History",
          data: removedSearchHistory._doc,
          status: httpStatus.OK,
        });

        findOneAndRemoveStub.restore();
      });

      it("should handle the case when the Search History does not exist and return a bad request response", async () => {
        const filter = { _id: ObjectId("1234567890abcdef12345678") };

        const findOneAndRemoveStub = sinon.stub(
          SearchHistorySchema,
          "findOneAndRemove"
        );
        findOneAndRemoveStub.withArgs(filter, sinon.match.any).resolves(null);

        const result = await SearchHistoryModel("airqo").remove({ filter });

        expect(result).to.deep.equal({
          success: false,
          message: "Search History does not exist, please crosscheck",
          errors: {
            message: "Search History does not exist, please crosscheck",
          },
          status: httpStatus.BAD_REQUEST,
        });

        findOneAndRemoveStub.restore();
      });

      it("should handle database-related errors and return an internal server error response", async () => {
        const filter = { _id: ObjectId("1234567890abcdef12345678") };

        const findOneAndRemoveStub = sinon.stub(
          SearchHistorySchema,
          "findOneAndRemove"
        );
        const databaseError = new Error("Database error");
        findOneAndRemoveStub.throws(databaseError);

        const result = await SearchHistoryModel("airqo").remove({ filter });

        expect(result).to.deep.equal({
          success: false,
          message: "Internal Server Error",
          errors: { message: databaseError.message },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        });

        findOneAndRemoveStub.restore();
      });
    });
  });

  describe("Instance methods", () => {
    describe("toJSON", () => {
      it("should convert a SearchHistory object to a JSON representation", () => {
        const searchHistory = new (SearchHistoryModel("airqo"))({
          _id: "1234567890abcdef12345678",
          name: "Test Search",
          location: "Test Location",
          latitude: 123.456,
          longitude: 78.9,
          place_id: "test_place_id",
          firebase_user_id: "test_firebase_user_id",
          date_time: new Date("2023-07-25T12:34:56.789Z"),
        });

        const result = searchHistory.toJSON();

        expect(result).to.deep.equal({
          _id: "1234567890abcdef12345678",
          name: "Test Search",
          location: "Test Location",
          latitude: 123.456,
          longitude: 78.9,
          place_id: "test_place_id",
          firebase_user_id: "test_firebase_user_id",
          date_time: new Date("2023-07-25T12:34:56.789Z"),
        });
      });

      it("should exclude additional properties from the JSON representation", () => {
        const searchHistory = new (SearchHistoryModel("airqo"))({
          _id: "1234567890abcdef12345678",
          name: "Test Search",
          location: "Test Location",
          latitude: 123.456,
          longitude: 78.9,
          place_id: "test_place_id",
          firebase_user_id: "test_firebase_user_id",
          date_time: new Date("2023-07-25T12:34:56.789Z"),
          extraField: "This should be excluded",
        });

        const result = searchHistory.toJSON();

        expect(result).to.not.have.property("extraField");
      });
    });
  });
});
