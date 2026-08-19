require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const rewire = require("rewire");
const inquiryUtil = require("@utils/inquiry.util");

const inquiry = rewire("@controllers/inquiry.controller");
const realExtractErrors = require("@utils/shared").extractErrorsFromRequest;
const mockBadRequest = () => [{ param: "key", message: "required" }];

describe("inquire controller", () => {
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
    inquiry.__set__("extractErrorsFromRequest", realExtractErrors);
  });

  describe("create function", () => {
    it("should return a success response when everything is fine", async () => {
      sinon.stub(inquiryUtil, "create").resolves({
        success: true,
        status: httpStatus.OK,
        message: "inquiry successfully created",
        data: { inquiry: "sample inquiry" },
      });

      await inquiry.create(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, inquiry: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      inquiry.__set__("extractErrorsFromRequest", mockBadRequest);

      await inquiry.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should return an error response when util fails", async () => {
      sinon.stub(inquiryUtil, "create").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Creation failed",
        errors: { message: "Error" },
      });

      await inquiry.create(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected exceptions", async () => {
      sinon.stub(inquiryUtil, "create").rejects(new Error("Unexpected error"));

      await inquiry.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("list function", () => {
    it("should list inquiries successfully", async () => {
      sinon.stub(inquiryUtil, "list").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Inquiries listed successfully",
        data: [{ _id: "inquiry-id", name: "Inquiry 1" }],
      });

      await inquiry.list(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, inquiries: sinon.match.array })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      inquiry.__set__("extractErrorsFromRequest", mockBadRequest);

      await inquiry.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle list failure", async () => {
      sinon.stub(inquiryUtil, "list").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "List inquiry failed",
        errors: { message: "Error" },
      });

      await inquiry.list(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected exceptions", async () => {
      sinon.stub(inquiryUtil, "list").rejects(new Error("Database error"));

      await inquiry.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("delete function", () => {
    it("should delete inquiry successfully", async () => {
      sinon.stub(inquiryUtil, "delete").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Inquiry deleted successfully",
        data: { _id: "inquiry-id", name: "Inquiry 1" },
      });

      await inquiry.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, deleted_inquiry: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      inquiry.__set__("extractErrorsFromRequest", mockBadRequest);

      await inquiry.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle delete failure", async () => {
      sinon.stub(inquiryUtil, "delete").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Delete inquiry failed",
        errors: { message: "Error" },
      });

      await inquiry.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected exceptions", async () => {
      sinon.stub(inquiryUtil, "delete").rejects(new Error("Database error"));

      await inquiry.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("update function", () => {
    it("should update inquiry successfully", async () => {
      sinon.stub(inquiryUtil, "update").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Inquiry updated successfully",
        data: { _id: "inquiry-id", name: "Inquiry 1" },
      });

      await inquiry.update(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, updated_inquiry: sinon.match.object })).to.be.true;
    });

    it("should handle bad request errors", async () => {
      inquiry.__set__("extractErrorsFromRequest", mockBadRequest);

      await inquiry.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle update failure", async () => {
      sinon.stub(inquiryUtil, "update").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Update inquiry failed",
        errors: { message: "Error" },
      });

      await inquiry.update(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected exceptions", async () => {
      sinon.stub(inquiryUtil, "update").rejects(new Error("Database error"));

      await inquiry.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
