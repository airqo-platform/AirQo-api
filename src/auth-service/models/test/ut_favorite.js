require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const mongoose = require("mongoose");
const FavoriteSchema = require("@models/FavoriteSchema");

// Replace this with the actual import path for your Favorite model if applicable
const FavoriteModel = mongoose.model("Favorite", FavoriteSchema);

describe("FavoriteSchema statics", () => {
  describe("register method", () => {
    it("should create a new Favorite and return success message with status 200", async () => {
      // Mock input data for the Favorite to be created
      const args = {
        place_id: "some_place_id",
        name: "Favorite Name",
        location: "Favorite Location",
        latitude: 12.345,
        longitude: 67.89,
        firebase_user_id: "some_firebase_user_id",
      };

      // Mock the Favorite.create method to return a successful result
      const createStub = sinon.stub(FavoriteModel, "create").resolves(args);

      // Call the register method
      const result = await FavoriteModel.register(args);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Favorite created");
      expect(result.status).to.equal(200);
      expect(result.data).to.deep.equal(args);

      // Restore the stubbed method
      createStub.restore();
    });

    it("should return success message with status 202 if the Favorite is not created", async () => {
      // Mock input data for the Favorite (this time we'll return an empty data array)
      const args = {
        place_id: "some_place_id",
        name: "Favorite Name",
        location: "Favorite Location",
        latitude: 12.345,
        longitude: 67.89,
        firebase_user_id: "some_firebase_user_id",
      };

      // Mock the Favorite.create method to return an empty data array
      const createStub = sinon.stub(FavoriteModel, "create").resolves([]);

      // Call the register method
      const result = await FavoriteModel.register(args);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "operation successful but Favorite NOT successfully created"
      );
      expect(result.status).to.equal(202);
      expect(result.data).to.be.an("array").that.is.empty;

      // Restore the stubbed method
      createStub.restore();
    });

    it("should return validation errors if the Favorite creation encounters duplicate values", async () => {
      // Mock input data for the Favorite with duplicate values
      const args = {
        place_id: "duplicate_place_id",
        name: "Duplicate Name",
        location: "Duplicate Location",
        latitude: 12.345,
        longitude: 67.89,
        firebase_user_id: "some_firebase_user_id",
      };

      // Mock the Favorite.create method to throw a duplicate key error
      const createStub = sinon.stub(FavoriteModel, "create").throws({
        keyValue: { place_id: "duplicate_place_id" },
      });

      // Call the register method
      const result = await FavoriteModel.register(args);

      // Assertions
      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({
        place_id: "the place_id must be unique",
      });
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
    it("should list favorites with the provided filter, skip, and limit", async () => {
      // Sample favorites data
      const favoritesData = [
        {
          _id: "fav_id_1",
          title: "Favorite 1",
          category: "books",
          createdAt: new Date("2023-01-01"),
        },
        {
          _id: "fav_id_2",
          title: "Favorite 2",
          category: "movies",
          createdAt: new Date("2023-01-02"),
        },
      ];

      // Stub the aggregate method of the model to return the sample favorites data
      const aggregateStub = sinon
        .stub(FavoritesModel, "aggregate")
        .returnsThis();
      const matchStub = sinon.stub().resolvesThis();
      const sortStub = sinon.stub().resolvesThis();
      const projectStub = sinon.stub().resolvesThis();
      const allowDiskUseStub = sinon.stub().resolves(favoritesData);
      aggregateStub.match = matchStub;
      aggregateStub.sort = sortStub;
      aggregateStub.project = projectStub;
      aggregateStub.allowDiskUse = allowDiskUseStub;

      // Call the list method with sample filter, skip, and limit
      const filter = { category: "movies" };
      const skip = 0;
      const limit = 2;
      const result = await FavoritesModel.list({ skip, limit, filter });

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property("data").that.deep.equals(favoritesData);
      expect(result).to.have.property(
        "message",
        "successfully listed the favorites"
      );
      expect(result).to.have.property("status", httpStatus.OK);

      // Restore the aggregate method to its original implementation
      aggregateStub.restore();
    });

    it("should return 'no favorites exist' message if no favorites found", async () => {
      // Stub the aggregate method of the model to return an empty array (no favorites found)
      const aggregateStub = sinon
        .stub(FavoritesModel, "aggregate")
        .returnsThis();
      const matchStub = sinon.stub().resolvesThis();
      const sortStub = sinon.stub().resolvesThis();
      const projectStub = sinon.stub().resolvesThis();
      const allowDiskUseStub = sinon.stub().resolves([]);
      aggregateStub.match = matchStub;
      aggregateStub.sort = sortStub;
      aggregateStub.project = projectStub;
      aggregateStub.allowDiskUse = allowDiskUseStub;

      // Call the list method with sample filter, skip, and limit
      const filter = { category: "non_existent_category" };
      const skip = 0;
      const limit = 10;
      const result = await FavoritesModel.list({ skip, limit, filter });

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property("message", "no favorites exist");
      expect(result).to.have.property("data").that.is.an("array").that.is.empty;
      expect(result).to.have.property("status", httpStatus.OK);

      // Restore the aggregate method to its original implementation
      aggregateStub.restore();
    });

    // Add more test cases to cover other scenarios
  });

  describe("modify method", () => {
    it("should modify the favorite with the provided filter and update", async () => {
      // Sample favorite data
      const favoriteData = {
        _id: "fav_id_1",
        title: "Favorite 1",
        category: "books",
        createdAt: new Date("2023-01-01"),
      };

      // Stub the findOneAndUpdate method of the model to return the modified favorite data
      const findOneAndUpdateStub = sinon
        .stub(FavoritesModel, "findOneAndUpdate")
        .resolves(favoriteData);

      // Call the modify method with sample filter and update
      const filter = { _id: "fav_id_1" };
      const update = { category: "movies" };
      const result = await FavoritesModel.modify({ filter, update });

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property(
        "message",
        "successfully modified the Favorite"
      );
      expect(result).to.have.property("data").that.deep.equals(favoriteData);
      expect(result).to.have.property("status", httpStatus.OK);

      // Restore the findOneAndUpdate method to its original implementation
      findOneAndUpdateStub.restore();
    });

    it("should return 'Favorite does not exist' message if no favorite found", async () => {
      // Stub the findOneAndUpdate method of the model to return null (no favorite found)
      const findOneAndUpdateStub = sinon
        .stub(FavoritesModel, "findOneAndUpdate")
        .resolves(null);

      // Call the modify method with sample filter and update
      const filter = { _id: "non_existent_id" };
      const update = { category: "movies" };
      const result = await FavoritesModel.modify({ filter, update });

      // Assertions
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

      // Restore the findOneAndUpdate method to its original implementation
      findOneAndUpdateStub.restore();
    });

    // Add more test cases to cover other scenarios
  });

  describe("remove method", () => {
    it("should remove the favorite with the provided filter", async () => {
      // Sample favorite data
      const favoriteData = {
        _id: "fav_id_1",
        name: "Favorite 1",
        location: "New York",
        firebase_user_id: "user_id_1",
      };

      // Stub the findOneAndRemove method of the model to return the removed favorite data
      const findOneAndRemoveStub = sinon
        .stub(FavoritesModel, "findOneAndRemove")
        .resolves(favoriteData);

      // Call the remove method with sample filter
      const filter = { _id: "fav_id_1" };
      const result = await FavoritesModel.remove({ filter });

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property(
        "message",
        "successfully removed the Favorite"
      );
      expect(result).to.have.property("data").that.deep.equals(favoriteData);
      expect(result).to.have.property("status", httpStatus.OK);

      // Restore the findOneAndRemove method to its original implementation
      findOneAndRemoveStub.restore();
    });

    it("should return 'Favorite does not exist' message if no favorite found", async () => {
      // Stub the findOneAndRemove method of the model to return null (no favorite found)
      const findOneAndRemoveStub = sinon
        .stub(FavoritesModel, "findOneAndRemove")
        .resolves(null);

      // Call the remove method with sample filter
      const filter = { _id: "non_existent_id" };
      const result = await FavoritesModel.remove({ filter });

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", false);
      expect(result).to.have.property(
        "message",
        "Favorite does not exist, please crosscheck"
      );
      expect(result)
        .to.have.property("errors")
        .that.deep.equals({
          message: "Favorite does not exist, please crosscheck",
        });
      expect(result).to.have.property("status", httpStatus.BAD_REQUEST);

      // Restore the findOneAndRemove method to its original implementation
      findOneAndRemoveStub.restore();
    });

    // Add more test cases to cover other scenarios
  });

  // Add more tests for other static methods if applicable
});

describe("FavoriteSchema methods", () => {
  describe("toJSON method", () => {
    it("should return a JSON object with specific properties", () => {
      // Create a new instance of FavoriteSchema with mock data
      const favorite = new FavoriteModel({
        _id: "some_id",
        name: "Favorite Name",
        location: "Favorite Location",
        latitude: 12.345,
        longitude: 67.89,
        place_id: "some_place_id",
        reference_site: "some_reference_site",
        firebase_user_id: "some_firebase_user_id",
      });

      // Call the toJSON method on the favorite instance
      const result = favorite.toJSON();

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("_id", "some_id");
      expect(result).to.have.property("name", "Favorite Name");
      expect(result).to.have.property("location", "Favorite Location");
      expect(result).to.have.property("latitude", 12.345);
      expect(result).to.have.property("longitude", 67.89);
      expect(result).to.have.property("place_id", "some_place_id");
      expect(result).to.have.property("reference_site", "some_reference_site");
      expect(result).to.have.property(
        "firebase_user_id",
        "some_firebase_user_id"
      );
      // Add more assertions to verify the result
    });

    // Add more test cases to cover additional scenarios
  });

  // Add more tests for other methods if applicable
});
