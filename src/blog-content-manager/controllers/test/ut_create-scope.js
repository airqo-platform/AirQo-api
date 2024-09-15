require("module-alias/register");
const sinon = require("sinon");
const { expect } = require("chai");
const { validationResult } = require("express-validator");
const createScope = require("@controllers/create-scope");
const controlAccessUtil = require("@utils/control-access");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const { logObject } = require("@utils/log");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const isEmpty = require("is-empty");

describe("createScope", () => {
  describe("create", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon.stub(createScope, "badRequest").returns(res);
      controlAccessUtilStub = sinon.stub(controlAccessUtil, "createScope");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
    });

    it("should create scope for default tenant", async () => {
      req.query.tenant = "default-tenant"; // Set the tenant for the request.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: "createdScope1", // Set the created scope returned by the controlAccessUtil.
      });

      await createScope.create(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Scope created successfully",
          created_scope: "createdScope1",
        })
      ).to.be.true;
    });

    it("should create scope for custom tenant", async () => {
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: "createdScope2", // Set the created scope returned by the controlAccessUtil.
      });

      await createScope.create(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Scope created successfully",
          created_scope: "createdScope2",
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await createScope.create(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle scope creation failure and return internal server error", async () => {
      const error = new Error("Failed to create scope.");
      controlAccessUtilStub.rejects(error);

      await createScope.create(req, res);

      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
          success: false,
        })
      ).to.be.true;
    });
  });

  describe("list", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon.stub(listScope, "badRequest").returns(res);
      controlAccessUtilStub = sinon.stub(controlAccessUtil, "listScope");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
    });

    it("should list scopes for default tenant", async () => {
      req.query.tenant = "default-tenant"; // Set the tenant for the request.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: ["scope1", "scope2"], // Set the list of scopes returned by the controlAccessUtil.
      });

      await listScope.list(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Scopes listed successfully",
          scopes: ["scope1", "scope2"],
        })
      ).to.be.true;
    });

    it("should list scopes for custom tenant", async () => {
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: ["scope3", "scope4"], // Set the list of scopes returned by the controlAccessUtil.
      });

      await listScope.list(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Scopes listed successfully",
          scopes: ["scope3", "scope4"],
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await listScope.list(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle scope listing failure and return internal server error", async () => {
      const error = new Error("Failed to list scopes.");
      controlAccessUtilStub.rejects(error);

      await listScope.list(req, res);

      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
          success: false,
        })
      ).to.be.true;
    });
  });

  describe("delete", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon.stub(deleteScope, "badRequest").returns(res);
      controlAccessUtilStub = sinon.stub(controlAccessUtil, "deleteScope");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
    });

    it("should delete a scope for default tenant", async () => {
      req.query.tenant = "default-tenant"; // Set the tenant for the request.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: "scope1", // Set the scope deleted by the controlAccessUtil.
      });

      await deleteScope.delete(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Scope deleted successfully",
          deleted_scope: "scope1",
        })
      ).to.be.true;
    });

    it("should delete a scope for custom tenant", async () => {
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: "scope2", // Set the scope deleted by the controlAccessUtil.
      });

      await deleteScope.delete(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Scope deleted successfully",
          deleted_scope: "scope2",
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await deleteScope.delete(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle scope deletion failure and return internal server error", async () => {
      const error = new Error("Failed to delete scope.");
      controlAccessUtilStub.rejects(error);

      await deleteScope.delete(req, res);

      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
          success: false,
        })
      ).to.be.true;
    });
  });

  describe("update", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon.stub(updateScope, "badRequest").returns(res);
      controlAccessUtilStub = sinon.stub(controlAccessUtil, "updateScope");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
    });

    it("should update a scope for default tenant", async () => {
      req.query.tenant = "default-tenant"; // Set the tenant for the request.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: "updated_scope1", // Set the scope updated by the controlAccessUtil.
      });

      await updateScope.update(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Scope updated successfully",
          updated_scope: "updated_scope1",
        })
      ).to.be.true;
    });

    it("should update a scope for custom tenant", async () => {
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: "updated_scope2", // Set the scope updated by the controlAccessUtil.
      });

      await updateScope.update(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          success: true,
          message: "Scope updated successfully",
          updated_scope: "updated_scope2",
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await updateScope.update(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle scope update failure and return internal server error", async () => {
      const error = new Error("Failed to update scope.");
      controlAccessUtilStub.rejects(error);

      await updateScope.update(req, res);

      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
          success: false,
        })
      ).to.be.true;
    });
  });
});
