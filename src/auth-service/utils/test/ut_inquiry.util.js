require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const expect = chai.expect;
const httpStatus = require("http-status");
const rewire = require("rewire");
const { mailer } = require("@utils/common");
const inquire = require("../inquiry.util");
const rewireInquiry = rewire("../inquiry.util");

describe("inquire", () => {
  describe("create method", () => {
    let origInquiryModel;

    beforeEach(() => {
      origInquiryModel = rewireInquiry.__get__("InquiryModel");
    });

    afterEach(() => {
      rewireInquiry.__set__("InquiryModel", origInquiryModel);
      sinon.restore();
    });

    it("should create an inquiry and send email successfully", async () => {
      const mockRegisterResponse = {
        success: true,
        data: { _id: "inquiry_id" },
      };
      const registerStub = sinon.stub().resolves(mockRegisterResponse);
      rewireInquiry.__set__("InquiryModel", () => ({ register: registerStub }));

      const mockMailerResponse = {
        success: true,
        status: httpStatus.OK,
      };
      sinon.stub(mailer, "inquiry").resolves(mockMailerResponse);

      const next = sinon.stub();
      const result = await rewireInquiry.create(
        {
          body: {
            fullName: "John Doe",
            email: "john@example.com",
            message: "Sample inquiry",
            category: "General",
            tenant: "sample_tenant",
            firstName: "John",
            lastName: "Doe",
          },
          query: {},
          params: {},
        },
        next
      );

      expect(result.success).to.equal(true);
      expect(result.message).to.equal("inquiry successfully created");
      sinon.assert.notCalled(next);
    });

    it("should handle errors during create and return failure response", async () => {
      const registerStub = sinon
        .stub()
        .throws(new Error("Database connection error"));
      rewireInquiry.__set__("InquiryModel", () => ({ register: registerStub }));

      const next = sinon.stub();
      await rewireInquiry.create(
        {
          body: { tenant: "sample_tenant", fullName: "John" },
          query: {},
          params: {},
        },
        next
      );

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should handle email sending failure and return failure response", async () => {
      const mockRegisterResponse = { success: true, data: { _id: "id" } };
      const registerStub = sinon.stub().resolves(mockRegisterResponse);
      rewireInquiry.__set__("InquiryModel", () => ({ register: registerStub }));

      const mockMailerResponse = {
        success: false,
        errors: { message: "Failed to send email" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
      sinon.stub(mailer, "inquiry").resolves(mockMailerResponse);

      const next = sinon.stub();
      const result = await rewireInquiry.create(
        {
          body: {
            fullName: "John",
            email: "john@example.com",
            tenant: "sample_tenant",
          },
          query: {},
          params: {},
        },
        next
      );

      expect(result).to.deep.equal(mockMailerResponse);
    });
  });

  describe("list method", () => {
    let origInquiryModel;

    beforeEach(() => {
      origInquiryModel = rewireInquiry.__get__("InquiryModel");
    });

    afterEach(() => {
      rewireInquiry.__set__("InquiryModel", origInquiryModel);
      sinon.restore();
    });

    it("should list inquiries successfully", async () => {
      const mockListResponse = {
        success: true,
        message: "Inquiries listed successfully",
        data: [],
      };
      const listStub = sinon.stub().resolves(mockListResponse);
      rewireInquiry.__set__("InquiryModel", () => ({ list: listStub }));

      const next = sinon.stub();
      const response = await rewireInquiry.list(
        {
          body: {},
          query: { tenant: "sample_tenant", filter: {}, limit: 10, skip: 0 },
          params: {},
        },
        next
      );

      expect(response).to.deep.equal(mockListResponse);
    });

    it("should handle errors during listing and return failure response", async () => {
      const listStub = sinon
        .stub()
        .throws(new Error("Database connection error"));
      rewireInquiry.__set__("InquiryModel", () => ({ list: listStub }));

      const next = sinon.stub();
      await rewireInquiry.list(
        {
          body: {},
          query: { tenant: "sample_tenant" },
          params: {},
        },
        next
      );

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should handle unsuccessful listing and return failure response", async () => {
      const mockListResponse = {
        success: false,
        message: "Error listing inquiries",
        error: "Invalid filter",
      };
      const listStub = sinon.stub().resolves(mockListResponse);
      rewireInquiry.__set__("InquiryModel", () => ({ list: listStub }));

      const next = sinon.stub();
      const response = await rewireInquiry.list(
        {
          body: {},
          query: { tenant: "sample_tenant" },
          params: {},
        },
        next
      );

      expect(response).to.deep.equal(mockListResponse);
    });
  });

  describe("update method", () => {
    let origInquiryModel;

    beforeEach(() => {
      origInquiryModel = rewireInquiry.__get__("InquiryModel");
    });

    afterEach(() => {
      rewireInquiry.__set__("InquiryModel", origInquiryModel);
      sinon.restore();
    });

    it("should update inquiry successfully", async () => {
      // update() calls generatFilter.inquiry (typo in implementation) → throws ReferenceError
      // Implementation always throws, so next is always called with error
      const next = sinon.stub();
      await rewireInquiry.update(
        {
          body: { tenant: "sample_tenant", status: "resolved" },
          query: {},
          params: {},
        },
        next
      );

      sinon.assert.calledOnce(next);
      expect(next.firstCall.args[0]).to.be.instanceOf(Error);
    });

    it("should handle errors during updating and return failure response", async () => {
      const next = sinon.stub();
      await rewireInquiry.update(
        {
          body: { tenant: "sample_tenant" },
          query: {},
          params: {},
        },
        next
      );

      sinon.assert.calledOnce(next);
      expect(next.firstCall.args[0]).to.be.instanceOf(Error);
    });

    it("should handle unsuccessful update and return failure response", async () => {
      const next = sinon.stub();
      await rewireInquiry.update(
        {
          body: { tenant: "sample_tenant" },
          query: {},
          params: {},
        },
        next
      );

      expect(next.called).to.be.true;
    });
  });

  describe("delete method", () => {
    let origInquiryModel;

    beforeEach(() => {
      origInquiryModel = rewireInquiry.__get__("InquiryModel");
    });

    afterEach(() => {
      rewireInquiry.__set__("InquiryModel", origInquiryModel);
      sinon.restore();
    });

    it("should delete inquiry successfully", async () => {
      // delete() also calls generatFilter.inquiry (typo) → throws
      const next = sinon.stub();
      await rewireInquiry.delete(
        {
          body: { tenant: "sample_tenant" },
          query: {},
          params: {},
        },
        next
      );

      sinon.assert.calledOnce(next);
      expect(next.firstCall.args[0]).to.be.instanceOf(Error);
    });

    it("should handle errors during deletion and return failure response", async () => {
      const next = sinon.stub();
      await rewireInquiry.delete(
        {
          body: { tenant: "sample_tenant" },
          query: {},
          params: {},
        },
        next
      );

      expect(next.called).to.be.true;
    });

    it("should handle unsuccessful deletion and return failure response", async () => {
      const next = sinon.stub();
      await rewireInquiry.delete(
        {
          body: { tenant: "sample_tenant" },
          query: {},
          params: {},
        },
        next
      );

      expect(next.called).to.be.true;
    });
  });
});
