require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const sinonChai = require("sinon-chai");

const httpStatus = require("http-status");
const BlogPostController = require("@controllers/create-post");
const createBlogPostUtil = require("@utils/create-post");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- blogPost-controller`
);
const { logText, logObject } = require("@utils/log");

// Mock dependencies
const mockRequest = {
  query: {},
  body: {},
};
const mockResponse = {
  json: sinon.spy(),
  status: sinon.spy(),
};
const mockNext = sinon.spy();

describe("BlogPostController", () => {
  beforeEach(() => {
    sinon.replace(log4js, "getLogger", sinon.stub().returns(logger));
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("create", () => {
    it("should call createBlogPostUtil.create with correct arguments", async () => {
      const mockResult = { success: true, data: {} };
      sinon.stub(createBlogPostUtil, "create").resolves(mockResult);

      await BlogPostController.create(mockRequest, mockResponse, mockNext);

      expect(createBlogPostUtil.create).toHaveBeenCalledWith(
        mockRequest,
        mockNext
      );
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
        blogPost: mockResult.data,
      });
    });

    it("should handle errors from createBlogPostUtil.create", async () => {
      const mockError = new Error("Test error");
      sinon.stub(createBlogPostUtil, "create").rejects(mockError);

      await BlogPostController.create(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });
  });

  describe("list", () => {
    it("should call createBlogPostUtil.list with correct arguments", async () => {
      const mockResult = { success: true, data: [] };
      sinon.stub(createBlogPostUtil, "list").resolves(mockResult);

      await BlogPostController.list(mockRequest, mockResponse, mockNext);

      expect(createBlogPostUtil.list).toHaveBeenCalledWith(
        mockRequest,
        mockNext
      );
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
        blogPosts: mockResult.data,
      });
    });

    it("should handle errors from createBlogPostUtil.list", async () => {
      const mockError = new Error("Test error");
      sinon.stub(createBlogPostUtil, "list").rejects(mockError);

      await BlogPostController.list(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });
  });

  describe("retrieve", () => {
    it("should call createBlogPostUtil.retrieve with correct arguments", async () => {
      const mockResult = { success: true, data: {} };
      sinon.stub(createBlogPostUtil, "retrieve").resolves(mockResult);

      await BlogPostController.retrieve(mockRequest, mockResponse, mockNext);

      expect(createBlogPostUtil.retrieve).toHaveBeenCalledWith(
        mockRequest,
        mockNext
      );
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
        blogPost: mockResult.data,
      });
    });

    it("should handle errors from createBlogPostUtil.retrieve", async () => {
      const mockError = new Error("Test error");
      sinon.stub(createBlogPostUtil, "retrieve").rejects(mockError);

      await BlogPostController.retrieve(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });
  });

  describe("update", () => {
    it("should call createBlogPostUtil.update with correct arguments", async () => {
      const mockResult = { success: true, data: {} };
      sinon.stub(createBlogPostUtil, "update").resolves(mockResult);

      await BlogPostController.update(mockRequest, mockResponse, mockNext);

      expect(createBlogPostUtil.update).toHaveBeenCalledWith(
        mockRequest,
        mockNext
      );
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
        blogPost: mockResult.data,
      });
    });

    it("should handle errors from createBlogPostUtil.update", async () => {
      const mockError = new Error("Test error");
      sinon.stub(createBlogPostUtil, "update").rejects(mockError);

      await BlogPostController.update(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });
  });

  describe("delete", () => {
    it("should call createBlogPostUtil.delete with correct arguments", async () => {
      const mockResult = { success: true };
      sinon.stub(createBlogPostUtil, "delete").resolves(mockResult);

      await BlogPostController.delete(mockRequest, mockResponse, mockNext);

      expect(createBlogPostUtil.delete).toHaveBeenCalledWith(
        mockRequest,
        mockNext
      );
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
      });
    });

    it("should handle errors from createBlogPostUtil.delete", async () => {
      const mockError = new Error("Test error");
      sinon.stub(createBlogPostUtil, "delete").rejects(mockError);

      await BlogPostController.delete(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });
  });

  describe("uploadImage", () => {
    it("should call createBlogPostUtil.uploadImage with correct arguments", async () => {
      const mockResult = { success: true, data: "" };
      sinon.stub(createBlogPostUtil, "uploadImage").resolves(mockResult);

      await BlogPostController.uploadImage(mockRequest, mockResponse, mockNext);

      expect(createBlogPostUtil.uploadImage).toHaveBeenCalledWith(
        mockRequest,
        mockNext
      );
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
        imageUrl: mockResult.data,
      });
    });

    it("should handle errors from createBlogPostUtil.uploadImage", async () => {
      const mockError = new Error("Test error");
      sinon.stub(createBlogPostUtil, "uploadImage").rejects(mockError);

      await BlogPostController.uploadImage(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });
  });

  describe("preview", () => {
    it("should call createBlogPostUtil.preview with correct arguments", async () => {
      const mockResult = { success: true, data: "" };
      sinon.stub(createBlogPostUtil, "preview").resolves(mockResult);

      await BlogPostController.preview(mockRequest, mockResponse, mockNext);

      expect(createBlogPostUtil.preview).toHaveBeenCalledWith(
        mockRequest,
        mockNext
      );
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
        htmlContent: mockResult.data,
      });
    });

    it("should handle errors from createBlogBlogPostUtil.preview", async () => {
      const mockError = new Error("Test error");
      sinon.stub(createBlogPostUtil, "preview").rejects(mockError);

      await BlogPostController.preview(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });
  });

  describe("updateDraftStatus", () => {
    it("should call createBlogPostUtil.updateDraftStatus with correct arguments", async () => {
      const mockRequest = {
        query: { tenant: "custom-tenant" },
        body: {
          /* Add any necessary body properties */
        },
      };
      const mockResponse = {
        json: sinon.spy(),
        status: sinon.spy(),
      };
      const mockNext = sinon.spy();

      const mockResult = {
        success: true,
        status: httpStatus.OK,
        message: "Status updated successfully",
        data: "HTML content",
      };

      sinon.stub(createBlogPostUtil, "updateDraftStatus").resolves(mockResult);

      await BlogPostController.updateDraftStatus(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(createBlogPostUtil.updateDraftStatus).toHaveBeenCalledWith(
        mockRequest,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: mockResult.message,
        htmlContent: mockResult.data,
      });
    });

    it("should handle errors from createBlogPostUtil.updateDraftStatus", async () => {
      const mockRequest = {
        query: { tenant: "custom-tenant" },
        body: {
          /* Add any necessary body properties */
        },
      };
      const mockResponse = {
        json: sinon.spy(),
        status: sinon.spy(),
      };
      const mockNext = sinon.spy();

      const mockError = new Error("Test error");
      sinon.stub(createBlogPostUtil, "updateDraftStatus").rejects(mockError);

      await BlogPostController.updateDraftStatus(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(sinon.match.instanceOf(HttpError));
    });

    it("should handle empty result from createBlogPostUtil.updateDraftStatus", async () => {
      const mockRequest = {
        query: { tenant: "custom-tenant" },
        body: {
          /* Add any necessary body properties */
        },
      };
      const mockResponse = {
        json: sinon.spy(),
        status: sinon.spy(),
      };
      const mockNext = sinon.spy();

      const mockResult = {};
      sinon.stub(createBlogPostUtil, "updateDraftStatus").resolves(mockResult);

      await BlogPostController.updateDraftStatus(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle errors during execution", async () => {
      const mockRequest = {
        query: { tenant: "custom-tenant" },
        body: {
          /* Add any necessary body properties */
        },
      };
      const mockResponse = {
        json: sinon.spy(),
        status: sinon.spy(),
      };
      const mockNext = sinon.spy();

      const mockError = new Error("Execution error");
      sinon.stub(createBlogPostUtil, "updateDraftStatus").rejects(mockError);

      await BlogPostController.updateDraftStatus(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(logger.error).toHaveBeenCalledWith(
        `🐛🐛 Internal Server Error ${mockError.message}`
      );
      expect(mockNext).toHaveBeenCalledWith(sinon.match.instanceOf(HttpError));
    });
  });
});
