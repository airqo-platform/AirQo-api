require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const httpStatus = require("http-status");
const createInquiryUtil = require("@utils/create-inquiry");
const generateFilter = require("@utils/generate-filter");
const { validationResult } = require("express-validator");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const { logText, logElement, logObject, logError } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const inquire = require("@controllers/create-inquiry");
const chaiHttp = require("chai-http");
chai.use(chaiHttp);
const InquiryModel = require("@models/Inquiry");
const mailer = require("@utils/mailer");

describe("inquire controller", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("create function", () => {
    let inquire, InquiryModelStub, mailerStub;

    beforeEach(() => {
      inquire = {
        fullName: "John Doe",
        email: "johndoe@example.com",
        message: "Test message",
        category: "General",
        tenant: "sample-tenant",
        firstName: "John",
        lastName: "Doe",
      };

      InquiryModelStub = sinon.stub(InquiryModel.prototype, "register");
      mailerStub = sinon.stub(mailer, "inquiry");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return a success response when everything is fine", async () => {
      InquiryModelStub.resolves({
        success: true,
        data: { inquiry: "sample inquiry" },
      });
      mailerStub.resolves({ success: true, status: 200 });

      const expectedResponse = {
        success: true,
        message: "inquiry successfully created",
        data: { inquiry: "sample inquiry" },
        status: 200,
      };

      const response = await inquire.create(inquire);

      expect(response).to.deep.equal(expectedResponse);
    });

    it("should return an error response when InquiryModel registration fails", async () => {
      InquiryModelStub.resolves({
        success: false,
        message: "Registration failed",
      });

      const expectedResponse = {
        success: false,
        message: "Registration failed",
      };

      const response = await inquire.create(inquire);

      expect(response).to.deep.equal(expectedResponse);
    });

    it("should return an error response when mailer fails", async () => {
      InquiryModelStub.resolves({
        success: true,
        data: { inquiry: "sample inquiry" },
      });
      mailerStub.resolves({ success: false, message: "Email sending failed" });

      const expectedResponse = {
        success: false,
        message: "Email sending failed",
      };

      const response = await inquire.create(inquire);

      expect(response).to.deep.equal(expectedResponse);
    });

    it("should return an internal server error response when an exception occurs", async () => {
      InquiryModelStub.rejects(new Error("Test error"));

      const expectedResponse = {
        success: false,
        message: "Internal Server Error",
        errors: { message: "Test error" },
        status: 500,
      };

      const response = await inquire.create(inquire);

      expect(response).to.deep.equal(expectedResponse);
    });
  });

  describe("list function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return bad request when validation has errors", async () => {
      const req = { query: {} };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon.stub(validationResult(req));
      validationResultStub.isEmpty.returns(false);
      validationResultStub.errors = [
        { nestedErrors: [{ msg: "Error 1" }, { msg: "Error 2" }] },
      ];

      await inquire.list(req, res);

      expect(validationResultStub.isEmpty).to.be.calledOnce;
      expect(badRequest).to.be.calledOnceWith(
        res,
        "bad request errors",
        convertErrorArrayToObject(validationResultStub.errors[0].nestedErrors)
      );
    });

    it("should return internal server error when createInquiryUtil throws an error", async () => {
      const req = { query: {} };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      sinon.stub(validationResult(req)).isEmpty.returns(true);
      sinon
        .stub(generateFilter, "inquiry")
        .returns({ success: true, data: {} });
      sinon.stub(createInquiryUtil, "list").throws(new Error("Database error"));

      await inquire.list(req, res);

      expect(res.status).to.be.calledOnceWith(httpStatus.BAD_GATEWAY);
      expect(res.json).to.be.calledOnceWith({
        success: false,
        message: "controller server error",
        error: "Database error",
      });
    });

    it("should list inquiries successfully", async () => {
      const req = { query: { limit: "10", skip: "0" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      sinon.stub(validationResult(req)).isEmpty.returns(true);
      sinon
        .stub(generateFilter, "inquiry")
        .returns({ success: true, data: {} });
      sinon.stub(createInquiryUtil, "list").resolves({
        success: true,
        message: "Inquiries listed successfully",
        data: [
          { _id: "inquiry-id", name: "Inquiry 1" },
          { _id: "inquiry-id-2", name: "Inquiry 2" },
        ],
      });

      await inquire.list(req, res);

      expect(createInquiryUtil.list).to.be.calledOnceWith({
        tenant: constants.DEFAULT_TENANT,
        filter: {},
        limit: 10,
        skip: 0,
      });
      expect(res.status).to.be.calledOnceWith(httpStatus.OK);
      expect(res.json).to.be.calledOnceWith({
        success: true,
        message: "Inquiries listed successfully",
        inquiries: [
          { _id: "inquiry-id", name: "Inquiry 1" },
          { _id: "inquiry-id-2", name: "Inquiry 2" },
        ],
      });
    });

    it("should handle list failure with error", async () => {
      const req = { query: { limit: "10", skip: "0" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      sinon.stub(validationResult(req)).isEmpty.returns(true);
      sinon
        .stub(generateFilter, "inquiry")
        .returns({ success: true, data: {} });
      sinon.stub(createInquiryUtil, "list").resolves({
        success: false,
        message: "List inquiry failed",
        error: "Invalid data",
      });

      await inquire.list(req, res);

      expect(createInquiryUtil.list).to.be.calledOnceWith({
        tenant: constants.DEFAULT_TENANT,
        filter: {},
        limit: 10,
        skip: 0,
      });
      expect(res.status).to.be.calledOnceWith(httpStatus.BAD_GATEWAY);
      expect(res.json).to.be.calledOnceWith({
        success: false,
        message: "List inquiry failed",
        error: "Invalid data",
      });
    });

    it("should handle list failure without error", async () => {
      const req = { query: { limit: "10", skip: "0" } };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      sinon.stub(validationResult(req)).isEmpty.returns(true);
      sinon
        .stub(generateFilter, "inquiry")
        .returns({ success: true, data: {} });
      sinon.stub(createInquiryUtil, "list").resolves({
        success: false,
        message: "List inquiry failed",
      });

      await inquire.list(req, res);

      expect(createInquiryUtil.list).to.be.calledOnceWith({
        tenant: constants.DEFAULT_TENANT,
        filter: {},
        limit: 10,
        skip: 0,
      });
      expect(res.status).to.be.calledOnceWith(httpStatus.BAD_REQUEST);
      expect(res.json).to.be.calledOnceWith({
        success: false,
        message: "List inquiry failed",
      });
    });
  });

  describe("delete function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return bad request when validation has errors", async () => {
      const req = { query: {} };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon.stub(validationResult(req));
      validationResultStub.isEmpty.returns(false);
      validationResultStub.errors = [
        { nestedErrors: [{ msg: "Error 1" }, { msg: "Error 2" }] },
      ];

      await inquire.delete(req, res);

      expect(validationResultStub.isEmpty).to.be.calledOnce;
      expect(badRequest).to.be.calledOnceWith(
        res,
        "bad request errors",
        convertErrorArrayToObject(validationResultStub.errors[0].nestedErrors)
      );
    });

    it("should return internal server error when createInquiryUtil throws an error", async () => {
      const req = { query: {} };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      sinon.stub(validationResult(req)).isEmpty.returns(true);
      sinon
        .stub(generateFilter, "inquiry")
        .returns({ success: true, data: {} });
      sinon
        .stub(createInquiryUtil, "delete")
        .throws(new Error("Database error"));

      await inquire.delete(req, res);

      expect(res.status).to.be.calledOnceWith(httpStatus.BAD_GATEWAY);
      expect(res.json).to.be.calledOnceWith({
        success: false,
        message: "controller server error",
        error: "Database error",
      });
    });

    it("should delete inquiry successfully", async () => {
      const req = { query: {} };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      sinon.stub(validationResult(req)).isEmpty.returns(true);
      sinon
        .stub(generateFilter, "inquiry")
        .returns({ success: true, data: {} });
      sinon.stub(createInquiryUtil, "delete").resolves({
        success: true,
        message: "Inquiry deleted successfully",
        data: { _id: "inquiry-id", name: "Inquiry 1" },
      });

      await inquire.delete(req, res);

      expect(createInquiryUtil.delete).to.be.calledOnceWith(
        constants.DEFAULT_TENANT,
        {}
      );
      expect(res.status).to.be.calledOnceWith(httpStatus.OK);
      expect(res.json).to.be.calledOnceWith({
        success: true,
        message: "Inquiry deleted successfully",
        inquiry: { _id: "inquiry-id", name: "Inquiry 1" },
      });
    });

    it("should handle delete failure with error", async () => {
      const req = { query: {} };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      sinon.stub(validationResult(req)).isEmpty.returns(true);
      sinon
        .stub(generateFilter, "inquiry")
        .returns({ success: true, data: {} });
      sinon.stub(createInquiryUtil, "delete").resolves({
        success: false,
        message: "Delete inquiry failed",
        error: "Invalid data",
      });

      await inquire.delete(req, res);

      expect(createInquiryUtil.delete).to.be.calledOnceWith(
        constants.DEFAULT_TENANT,
        {}
      );
      expect(res.status).to.be.calledOnceWith(httpStatus.BAD_GATEWAY);
      expect(res.json).to.be.calledOnceWith({
        success: false,
        message: "Delete inquiry failed",
        inquire: {},
        error: "Invalid data",
      });
    });

    it("should handle delete failure without error", async () => {
      const req = { query: {} };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      sinon.stub(validationResult(req)).isEmpty.returns(true);
      sinon
        .stub(generateFilter, "inquiry")
        .returns({ success: true, data: {} });
      sinon.stub(createInquiryUtil, "delete").resolves({
        success: false,
        message: "Delete inquiry failed",
      });

      await inquire.delete(req, res);

      expect(createInquiryUtil.delete).to.be.calledOnceWith(
        constants.DEFAULT_TENANT,
        {}
      );
      expect(res.status).to.be.calledOnceWith(httpStatus.BAD_REQUEST);
      expect(res.json).to.be.calledOnceWith({
        success: false,
        message: "Delete inquiry failed",
        inquire: {},
      });
    });
  });

  describe("update function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return bad request when validation has errors", async () => {
      const req = { query: {} };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon.stub(validationResult(req));
      validationResultStub.isEmpty.returns(false);
      validationResultStub.errors = [
        { nestedErrors: [{ msg: "Error 1" }, { msg: "Error 2" }] },
      ];

      await inquire.update(req, res);

      expect(validationResultStub.isEmpty).to.be.calledOnce;
      expect(badRequest).to.be.calledOnceWith(
        res,
        "bad request errors",
        convertErrorArrayToObject(validationResultStub.errors[0].nestedErrors)
      );
    });

    it("should return internal server error when createInquiryUtil throws an error", async () => {
      const req = { query: {} };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      sinon.stub(validationResult(req)).isEmpty.returns(true);
      sinon
        .stub(generateFilter, "inquiry")
        .returns({ success: true, data: {} });
      sinon
        .stub(createInquiryUtil, "update")
        .throws(new Error("Database error"));

      await inquire.update(req, res);

      expect(res.status).to.be.calledOnceWith(httpStatus.BAD_GATEWAY);
      expect(res.json).to.be.calledOnceWith({
        success: false,
        message: "controller server error",
        error: "Database error",
      });
    });

    it("should update inquiry successfully", async () => {
      const req = { query: {} };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      sinon.stub(validationResult(req)).isEmpty.returns(true);
      sinon
        .stub(generateFilter, "inquiry")
        .returns({ success: true, data: {} });
      sinon.stub(createInquiryUtil, "update").resolves({
        success: true,
        message: "Inquiry updated successfully",
        data: { _id: "inquiry-id", name: "Inquiry 1" },
      });

      await inquire.update(req, res);

      expect(createInquiryUtil.update).to.be.calledOnceWith(
        constants.DEFAULT_TENANT,
        {},
        {}
      );
      expect(res.status).to.be.calledOnceWith(httpStatus.OK);
      expect(res.json).to.be.calledOnceWith({
        success: true,
        message: "Inquiry updated successfully",
        inquiry: { _id: "inquiry-id", name: "Inquiry 1" },
      });
    });

    it("should handle update failure with error", async () => {
      const req = { query: {} };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      sinon.stub(validationResult(req)).isEmpty.returns(true);
      sinon
        .stub(generateFilter, "inquiry")
        .returns({ success: true, data: {} });
      sinon.stub(createInquiryUtil, "update").resolves({
        success: false,
        message: "Update inquiry failed",
        error: "Invalid data",
      });

      await inquire.update(req, res);

      expect(createInquiryUtil.update).to.be.calledOnceWith(
        constants.DEFAULT_TENANT,
        {},
        {}
      );
      expect(res.status).to.be.calledOnceWith(httpStatus.BAD_GATEWAY);
      expect(res.json).to.be.calledOnceWith({
        success: false,
        message: "Update inquiry failed",
        inquire: {},
        error: "Invalid data",
      });
    });

    it("should handle update failure without error", async () => {
      const req = { query: {} };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      sinon.stub(validationResult(req)).isEmpty.returns(true);
      sinon
        .stub(generateFilter, "inquiry")
        .returns({ success: true, data: {} });
      sinon.stub(createInquiryUtil, "update").resolves({
        success: false,
        message: "Update inquiry failed",
      });

      await inquire.update(req, res);

      expect(createInquiryUtil.update).to.be.calledOnceWith(
        constants.DEFAULT_TENANT,
        {},
        {}
      );
      expect(res.status).to.be.calledOnceWith(httpStatus.BAD_REQUEST);
      expect(res.json).to.be.calledOnceWith({
        success: false,
        message: "Update inquiry failed",
        inquire: {},
      });
    });
  });
});
