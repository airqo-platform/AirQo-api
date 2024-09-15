require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const { validationResult } = require("express-validator");
const createLocationHistoryUtil = require("@utils/create-location-history");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const { logText, logObject } = require("@utils/log");
const constants = require("@config/constants");
const controller = require("@controllers/create-location-history");

describe("createLocationHistory", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("syncLocationHistory", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return bad request when validation has errors", async () => {
      const req = {
        // Create a mock req object with validation errors
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(false);
      validationResultStub.withArgs(req).returns(true);

      const badRequestStub = sinon.stub(controller, "badRequest");

      await controller.syncLocationHistory(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(badRequestStub.calledOnce).to.be.true;
      expect(badRequestStub.args[0][1]).to.equal("bad request errors");
      expect(badRequestStub.args[0][2]).to.be.an("object");
      // Add more assertions for the bad request response
    });

    it("should handle internal server error when createLocationHistoryUtil.syncLocationHistories throws an error", async () => {
      const req = {
        // Create a mock req object
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);

      const syncLocationHistoriesStub = sinon
        .stub(createLocationHistoryUtil, "syncLocationHistories")
        .throws(new Error("Mocked Error"));

      await controller.syncLocationHistory(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(syncLocationHistoriesStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions for the internal server error response
    });

    it("should sync location histories successfully", async () => {
      const req = {
        // Create a mock req object
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);

      const responseFromSyncLocationHistories = {
        success: true,
        status: httpStatus.OK,
        message: "Sync successful",
        data: [{ locationHistory: "data1" }, { locationHistory: "data2" }],
      };

      const syncLocationHistoriesStub = sinon
        .stub(createLocationHistoryUtil, "syncLocationHistories")
        .returns(responseFromSyncLocationHistories);

      await controller.syncLocationHistory(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(syncLocationHistoriesStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions for the successful response
    });

    it("should handle sync failure with error", async () => {
      const req = {
        // Create a mock req object
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);

      const responseFromSyncLocationHistories = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Sync failed",
        errors: { message: "Error occurred during sync" },
      };

      const syncLocationHistoriesStub = sinon
        .stub(createLocationHistoryUtil, "syncLocationHistories")
        .returns(responseFromSyncLocationHistories);

      await controller.syncLocationHistory(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(syncLocationHistoriesStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions for the sync failure response with error
    });

    it("should handle sync failure without error", async () => {
      const req = {
        // Create a mock req object
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);

      const responseFromSyncLocationHistories = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Sync failed",
      };

      const syncLocationHistoriesStub = sinon
        .stub(createLocationHistoryUtil, "syncLocationHistories")
        .returns(responseFromSyncLocationHistories);

      await controller.syncLocationHistory(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(syncLocationHistoriesStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions for the sync failure response without error
    });
  });

  describe("create", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return bad request when validation has errors", async () => {
      const req = {
        // Create a mock req object with validation errors
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(false);
      validationResultStub.withArgs(req).returns(true);

      const badRequestStub = sinon.stub(controller, "badRequest");

      await controller.create(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(badRequestStub.calledOnce).to.be.true;
      expect(badRequestStub.args[0][1]).to.equal("bad request errors");
      expect(badRequestStub.args[0][2]).to.be.an("object");
      // Add more assertions for the bad request response
    });

    it("should handle internal server error when createLocationHistoryUtil.create throws an error", async () => {
      const req = {
        // Create a mock req object
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);

      const createLocationHistoryStub = sinon
        .stub(createLocationHistoryUtil, "create")
        .throws(new Error("Mocked Error"));

      await controller.create(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(createLocationHistoryStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions for the internal server error response
    });

    it("should create location history successfully", async () => {
      const req = {
        // Create a mock req object
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);

      const responseFromCreateLocationHistory = {
        success: true,
        status: httpStatus.OK,
        message: "Location history created successfully",
        data: { locationHistory: "data1" },
      };

      const createLocationHistoryStub = sinon
        .stub(createLocationHistoryUtil, "create")
        .returns(responseFromCreateLocationHistory);

      await controller.create(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(createLocationHistoryStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions for the successful response
    });

    it("should handle creation failure with error", async () => {
      const req = {
        // Create a mock req object
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);

      const responseFromCreateLocationHistory = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Location history creation failed",
        errors: { message: "Error occurred during creation" },
      };

      const createLocationHistoryStub = sinon
        .stub(createLocationHistoryUtil, "create")
        .returns(responseFromCreateLocationHistory);

      await controller.create(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(createLocationHistoryStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions for the creation failure response with error
    });

    it("should handle creation failure without error", async () => {
      const req = {
        // Create a mock req object
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);

      const responseFromCreateLocationHistory = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Location history creation failed",
      };

      const createLocationHistoryStub = sinon
        .stub(createLocationHistoryUtil, "create")
        .returns(responseFromCreateLocationHistory);

      await controller.create(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(createLocationHistoryStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions for the creation failure response without error
    });
  });

  describe("list", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return bad request when validation has errors", async () => {
      const req = {
        // Create a mock req object with validation errors
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(false);
      validationResultStub.withArgs(req).returns(true);

      const badRequestStub = sinon.stub(controller, "badRequest");

      await controller.list(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(badRequestStub.calledOnce).to.be.true;
      expect(badRequestStub.args[0][1]).to.equal("bad request errors");
      expect(badRequestStub.args[0][2]).to.be.an("object");
      // Add more assertions for the bad request response
    });

    it("should handle internal server error when createLocationHistoryUtil.list throws an error", async () => {
      const req = {
        // Create a mock req object
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);

      const createLocationHistoryStub = sinon
        .stub(createLocationHistoryUtil, "list")
        .throws(new Error("Mocked Error"));

      await controller.list(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(createLocationHistoryStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions for the internal server error response
    });

    it("should list location histories successfully", async () => {
      const req = {
        // Create a mock req object
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);

      const responseFromListLocationHistories = {
        success: true,
        status: httpStatus.OK,
        message: "Location histories retrieved successfully",
        data: [{ locationHistory: "data1" }, { locationHistory: "data2" }],
      };

      const createLocationHistoryStub = sinon
        .stub(createLocationHistoryUtil, "list")
        .returns(responseFromListLocationHistories);

      await controller.list(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(createLocationHistoryStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions for the successful response
    });

    it("should handle listing failure with error", async () => {
      const req = {
        // Create a mock req object
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);

      const responseFromListLocationHistories = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Location histories retrieval failed",
        errors: { message: "Error occurred during retrieval" },
      };

      const createLocationHistoryStub = sinon
        .stub(createLocationHistoryUtil, "list")
        .returns(responseFromListLocationHistories);

      await controller.list(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(createLocationHistoryStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions for the listing failure response with error
    });

    it("should handle listing failure without error", async () => {
      const req = {
        // Create a mock req object
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);

      const responseFromListLocationHistories = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Location histories retrieval failed",
      };

      const createLocationHistoryStub = sinon
        .stub(createLocationHistoryUtil, "list")
        .returns(responseFromListLocationHistories);

      await controller.list(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(createLocationHistoryStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions for the listing failure response without error
    });
  });

  describe("delete", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return bad request when validation has errors", async () => {
      const req = {
        // Create a mock req object with validation errors
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(false);
      validationResultStub.withArgs(req).returns(true);

      const badRequestStub = sinon.stub(controller, "badRequest");

      await controller.delete(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(badRequestStub.calledOnce).to.be.true;
      expect(badRequestStub.args[0][1]).to.equal("bad request errors");
      expect(badRequestStub.args[0][2]).to.be.an("object");
      // Add more assertions for the bad request response
    });

    it("should handle internal server error when createLocationHistoryUtil.delete throws an error", async () => {
      const req = {
        // Create a mock req object
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);

      const createLocationHistoryStub = sinon
        .stub(createLocationHistoryUtil, "delete")
        .throws(new Error("Mocked Error"));

      await controller.delete(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(createLocationHistoryStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions for the internal server error response
    });

    it("should delete location histories successfully", async () => {
      const req = {
        // Create a mock req object
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);

      const responseFromDeleteLocationHistories = {
        success: true,
        status: httpStatus.OK,
        message: "Location histories deleted successfully",
        data: [{ locationHistory: "data1" }, { locationHistory: "data2" }],
      };

      const createLocationHistoryStub = sinon
        .stub(createLocationHistoryUtil, "delete")
        .returns(responseFromDeleteLocationHistories);

      await controller.delete(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(createLocationHistoryStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions for the successful response
    });

    it("should handle deletion failure with error", async () => {
      const req = {
        // Create a mock req object
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);

      const responseFromDeleteLocationHistories = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Location histories deletion failed",
        errors: { message: "Error occurred during deletion" },
      };

      const createLocationHistoryStub = sinon
        .stub(createLocationHistoryUtil, "delete")
        .returns(responseFromDeleteLocationHistories);

      await controller.delete(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(createLocationHistoryStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions for the deletion failure response with error
    });

    it("should handle deletion failure without error", async () => {
      const req = {
        // Create a mock req object
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);

      const responseFromDeleteLocationHistories = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Location histories deletion failed",
      };

      const createLocationHistoryStub = sinon
        .stub(createLocationHistoryUtil, "delete")
        .returns(responseFromDeleteLocationHistories);

      await controller.delete(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(createLocationHistoryStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions for the deletion failure response without error
    });
  });

  describe("update", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return bad request when validation has errors", async () => {
      const req = {
        // Create a mock req object with validation errors
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(false);
      validationResultStub.withArgs(req).returns(true);

      const badRequestStub = sinon.stub(controller, "badRequest");

      await controller.update(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(badRequestStub.calledOnce).to.be.true;
      expect(badRequestStub.args[0][1]).to.equal("bad request errors");
      expect(badRequestStub.args[0][2]).to.be.an("object");
      // Add more assertions for the bad request response
    });

    it("should handle internal server error when createLocationHistoryUtil.update throws an error", async () => {
      const req = {
        // Create a mock req object
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);

      const createLocationHistoryStub = sinon
        .stub(createLocationHistoryUtil, "update")
        .throws(new Error("Mocked Error"));

      await controller.update(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(createLocationHistoryStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions for the internal server error response
    });

    it("should update location histories successfully", async () => {
      const req = {
        // Create a mock req object
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);

      const responseFromUpdateLocationHistories = {
        success: true,
        status: httpStatus.OK,
        message: "Location histories updated successfully",
        data: [{ updatedLocation: "data1" }, { updatedLocation: "data2" }],
      };

      const createLocationHistoryStub = sinon
        .stub(createLocationHistoryUtil, "update")
        .returns(responseFromUpdateLocationHistories);

      await controller.update(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(createLocationHistoryStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions for the successful response
    });

    it("should handle update failure with error", async () => {
      const req = {
        // Create a mock req object
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);

      const responseFromUpdateLocationHistories = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Location histories update failed",
        errors: { message: "Error occurred during update" },
      };

      const createLocationHistoryStub = sinon
        .stub(createLocationHistoryUtil, "update")
        .returns(responseFromUpdateLocationHistories);

      await controller.update(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(createLocationHistoryStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions for the update failure response with error
    });

    it("should handle update failure without error", async () => {
      const req = {
        // Create a mock req object
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      const validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);

      const responseFromUpdateLocationHistories = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Location histories update failed",
      };

      const createLocationHistoryStub = sinon
        .stub(createLocationHistoryUtil, "update")
        .returns(responseFromUpdateLocationHistories);

      await controller.update(req, res);

      expect(validationResultStub.calledWith(req)).to.be.true;
      expect(createLocationHistoryStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions for the update failure response without error
    });
  });
});
