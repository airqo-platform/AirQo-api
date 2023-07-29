require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const createInquiryUtil = require("@utils/create-inquiry");
const generateFilter = require("@utils/generate-filter");
const { validationResult } = require("express-validator");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const { logText, logElement, logObject, logError } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");

const inquire = require("@controllers/create-inquiry");
const createInquiryUtil = require("@utils/create-inquiry");

describe("inquire controller", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("create function", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return bad request when validation has errors", async () => {
      const req = { body: {}, query: {} };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      const validationResultStub = sinon.stub(validationResult(req));
      validationResultStub.isEmpty.returns(false);
      validationResultStub.errors = [
        { nestedErrors: [{ msg: "Error 1" }, { msg: "Error 2" }] },
      ];

      await inquire.create(req, res);

      expect(validationResultStub.isEmpty).to.be.calledOnce;
      expect(badRequest).to.be.calledOnceWith(
        res,
        "bad request errors",
        convertErrorArrayToObject(validationResultStub.errors[0].nestedErrors)
      );
    });

    it("should return internal server error when createInquiryUtil throws an error", async () => {
      const req = { body: {}, query: {} };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      sinon.stub(validationResult(req)).isEmpty.returns(true);
      sinon
        .stub(createInquiryUtil, "create")
        .throws(new Error("Database error"));

      await inquire.create(req, res);

      expect(res.status).to.be.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR);
      expect(res.json).to.be.calledOnceWith({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Database error" },
      });
    });

    it("should create an inquiry successfully", async () => {
      const req = {
        body: {
          fullName: "John Doe",
          email: "john.doe@example.com",
          message: "Test inquiry",
          category: "General",
          firstName: "John",
          lastName: "Doe",
        },
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      sinon.stub(validationResult(req)).isEmpty.returns(true);
      sinon.stub(createInquiryUtil, "create").callsFake((request, callback) => {
        const value = {
          success: true,
          status: httpStatus.CREATED,
          message: "Inquiry created successfully",
          data: { _id: "inquiry-id", ...req.body },
        };
        callback(value);
      });

      await inquire.create(req, res);

      expect(createInquiryUtil.create).to.be.calledOnce;
      expect(res.status).to.be.calledOnceWith(httpStatus.CREATED);
      expect(res.json).to.be.calledOnceWith({
        success: true,
        message: "Inquiry created successfully",
        inquiry: { _id: "inquiry-id", ...req.body },
      });
    });

    it("should handle createInquiryUtil failure", async () => {
      const req = {
        body: {
          fullName: "John Doe",
          email: "john.doe@example.com",
          message: "Test inquiry",
          category: "General",
          firstName: "John",
          lastName: "Doe",
        },
        query: {},
      };
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      sinon.stub(validationResult(req)).isEmpty.returns(true);
      sinon.stub(createInquiryUtil, "create").callsFake((request, callback) => {
        const value = {
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "Inquiry creation failed",
          errors: { message: "Invalid data" },
        };
        callback(value);
      });

      await inquire.create(req, res);

      expect(createInquiryUtil.create).to.be.calledOnce;
      expect(res.status).to.be.calledOnceWith(httpStatus.BAD_REQUEST);
      expect(res.json).to.be.calledOnceWith({
        success: false,
        message: "Inquiry creation failed",
        errors: { message: "Invalid data" },
      });
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
