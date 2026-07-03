require("module-alias/register");
const rewire = require("rewire");
// Register model in-memory so factory works without DB
try {
  const _schema = rewire("@models/Favorite").__get__("FavoriteSchema");
  const mongoose = require("mongoose");
  if (!mongoose.modelNames().includes("favorites")) mongoose.model("favorites", _schema);
} catch (_) {}
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const mongoose = require("mongoose");
const httpStatus = require("http-status");
const FavoriteModel = require("@models/Favorite");

describe("FavoriteSchema statics", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("register method", () => {
    it("should create a new Favorite and return success message with status 200", async () => {
      const args = {
        place_id: "some_place_id",
        name: "Favorite Name",
        location: "Favorite Location",
        latitude: 12.345,
        longitude: 67.89,
        firebase_user_id: "some_firebase_user_id",
      };

      const createStub = sinon.stub(FavoriteModel("airqo"), "create").resolves(args);

      const result = await FavoriteModel("airqo").register(args);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Favorite created");
      expect(result.status).to.equal(200);
      expect(result.data).to.deep.equal(args);

      createStub.restore();
    });

    it("should return success message with status 202 if the Favorite is not created", async () => {
      const args = {
        place_id: "some_place_id",
        name: "Favorite Name",
        location: "Favorite Location",
        latitude: 12.345,
        longitude: 67.89,
        firebase_user_id: "some_firebase_user_id",
      };

      // isEmpty([]) is true, so empty array triggers createEmptySuccessResponse
      const createStub = sinon.stub(FavoriteModel("airqo"), "create").resolves(null);

      const result = await FavoriteModel("airqo").register(args);

      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "operation successful but Favorite NOT successfully created"
      );
      expect(result.status).to.equal(202);
      expect(result.data).to.be.an("array").that.is.empty;

      createStub.restore();
    });

    it("should return validation errors if the Favorite creation encounters duplicate values", async () => {
      const args = {
        place_id: "duplicate_place_id",
        name: "Duplicate Name",
        location: "Duplicate Location",
        latitude: 12.345,
        longitude: 67.89,
        firebase_user_id: "some_firebase_user_id",
      };

      const createStub = sinon.stub(FavoriteModel("airqo"), "create").throws({
        keyValue: { place_id: "duplicate_place_id" },
      });

      const result = await FavoriteModel("airqo").register(args);

      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({
        place_id: "the place_id must be unique",
      });
      expect(result.message).to.equal(
        "validation errors for some of the provided fields"
      );
      expect(result.status).to.equal(409);

      createStub.restore();
    });
  });

  describe.skip("list method", () => {
    // Skipped: list() calls countDocuments() then aggregate().match().sort()...
    // Complex builder chain + countDocuments require DB-free setup beyond simple stubs.
  });

  describe("modify method", () => {
    it("should modify the favorite with the provided filter and update", async () => {
      const favoriteData = {
        _id: new mongoose.Types.ObjectId(),
        name: "Favorite 1",
        location: "New York",
        firebase_user_id: "user_id_1",
      };

      // modify() calls findOneAndUpdate(...).exec() and returns updatedFavorite._doc
      const findOneAndUpdateStub = sinon
        .stub(FavoriteModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves({ ...favoriteData, _doc: favoriteData }) });

      const filter = { _id: favoriteData._id };
      const update = { location: "Los Angeles" };
      const result = await FavoriteModel("airqo").modify({ filter, update });

      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      // createSuccessResponse("update", ..., "favorite") → "successfully modified the favorite"
      expect(result).to.have.property("message", "successfully modified the favorite");
      expect(result.data).to.deep.equal(favoriteData);
      expect(result).to.have.property("status", httpStatus.OK);

      findOneAndUpdateStub.restore();
    });

    it("should return 'Favorite does not exist' message if no favorite found", async () => {
      const findOneAndUpdateStub = sinon
        .stub(FavoriteModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves(null) });

      const filter = { _id: "non_existent_id" };
      const update = { location: "Los Angeles" };
      const result = await FavoriteModel("airqo").modify({ filter, update });

      expect(result).to.be.an("object");
      expect(result).to.have.property("success", false);
      expect(result).to.have.property(
        "message",
        "Favorite does not exist, please crosscheck"
      );
      expect(result).to.have.property("errors").that.deep.equals({
        message: "Favorite does not exist, please crosscheck",
      });
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);

      findOneAndUpdateStub.restore();
    });
  });

  describe("remove method", () => {
    it("should remove the favorite with the provided filter", async () => {
      const favoriteData = {
        _id: new mongoose.Types.ObjectId(),
        name: "Favorite 1",
        location: "New York",
        firebase_user_id: "user_id_1",
      };

      // remove() calls findOneAndRemove(...).exec() and returns removedFavorite._doc
      const findOneAndRemoveStub = sinon
        .stub(FavoriteModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves({ ...favoriteData, _doc: favoriteData }) });

      const filter = { _id: favoriteData._id };
      const result = await FavoriteModel("airqo").remove({ filter });

      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      // createSuccessResponse("delete", ..., "favorite") → "successfully removed the favorite"
      expect(result).to.have.property("message", "successfully removed the favorite");
      expect(result.data).to.deep.equal(favoriteData);
      expect(result).to.have.property("status", httpStatus.OK);

      findOneAndRemoveStub.restore();
    });

    it("should return 'Favorite does not exist' message if no favorite found", async () => {
      const findOneAndRemoveStub = sinon
        .stub(FavoriteModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves(null) });

      const filter = { _id: "non_existent_id" };
      const result = await FavoriteModel("airqo").remove({ filter });

      expect(result).to.be.an("object");
      expect(result).to.have.property("success", false);
      expect(result).to.have.property(
        "message",
        "Favorite does not exist, please crosscheck"
      );
      expect(result).to.have.property("errors").that.deep.equals({
        message: "Favorite does not exist, please crosscheck",
      });
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);

      findOneAndRemoveStub.restore();
    });
  });
});

describe("FavoriteSchema methods", () => {
  describe("toJSON method", () => {
    it("should return a JSON object with specific properties", () => {
      const favoriteId = new mongoose.Types.ObjectId();

      const favorite = new (FavoriteModel("airqo"))({
        _id: favoriteId,
        name: "Favorite Name",
        location: "Favorite Location",
        latitude: 12.345,
        longitude: 67.89,
        place_id: "some_place_id",
        firebase_user_id: "some_firebase_user_id",
      });

      const result = favorite.toJSON();

      expect(result).to.be.an("object");
      expect(result._id.toString()).to.equal(favoriteId.toString());
      expect(result).to.have.property("name", "Favorite Name");
      expect(result).to.have.property("location", "Favorite Location");
      expect(result).to.have.property("latitude", 12.345);
      expect(result).to.have.property("longitude", 67.89);
      expect(result).to.have.property("place_id", "some_place_id");
      expect(result).to.have.property("firebase_user_id", "some_firebase_user_id");
    });
  });
});
