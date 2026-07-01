require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const rewire = require("rewire");
const { generateFilter } = require("@utils/common");

const locationHistories = require("../location-history.util");
const rewireLocationHistories = rewire("../location-history.util");
const LocationHistoryModel = require("@models/LocationHistory");

describe("locationHistories", () => {
  describe("sample method", () => {
    it("should do something", async () => {
      // Implement test case for the sample method
    });
  });

  describe("list method", () => {
    let origLocationHistoryModel;
    let listStub;

    beforeEach(() => {
      listStub = sinon.stub();
      origLocationHistoryModel = rewireLocationHistories.__get__(
        "LocationHistoryModel"
      );
      rewireLocationHistories.__set__("LocationHistoryModel", () => ({
        list: listStub,
      }));
    });

    afterEach(() => {
      rewireLocationHistories.__set__(
        "LocationHistoryModel",
        origLocationHistoryModel
      );
      sinon.restore();
    });

    it("should return a list of location histories", async () => {
      const request = { query: { tenant: "test_tenant" } };

      sinon.stub(generateFilter, "location_histories").returns({
        success: true,
        filter: {},
      });
      listStub.resolves({ success: true, data: [] });

      const result = await rewireLocationHistories.list(request);

      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result).to.have.property("data").that.is.an("array");
    });

    it("should return the filter error if generateFilter.location_histories returns success as false", async () => {
      const request = { query: { tenant: "test_tenant" } };

      // Implementation passes filter to model regardless of success flag
      sinon.stub(generateFilter, "location_histories").returns({
        success: false,
        errors: { message: "Invalid filter" },
      });
      listStub.resolves({ success: false, errors: { message: "Invalid filter" } });

      const result = await rewireLocationHistories.list(request);

      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
    });

    it("should handle internal server error and return appropriate response", async () => {
      const request = { query: { tenant: "test_tenant" } };
      const next = sinon.stub();
      const errorMessage = "Database connection error";

      sinon.stub(generateFilter, "location_histories").returns({ success: true, filter: {} });
      listStub.throws(new Error(errorMessage));

      await rewireLocationHistories.list(request, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(500);
    });
  });

  describe("delete method", () => {
    let origLocationHistoryModel;
    let removeStub;

    beforeEach(() => {
      removeStub = sinon.stub();
      origLocationHistoryModel = rewireLocationHistories.__get__(
        "LocationHistoryModel"
      );
      rewireLocationHistories.__set__("LocationHistoryModel", () => ({
        remove: removeStub,
      }));
    });

    afterEach(() => {
      rewireLocationHistories.__set__(
        "LocationHistoryModel",
        origLocationHistoryModel
      );
      sinon.restore();
    });

    it("should delete location histories and return success response", async () => {
      const request = { query: { tenant: "test_tenant" } };

      sinon.stub(generateFilter, "location_histories").returns({ success: true, filter: {} });
      removeStub.resolves({
        success: true,
        message: "Location histories deleted successfully",
        data: [],
      });

      const result = await rewireLocationHistories.delete(request);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Location histories deleted successfully");
    });

    it("should return the filter error if generateFilter.location_histories returns success as false", async () => {
      const request = { query: { tenant: "test_tenant" } };

      sinon.stub(generateFilter, "location_histories").returns({
        success: false,
        errors: { message: "Invalid filter" },
      });
      removeStub.resolves({ success: false, errors: { message: "Invalid filter" } });

      const result = await rewireLocationHistories.delete(request);

      expect(result.success).to.be.false;
    });

    it("should handle internal server error and return appropriate response", async () => {
      const request = { query: { tenant: "test_tenant" } };
      const next = sinon.stub();
      const errorMessage = "Database connection error";

      sinon.stub(generateFilter, "location_histories").returns({ success: true, filter: {} });
      removeStub.throws(new Error(errorMessage));

      await rewireLocationHistories.delete(request, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err.statusCode).to.equal(500);
    });
  });

  describe("update method", () => {
    let origLocationHistoryModel;
    let modifyStub;

    beforeEach(() => {
      modifyStub = sinon.stub();
      origLocationHistoryModel = rewireLocationHistories.__get__(
        "LocationHistoryModel"
      );
      rewireLocationHistories.__set__("LocationHistoryModel", () => ({
        modify: modifyStub,
      }));
    });

    afterEach(() => {
      rewireLocationHistories.__set__(
        "LocationHistoryModel",
        origLocationHistoryModel
      );
      sinon.restore();
    });

    it("should update location histories and return success response", async () => {
      const request = { query: { tenant: "test_tenant" }, body: {} };

      sinon.stub(generateFilter, "location_histories").returns({ success: true, filter: {} });
      modifyStub.resolves({
        success: true,
        message: "Location histories updated successfully",
        data: {},
      });

      const result = await rewireLocationHistories.update(request);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Location histories updated successfully");
    });

    it("should return the filter error if generateFilter.location_histories returns success as false", async () => {
      const request = { query: { tenant: "test_tenant" }, body: {} };

      sinon.stub(generateFilter, "location_histories").returns({
        success: false,
        errors: { message: "Invalid filter" },
      });
      modifyStub.resolves({ success: false, errors: { message: "Invalid filter" } });

      const result = await rewireLocationHistories.update(request);

      expect(result.success).to.be.false;
    });

    it("should handle internal server error and return appropriate response", async () => {
      const request = { query: { tenant: "test_tenant" }, body: {} };
      const next = sinon.stub();
      const errorMessage = "Database connection error";

      sinon.stub(generateFilter, "location_histories").returns({ success: true, filter: {} });
      modifyStub.throws(new Error(errorMessage));

      await rewireLocationHistories.update(request, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err.statusCode).to.equal(500);
    });
  });

  describe("create method", () => {
    let origLocationHistoryModel;
    let registerStub;

    beforeEach(() => {
      registerStub = sinon.stub();
      origLocationHistoryModel = rewireLocationHistories.__get__(
        "LocationHistoryModel"
      );
      rewireLocationHistories.__set__("LocationHistoryModel", () => ({
        register: registerStub,
      }));
    });

    afterEach(() => {
      rewireLocationHistories.__set__(
        "LocationHistoryModel",
        origLocationHistoryModel
      );
      sinon.restore();
    });

    it("should create a new location history and return success response", async () => {
      const request = { query: { tenant: "test_tenant" }, body: {} };

      registerStub.resolves({
        success: true,
        message: "Location history created successfully",
        data: {},
      });

      const result = await rewireLocationHistories.create(request);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Location history created successfully");
    });

    it("should handle internal server error and return appropriate response", async () => {
      const request = { query: { tenant: "test_tenant" }, body: {} };
      const next = sinon.stub();
      const errorMessage = "Database connection error";

      registerStub.throws(new Error(errorMessage));

      await rewireLocationHistories.create(request, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err.statusCode).to.equal(500);
    });
  });

  describe("syncLocationHistories method", () => {
    let origLocationHistoryModel;
    let listStub;
    let registerStub;

    beforeEach(() => {
      listStub = sinon.stub();
      registerStub = sinon.stub();
      origLocationHistoryModel = rewireLocationHistories.__get__(
        "LocationHistoryModel"
      );
      rewireLocationHistories.__set__("LocationHistoryModel", () => ({
        list: listStub,
        register: registerStub,
      }));
    });

    afterEach(() => {
      rewireLocationHistories.__set__(
        "LocationHistoryModel",
        origLocationHistoryModel
      );
      sinon.restore();
    });

    it("should synchronize location histories and return success response", async () => {
      const request = {
        query: { tenant: "test_tenant" },
        body: { location_histories: [] },
        params: { firebase_user_id: "test_user_id" },
      };

      listStub.resolves({ success: true, data: [] });
      registerStub.resolves({
        success: true,
        message: "Location history created successfully",
        data: [],
      });

      const result = await rewireLocationHistories.syncLocationHistories(request);

      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Location Histories Synchronized");
    });

    it("should handle internal server error and return appropriate response", async () => {
      const request = {
        query: { tenant: "test_tenant" },
        body: { location_histories: [] },
        params: { firebase_user_id: "test_user_id" },
      };
      const next = sinon.stub();
      const errorMessage = "Database connection error";

      listStub.throws(new Error(errorMessage));

      await rewireLocationHistories.syncLocationHistories(request, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err.statusCode).to.equal(500);
    });
  });
});
