require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const favorites = require("@utils/create-favorites");
const { getModelByTenant } = require("@config/database");
const FavoriteSchema = require("@models/Favorite");
const UserSchema = require("@models/User");
const generateFilter = require("@utils/generate-filter");

describe("favorites", () => {
  describe("sample method", () => {
    it("should return a success response", async () => {
      const request = {
        // Add any required request data here
      };

      // Call the sample method
      const result = await favorites.sample(request);

      // Verify the response
      expect(result.success).to.be.true;
      // Add more assertions if needed
    });
  });
  describe("list method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should list favorites and send success response", async () => {
      const tenant = "sample_tenant";
      const request = {
        query: {
          tenant,
        },
      };

      // Mock the response from the generateFilter.favorites function (success)
      const mockGenerateFilterResponse = {
        success: true,
        data: {
          // Sample filter object returned by the generateFilter.favorites function
        },
      };
      sinon
        .stub(generateFilter, "favorites")
        .returns(mockGenerateFilterResponse);

      // Mock the response from the FavoriteModel list method (success)
      const mockListResponse = {
        success: true,
        data: {
          // Sample data object returned by the FavoriteModel list method
        },
      };
      sinon.stub(favorites, "FavoriteModel").returns({
        list: sinon.stub().resolves(mockListResponse),
      });

      // Call the list method
      const result = await favorites.list(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(mockListResponse.data);
    });

    it("should handle FavoriteModel list failure and return failure response", async () => {
      const tenant = "sample_tenant";
      const request = {
        query: {
          tenant,
        },
      };

      // Mock the response from the generateFilter.favorites function (success)
      sinon.stub(generateFilter, "favorites").returns({
        success: true,
        data: {
          // Sample filter object returned by the generateFilter.favorites function
        },
      });

      // Mock the response from the FavoriteModel list method (failure)
      sinon.stub(favorites, "FavoriteModel").returns({
        list: sinon.stub().resolves({
          success: false,
          message: "Failed to list favorites",
        }),
      });

      // Call the list method
      const result = await favorites.list(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to list favorites");
    });

    it("should handle generateFilter.favorites failure and return failure response", async () => {
      const tenant = "sample_tenant";
      const request = {
        query: {
          tenant,
        },
      };

      // Mock the response from the generateFilter.favorites function (failure)
      sinon.stub(generateFilter, "favorites").returns({
        success: false,
        message: "Invalid filter",
      });

      // Call the list method
      const result = await favorites.list(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Invalid filter");
    });
  });
  describe("delete method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should delete a favorite and send success response", async () => {
      const tenant = "sample_tenant";
      const request = {
        query: {
          tenant,
        },
      };

      // Mock the response from the generateFilter.favorites function (success)
      const mockGenerateFilterResponse = {
        success: true,
        data: {
          // Sample filter object returned by the generateFilter.favorites function
        },
      };
      sinon
        .stub(generateFilter, "favorites")
        .returns(mockGenerateFilterResponse);

      // Mock the response from the FavoriteModel remove method (success)
      const mockRemoveResponse = {
        success: true,
        data: {
          // Sample data object returned by the FavoriteModel remove method
        },
      };
      sinon.stub(favorites, "FavoriteModel").returns({
        remove: sinon.stub().resolves(mockRemoveResponse),
      });

      // Call the delete method
      const result = await favorites.delete(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(mockRemoveResponse.data);
    });

    it("should handle FavoriteModel remove failure and return failure response", async () => {
      const tenant = "sample_tenant";
      const request = {
        query: {
          tenant,
        },
      };

      // Mock the response from the generateFilter.favorites function (success)
      sinon.stub(generateFilter, "favorites").returns({
        success: true,
        data: {
          // Sample filter object returned by the generateFilter.favorites function
        },
      });

      // Mock the response from the FavoriteModel remove method (failure)
      sinon.stub(favorites, "FavoriteModel").returns({
        remove: sinon.stub().resolves({
          success: false,
          message: "Failed to remove favorite",
        }),
      });

      // Call the delete method
      const result = await favorites.delete(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to remove favorite");
    });

    it("should handle generateFilter.favorites failure and return failure response", async () => {
      const tenant = "sample_tenant";
      const request = {
        query: {
          tenant,
        },
      };

      // Mock the response from the generateFilter.favorites function (failure)
      sinon.stub(generateFilter, "favorites").returns({
        success: false,
        message: "Invalid filter",
      });

      // Call the delete method
      const result = await favorites.delete(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Invalid filter");
    });
  });
  describe("update method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should update a favorite and send success response", async () => {
      const tenant = "sample_tenant";
      const request = {
        query: {
          tenant,
        },
        body: {
          // Sample update data for the favorite
        },
      };

      // Mock the response from the generateFilter.favorites function (success)
      const mockGenerateFilterResponse = {
        success: true,
        data: {
          // Sample filter object returned by the generateFilter.favorites function
        },
      };
      sinon
        .stub(generateFilter, "favorites")
        .returns(mockGenerateFilterResponse);

      // Mock the response from the FavoriteModel modify method (success)
      const mockModifyResponse = {
        success: true,
        data: {
          // Sample data object returned by the FavoriteModel modify method
        },
      };
      sinon.stub(favorites, "FavoriteModel").returns({
        modify: sinon.stub().resolves(mockModifyResponse),
      });

      // Call the update method
      const result = await favorites.update(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(mockModifyResponse.data);
    });

    it("should handle FavoriteModel modify failure and return failure response", async () => {
      const tenant = "sample_tenant";
      const request = {
        query: {
          tenant,
        },
        body: {
          // Sample update data for the favorite
        },
      };

      // Mock the response from the generateFilter.favorites function (success)
      sinon.stub(generateFilter, "favorites").returns({
        success: true,
        data: {
          // Sample filter object returned by the generateFilter.favorites function
        },
      });

      // Mock the response from the FavoriteModel modify method (failure)
      sinon.stub(favorites, "FavoriteModel").returns({
        modify: sinon.stub().resolves({
          success: false,
          message: "Failed to update favorite",
        }),
      });

      // Call the update method
      const result = await favorites.update(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to update favorite");
    });

    it("should handle generateFilter.favorites failure and return failure response", async () => {
      const tenant = "sample_tenant";
      const request = {
        query: {
          tenant,
        },
        body: {
          // Sample update data for the favorite
        },
      };

      // Mock the response from the generateFilter.favorites function (failure)
      sinon.stub(generateFilter, "favorites").returns({
        success: false,
        message: "Invalid filter",
      });

      // Call the update method
      const result = await favorites.update(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Invalid filter");
    });
  });
  describe("create method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should create a favorite and send success response", async () => {
      const tenant = "sample_tenant";
      const request = {
        query: {
          tenant,
        },
        body: {
          // Sample data for creating a new favorite
        },
      };

      // Mock the response from the FavoriteModel register method (success)
      const mockRegisterResponse = {
        success: true,
        data: {
          // Sample data object returned by the FavoriteModel register method
        },
      };
      sinon.stub(favorites, "FavoriteModel").returns({
        register: sinon.stub().resolves(mockRegisterResponse),
      });

      // Call the create method
      const result = await favorites.create(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(mockRegisterResponse.data);
    });

    it("should handle FavoriteModel register failure and return failure response", async () => {
      const tenant = "sample_tenant";
      const request = {
        query: {
          tenant,
        },
        body: {
          // Sample data for creating a new favorite
        },
      };

      // Mock the response from the FavoriteModel register method (failure)
      sinon.stub(favorites, "FavoriteModel").returns({
        register: sinon.stub().resolves({
          success: false,
          message: "Failed to create favorite",
        }),
      });

      // Call the create method
      const result = await favorites.create(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to create favorite");
    });

    it("should handle errors during create and return failure response", async () => {
      const tenant = "sample_tenant";
      const request = {
        query: {
          tenant,
        },
        body: {
          // Sample data for creating a new favorite
        },
      };

      // Mock the response from the FavoriteModel register method (throws error)
      sinon.stub(favorites, "FavoriteModel").returns({
        register: sinon.stub().throws(new Error("Database connection error")),
      });

      // Call the create method
      const result = await favorites.create(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.errors.message).to.equal("Database connection error");
    });
  });
  describe("syncFavorites method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should sync favorites and send success response", async () => {
      const tenant = "sample_tenant";
      const request = {
        query: {
          tenant,
        },
        body: {
          favorite_places: [
            // Sample data for favorite_places array
          ],
        },
        params: {
          firebase_user_id: "sample_user_id",
        },
      };

      // Mock the response from FavoriteModel list method (success)
      const mockListResponse = {
        success: true,
        data: [
          // Sample data for unsynced_favorite_places array
        ],
      };
      sinon.stub(favorites, "FavoriteModel").returns({
        list: sinon.stub().resolves(mockListResponse),
        remove: sinon.stub().resolves({
          success: true,
          message: "Favorite removed successfully",
        }),
        register: sinon.stub().resolves({
          success: true,
          message: "Favorite created successfully",
        }),
      });

      // Call the syncFavorites method
      const result = await favorites.syncFavorites(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Favorites Synchronized");
      // Add more assertions as needed for the data and status
    });

    it("should handle errors during sync and return failure response", async () => {
      const tenant = "sample_tenant";
      const request = {
        query: {
          tenant,
        },
        body: {
          favorite_places: [
            // Sample data for favorite_places array
          ],
        },
        params: {
          firebase_user_id: "sample_user_id",
        },
      };

      // Mock the response from FavoriteModel list method (throws error)
      sinon.stub(favorites, "FavoriteModel").returns({
        list: sinon.stub().throws(new Error("Database connection error")),
      });

      // Call the syncFavorites method
      const result = await favorites.syncFavorites(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.errors.message).to.equal("Database connection error");
    });
  });
});
