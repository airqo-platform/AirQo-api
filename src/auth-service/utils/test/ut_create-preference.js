require("module-alias/register");
const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
const httpStatus = require("http-status");
const generateFilter = require("@utils/generate-filter");
const PreferenceModel = require("@models/Preference");
const chaiHttp = require("chai-http");
chai.use(chaiHttp);
const createPreferenceUtil = require("@utils/create-preference");
const UserModel = require("@models/User");
const sinonChai = require("sinon-chai");
const mongoose = require("mongoose");

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
  describe("selectedSites", () => {
    let SelectedSiteModel;

    beforeEach(() => {
      // Mock the SelectedSiteModel
      SelectedSiteModel = sinon.mock(mongoose.model("SelectedSite"));
    });

    afterEach(() => {
      // Restore the original SelectedSiteModel
      SelectedSiteModel.restore();
    });

    describe("addSelectedSites", () => {
      it("should add selected sites successfully", async () => {
        const request = {
          query: { tenant: "testTenant" },
          body: { selected_sites: [{ id: "site1" }, { id: "site2" }] },
        };
        const next = sinon.spy();

        SelectedSiteModel.insertMany.resolves([
          { _id: "site1" },
          { _id: "site2" },
        ]);

        const result =
          await require("@utils/create-preferences").addSelectedSites(
            request,
            next
          );

        expect(result).to.deep.equal({
          success: true,
          message: "Successfully added 2 selected sites. 0 failed.",
          data: [{ _id: "site1" }, { _id: "site2" }],
          status: 200,
        });
        expect(next).not.to.have.been.called;
      });

      it("should handle duplicate key errors", async () => {
        const request = {
          query: { tenant: "testTenant" },
          body: { selected_sites: [{ id: "existingSite" }] },
        };
        const next = sinon.spy();

        SelectedSiteModel.insertMany.rejects(
          new mongoose.Error.ValidatorFailure()
        );

        const result =
          await require("@utils/create-preferences").addSelectedSites(
            request,
            next
          );

        expect(result).to.deep.equal({
          success: false,
          message: "One or more selected sites already exist.",
          details: { message: "ValidatorFailure: Path 'id' is required." },
          status: 409,
        });
        expect(next).not.to.have.been.called;
      });

      it("should handle other errors", async () => {
        const request = {
          query: { tenant: "testTenant" },
          body: { selected_sites: [{ id: "newSite" }] },
        };
        const next = sinon.spy();

        SelectedSiteModel.insertMany.rejects(new Error("MongoDB error"));

        const result =
          await require("@utils/create-preferences").addSelectedSites(
            request,
            next
          );

        expect(result).to.deep.equal({
          success: false,
          message: "Internal Server Error",
          errors: { message: "MongoDB error" },
          status: 500,
        });
        expect(next).to.have.been.calledOnce;
      });
    });

    describe("updateSelectedSite", () => {
      it("should update selected site successfully", async () => {
        const request = {
          query: { tenant: "testTenant", site_id: "site1" },
          params: { site_id: "site1" },
          body: { name: "Updated Name" },
        };
        const next = sinon.spy();

        SelectedSiteModel.modify.resolves({ modifiedCount: 1 });

        const result =
          await require("@utils/create-preferences").updateSelectedSite(
            request,
            next
          );

        expect(result).to.deep.equal({
          success: true,
          message: "Successfully updated 1 document(s)",
          modifiedCount: 1,
          status: 200,
        });
        expect(next).not.to.have.been.called;
      });

      it("should handle errors", async () => {
        const request = {
          query: { tenant: "testTenant", site_id: "site1" },
          params: { site_id: "site1" },
          body: { name: "Updated Name" },
        };
        const next = sinon.spy();

        SelectedSiteModel.modify.rejects(new Error("MongoDB error"));

        const result =
          await require("@utils/create-preferences").updateSelectedSite(
            request,
            next
          );

        expect(result).to.deep.equal({
          success: false,
          message: "Internal Server Error",
          errors: { message: "MongoDB error" },
          status: 500,
        });
        expect(next).to.have.been.calledOnce;
      });
    });

    describe("deleteSelectedSite", () => {
      it("should delete selected site successfully", async () => {
        const request = {
          query: { tenant: "testTenant", site_id: "site1" },
          params: { site_id: "site1" },
        };
        const next = sinon.spy();

        SelectedSiteModel.remove.resolves({ removedCount: 1 });

        const result =
          await require("@utils/create-preferences").deleteSelectedSite(
            request,
            next
          );

        expect(result).to.deep.equal({
          success: true,
          message: "Successfully deleted 1 document(s)",
          removedCount: 1,
          status: 200,
        });
        expect(next).not.to.have.been.called;
      });

      it("should handle errors", async () => {
        const request = {
          query: { tenant: "testTenant", site_id: "site1" },
          params: { site_id: "site1" },
        };
        const next = sinon.spy();

        SelectedSiteModel.remove.rejects(new Error("MongoDB error"));

        const result =
          await require("@utils/create-preferences").deleteSelectedSite(
            request,
            next
          );

        expect(result).to.deep.equal({
          success: false,
          message: "Service Temporarily Unavailable",
          errors: { message: "Service Temporarily Unavailable" },
          status: 503,
        });
        expect(next).to.have.been.calledOnce;
      });
    });
  });
});
