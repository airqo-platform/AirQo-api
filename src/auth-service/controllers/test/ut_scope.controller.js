require("module-alias/register");
const sinon = require("sinon");
const { expect } = require("chai");
const httpStatus = require("http-status");
const rewire = require("rewire");

const createScopeModule = rewire("@controllers/scope.controller");
const realExtractErrors = require("@utils/shared").extractErrorsFromRequest;
const mockBadRequest = () => [{ param: "key", message: "required" }];

// Get the HOF factory so we can create controllers with inline mock util functions
const scopeControllerFactory = createScopeModule.__get__("createScopeController");

describe("createScope", () => {
  let req, res, next;

  beforeEach(() => {
    req = { query: { tenant: "airqo" }, body: {}, params: {} };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
      headersSent: false,
    };
    next = sinon.stub();
  });

  afterEach(() => {
    sinon.restore();
    createScopeModule.__set__("extractErrorsFromRequest", realExtractErrors);
  });

  describe("create", () => {
    it("should create scope successfully", async () => {
      const controller = scopeControllerFactory(
        () => Promise.resolve({ success: true, status: httpStatus.OK, message: "Scope created successfully", data: "createdScope1" }),
        "created_scope"
      );

      await controller(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, created_scope: "createdScope1" })).to.be.true;
    });

    it("should handle validation errors and return bad request", async () => {
      createScopeModule.__set__("extractErrorsFromRequest", mockBadRequest);
      const controller = scopeControllerFactory(sinon.stub(), "created_scope");

      await controller(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle scope creation failure", async () => {
      const controller = scopeControllerFactory(
        () => Promise.resolve({ success: false, status: httpStatus.INTERNAL_SERVER_ERROR, message: "Failed", errors: { message: "Error" } }),
        "created_scope"
      );

      await controller(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      const controller = scopeControllerFactory(
        () => Promise.reject(new Error("Failed to create scope.")),
        "created_scope"
      );

      await controller(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("list", () => {
    it("should list scopes successfully", async () => {
      const controller = scopeControllerFactory(
        () => Promise.resolve({ success: true, status: httpStatus.OK, message: "Scopes listed", data: ["scope1", "scope2"] }),
        "scopes"
      );

      await controller(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, scopes: sinon.match.array })).to.be.true;
    });

    it("should handle validation errors and return bad request", async () => {
      createScopeModule.__set__("extractErrorsFromRequest", mockBadRequest);
      const controller = scopeControllerFactory(sinon.stub(), "scopes");

      await controller(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle scope listing failure", async () => {
      const controller = scopeControllerFactory(
        () => Promise.resolve({ success: false, status: httpStatus.INTERNAL_SERVER_ERROR, message: "Failed", errors: { message: "Error" } }),
        "scopes"
      );

      await controller(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      const controller = scopeControllerFactory(
        () => Promise.reject(new Error("Failed to list scopes.")),
        "scopes"
      );

      await controller(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("delete", () => {
    it("should delete a scope successfully", async () => {
      const controller = scopeControllerFactory(
        () => Promise.resolve({ success: true, status: httpStatus.OK, message: "Scope deleted", data: "scope1" }),
        "deleted_scope"
      );

      await controller(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, deleted_scope: "scope1" })).to.be.true;
    });

    it("should handle validation errors and return bad request", async () => {
      createScopeModule.__set__("extractErrorsFromRequest", mockBadRequest);
      const controller = scopeControllerFactory(sinon.stub(), "deleted_scope");

      await controller(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle scope deletion failure", async () => {
      const controller = scopeControllerFactory(
        () => Promise.resolve({ success: false, status: httpStatus.INTERNAL_SERVER_ERROR, message: "Failed", errors: { message: "Error" } }),
        "deleted_scope"
      );

      await controller(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      const controller = scopeControllerFactory(
        () => Promise.reject(new Error("Failed to delete scope.")),
        "deleted_scope"
      );

      await controller(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("update", () => {
    it("should update a scope successfully", async () => {
      const controller = scopeControllerFactory(
        () => Promise.resolve({ success: true, status: httpStatus.OK, message: "Scope updated", data: "updated_scope1" }),
        "updated_scope"
      );

      await controller(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, updated_scope: "updated_scope1" })).to.be.true;
    });

    it("should handle validation errors and return bad request", async () => {
      createScopeModule.__set__("extractErrorsFromRequest", mockBadRequest);
      const controller = scopeControllerFactory(sinon.stub(), "updated_scope");

      await controller(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle scope update failure", async () => {
      const controller = scopeControllerFactory(
        () => Promise.resolve({ success: false, status: httpStatus.INTERNAL_SERVER_ERROR, message: "Failed", errors: { message: "Error" } }),
        "updated_scope"
      );

      await controller(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      const controller = scopeControllerFactory(
        () => Promise.reject(new Error("Failed to update scope.")),
        "updated_scope"
      );

      await controller(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
