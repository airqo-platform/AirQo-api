require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const rewire = require("rewire");
const createCandidateUtil = require("@utils/candidate.util");

const createCandidateController = rewire("@controllers/candidate.controller");
const realExtractErrors = require("@utils/shared").extractErrorsFromRequest;
const mockBadRequest = () => [{ param: "key", message: "required" }];

describe("createCandidateController", () => {
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
    createCandidateController.__set__("extractErrorsFromRequest", realExtractErrors);
  });

  describe("create()", () => {
    it("should return a success response when candidate is created", async () => {
      sinon.stub(createCandidateUtil, "create").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Candidate created",
        data: { email: "test@example.com" },
      });

      await createCandidateController.create(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, candidate: { email: "test@example.com" } })).to.be.true;
    });

    it("should return a bad request response if validation errors exist", async () => {
      createCandidateController.__set__("extractErrorsFromRequest", mockBadRequest);

      await createCandidateController.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should return an error response if createCandidateUtil fails", async () => {
      sinon.stub(createCandidateUtil, "create").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Creation failed",
        errors: { message: "Create error" },
      });

      await createCandidateController.create(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should return an internal server error response when an exception occurs", async () => {
      sinon.stub(createCandidateUtil, "create").rejects(new Error("Unexpected error"));

      await createCandidateController.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("list", () => {
    it("should return a success response if createCandidateUtil.list is successful", async () => {
      sinon.stub(createCandidateUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Candidates listed",
        data: [{ email: "test@example.com" }],
      });

      await createCandidateController.list(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, candidates: sinon.match.array })).to.be.true;
    });

    it("should return a bad request response if validation errors exist", async () => {
      createCandidateController.__set__("extractErrorsFromRequest", mockBadRequest);

      await createCandidateController.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should return an error response if createCandidateUtil.list returns an error", async () => {
      sinon.stub(createCandidateUtil, "list").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "List failed",
        errors: { message: "List error" },
      });

      await createCandidateController.list(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should return an error response if an exception is thrown", async () => {
      sinon.stub(createCandidateUtil, "list").rejects(new Error("Unexpected error"));

      await createCandidateController.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("confirm", () => {
    it("should return a success response if createCandidateUtil.confirm is successful", async () => {
      sinon.stub(createCandidateUtil, "confirm").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Candidate confirmed",
        data: { email: "test@example.com" },
      });

      await createCandidateController.confirm(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, user: { email: "test@example.com" } })).to.be.true;
    });

    it("should return a bad request response if validation errors exist", async () => {
      createCandidateController.__set__("extractErrorsFromRequest", mockBadRequest);

      await createCandidateController.confirm(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should return an error response if createCandidateUtil.confirm returns an error", async () => {
      sinon.stub(createCandidateUtil, "confirm").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Confirm failed",
        errors: { message: "Confirm error" },
      });

      await createCandidateController.confirm(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should return an error response if an exception is thrown", async () => {
      sinon.stub(createCandidateUtil, "confirm").rejects(new Error("Unexpected error"));

      await createCandidateController.confirm(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("delete", () => {
    it("should return a success response if createCandidateUtil.delete is successful", async () => {
      sinon.stub(createCandidateUtil, "delete").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Candidate deleted",
        data: { email: "test@example.com" },
      });

      await createCandidateController.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, candidate: { email: "test@example.com" } })).to.be.true;
    });

    it("should return a bad request response if validation errors exist", async () => {
      createCandidateController.__set__("extractErrorsFromRequest", mockBadRequest);

      await createCandidateController.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should return an error response if createCandidateUtil.delete returns an error", async () => {
      sinon.stub(createCandidateUtil, "delete").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Delete failed",
        errors: { message: "Delete error" },
      });

      await createCandidateController.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should return an error response if an exception is thrown", async () => {
      sinon.stub(createCandidateUtil, "delete").rejects(new Error("Unexpected error"));

      await createCandidateController.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("update", () => {
    it("should return a success response if createCandidateUtil.update is successful", async () => {
      sinon.stub(createCandidateUtil, "update").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Candidate updated",
        data: { email: "test@example.com" },
      });

      await createCandidateController.update(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, candidate: { email: "test@example.com" } })).to.be.true;
    });

    it("should return a bad request response if validation errors exist", async () => {
      createCandidateController.__set__("extractErrorsFromRequest", mockBadRequest);

      await createCandidateController.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should return an error response if createCandidateUtil.update returns an error", async () => {
      sinon.stub(createCandidateUtil, "update").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Update failed",
        errors: { message: "Update error" },
      });

      await createCandidateController.update(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should return an error response if an exception is thrown", async () => {
      sinon.stub(createCandidateUtil, "update").rejects(new Error("Unexpected error"));

      await createCandidateController.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
