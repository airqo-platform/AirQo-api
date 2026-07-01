require("module-alias/register");
const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
const rewire = require("rewire");
const httpStatus = require("http-status");
const { generateFilter } = require("@utils/common");
const ChecklistModel = require("@models/Checklist");
const ObjectId = require("mongoose").Types.ObjectId;
const chaiHttp = require("chai-http");
chai.use(chaiHttp);
const createChecklisteUtil = require("@utils/checklist.util");
const rewireChecklisteUtil = rewire("@utils/checklist.util");
const UserModel = require("@models/User");

describe("create checklist UTIL", () => {
  describe("list()", () => {
    let request;
    let listStub;
    let generateFilterStub;
    let origChecklistModel;

    beforeEach(() => {
      request = {
        query: { tenant: "tenant1", limit: 10, skip: 0 },
      };
      listStub = sinon.stub();
      origChecklistModel = rewireChecklisteUtil.__get__("ChecklistModel");
      rewireChecklisteUtil.__set__("ChecklistModel", () => ({ list: listStub }));
      generateFilterStub = sinon.stub(generateFilter, "checklists");
    });

    afterEach(() => {
      rewireChecklisteUtil.__set__("ChecklistModel", origChecklistModel);
      sinon.restore();
    });

    it("should return filterResponse when filterResponse.success is false", async () => {
      const filterResponse = { success: false };
      generateFilterStub.returns(filterResponse);
      listStub.resolves({ success: false });

      const result = await rewireChecklisteUtil.list(request);
      expect(result).to.have.property("success", false);
    });

    it("should return the result of ChecklistModel.list when filterResponse.success is true", async () => {
      const filterResponse = { success: true, filter: {} };
      const listResult = { success: true, data: [] };
      listStub.resolves(listResult);
      generateFilterStub.returns(filterResponse);

      const result = await rewireChecklisteUtil.list(request);
      expect(result).to.equal(listResult);
    });

    it("should return an error response when an error is thrown", async () => {
      const error = new Error("Test error");
      generateFilterStub.returns({ success: true, filter: {} });
      listStub.rejects(error);
      const next = sinon.stub();

      await rewireChecklisteUtil.list(request, next);
      expect(next.called).to.be.true;
    });
  });
  describe("create()", () => {
    let request;
    let findByIdStub;
    let registerStub;
    let origChecklistModel;
    let origUserModel;

    beforeEach(() => {
      request = {
        body: { user: "user1" },
        query: { tenant: "tenant1" },
      };
      findByIdStub = sinon.stub().returns({ lean: sinon.stub().resolves(null) });
      registerStub = sinon.stub();
      origChecklistModel = rewireChecklisteUtil.__get__("ChecklistModel");
      origUserModel = rewireChecklisteUtil.__get__("UserModel");
      rewireChecklisteUtil.__set__("ChecklistModel", () => ({ register: registerStub }));
      rewireChecklisteUtil.__set__("UserModel", () => ({ findById: findByIdStub }));
    });

    afterEach(() => {
      rewireChecklisteUtil.__set__("ChecklistModel", origChecklistModel);
      rewireChecklisteUtil.__set__("UserModel", origUserModel);
      sinon.restore();
    });

    it("should return an error response when user_id is empty", async () => {
      request.body.user = "";
      const next = sinon.stub();

      const result = await rewireChecklisteUtil.create(request, next);
      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should return an error response when user is not found", async () => {
      findByIdStub.returns({ lean: sinon.stub().resolves(null) });
      const next = sinon.stub();

      const result = await rewireChecklisteUtil.create(request, next);
      expect(result).to.have.property("success", false);
    });

    it("should return the result of ChecklistModel.register when user is found", async () => {
      const user = { _id: "user1" };
      findByIdStub.returns({ lean: sinon.stub().resolves(user) });
      const registerResult = { success: true };
      registerStub.resolves(registerResult);
      const next = sinon.stub();

      const result = await rewireChecklisteUtil.create(request, next);
      expect(result).to.equal(registerResult);
    });

    it("should return an error response when an error is thrown", async () => {
      findByIdStub.returns({ lean: sinon.stub().rejects(new Error("Test error")) });
      const next = sinon.stub();

      await rewireChecklisteUtil.create(request, next);
      expect(next.called).to.be.true;
    });
  });
  describe("update()", () => {
    let request;
    let modifyStub;
    let generateFilterStub;
    let origChecklistModel;

    beforeEach(() => {
      request = {
        query: { tenant: "tenant1" },
        body: { user: "user1" },
      };
      modifyStub = sinon.stub();
      origChecklistModel = rewireChecklisteUtil.__get__("ChecklistModel");
      rewireChecklisteUtil.__set__("ChecklistModel", () => ({ modify: modifyStub }));
      generateFilterStub = sinon.stub(generateFilter, "checklists");
    });

    afterEach(() => {
      rewireChecklisteUtil.__set__("ChecklistModel", origChecklistModel);
      sinon.restore();
    });

    it("should return filterResponse when filterResponse.success is false", async () => {
      generateFilterStub.returns({ success: false });
      modifyStub.resolves({ success: false });

      const result = await rewireChecklisteUtil.update(request);
      expect(result).to.have.property("success", false);
    });

    it("should return the result of ChecklistModel.modify when filterResponse.success is true", async () => {
      const modifyResult = { success: true };
      generateFilterStub.returns({ success: true, filter: {} });
      modifyStub.resolves(modifyResult);

      const result = await rewireChecklisteUtil.update(request);
      expect(result).to.equal(modifyResult);
    });

    it("should return an error response when an error is thrown", async () => {
      generateFilterStub.returns({ success: true, filter: {} });
      modifyStub.rejects(new Error("Test error"));
      const next = sinon.stub();

      await rewireChecklisteUtil.update(request, next);
      expect(next.called).to.be.true;
    });
  });
  describe("upsert()", () => {
    let request;
    let findOneAndUpdateStub;
    let generateFilterStub;
    let origChecklistModel;

    beforeEach(() => {
      request = {
        query: { tenant: "tenant1" },
        body: { user: "user1" },
      };
      findOneAndUpdateStub = sinon.stub();
      origChecklistModel = rewireChecklisteUtil.__get__("ChecklistModel");
      rewireChecklisteUtil.__set__("ChecklistModel", () => ({ findOneAndUpdate: findOneAndUpdateStub }));
      generateFilterStub = sinon.stub(generateFilter, "checklists");
    });

    afterEach(() => {
      rewireChecklisteUtil.__set__("ChecklistModel", origChecklistModel);
      sinon.restore();
    });

    it("should return filterResponse when filterResponse.success is false", async () => {
      generateFilterStub.returns({ success: false });
      findOneAndUpdateStub.resolves(null);

      const result = await rewireChecklisteUtil.upsert(request);
      expect(result).to.have.property("success", false);
    });

    it("should return the result of ChecklistModel.findOneAndUpdate when filterResponse.success is true", async () => {
      const modifyResult = { success: true };
      generateFilterStub.returns({ success: true, filter: {} });
      findOneAndUpdateStub.resolves(modifyResult);

      const result = await rewireChecklisteUtil.upsert(request);
      expect(result).to.have.property("success", true);
    });

    it("should return an error response when an error is thrown", async () => {
      generateFilterStub.returns({ success: true, filter: {} });
      findOneAndUpdateStub.rejects(new Error("Test error"));
      const next = sinon.stub();

      await rewireChecklisteUtil.upsert(request, next);
      expect(next.called).to.be.true;
    });
  });
  describe.skip("delete()", () => {
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
