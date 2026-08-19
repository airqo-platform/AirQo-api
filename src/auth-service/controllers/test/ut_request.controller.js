require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const rewire = require("rewire");
const createAccessRequestUtil = require("@utils/request.util");

const createAccessRequest = rewire("@controllers/request.controller");
const realExtractErrors = require("@utils/shared").extractErrorsFromRequest;
const mockBadRequest = () => [{ param: "key", message: "required" }];

describe("createAccessRequest()", () => {
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
    createAccessRequest.__set__("extractErrorsFromRequest", realExtractErrors);
  });

  describe("requestAccessToGroup", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createAccessRequestUtil, "requestAccessToGroup").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Access request created",
        data: { _id: "req1" },
      });

      await createAccessRequest.requestAccessToGroup(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, request: { _id: "req1" } })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createAccessRequest.__set__("extractErrorsFromRequest", mockBadRequest);

      await createAccessRequest.requestAccessToGroup(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle an error from createAccessRequestUtil and return an internal server error response", async () => {
      sinon.stub(createAccessRequestUtil, "requestAccessToGroup").rejects(new Error("Test error"));

      await createAccessRequest.requestAccessToGroup(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("requestAccessToNetwork()", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createAccessRequestUtil, "requestAccessToNetwork").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Network access request created",
        data: { _id: "req2" },
      });

      await createAccessRequest.requestAccessToNetwork(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createAccessRequest.__set__("extractErrorsFromRequest", mockBadRequest);

      await createAccessRequest.requestAccessToNetwork(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle an error from createAccessRequestUtil and return an internal server error response", async () => {
      sinon.stub(createAccessRequestUtil, "requestAccessToNetwork").rejects(new Error("Test error"));

      await createAccessRequest.requestAccessToNetwork(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("approveAccessRequest()", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createAccessRequestUtil, "approveAccessRequest").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Access request approved",
        data: { status: "approved" },
      });

      await createAccessRequest.approveAccessRequest(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createAccessRequest.__set__("extractErrorsFromRequest", mockBadRequest);

      await createAccessRequest.approveAccessRequest(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle an error from createAccessRequestUtil and return an internal server error response", async () => {
      sinon.stub(createAccessRequestUtil, "approveAccessRequest").rejects(new Error("Test error"));

      await createAccessRequest.approveAccessRequest(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("rejectAccessRequest()", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createAccessRequestUtil, "rejectAccessRequest").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Access request rejected",
        data: { status: "rejected" },
      });

      await createAccessRequest.rejectAccessRequest(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createAccessRequest.__set__("extractErrorsFromRequest", mockBadRequest);

      await createAccessRequest.rejectAccessRequest(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle an error from createAccessRequestUtil and return an internal server error response", async () => {
      sinon.stub(createAccessRequestUtil, "rejectAccessRequest").rejects(new Error("Test error"));

      await createAccessRequest.rejectAccessRequest(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("listPendingAccessRequests()", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createAccessRequestUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Pending requests listed",
        data: [],
      });

      await createAccessRequest.listPendingAccessRequests(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createAccessRequest.__set__("extractErrorsFromRequest", mockBadRequest);

      await createAccessRequest.listPendingAccessRequests(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle an error from createAccessRequestUtil.list and return an internal server error response", async () => {
      sinon.stub(createAccessRequestUtil, "list").rejects(new Error("Test error"));

      await createAccessRequest.listPendingAccessRequests(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("listAccessRequestsForGroup()", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createAccessRequestUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Group requests listed",
        data: [],
      });

      await createAccessRequest.listAccessRequestsForGroup(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createAccessRequest.__set__("extractErrorsFromRequest", mockBadRequest);

      await createAccessRequest.listAccessRequestsForGroup(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle an error from createAccessRequestUtil.list and return an internal server error response", async () => {
      sinon.stub(createAccessRequestUtil, "list").rejects(new Error("Test error"));

      await createAccessRequest.listAccessRequestsForGroup(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("listAccessRequestsForNetwork()", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createAccessRequestUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Network requests listed",
        data: [],
      });

      await createAccessRequest.listAccessRequestsForNetwork(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createAccessRequest.__set__("extractErrorsFromRequest", mockBadRequest);

      await createAccessRequest.listAccessRequestsForNetwork(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle an error from createAccessRequestUtil.list and return an internal server error response", async () => {
      sinon.stub(createAccessRequestUtil, "list").rejects(new Error("Test error"));

      await createAccessRequest.listAccessRequestsForNetwork(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("list()", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createAccessRequestUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Requests listed",
        data: [],
      });

      await createAccessRequest.list(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createAccessRequest.__set__("extractErrorsFromRequest", mockBadRequest);

      await createAccessRequest.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle an error from createAccessRequestUtil.list and return an internal server error response", async () => {
      sinon.stub(createAccessRequestUtil, "list").rejects(new Error("Test error"));

      await createAccessRequest.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("delete()", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createAccessRequestUtil, "delete").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Request deleted",
        data: { _id: "req1" },
      });

      await createAccessRequest.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createAccessRequest.__set__("extractErrorsFromRequest", mockBadRequest);

      await createAccessRequest.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle an error from createAccessRequestUtil and return an internal server error response", async () => {
      sinon.stub(createAccessRequestUtil, "delete").rejects(new Error("Test error"));

      await createAccessRequest.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("update()", () => {
    it("should handle a valid request and return a success response", async () => {
      sinon.stub(createAccessRequestUtil, "update").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Request updated",
        data: { _id: "req1" },
      });

      await createAccessRequest.update(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it("should handle a request with validation errors and return a bad request response", async () => {
      createAccessRequest.__set__("extractErrorsFromRequest", mockBadRequest);

      await createAccessRequest.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle an error from createAccessRequestUtil and return an internal server error response", async () => {
      sinon.stub(createAccessRequestUtil, "update").rejects(new Error("Test error"));

      await createAccessRequest.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
