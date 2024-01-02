require("module-alias/register");
const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
const httpStatus = require("http-status");
const accessCodeGenerator = require("generate-password");
const constants = require("@config/constants");
const generateFilter = require("@utils/generate-filter");
const PreferenceModel = require("@models/Preference");
const ObjectId = require("mongoose").Types.ObjectId;
const chaiHttp = require("chai-http");
chai.use(chaiHttp);
const createPreferenceUtil = require("@utils/create-preference");
const UserModel = require("@models/User");

describe("create preference UTIL", function () {
  describe("list function", function () {
    let request;
    let filterResponse;
    let listStub;
    let generateFilterStub;

    beforeEach(function () {
      request = {
        query: { tenant: "tenant1", limit: 10, skip: 0 },
      };
      filterResponse = { success: true, filter: {} };
      listStub = sinon.stub(PreferenceModel.prototype, "list");
      generateFilterStub = sinon.stub(generateFilter, "preferences");
    });

    afterEach(function () {
      listStub.restore();
      generateFilterStub.restore();
    });

    it("should return filterResponse when filterResponse.success is false", async function () {
      filterResponse.success = false;
      generateFilterStub.returns(filterResponse);

      const result = await createPreferenceUtil.list(request);
      expect(result).to.equal(filterResponse);
    });

    it("should return the result of PreferenceModel.list when filterResponse.success is true", async function () {
      const listResult = "list result";
      listStub.resolves(listResult);
      generateFilterStub.returns(filterResponse);

      const result = await createPreferenceUtil.list(request);
      expect(result).to.equal(listResult);
    });

    it("should return an error response when an error is thrown", async function () {
      const error = new Error("Test error");
      listStub.rejects(error);
      generateFilterStub.returns(filterResponse);

      const result = await createPreferenceUtil.list(request);
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });
  describe("create function", function () {
    let request;
    let findByIdStub;
    let registerStub;

    beforeEach(function () {
      request = {
        body: { user: "user1" },
        query: { tenant: "tenant1" },
      };
      findByIdStub = sinon.stub(UserModel.prototype, "findById");
      registerStub = sinon.stub(PreferenceModel.prototype, "register");
    });

    afterEach(function () {
      findByIdStub.restore();
      registerStub.restore();
    });

    it("should return an error response when user_id is empty", async function () {
      request.body.user = "";

      const result = await createPreferenceUtil.create(request);
      expect(result).to.deep.equal({
        success: false,
        message: "Bad Request Error",
        errors: {
          message: "The provided User does not exist",
          value: "",
        },
        status: httpStatus.BAD_REQUEST,
      });
    });

    it("should return an error response when user is not found", async function () {
      findByIdStub.resolves(null);

      const result = await createPreferenceUtil.create(request);
      expect(result).to.deep.equal({
        success: false,
        message: "Bad Request Error",
        errors: {
          message: "The provided User does not exist",
          value: "user1",
        },
        status: httpStatus.BAD_REQUEST,
      });
    });

    it("should return the result of PreferenceModel.register when user is found", async function () {
      const user = { _id: "user1" };
      const registerResult = { success: true };
      findByIdStub.resolves(user);
      registerStub.resolves(registerResult);

      const result = await createPreferenceUtil.create(request);
      expect(result).to.equal(registerResult);
    });

    it("should return an error response when an error is thrown", async function () {
      const error = new Error("Test error");
      findByIdStub.rejects(error);

      const result = await createPreferenceUtil.create(request);
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });
  describe("update function", function () {
    let request;
    let modifyStub;
    let generateFilterStub;

    beforeEach(function () {
      request = {
        query: { tenant: "tenant1" },
        body: { user: "user1" },
      };
      modifyStub = sinon.stub(PreferenceModel.prototype, "modify");
      generateFilterStub = sinon.stub(generateFilter, "preferences");
    });

    afterEach(function () {
      modifyStub.restore();
      generateFilterStub.restore();
    });

    it("should return filterResponse when filterResponse.success is false", async function () {
      const filterResponse = { success: false };
      generateFilterStub.returns(filterResponse);

      const result = await createPreferenceUtil.update(request);
      expect(result).to.equal(filterResponse);
    });

    it("should return the result of PreferenceModel.modify when filterResponse.success is true", async function () {
      const filterResponse = { success: true, filter: {} };
      const modifyResult = { success: true };
      generateFilterStub.returns(filterResponse);
      modifyStub.resolves(modifyResult);

      const result = await createPreferenceUtil.update(request);
      expect(result).to.equal(modifyResult);
    });

    it("should return an error response when an error is thrown", async function () {
      const error = new Error("Test error");
      generateFilterStub.returns({ success: true, filter: {} });
      modifyStub.rejects(error);

      const result = await createPreferenceUtil.update(request);
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });
  describe("upsert function", function () {
    let request;
    let findOneAndUpdateStub;
    let generateFilterStub;

    beforeEach(function () {
      request = {
        query: { tenant: "tenant1" },
        body: { user: "user1" },
      };
      findOneAndUpdateStub = sinon.stub(
        PreferenceModel.prototype,
        "findOneAndUpdate"
      );
      generateFilterStub = sinon.stub(generateFilter, "preferences");
    });

    afterEach(function () {
      findOneAndUpdateStub.restore();
      generateFilterStub.restore();
    });

    it("should return filterResponse when filterResponse.success is false", async function () {
      const filterResponse = { success: false };
      generateFilterStub.returns(filterResponse);

      const result = await createPreferenceUtil.upsert(request);
      expect(result).to.equal(filterResponse);
    });

    it("should return the result of PreferenceModel.findOneAndUpdate when filterResponse.success is true", async function () {
      const filterResponse = { success: true, filter: {} };
      const modifyResult = { success: true };
      generateFilterStub.returns(filterResponse);
      findOneAndUpdateStub.resolves(modifyResult);

      const result = await createPreferenceUtil.upsert(request);
      expect(result).to.deep.equal({
        success: true,
        message: "successfully created or updated a preference",
        data: modifyResult,
        status: httpStatus.OK,
      });
    });

    it("should return an error response when an error is thrown", async function () {
      const error = new Error("Test error");
      generateFilterStub.returns({ success: true, filter: {} });
      findOneAndUpdateStub.rejects(error);

      const result = await createPreferenceUtil.upsert(request);
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });
  describe("delete function", function () {
    let request;
    let removeStub;
    let generateFilterStub;

    beforeEach(function () {
      request = {
        query: { tenant: "tenant1" },
        body: { user: "user1" },
      };
      removeStub = sinon.stub(PreferenceModel.prototype, "remove");
      generateFilterStub = sinon.stub(generateFilter, "preferences");
    });

    afterEach(function () {
      removeStub.restore();
      generateFilterStub.restore();
    });

    it("should return responseFromFilter when responseFromFilter.success is false", async function () {
      const responseFromFilter = { success: false };
      generateFilterStub.returns(responseFromFilter);

      const result = await createPreferenceUtil.delete(request);
      expect(result).to.equal(responseFromFilter);
    });

    it("should return the result of PreferenceModel.remove when responseFromFilter.success is true", async function () {
      const responseFromFilter = { success: true, filter: {} };
      const removeResult = { success: true };
      generateFilterStub.returns(responseFromFilter);
      removeStub.resolves(removeResult);

      const result = await createPreferenceUtil.delete(request);
      expect(result).to.equal(removeResult);
    });

    it("should return an error response when an error is thrown", async function () {
      const error = new Error("Test error");
      generateFilterStub.returns({ success: true, filter: {} });
      removeStub.rejects(error);

      const result = await createPreferenceUtil.delete(request);
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });
});
