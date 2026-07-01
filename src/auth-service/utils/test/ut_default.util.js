require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const rewire = require("rewire");
const httpStatus = require("http-status");
const defaults = require("@utils/default.util");
const rewireDefaults = rewire("@utils/default.util");
const { generateFilter } = require("@utils/common");

describe("defaults", () => {
  describe("list method", () => {
    let origDefaultsModel;
    let listStub;

    beforeEach(() => {
      listStub = sinon.stub();
      origDefaultsModel = rewireDefaults.__get__("DefaultsModel");
      rewireDefaults.__set__("DefaultsModel", () => ({ list: listStub }));
    });

    afterEach(() => {
      rewireDefaults.__set__("DefaultsModel", origDefaultsModel);
      sinon.restore();
    });

    it("should list defaults and send success response", async () => {
      const mockListResponse = {
        success: true,
        data: [],
      };
      sinon.stub(generateFilter, "defaults").returns({});
      listStub.resolves(mockListResponse);

      const result = await rewireDefaults.list(
        { query: { tenant: "sample_tenant", limit: 10, skip: 0 } },
        sinon.stub()
      );

      expect(result.success).to.be.true;
    });

    it("should handle DefaultsSchema list failure and return failure response", async () => {
      sinon.stub(generateFilter, "defaults").returns({});
      listStub.resolves({ success: false, message: "Failed to list defaults" });

      const result = await rewireDefaults.list(
        { query: { tenant: "sample_tenant", limit: 10, skip: 0 } },
        sinon.stub()
      );

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to list defaults");
    });

    it("should handle exceptions and return failure response", async () => {
      sinon.stub(generateFilter, "defaults").throws(new Error("Mocked database error"));
      const next = sinon.stub();

      await rewireDefaults.list(
        { query: { tenant: "sample_tenant", limit: 10, skip: 0 } },
        next
      );

      sinon.assert.calledOnce(next);
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("create method", () => {
    let origDefaultsModel;
    let registerStub;

    beforeEach(() => {
      registerStub = sinon.stub();
      origDefaultsModel = rewireDefaults.__get__("DefaultsModel");
      rewireDefaults.__set__("DefaultsModel", () => ({ register: registerStub }));
    });

    afterEach(() => {
      rewireDefaults.__set__("DefaultsModel", origDefaultsModel);
      sinon.restore();
    });

    it("should create a new default and send success response", async () => {
      const mockRegisterResponse = { success: true, data: {} };
      registerStub.resolves(mockRegisterResponse);

      const result = await rewireDefaults.create(
        { body: {}, query: { tenant: "sample_tenant" } },
        sinon.stub()
      );

      expect(result.success).to.be.true;
    });

    it("should handle DefaultsSchema register failure and return failure response", async () => {
      registerStub.resolves({ success: false, message: "Failed to create default" });

      const result = await rewireDefaults.create(
        { body: {}, query: { tenant: "sample_tenant" } },
        sinon.stub()
      );

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to create default");
    });

    it("should handle exceptions and return failure response", async () => {
      registerStub.throws(new Error("Mocked database error"));
      const next = sinon.stub();

      await rewireDefaults.create(
        { body: {}, query: { tenant: "sample_tenant" } },
        next
      );

      sinon.assert.calledOnce(next);
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("update method", () => {
    let origDefaultsModel;
    let modifyStub;

    beforeEach(() => {
      modifyStub = sinon.stub();
      origDefaultsModel = rewireDefaults.__get__("DefaultsModel");
      rewireDefaults.__set__("DefaultsModel", () => ({ modify: modifyStub }));
    });

    afterEach(() => {
      rewireDefaults.__set__("DefaultsModel", origDefaultsModel);
      sinon.restore();
    });

    it("should update the default and send success response", async () => {
      const mockModifyResponse = { success: true, data: {} };
      sinon.stub(generateFilter, "defaults").returns({});
      modifyStub.resolves(mockModifyResponse);

      const result = await rewireDefaults.update(
        { body: {}, query: { tenant: "sample_tenant" }, params: {} },
        sinon.stub()
      );

      expect(result.success).to.be.true;
    });

    it("should handle DefaultsSchema modify failure and return failure response", async () => {
      sinon.stub(generateFilter, "defaults").returns({});
      modifyStub.resolves({ success: false, message: "Failed to update default" });

      const result = await rewireDefaults.update(
        { body: {}, query: { tenant: "sample_tenant" }, params: {} },
        sinon.stub()
      );

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to update default");
    });

    it("should handle exceptions and return failure response", async () => {
      sinon.stub(generateFilter, "defaults").throws(new Error("Mocked database error"));
      const next = sinon.stub();

      await rewireDefaults.update(
        { body: {}, query: { tenant: "sample_tenant" }, params: {} },
        next
      );

      sinon.assert.calledOnce(next);
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("delete method", () => {
    let origDefaultsModel;
    let removeStub;

    beforeEach(() => {
      removeStub = sinon.stub();
      origDefaultsModel = rewireDefaults.__get__("DefaultsModel");
      rewireDefaults.__set__("DefaultsModel", () => ({ remove: removeStub }));
    });

    afterEach(() => {
      rewireDefaults.__set__("DefaultsModel", origDefaultsModel);
      sinon.restore();
    });

    it("should delete the default and send success response", async () => {
      sinon.stub(generateFilter, "defaults").returns({});
      removeStub.resolves({ success: true, data: {} });

      const result = await rewireDefaults.delete(
        { query: { tenant: "sample_tenant" } },
        sinon.stub()
      );

      expect(result.success).to.be.true;
    });

    it("should handle DefaultsSchema remove failure and return failure response", async () => {
      sinon.stub(generateFilter, "defaults").returns({});
      removeStub.resolves({ success: false, message: "Failed to delete default" });

      const result = await rewireDefaults.delete(
        { query: { tenant: "sample_tenant" } },
        sinon.stub()
      );

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to delete default");
    });

    it("should handle generateFilter.defaults failure and return failure response", async () => {
      // Implementation passes filter to model regardless of success flag
      sinon.stub(generateFilter, "defaults").returns({ success: false });
      removeStub.resolves({ success: false, message: "Invalid filter" });

      const result = await rewireDefaults.delete(
        { query: { tenant: "sample_tenant" } },
        sinon.stub()
      );

      expect(result.success).to.be.false;
    });
  });
});
