require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const rewire = require("rewire");
const createLocationHistoryUtil = require("@utils/location-history.util");

const createLocationHistory = rewire("@controllers/location-history.controller");
const realExtractErrors = require("@utils/shared").extractErrorsFromRequest;
const mockBadRequest = () => [{ param: "key", message: "required" }];

describe("createLocationHistory", () => {
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
    createLocationHistory.__set__("extractErrorsFromRequest", realExtractErrors);
  });

  describe("syncLocationHistory", () => {
    it("should sync location histories successfully", async () => {
      sinon.stub(createLocationHistoryUtil, "syncLocationHistories").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Location histories synced",
        data: [],
      });

      await createLocationHistory.syncLocationHistory(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle syncing location histories failure", async () => {
      sinon.stub(createLocationHistoryUtil, "syncLocationHistories").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to sync",
        errors: { message: "Sync error" },
      });

      await createLocationHistory.syncLocationHistory(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createLocationHistory.__set__("extractErrorsFromRequest", mockBadRequest);

      await createLocationHistory.syncLocationHistory(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(createLocationHistoryUtil, "syncLocationHistories").rejects(new Error("Unexpected error"));

      await createLocationHistory.syncLocationHistory(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should sync location histories successfully (duplicate for suite parity)", async () => {
      sinon.stub(createLocationHistoryUtil, "syncLocationHistories").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Location histories synced",
        data: [{ location: "loc1" }],
      });

      await createLocationHistory.syncLocationHistory(req, res, next);

      expect(res.json.calledWithMatch({ success: true, location_histories: sinon.match.array })).to.be.true;
    });
  });

  describe("create", () => {
    it("should create a location history successfully", async () => {
      sinon.stub(createLocationHistoryUtil, "create").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Created",
        data: { location: "loc1" },
      });

      await createLocationHistory.create(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, created_location_history: { location: "loc1" } })).to.be.true;
    });

    it("should handle creation failure", async () => {
      sinon.stub(createLocationHistoryUtil, "create").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed",
        errors: { message: "Create error" },
      });

      await createLocationHistory.create(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createLocationHistory.__set__("extractErrorsFromRequest", mockBadRequest);

      await createLocationHistory.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(createLocationHistoryUtil, "create").rejects(new Error("Unexpected error"));

      await createLocationHistory.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should handle creation with no data returned", async () => {
      sinon.stub(createLocationHistoryUtil, "create").resolves(null);

      await createLocationHistory.create(req, res, next);

      expect(res.json.notCalled).to.be.true;
    });
  });

  describe("list", () => {
    it("should list location histories successfully", async () => {
      sinon.stub(createLocationHistoryUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Listed",
        data: [{ location: "loc1" }],
      });

      await createLocationHistory.list(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, location_histories: sinon.match.array })).to.be.true;
    });

    it("should handle listing failure", async () => {
      sinon.stub(createLocationHistoryUtil, "list").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed",
        errors: { message: "List error" },
      });

      await createLocationHistory.list(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createLocationHistory.__set__("extractErrorsFromRequest", mockBadRequest);

      await createLocationHistory.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(createLocationHistoryUtil, "list").rejects(new Error("Unexpected error"));

      await createLocationHistory.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should handle empty result", async () => {
      sinon.stub(createLocationHistoryUtil, "list").resolves(null);

      await createLocationHistory.list(req, res, next);

      expect(res.json.notCalled).to.be.true;
    });
  });

  describe("delete", () => {
    it("should delete location histories successfully", async () => {
      sinon.stub(createLocationHistoryUtil, "delete").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Deleted",
        data: { location: "loc1" },
      });

      await createLocationHistory.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, deleted_location_histories: { location: "loc1" } })).to.be.true;
    });

    it("should handle deletion failure", async () => {
      sinon.stub(createLocationHistoryUtil, "delete").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed",
        errors: { message: "Delete error" },
      });

      await createLocationHistory.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createLocationHistory.__set__("extractErrorsFromRequest", mockBadRequest);

      await createLocationHistory.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(createLocationHistoryUtil, "delete").rejects(new Error("Unexpected error"));

      await createLocationHistory.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should handle empty result", async () => {
      sinon.stub(createLocationHistoryUtil, "delete").resolves(null);

      await createLocationHistory.delete(req, res, next);

      expect(res.json.notCalled).to.be.true;
    });
  });

  describe("update", () => {
    it("should update location history successfully", async () => {
      sinon.stub(createLocationHistoryUtil, "update").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Updated",
        data: { location: "loc1" },
      });

      await createLocationHistory.update(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, updated_location_history: { location: "loc1" } })).to.be.true;
    });

    it("should handle update failure", async () => {
      sinon.stub(createLocationHistoryUtil, "update").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed",
        errors: { message: "Update error" },
      });

      await createLocationHistory.update(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle bad request errors", async () => {
      createLocationHistory.__set__("extractErrorsFromRequest", mockBadRequest);

      await createLocationHistory.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(createLocationHistoryUtil, "update").rejects(new Error("Unexpected error"));

      await createLocationHistory.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should handle update location histories successfully (filter applied)", async () => {
      req.query.location_history_id = "loc123";
      sinon.stub(createLocationHistoryUtil, "update").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Updated with filter",
        data: { location: "loc1" },
      });

      await createLocationHistory.update(req, res, next);

      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });
  });
});
