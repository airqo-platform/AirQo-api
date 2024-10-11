const sinon = require("sinon");
const chai = require("chai");
const chaiHttp = require("chai-http");
const expect = chai.expect;
const BlogPostManagementController = require("./blog-post-management.controller");

describe("BlogPostManagementController", () => {
  let mockRequest;
  let mockResponse;
  let mockNext;
  let mockBlogPostManagementUtil;

  beforeEach(() => {
    mockRequest = {
      params: {},
      body: {},
      query: {},
    };
    mockResponse = {
      status: sinon.spy(),
      json: sinon.spy(),
    };
    mockNext = sinon.spy();
    mockBlogPostManagementUtil = {
      edit: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Edited successfully",
          data: {},
        }),
      update: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Updated successfully",
          data: {},
        }),
      delete: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Deleted successfully",
          data: {},
        }),
      schedule: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Scheduled successfully",
          data: {},
        }),
      history: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "History retrieved successfully",
          data: [],
        }),
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("edit", () => {
    it("should edit a blog post", async () => {
      mockRequest.params.id = "123";
      mockRequest.body = { title: "New Title", content: "New Content" };

      await BlogPostManagementController.edit(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockBlogPostManagementUtil.edit).toHaveBeenCalledWith(
        "123",
        mockRequest,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Edited successfully",
        editedBlogPost: {},
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "title", message: "Title is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await BlogPostManagementController.edit(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockBlogPostManagementUtil.edit.resolves({});

      await BlogPostManagementController.edit(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("update", () => {
    it("should update a blog post", async () => {
      mockRequest.params.id = "456";
      mockRequest.body = { title: "Updated Title", content: "Updated Content" };

      await BlogPostManagementController.update(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockBlogPostManagementUtil.update).toHaveBeenCalledWith(
        "456",
        mockRequest.body,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Updated successfully",
        updatedBlogPost: {},
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "content", message: "Content is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await BlogPostManagementController.update(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockBlogPostManagementUtil.update.resolves({});

      await BlogPostManagementController.update(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("delete", () => {
    it("should delete a blog post", async () => {
      mockRequest.params.id = "789";
      mockRequest.body = {};

      await BlogPostManagementController.delete(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockBlogPostManagementUtil.delete).toHaveBeenCalledWith(
        "789",
        mockRequest.body,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Deleted successfully",
        deletedBlogPost: {},
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "id", message: "ID is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await BlogPostManagementController.delete(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockBlogPostManagementUtil.delete.resolves({});

      await BlogPostManagementController.delete(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("schedule", () => {
    it("should schedule a blog post", async () => {
      mockRequest.params.id = "101";
      mockRequest.body = { scheduleDate: "2024-09-25T10:00:00Z" };

      await BlogPostManagementController.schedule(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockBlogPostManagementUtil.schedule).toHaveBeenCalledWith(
        "101",
        mockRequest.body,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Scheduled successfully",
        scheduledBlogPost: {},
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [
        { field: "scheduleDate", message: "Schedule Date is required" },
      ];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await BlogPostManagementController.schedule(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockBlogPostManagementUtil.schedule.resolves({});

      await BlogPostManagementController.schedule(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("history", () => {
    it("should retrieve blog post history", async () => {
      mockRequest.params.id = "102";

      await BlogPostManagementController.history(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockBlogPostManagementUtil.history).toHaveBeenCalledWith(
        "102",
        mockRequest,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "History retrieved successfully",
        blogPostHistory: [],
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "id", message: "ID is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await BlogPostManagementController.history(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockBlogPostManagementUtil.history.resolves({});

      await BlogPostManagementController.history(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.json).not.to.have.been.called;
    });
  });
});
