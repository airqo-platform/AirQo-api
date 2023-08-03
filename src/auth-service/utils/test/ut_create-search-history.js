require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const expect = chai.expect;
const httpStatus = require("http-status");
const SearchHistorySchema = require("@models/searchHistory");

const { getModelByTenant } = require("@config/database");
const SearchHistoryModel = (tenant) => {
  try {
    let users = mongoose.model("searchhistories");
    return users;
  } catch (error) {
    let users = getModelByTenant(tenant, "searchhistory", SearchHistorySchema);
    return users;
  }
};

const UserModel = require("@models/User");
const searchHistories = require("../create-search-history");

describe("Search Histories Util", () => {
  describe("SearchHistoryModel", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return the mongoose model if it exists", () => {
      const modelStub = sinon
        .stub(mongoose, "model")
        .returns({ some: "model" });

      const tenant = "exampleTenant";
      const result = SearchHistoryModel(tenant);

      expect(modelStub.calledOnceWithExactly("searchHistories")).to.be.true;
      expect(result).to.deep.equal({ some: "model" });
    });

    it("should return the model by tenant if the mongoose model does not exist", () => {
      const modelStub = sinon
        .stub(mongoose, "model")
        .throws(new Error("Model not found"));
      const getModelByTenantStub = sinon
        .stub(getModelByTenant, "returns")
        .returns({ some: "tenantModel" });

      const tenant = "exampleTenant";
      const result = SearchHistoryModel(tenant);

      expect(modelStub.calledOnceWithExactly("searchHistories")).to.be.true;
      expect(
        getModelByTenantStub.calledOnceWithExactly(
          tenant,
          "searchHistory",
          SearchHistorySchema
        )
      ).to.be.true;
      expect(result).to.deep.equal({ some: "tenantModel" });
    });

    it("should handle errors when both mongoose model and getModelByTenant fail", () => {
      const modelStub = sinon
        .stub(mongoose, "model")
        .throws(new Error("Model not found"));
      const getModelByTenantStub = sinon
        .stub(getModelByTenant, "throws")
        .throws(new Error("Tenant model not found"));

      const tenant = "exampleTenant";
      const result = SearchHistoryModel(tenant);

      expect(modelStub.calledOnceWithExactly("searchHistories")).to.be.true;
      expect(
        getModelByTenantStub.calledOnceWithExactly(
          tenant,
          "searchHistory",
          SearchHistorySchema
        )
      ).to.be.true;
      expect(result).to.be.null; // Or handle error response based on your use case
    });
  });
  describe("list", () => {
    // Mock the request object to be used in each test case
    const request = {
      query: {
        tenant: "exampleTenant",
      },
    };

    // Mock the SearchHistoryModel.list function
    const listStub = sinon.stub(SearchHistoryModel("exampleTenant"), "list");

    // Restore the stub after all test cases are executed
    after(() => {
      listStub.restore();
    });

    it("should return the response from SearchHistoryModel.list", async () => {
      // Mock the generateFilter.search_histories function to return a successful filter
      const generateFilterStub = sinon
        .stub(generateFilter, "search_histories")
        .returns({ success: true, filter: { someFilter: "value" } });

      // Set up the response from SearchHistoryModel.list
      const expectedResponse = {
        success: true,
        message: "Success",
        data: [{ history: "data" }],
      };
      listStub.resolves(expectedResponse);

      // Call the list function with the mocked request
      const response = await searchHistories.list(request);

      // Assertions
      expect(generateFilterStub.calledOnce).to.be.true;
      expect(listStub.calledOnce).to.be.true;
      expect(listStub.calledWithExactly({ filter: { someFilter: "value" } })).to
        .be.true;
      expect(response).to.deep.equal(expectedResponse);

      // Restore the stubs
      generateFilterStub.restore();
    });

    it("should handle filter failure", async () => {
      // Mock the generateFilter.search_histories function to return a failed filter
      const generateFilterStub = sinon
        .stub(generateFilter, "search_histories")
        .returns({ success: false, message: "Invalid filter" });

      // Call the list function with the mocked request
      const response = await searchHistories.list(request);

      // Assertions
      expect(generateFilterStub.calledOnce).to.be.true;
      expect(listStub.called).to.be.false;
      expect(response).to.deep.equal({
        success: false,
        message: "Invalid filter",
      });

      // Restore the stubs
      generateFilterStub.restore();
    });

    it("should handle internal server errors", async () => {
      // Mock the generateFilter.search_histories function to return a successful filter
      const generateFilterStub = sinon
        .stub(generateFilter, "search_histories")
        .returns({ success: true, filter: { someFilter: "value" } });

      // Mock the logger.error function to do nothing (prevents logs from cluttering test output)
      sinon.stub(logger, "error");

      // Set up the response from SearchHistoryModel.list to throw an error
      listStub.rejects(new Error("Database connection error"));

      // Call the list function with the mocked request
      const response = await searchHistories.list(request);

      // Assertions
      expect(generateFilterStub.calledOnce).to.be.true;
      expect(listStub.calledOnce).to.be.true;
      expect(listStub.calledWithExactly({ filter: { someFilter: "value" } })).to
        .be.true;
      expect(logger.error.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: {
          message: "Database connection error",
        },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });

      // Restore the stubs
      generateFilterStub.restore();
      logger.error.restore();
    });
  });
  describe("delete", () => {
    // Mock the request object to be used in each test case
    const request = {
      query: {
        tenant: "exampleTenant",
      },
    };

    // Mock the SearchHistoryModel.remove function
    const removeStub = sinon.stub(
      SearchHistoryModel("exampleTenant"),
      "remove"
    );

    // Restore the stub after all test cases are executed
    after(() => {
      removeStub.restore();
    });

    it("should return the response from SearchHistoryModel.remove", async () => {
      // Mock the generateFilter.search_histories function to return a successful filter
      const generateFilterStub = sinon
        .stub(generateFilter, "search_histories")
        .returns({ success: true, filter: { someFilter: "value" } });

      // Set up the response from SearchHistoryModel.remove
      const expectedResponse = {
        success: true,
        message: "Success",
        data: { deletedCount: 1 },
      };
      removeStub.resolves(expectedResponse);

      // Call the delete function with the mocked request
      const response = await searchHistories.delete(request);

      // Assertions
      expect(generateFilterStub.calledOnce).to.be.true;
      expect(removeStub.calledOnce).to.be.true;
      expect(removeStub.calledWithExactly({ filter: { someFilter: "value" } }))
        .to.be.true;
      expect(response).to.deep.equal(expectedResponse);

      // Restore the stubs
      generateFilterStub.restore();
    });

    it("should handle filter failure", async () => {
      // Mock the generateFilter.search_histories function to return a failed filter
      const generateFilterStub = sinon
        .stub(generateFilter, "search_histories")
        .returns({ success: false, message: "Invalid filter" });

      // Call the delete function with the mocked request
      const response = await searchHistories.delete(request);

      // Assertions
      expect(generateFilterStub.calledOnce).to.be.true;
      expect(removeStub.called).to.be.false;
      expect(response).to.deep.equal({
        success: false,
        message: "Invalid filter",
      });

      // Restore the stubs
      generateFilterStub.restore();
    });

    it("should handle internal server errors", async () => {
      // Mock the generateFilter.search_histories function to return a successful filter
      const generateFilterStub = sinon
        .stub(generateFilter, "search_histories")
        .returns({ success: true, filter: { someFilter: "value" } });

      // Mock the logger.error function to do nothing (prevents logs from cluttering test output)
      sinon.stub(logger, "error");

      // Set up the response from SearchHistoryModel.remove to throw an error
      removeStub.rejects(new Error("Database connection error"));

      // Call the delete function with the mocked request
      const response = await searchHistories.delete(request);

      // Assertions
      expect(generateFilterStub.calledOnce).to.be.true;
      expect(removeStub.calledOnce).to.be.true;
      expect(removeStub.calledWithExactly({ filter: { someFilter: "value" } }))
        .to.be.true;
      expect(logger.error.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: {
          message: "Database connection error",
        },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });

      // Restore the stubs
      generateFilterStub.restore();
      logger.error.restore();
    });
  });
  describe("update", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return the response from SearchHistoryModel.modify", async () => {
      const tenant = "exampleTenant";
      const filter = { some: "filter" };
      const update = { some: "update" };
      const request = {
        query: { tenant },
        body: update,
      };

      const modifyStub = sinon.stub().resolves({ some: "response" });
      const SearchHistoryModelStub = sinon
        .stub(SearchHistoryModel(tenant.toLowerCase()), "modify")
        .returns(modifyStub);

      const result = await SearchHistoryModel.update(request);

      expect(SearchHistoryModelStub.calledOnceWithExactly({ filter, update }))
        .to.be.true;
      expect(result).to.deep.equal({ some: "response" });
    });

    it("should return the error response when SearchHistoryModel.modify throws an error", async () => {
      const tenant = "exampleTenant";
      const filter = { some: "filter" };
      const update = { some: "update" };
      const request = {
        query: { tenant },
        body: update,
      };

      const errorMessage = "An error occurred.";
      const error = new Error(errorMessage);
      const modifyStub = sinon.stub().rejects(error);
      const SearchHistoryModelStub = sinon
        .stub(SearchHistoryModel(tenant.toLowerCase()), "modify")
        .returns(modifyStub);

      const result = await SearchHistoryModel.update(request);

      expect(SearchHistoryModelStub.calledOnceWithExactly({ filter, update }))
        .to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: errorMessage },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    // Add more test cases to cover edge cases and error scenarios if needed
  });
  describe("create", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return the response from SearchHistoryModel.register", async () => {
      const tenant = "exampleTenant";
      const requestBody = { some: "data" };
      const request = {
        query: { tenant },
        body: requestBody,
      };

      const registerStub = sinon.stub().resolves({ some: "response" });
      const SearchHistoryModelStub = sinon
        .stub(SearchHistoryModel(tenant.toLowerCase()), "register")
        .returns(registerStub);

      const result = await SearchHistoryModel.create(request);

      expect(SearchHistoryModelStub.calledOnceWithExactly(requestBody)).to.be
        .true;
      expect(result).to.deep.equal({ some: "response" });
    });

    it("should return the error response when SearchHistoryModel.register throws an error", async () => {
      const tenant = "exampleTenant";
      const requestBody = { some: "data" };
      const request = {
        query: { tenant },
        body: requestBody,
      };

      const errorMessage = "An error occurred.";
      const error = new Error(errorMessage);
      const registerStub = sinon.stub().rejects(error);
      const SearchHistoryModelStub = sinon
        .stub(SearchHistoryModel(tenant.toLowerCase()), "register")
        .returns(registerStub);

      const result = await SearchHistoryModel.create(request);

      expect(SearchHistoryModelStub.calledOnceWithExactly(requestBody)).to.be
        .true;
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: errorMessage },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    // Add more test cases to cover edge cases and error scenarios if needed
  });
  describe("syncSearchHistories", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should synchronize search histories and return the response", async () => {
      const tenant = "exampleTenant";
      const requestBody = {
        search_histories: [{ place_id: "123", firebase_user_id: "456" }],
      };
      const params = { firebase_user_id: "456" };
      const request = {
        query: { tenant },
        body: requestBody,
        params,
      };

      const listStub = sinon
        .stub()
        .resolves({ data: [{ place_id: "789", firebase_user_id: "456" }] });
      const registerStub = sinon.stub().resolves({ success: true });
      const SearchHistoryModelStub = sinon.stub(
        SearchHistoryModel(tenant.toLowerCase())
      );
      SearchHistoryModelStub.list = listStub;
      SearchHistoryModelStub.register = registerStub;

      const result = await SearchHistoryModel.syncSearchHistories(request);

      expect(
        listStub.calledOnceWithExactly({ filter: { firebase_user_id: "456" } })
      ).to.be.true;
      expect(
        registerStub.calledOnceWithExactly({
          place_id: "123",
          firebase_user_id: "456",
        })
      ).to.be.true;
      expect(result).to.deep.equal({
        success: true,
        message: "Search Histories Synchronized",
        data: [{ place_id: "789", firebase_user_id: "456" }],
        status: httpStatus.OK,
      });
    });

    it("should handle error when SearchHistoryModel.list throws an error", async () => {
      const tenant = "exampleTenant";
      const requestBody = {
        search_histories: [{ place_id: "123", firebase_user_id: "456" }],
      };
      const params = { firebase_user_id: "456" };
      const request = {
        query: { tenant },
        body: requestBody,
        params,
      };

      const errorMessage = "An error occurred.";
      const error = new Error(errorMessage);
      const listStub = sinon.stub().rejects(error);
      const SearchHistoryModelStub = sinon.stub(
        SearchHistoryModel(tenant.toLowerCase())
      );
      SearchHistoryModelStub.list = listStub;

      const result = await SearchHistoryModel.syncSearchHistories(request);

      expect(
        listStub.calledOnceWithExactly({ filter: { firebase_user_id: "456" } })
      ).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: errorMessage },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it("should handle error when SearchHistoryModel.register throws an error", async () => {
      const tenant = "exampleTenant";
      const requestBody = {
        search_histories: [{ place_id: "123", firebase_user_id: "456" }],
      };
      const params = { firebase_user_id: "456" };
      const request = {
        query: { tenant },
        body: requestBody,
        params,
      };

      const errorMessage = "An error occurred.";
      const error = new Error(errorMessage);
      const listStub = sinon.stub().resolves({ data: [] });
      const registerStub = sinon.stub().rejects(error);
      const SearchHistoryModelStub = sinon.stub(
        SearchHistoryModel(tenant.toLowerCase())
      );
      SearchHistoryModelStub.list = listStub;
      SearchHistoryModelStub.register = registerStub;

      const result = await SearchHistoryModel.syncSearchHistories(request);

      expect(
        listStub.calledOnceWithExactly({ filter: { firebase_user_id: "456" } })
      ).to.be.true;
      expect(
        registerStub.calledOnceWithExactly({
          place_id: "123",
          firebase_user_id: "456",
        })
      ).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "Error Synchronizing Search Histories",
        errors: {
          message: `Response from Create Search History: ${errorMessage}`,
        },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    // Add more test cases to cover edge cases and error scenarios if needed
  });
});
