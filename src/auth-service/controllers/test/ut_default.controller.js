require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const rewire = require("rewire");
const defaultUtil = require("@utils/default.util");

// Use rewire so we can inject extractErrorsFromRequest for bad-request tests
const defaults = rewire("@controllers/default.controller");

describe("defaults controller", () => {
  let req, res, next;

  beforeEach(() => {
    req = { query: { tenant: "airqo" }, body: { key: "value" } };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
      headersSent: false,
    };
    next = sinon.stub();
  });

  afterEach(() => {
    sinon.restore();
    // Reset extractErrorsFromRequest to the real one after each test
    defaults.__set__("extractErrorsFromRequest", require("@utils/shared").extractErrorsFromRequest);
  });

  describe("update()", () => {
    it("should update default successfully", async () => {
      sinon.stub(defaultUtil, "update").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Default updated successfully",
        data: { key: "value" },
      });

      await defaults.update(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        success: true,
        message: "Default updated successfully",
        default: { key: "value" },
      })).to.be.true;
    });

    it("should handle default update failure", async () => {
      sinon.stub(defaultUtil, "update").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to update default",
        errors: { message: "Default update error" },
      });

      await defaults.update(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
      expect(res.json.calledWith({
        success: false,
        message: "Failed to update default",
        default: undefined,
        errors: { message: "Default update error" },
      })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      defaults.__set__("extractErrorsFromRequest", () => [{ param: "key", message: "required" }]);

      await defaults.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(defaultUtil, "update").rejects(new Error("Some unexpected error"));

      await defaults.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("create()", () => {
    it("should create default successfully", async () => {
      sinon.stub(defaultUtil, "create").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Default created successfully",
        data: { key: "value" },
      });

      await defaults.create(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        success: true,
        message: "Default created successfully",
        default: { key: "value" },
      })).to.be.true;
    });

    it("should handle default creation failure", async () => {
      sinon.stub(defaultUtil, "create").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to create default",
        errors: { message: "Default creation error" },
      });

      await defaults.create(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
      expect(res.json.calledWith({
        success: false,
        message: "Failed to create default",
        default: undefined,
        errors: { message: "Default creation error" },
      })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      defaults.__set__("extractErrorsFromRequest", () => [{ param: "key", message: "required" }]);

      await defaults.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(defaultUtil, "create").rejects(new Error("Some unexpected error"));

      await defaults.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("list()", () => {
    it("should list all defaults by query params provided", async () => {
      req = { query: { tenant: "airqo", limit: 10, skip: 0 }, body: {} };
      sinon.stub(defaultUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Defaults listed successfully",
        data: [{ key: "value" }],
      });

      await defaults.list(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        success: true,
        message: "Defaults listed successfully",
        defaults: [{ key: "value" }],
      })).to.be.true;
    });

    it("should handle listing defaults failure", async () => {
      sinon.stub(defaultUtil, "list").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to list defaults",
        errors: { message: "Defaults listing error" },
      });

      await defaults.list(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
      expect(res.json.calledWith({
        success: false,
        message: "Failed to list defaults",
        errors: { message: "Defaults listing error" },
      })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      defaults.__set__("extractErrorsFromRequest", () => [{ param: "key", message: "required" }]);

      await defaults.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(defaultUtil, "list").rejects(new Error("Some unexpected error"));

      await defaults.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("delete()", () => {
    it("should delete the default", async () => {
      sinon.stub(defaultUtil, "delete").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Default deleted successfully",
        data: { key: "value" },
      });

      await defaults.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        success: true,
        message: "Default deleted successfully",
        default: { key: "value" },
      })).to.be.true;
    });

    it("should handle delete failure", async () => {
      sinon.stub(defaultUtil, "delete").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to delete default",
        errors: { message: "Default deletion error" },
      });

      await defaults.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
      expect(res.json.calledWith({
        success: false,
        message: "Failed to delete default",
        default: undefined,
        errors: { message: "Default deletion error" },
      })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      defaults.__set__("extractErrorsFromRequest", () => [{ param: "key", message: "required" }]);

      await defaults.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(defaultUtil, "delete").rejects(new Error("Some unexpected error"));

      await defaults.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
