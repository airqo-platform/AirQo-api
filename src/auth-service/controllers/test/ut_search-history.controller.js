require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const rewire = require("rewire");
const searchHistoryUtil = require("@utils/search-history.util");

const createSearchHistory = rewire("@controllers/search-history.controller");
const realExtractErrors = require("@utils/shared").extractErrorsFromRequest;
const mockBadRequest = () => [{ param: "key", message: "required" }];

describe("createSearchHistory Controller", () => {
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
    createSearchHistory.__set__("extractErrorsFromRequest", realExtractErrors);
  });

  describe("syncSearchHistory", () => {
    it("should sync search histories successfully", async () => {
      sinon.stub(searchHistoryUtil, "syncSearchHistories").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Search Histories Synchronized",
        data: [{ id: "1", name: "Search History 1" }],
      });

      await createSearchHistory.syncSearchHistory(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, search_histories: sinon.match.array })).to.be.true;
    });

    it("should handle syncing failure", async () => {
      sinon.stub(searchHistoryUtil, "syncSearchHistories").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Sync failed",
        errors: { message: "Error" },
      });

      await createSearchHistory.syncSearchHistory(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createSearchHistory.__set__("extractErrorsFromRequest", mockBadRequest);

      await createSearchHistory.syncSearchHistory(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(searchHistoryUtil, "syncSearchHistories").rejects(new Error("Unexpected error"));

      await createSearchHistory.syncSearchHistory(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("create", () => {
    it("should create search history successfully", async () => {
      sinon.stub(searchHistoryUtil, "create").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Search History created successfully",
        data: { id: "1", name: "Search History 1" },
      });

      await createSearchHistory.create(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, created_search_history: sinon.match.object })).to.be.true;
    });

    it("should handle creation failure", async () => {
      sinon.stub(searchHistoryUtil, "create").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Create failed",
        errors: { message: "Error" },
      });

      await createSearchHistory.create(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createSearchHistory.__set__("extractErrorsFromRequest", mockBadRequest);

      await createSearchHistory.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(searchHistoryUtil, "create").rejects(new Error("Unexpected error"));

      await createSearchHistory.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("list", () => {
    it("should list search histories successfully", async () => {
      sinon.stub(searchHistoryUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Search Histories listed successfully",
        data: [{ id: "1" }, { id: "2" }],
      });

      await createSearchHistory.list(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, search_histories: sinon.match.array })).to.be.true;
    });

    it("should handle listing failure", async () => {
      sinon.stub(searchHistoryUtil, "list").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "List failed",
        errors: { message: "Error" },
      });

      await createSearchHistory.list(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createSearchHistory.__set__("extractErrorsFromRequest", mockBadRequest);

      await createSearchHistory.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(searchHistoryUtil, "list").rejects(new Error("Unexpected error"));

      await createSearchHistory.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("delete", () => {
    it("should delete search histories successfully", async () => {
      sinon.stub(searchHistoryUtil, "delete").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Search Histories deleted successfully",
        data: [{ id: "1" }, { id: "2" }],
      });

      await createSearchHistory.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, deleted_search_histories: sinon.match.array })).to.be.true;
    });

    it("should handle deletion failure", async () => {
      sinon.stub(searchHistoryUtil, "delete").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Delete failed",
        errors: { message: "Error" },
      });

      await createSearchHistory.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createSearchHistory.__set__("extractErrorsFromRequest", mockBadRequest);

      await createSearchHistory.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(searchHistoryUtil, "delete").rejects(new Error("Unexpected error"));

      await createSearchHistory.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("update", () => {
    it("should update search history successfully", async () => {
      sinon.stub(searchHistoryUtil, "update").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Search History updated successfully",
        data: { id: "1", name: "Updated Search History" },
      });

      await createSearchHistory.update(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, updated_search_history: sinon.match.object })).to.be.true;
    });

    it("should handle update failure", async () => {
      sinon.stub(searchHistoryUtil, "update").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Update failed",
        errors: { message: "Error" },
      });

      await createSearchHistory.update(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createSearchHistory.__set__("extractErrorsFromRequest", mockBadRequest);

      await createSearchHistory.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(searchHistoryUtil, "update").rejects(new Error("Unexpected error"));

      await createSearchHistory.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
