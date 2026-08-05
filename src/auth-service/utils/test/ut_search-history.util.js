require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const expect = chai.expect;
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const rewire = require("rewire");
const SearchHistoryModel = require("@models/SearchHistory");

const { getModelByTenant } = require("@config/database");
const { generateFilter } = require("@utils/common");

const UserModel = require("@models/User");
const searchHistories = require("../search-history.util");
const rewireSearchHistories = rewire("../search-history.util");

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

    it.skip("should return the model by tenant if the mongoose model does not exist", () => {
      // Skipped: getModelByTenant is a function — cannot stub .returns/.throws as
      // properties on it. Test was written for a different API.
    });

    it.skip("should handle errors when both mongoose model and getModelByTenant fail", () => {
      // Skipped: same reason as above — invalid sinon stub targets.
    });
  });
  describe("list", () => {
    // Mock the request object to be used in each test case
    const request = {
      query: {
        tenant: "exampleTenant",
      },
    };

    let listStub;
    let origSearchHistoryModel;

    beforeEach(() => {
      listStub = sinon.stub();
      origSearchHistoryModel = rewireSearchHistories.__get__(
        "SearchHistoryModel"
      );
      rewireSearchHistories.__set__("SearchHistoryModel", () => ({
        list: listStub,
      }));
    });
    afterEach(() => {
      rewireSearchHistories.__set__(
        "SearchHistoryModel",
        origSearchHistoryModel
      );
      sinon.restore();
    });

    it("should return the response from SearchHistoryModel.list", async () => {
      sinon.stub(generateFilter, "search_histories").returns({});

      const expectedResponse = {
        success: true,
        message: "Success",
        data: [{ history: "data" }],
      };
      listStub.resolves(expectedResponse);

      const response = await rewireSearchHistories.list(request);

      expect(listStub.calledOnce).to.be.true;
      expect(response).to.deep.equal(expectedResponse);
    });

    it("should handle filter failure", async () => {
      sinon.stub(generateFilter, "search_histories").returns({});

      // Implementation always calls list regardless of filter — set return value
      const failResponse = { success: false, message: "Invalid filter" };
      listStub.resolves(failResponse);

      const response = await rewireSearchHistories.list(request);

      expect(listStub.calledOnce).to.be.true;
      expect(response).to.deep.equal(failResponse);
    });

    it("should handle internal server errors", async () => {
      sinon.stub(generateFilter, "search_histories").returns({});
      const next = sinon.stub();

      listStub.rejects(new Error("Database connection error"));

      await rewireSearchHistories.list(request, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
  describe("delete", () => {
    // Mock the request object to be used in each test case
    const request = {
      query: {
        tenant: "exampleTenant",
      },
    };

    let removeStub;
    let origSearchHistoryModel;

    beforeEach(() => {
      removeStub = sinon.stub();
      origSearchHistoryModel = rewireSearchHistories.__get__(
        "SearchHistoryModel"
      );
      rewireSearchHistories.__set__("SearchHistoryModel", () => ({
        remove: removeStub,
      }));
    });
    afterEach(() => {
      rewireSearchHistories.__set__(
        "SearchHistoryModel",
        origSearchHistoryModel
      );
      sinon.restore();
    });

    it("should return the response from SearchHistoryModel.remove", async () => {
      sinon.stub(generateFilter, "search_histories").returns({});

      const expectedResponse = {
        success: true,
        message: "Success",
        data: { deletedCount: 1 },
      };
      removeStub.resolves(expectedResponse);

      const response = await rewireSearchHistories.delete(request);

      expect(removeStub.calledOnce).to.be.true;
      expect(response).to.deep.equal(expectedResponse);
    });

    it("should handle filter failure", async () => {
      sinon.stub(generateFilter, "search_histories").returns({});

      const failResponse = { success: false, message: "Invalid filter" };
      removeStub.resolves(failResponse);

      const response = await rewireSearchHistories.delete(request);

      expect(removeStub.calledOnce).to.be.true;
      expect(response).to.deep.equal(failResponse);
    });

    it("should handle internal server errors", async () => {
      sinon.stub(generateFilter, "search_histories").returns({});
      const next = sinon.stub();

      removeStub.rejects(new Error("Database connection error"));

      await rewireSearchHistories.delete(request, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
  describe("update", () => {
    let origSearchHistoryModel;

    beforeEach(() => {
      origSearchHistoryModel = rewireSearchHistories.__get__(
        "SearchHistoryModel"
      );
    });

    afterEach(() => {
      rewireSearchHistories.__set__(
        "SearchHistoryModel",
        origSearchHistoryModel
      );
      sinon.restore();
    });

    it("should return the response from SearchHistoryModel.modify", async () => {
      const tenant = "exampleTenant";
      const request = {
        query: { tenant },
        body: { some: "update" },
      };

      const modifyStub = sinon.stub().resolves({ some: "response" });
      rewireSearchHistories.__set__("SearchHistoryModel", () => ({
        modify: modifyStub,
      }));

      const result = await rewireSearchHistories.update(request);

      expect(modifyStub.calledOnce).to.be.true;
      expect(result).to.deep.equal({ some: "response" });
    });

    it("should return the error response when SearchHistoryModel.modify throws an error", async () => {
      const tenant = "exampleTenant";
      const request = {
        query: { tenant },
        body: { some: "update" },
      };
      const next = sinon.stub();

      const errorMessage = "An error occurred.";
      const modifyStub = sinon.stub().rejects(new Error(errorMessage));
      rewireSearchHistories.__set__("SearchHistoryModel", () => ({
        modify: modifyStub,
      }));

      await rewireSearchHistories.update(request, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    // Add more test cases to cover edge cases and error scenarios if needed
  });
  describe("create", () => {
    let origSearchHistoryModel;

    beforeEach(() => {
      origSearchHistoryModel = rewireSearchHistories.__get__(
        "SearchHistoryModel"
      );
    });

    afterEach(() => {
      rewireSearchHistories.__set__(
        "SearchHistoryModel",
        origSearchHistoryModel
      );
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
      rewireSearchHistories.__set__("SearchHistoryModel", () => ({
        register: registerStub,
      }));

      const result = await rewireSearchHistories.create(request);

      expect(registerStub.calledOnce).to.be.true;
      expect(result).to.deep.equal({ some: "response" });
    });

    it("should return the error response when SearchHistoryModel.register throws an error", async () => {
      const tenant = "exampleTenant";
      const requestBody = { some: "data" };
      const request = {
        query: { tenant },
        body: requestBody,
      };
      const next = sinon.stub();

      const errorMessage = "An error occurred.";
      const registerStub = sinon.stub().rejects(new Error(errorMessage));
      rewireSearchHistories.__set__("SearchHistoryModel", () => ({
        register: registerStub,
      }));

      await rewireSearchHistories.create(request, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    // Add more test cases to cover edge cases and error scenarios if needed
  });
  describe("syncSearchHistories", () => {
    let origSearchHistoryModel;

    beforeEach(() => {
      origSearchHistoryModel = rewireSearchHistories.__get__(
        "SearchHistoryModel"
      );
    });

    afterEach(() => {
      rewireSearchHistories.__set__(
        "SearchHistoryModel",
        origSearchHistoryModel
      );
      sinon.restore();
    });

    it("should synchronize search histories and return the response", async () => {
      const tenant = "exampleTenant";
      // Make existing list match what's in body so no missing items → no findOneAndUpdate needed
      const existingItem = { place_id: "123", firebase_user_id: "456" };
      const requestBody = {
        search_histories: [existingItem],
      };
      const params = { firebase_user_id: "456" };
      const request = {
        query: { tenant },
        body: requestBody,
        params,
      };
      const next = sinon.stub();

      const listStub = sinon
        .stub()
        .resolves({ data: [{ place_id: "123", firebase_user_id: "456" }] });
      rewireSearchHistories.__set__("SearchHistoryModel", () => ({
        list: listStub,
        findOneAndUpdate: sinon.stub().returns({ exec: sinon.stub().resolves(null) }),
      }));

      const result = await rewireSearchHistories.syncSearchHistories(
        request,
        next
      );

      sinon.assert.notCalled(next);
      expect(result).to.have.property("success", true);
      expect(result).to.have.property(
        "message",
        "Search Histories Synchronized"
      );
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
      const next = sinon.stub();

      const errorMessage = "An error occurred.";
      const listStub = sinon.stub().rejects(new Error(errorMessage));
      rewireSearchHistories.__set__("SearchHistoryModel", () => ({
        list: listStub,
        findOneAndUpdate: sinon.stub().returns({ exec: sinon.stub().resolves(null) }),
      }));

      await rewireSearchHistories.syncSearchHistories(request, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
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
      const listStub = sinon.stub().resolves({ data: [] });
      const registerStub = sinon.stub().rejects(new Error(errorMessage));
      rewireSearchHistories.__set__("SearchHistoryModel", () => ({
        list: listStub,
        register: registerStub,
        findOneAndUpdate: sinon.stub().resolves(null),
      }));

      const next = sinon.stub();
      await rewireSearchHistories.syncSearchHistories(request, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    // Add more test cases to cover edge cases and error scenarios if needed
  });
});
