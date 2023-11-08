require("module-alias/register");
const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
const httpStatus = require("http-status");
const generateFilter = require("@utils/generate-filter");
const ChecklistModel = require("@models/Checklist");
const ObjectId = require("mongoose").Types.ObjectId;
const chaiHttp = require("chai-http");
chai.use(chaiHttp);
const createChecklisteUtil = require("@utils/create-checklist");
const UserModel = require("@models/User");

describe("create checklist UTIL", () => {
  describe("list()", () => {
    let request;
    let listStub;
    let generateFilterStub;

    beforeEach(() => {
      request = {
        query: { tenant: "tenant1", limit: 10, skip: 0 },
      };
      listStub = sinon.stub(ChecklistModel.prototype, "list");
      generateFilterStub = sinon.stub(generateFilter, "checklists");
    });

    afterEach(() => {
      listStub.restore();
      generateFilterStub.restore();
    });

    it("should return filterResponse when filterResponse.success is false", async () => {
      const filterResponse = { success: false };
      generateFilterStub.returns(filterResponse);

      const result = await createChecklisteUtil.list(request);
      expect(result).to.equal(filterResponse);
    });

    it("should return the result of ChecklistModel.list when filterResponse.success is true", async () => {
      const filterResponse = { success: true, filter: {} };
      const listResult = "list result";
      listStub.resolves(listResult);
      generateFilterStub.returns(filterResponse);

      const result = await createChecklisteUtil.list(request);
      expect(result).to.equal(listResult);
    });

    it("should return an error response when an error is thrown", async () => {
      const error = new Error("Test error");
      generateFilterStub.returns({ success: true, filter: {} });
      listStub.rejects(error);

      const result = await createChecklisteUtil.list(request);
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });
  describe("create()", () => {
    let request;
    let findByIdStub;
    let registerStub;

    beforeEach(() => {
      request = {
        body: { user: "user1" },
        query: { tenant: "tenant1" },
      };
      findByIdStub = sinon.stub(UserModel.prototype, "findById");
      registerStub = sinon.stub(ChecklistModel.prototype, "register");
    });

    afterEach(() => {
      findByIdStub.restore();
      registerStub.restore();
    });

    it("should return an error response when user_id is empty", async () => {
      request.body.user = "";

      const result = await createChecklisteUtil.create(request);
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

    it("should return an error response when user is not found", async () => {
      findByIdStub.resolves(null);

      const result = await createChecklisteUtil.create(request);
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

    it("should return the result of ChecklistModel.register when user is found", async () => {
      const user = { _id: "user1" };
      const registerResult = { success: true };
      findByIdStub.resolves(user);
      registerStub.resolves(registerResult);

      const result = await createChecklisteUtil.create(request);
      expect(result).to.equal(registerResult);
    });

    it("should return an error response when an error is thrown", async () => {
      const error = new Error("Test error");
      findByIdStub.rejects(error);

      const result = await createChecklisteUtil.create(request);
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });
  describe("update()", () => {
    let request;
    let modifyStub;
    let generateFilterStub;

    beforeEach(() => {
      request = {
        query: { tenant: "tenant1" },
        body: { user: "user1" },
      };
      modifyStub = sinon.stub(ChecklistModel.prototype, "modify");
      generateFilterStub = sinon.stub(generateFilter, "checklists");
    });

    afterEach(() => {
      modifyStub.restore();
      generateFilterStub.restore();
    });

    it("should return filterResponse when filterResponse.success is false", async () => {
      const filterResponse = { success: false };
      generateFilterStub.returns(filterResponse);

      const result = await createChecklisteUtil.update(request);
      expect(result).to.equal(filterResponse);
    });

    it("should return the result of ChecklistModel.modify when filterResponse.success is true", async () => {
      const filterResponse = { success: true, filter: {} };
      const modifyResult = { success: true };
      generateFilterStub.returns(filterResponse);
      modifyStub.resolves(modifyResult);

      const result = await createChecklisteUtil.update(request);
      expect(result).to.equal(modifyResult);
    });

    it("should return an error response when an error is thrown", async () => {
      const error = new Error("Test error");
      generateFilterStub.returns({ success: true, filter: {} });
      modifyStub.rejects(error);

      const result = await createChecklisteUtil.update(request);
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });
  describe("upsert()", () => {
    let request;
    let findOneAndUpdateStub;
    let generateFilterStub;

    beforeEach(() => {
      request = {
        query: { tenant: "tenant1" },
        body: { user: "user1" },
      };
      findOneAndUpdateStub = sinon.stub(
        ChecklistModel.prototype,
        "findOneAndUpdate"
      );
      generateFilterStub = sinon.stub(generateFilter, "checklists");
    });

    afterEach(() => {
      findOneAndUpdateStub.restore();
      generateFilterStub.restore();
    });

    it("should return filterResponse when filterResponse.success is false", async () => {
      const filterResponse = { success: false };
      generateFilterStub.returns(filterResponse);

      const result = await createChecklisteUtil.upsert(request);
      expect(result).to.equal(filterResponse);
    });

    it("should return the result of ChecklistModel.findOneAndUpdate when filterResponse.success is true", async () => {
      const filterResponse = { success: true, filter: {} };
      const modifyResult = { success: true };
      generateFilterStub.returns(filterResponse);
      findOneAndUpdateStub.resolves(modifyResult);

      const result = await createChecklisteUtil.upsert(request);
      expect(result).to.deep.equal({
        success: true,
        message: "successfully created or updated a checklist",
        data: modifyResult,
        status: httpStatus.OK,
      });
    });

    it("should return an error response when an error is thrown", async () => {
      const error = new Error("Test error");
      generateFilterStub.returns({ success: true, filter: {} });
      findOneAndUpdateStub.rejects(error);

      const result = await createChecklisteUtil.upsert(request);
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });
  describe("delete()", () => {
    it("should createChecklisteUtil.delete a checklist successfully", async () => {
      // Stub generateFilter.checklists to return a successful response
      const generateFilter = {
        checklists: sinon.stub().resolves({ success: true }),
      };

      // Stub ChecklistModel(tenant).remove to return a successful response
      const ChecklistModel = {
        remove: sinon.stub().resolves({ success: true }),
      };

      // Mock request object
      const request = {
        query: { tenant: "sampleTenant" },
      };

      // Call the createChecklisteUtil.delete function
      const result = await createChecklisteUtil.delete(
        request,
        generateFilter,
        ChecklistModel
      );

      // Assert the result
      expect(result).to.deep.equal({ success: true });

      // Verify that the stubs were called as expected
      sinon.assert.calledOnce(generateFilter.checklists);
      sinon.assert.calledWith(ChecklistModel.remove, {
        filter: { success: true },
      });
    });

    it("should handle an error from generateFilter.checklists", async () => {
      // Stub generateFilter.checklists to return an error response
      const generateFilter = {
        checklists: sinon.stub().rejects(new Error("Generate Filter Error")),
      };

      // Mock request object
      const request = {
        query: { tenant: "sampleTenant" },
      };

      // Call the createChecklisteUtil.delete function
      const result = await createChecklisteUtil.delete(
        request,
        generateFilter,
        ChecklistModel
      );

      // Assert the result
      expect(result).to.deep.equal({
        success: false,
        message: "Generate Filter Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: "Generate Filter Error" },
      });

      // Verify that generateFilter.checklists was called once
      sinon.assert.calledOnce(generateFilter.checklists);
    });

    it("should handle an error from ChecklistModel.remove", async () => {
      // Stub generateFilter.checklists to return a successful response
      const generateFilter = {
        checklists: sinon.stub().resolves({ success: true }),
      };

      // Stub ChecklistModel(tenant).remove to return an error response
      const ChecklistModel = {
        remove: sinon.stub().rejects(new Error("Remove Default Error")),
      };

      // Mock request object
      const request = {
        query: { tenant: "sampleTenant" },
      };

      // Call the createChecklisteUtil.delete function
      const result = await createChecklisteUtil.delete(
        request,
        generateFilter,
        ChecklistModel
      );

      // Assert the result
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: "Remove Default Error" },
      });

      // Verify that generateFilter.checklists and ChecklistModel.remove were called as expected
      sinon.assert.calledOnce(generateFilter.checklists);
      sinon.assert.calledWith(ChecklistModel.remove, {
        filter: { success: true },
      });
    });
  });
});
