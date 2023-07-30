require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const expect = chai.expect;
const { validationResult } = require("express-validator");
const createSearchHistoryUtil = require("@utils/create-search-history");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const { logText, logObject } = require("@utils/log");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-search-history-controller`
);

const createSearchHistory = require("./your-create-search-history-file");

describe("createSearchHistory Controller", () => {
  describe("syncSearchHistory", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should sync search history and return success response", async () => {
      const req = { query: { tenant: "test_tenant" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const createSearchHistoryUtilStub = sinon
        .stub(createSearchHistoryUtil, "syncSearchHistories")
        .returns({
          success: true,
          status: httpStatus.OK,
          message: "Search Histories Synchronized",
          data: [{ id: "1", name: "Search History 1" }],
        });

      await createSearchHistoryController.syncSearchHistory(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(createSearchHistoryUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWithExactly(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWithExactly({
          success: true,
          message: "Search Histories Synchronized",
          search_histories: [{ id: "1", name: "Search History 1" }],
        })
      ).to.be.true;
    });

    it("should handle bad request errors", async () => {
      const req = { query: { tenant: "test_tenant" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(false);
      const validationResultErrorsStub = sinon
        .stub(validationResult, "errors")
        .returns([{ nestedErrors: [{ msg: "Error 1" }, { msg: "Error 2" }] }]);
      const badRequestStub = sinon.stub(global, "badRequest").returns({});

      await createSearchHistoryController.syncSearchHistory(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(validationResultErrorsStub.calledOnce).to.be.true;
      expect(
        badRequestStub.calledOnceWithExactly(res, "bad request errors", {
          nestedErrors: [{ msg: "Error 1" }, { msg: "Error 2" }],
        })
      ).to.be.true;
    });

    it("should handle internal server errors", async () => {
      const req = { query: { tenant: "test_tenant" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const createSearchHistoryUtilStub = sinon
        .stub(createSearchHistoryUtil, "syncSearchHistories")
        .throws(new Error("Some error message"));
      const loggerErrorStub = sinon.stub(console, "error");

      await createSearchHistoryController.syncSearchHistory(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(createSearchHistoryUtilStub.calledOnce).to.be.true;
      expect(loggerErrorStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWithExactly(httpStatus.INTERNAL_SERVER_ERROR))
        .to.be.true;
      expect(
        res.json.calledOnceWithExactly({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Some error message" },
        })
      ).to.be.true;
    });
  });
  describe("create", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should create search history and return success response", async () => {
      const req = { query: { tenant: "test_tenant" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const createSearchHistoryUtilStub = sinon
        .stub(createSearchHistoryUtil, "create")
        .returns({
          success: true,
          status: httpStatus.OK,
          message: "Search History created successfully",
          data: { id: "1", name: "Search History 1" },
        });

      await createSearchHistoryController.create(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(createSearchHistoryUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWithExactly(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWithExactly({
          success: true,
          message: "Search History created successfully",
          created_search_history: { id: "1", name: "Search History 1" },
        })
      ).to.be.true;
    });

    it("should handle bad request errors", async () => {
      const req = { query: { tenant: "test_tenant" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(false);
      const validationResultErrorsStub = sinon
        .stub(validationResult, "errors")
        .returns([{ nestedErrors: [{ msg: "Error 1" }, { msg: "Error 2" }] }]);
      const badRequestStub = sinon.stub(global, "badRequest").returns({});

      await createSearchHistoryController.create(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(validationResultErrorsStub.calledOnce).to.be.true;
      expect(
        badRequestStub.calledOnceWithExactly(res, "bad request errors", {
          nestedErrors: [{ msg: "Error 1" }, { msg: "Error 2" }],
        })
      ).to.be.true;
    });

    it("should handle internal server errors", async () => {
      const req = { query: { tenant: "test_tenant" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const createSearchHistoryUtilStub = sinon
        .stub(createSearchHistoryUtil, "create")
        .throws(new Error("Some error message"));
      const loggerErrorStub = sinon.stub(console, "error");

      await createSearchHistoryController.create(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(createSearchHistoryUtilStub.calledOnce).to.be.true;
      expect(loggerErrorStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWithExactly(httpStatus.INTERNAL_SERVER_ERROR))
        .to.be.true;
      expect(
        res.json.calledOnceWithExactly({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Some error message" },
        })
      ).to.be.true;
    });
  });
  describe("list", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should list search histories and return success response", async () => {
      const req = { query: { tenant: "test_tenant" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const createSearchHistoryUtilStub = sinon
        .stub(createSearchHistoryUtil, "list")
        .returns({
          success: true,
          status: httpStatus.OK,
          message: "Search Histories listed successfully",
          data: [
            { id: "1", name: "Search History 1" },
            { id: "2", name: "Search History 2" },
          ],
        });

      await createSearchHistoryController.list(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(createSearchHistoryUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWithExactly(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWithExactly({
          success: true,
          message: "Search Histories listed successfully",
          search_histories: [
            { id: "1", name: "Search History 1" },
            { id: "2", name: "Search History 2" },
          ],
        })
      ).to.be.true;
    });

    it("should handle bad request errors", async () => {
      const req = { query: { tenant: "test_tenant" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(false);
      const validationResultErrorsStub = sinon
        .stub(validationResult, "errors")
        .returns([{ nestedErrors: [{ msg: "Error 1" }, { msg: "Error 2" }] }]);
      const badRequestStub = sinon.stub(global, "badRequest").returns({});

      await createSearchHistoryController.list(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(validationResultErrorsStub.calledOnce).to.be.true;
      expect(
        badRequestStub.calledOnceWithExactly(res, "bad request errors", {
          nestedErrors: [{ msg: "Error 1" }, { msg: "Error 2" }],
        })
      ).to.be.true;
    });

    it("should handle internal server errors", async () => {
      const req = { query: { tenant: "test_tenant" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const createSearchHistoryUtilStub = sinon
        .stub(createSearchHistoryUtil, "list")
        .throws(new Error("Some error message"));
      const loggerErrorStub = sinon.stub(console, "error");

      await createSearchHistoryController.list(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(createSearchHistoryUtilStub.calledOnce).to.be.true;
      expect(loggerErrorStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWithExactly(httpStatus.INTERNAL_SERVER_ERROR))
        .to.be.true;
      expect(
        res.json.calledOnceWithExactly({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Some error message" },
        })
      ).to.be.true;
    });
  });
  describe("delete", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should delete search histories and return success response", async () => {
      const req = { query: { tenant: "test_tenant" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const createSearchHistoryUtilStub = sinon
        .stub(createSearchHistoryUtil, "delete")
        .returns({
          success: true,
          status: httpStatus.OK,
          message: "Search Histories deleted successfully",
          data: [
            { id: "1", name: "Search History 1" },
            { id: "2", name: "Search History 2" },
          ],
        });

      await createSearchHistoryController.delete(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(createSearchHistoryUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWithExactly(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWithExactly({
          success: true,
          message: "Search Histories deleted successfully",
          deleted_search_histories: [
            { id: "1", name: "Search History 1" },
            { id: "2", name: "Search History 2" },
          ],
        })
      ).to.be.true;
    });

    it("should handle bad request errors", async () => {
      const req = { query: { tenant: "test_tenant" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(false);
      const validationResultErrorsStub = sinon
        .stub(validationResult, "errors")
        .returns([{ nestedErrors: [{ msg: "Error 1" }, { msg: "Error 2" }] }]);
      const badRequestStub = sinon.stub(global, "badRequest").returns({});

      await createSearchHistoryController.delete(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(validationResultErrorsStub.calledOnce).to.be.true;
      expect(
        badRequestStub.calledOnceWithExactly(res, "bad request errors", {
          nestedErrors: [{ msg: "Error 1" }, { msg: "Error 2" }],
        })
      ).to.be.true;
    });

    it("should handle internal server errors", async () => {
      const req = { query: { tenant: "test_tenant" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const createSearchHistoryUtilStub = sinon
        .stub(createSearchHistoryUtil, "delete")
        .throws(new Error("Some error message"));
      const loggerErrorStub = sinon.stub(console, "error");

      await createSearchHistoryController.delete(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(createSearchHistoryUtilStub.calledOnce).to.be.true;
      expect(loggerErrorStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWithExactly(httpStatus.INTERNAL_SERVER_ERROR))
        .to.be.true;
      expect(
        res.json.calledOnceWithExactly({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Some error message" },
        })
      ).to.be.true;
    });
  });
  describe("update", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should update search history and return success response", async () => {
      const req = {
        query: { tenant: "test_tenant" },
        body: { id: "1", name: "Updated Search History" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const createSearchHistoryUtilStub = sinon
        .stub(createSearchHistoryUtil, "update")
        .returns({
          success: true,
          status: httpStatus.OK,
          message: "Search History updated successfully",
          data: { id: "1", name: "Updated Search History" },
        });

      await createSearchHistoryController.update(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(createSearchHistoryUtilStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWithExactly(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWithExactly({
          success: true,
          message: "Search History updated successfully",
          updated_search_history: { id: "1", name: "Updated Search History" },
        })
      ).to.be.true;
    });

    it("should handle bad request errors", async () => {
      const req = {
        query: { tenant: "test_tenant" },
        body: { id: "1", name: "" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(false);
      const validationResultErrorsStub = sinon
        .stub(validationResult, "errors")
        .returns([{ nestedErrors: [{ msg: "Name is required" }] }]);
      const badRequestStub = sinon.stub(global, "badRequest").returns({});

      await createSearchHistoryController.update(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(validationResultErrorsStub.calledOnce).to.be.true;
      expect(
        badRequestStub.calledOnceWithExactly(res, "bad request errors", {
          nestedErrors: [{ msg: "Name is required" }],
        })
      ).to.be.true;
    });

    it("should handle internal server errors", async () => {
      const req = {
        query: { tenant: "test_tenant" },
        body: { id: "1", name: "Updated Search History" },
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      const createSearchHistoryUtilStub = sinon
        .stub(createSearchHistoryUtil, "update")
        .throws(new Error("Some error message"));
      const loggerErrorStub = sinon.stub(console, "error");

      await createSearchHistoryController.update(req, res);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(createSearchHistoryUtilStub.calledOnce).to.be.true;
      expect(loggerErrorStub.calledOnce).to.be.true;
      expect(res.status.calledOnceWithExactly(httpStatus.INTERNAL_SERVER_ERROR))
        .to.be.true;
      expect(
        res.json.calledOnceWithExactly({
          success: false,
          message: "Internal Server Error",
          errors: { message: "Some error message" },
        })
      ).to.be.true;
    });
  });
});
