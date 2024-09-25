const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const chaiAsPromised = require("chai-as-promised");

const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);

const CommentController = require("./comment.controller");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const { isEmpty } = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- comment-controller`
);
const { logText, logObject } = require("@utils/log");

describe("CommentController", () => {
  let mockRequest;
  let mockResponse;
  let mockNext;
  let mockCommentUtil;

  beforeEach(() => {
    mockRequest = {
      params: {},
      body: {},
      query: {},
    };

    mockResponse = {
      json: sinon.spy(),
      status: sinon.spy(),
    };

    mockNext = sinon.spy();

    mockCommentUtil = {
      create: sinon.stub().resolves({ success: true, data: {}, status: 201 }),
      list: sinon.stub().resolves({ success: true, data: [], status: 200 }),
      replies: sinon.stub().resolves({ success: true, data: {}, status: 200 }),
      edit: sinon.stub().resolves({ success: true, data: {}, status: 200 }),
      delete: sinon.stub().resolves({ success: true, status: 204 }),
      approve: sinon.stub().resolves({ success: true, data: {}, status: 200 }),
      reject: sinon.stub().resolves({ success: true, data: {}, status: 200 }),
    };
  });

  describe("create", () => {
    it("should create a new comment successfully", async () => {
      mockRequest.params.postId = "123";
      mockRequest.body = { text: "New comment", tenant: "airqo" };

      await CommentController.create(mockRequest, mockResponse, mockNext);

      expect(mockCommentUtil.create).toHaveBeenCalledWith(
        "123",
        mockRequest.body,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(201);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockCommentUtil.create.getCall(0).args[0].message,
        commentId: mockCommentUtil.create.getCall(0).args[0].data.id,
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "text", message: "Text is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await CommentController.create(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockCommentUtil.create.resolves({});

      await CommentController.create(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("list", () => {
    it("should list comments successfully", async () => {
      mockRequest.params.postId = "123";
      mockRequest.query.tenant = "airqo";

      await CommentController.list(mockRequest, mockResponse, mockNext);

      expect(mockCommentUtil.list).toHaveBeenCalledWith(
        "123",
        mockRequest,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockCommentUtil.list.getCall(0).args[0].message,
        commentsData: mockCommentUtil.list.getCall(0).args[0].data,
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "query.tenant", message: "Tenant is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await CommentController.list(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockCommentUtil.list.resolves({});

      await CommentController.list(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("replies", () => {
    it("should list replies successfully", async () => {
      mockRequest.params.postId = "123";
      mockRequest.params.commentId = "456";
      mockRequest.query.tenant = "airqo";

      await CommentController.replies(mockRequest, mockResponse, mockNext);

      expect(mockCommentUtil.replies).toHaveBeenCalledWith(
        "123",
        "456",
        mockRequest,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockCommentUtil.replies.getCall(0).args[0].message,
        repliesData: mockCommentUtil.replies.getCall(0).args[0].data,
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [
        { field: "commentId", message: "Comment ID is required" },
      ];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await CommentController.replies(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockCommentUtil.replies.resolves({});

      await CommentController.replies(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("edit", () => {
    it("should edit a comment successfully", async () => {
      mockRequest.params.postId = "123";
      mockRequest.params.commentId = "456";
      mockRequest.body = { text: "Updated comment", tenant: "airqo" };

      await CommentController.edit(mockRequest, mockResponse, mockNext);

      expect(mockCommentUtil.edit).toHaveBeenCalledWith(
        "123",
        "456",
        mockRequest.body,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockCommentUtil.edit.getCall(0).args[0].message,
        editedComment: mockCommentUtil.edit.getCall(0).args[0].data,
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "text", message: "Text is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await CommentController.edit(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockCommentUtil.edit.resolves({});

      await CommentController.edit(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("delete", () => {
    it("should delete a comment successfully", async () => {
      mockRequest.params.postId = "123";
      mockRequest.params.commentId = "456";
      mockRequest.body = { tenant: "airqo" };

      await CommentController.delete(mockRequest, mockResponse, mockNext);

      expect(mockCommentUtil.delete).toHaveBeenCalledWith(
        "123",
        "456",
        mockRequest.body,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(204);
      expect(mockResponse.json).to.have.been.calledWith({});
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "tenant", message: "Tenant is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await CommentController.delete(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockCommentUtil.delete.resolves({});

      await CommentController.delete(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("approve", () => {
    it("should approve a comment successfully", async () => {
      mockRequest.params.postId = "123";
      mockRequest.params.commentId = "456";
      mockRequest.body = { tenant: "airqo" };

      await CommentController.approve(mockRequest, mockResponse, mockNext);

      expect(mockCommentUtil.approve).toHaveBeenCalledWith(
        "123",
        "456",
        mockRequest.body,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockCommentUtil.approve.getCall(0).args[0].message,
        approvedComment: mockCommentUtil.approve.getCall(0).args[0].data,
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "tenant", message: "Tenant is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await CommentController.approve(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockCommentUtil.approve.resolves({});

      await CommentController.approve(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("reject", () => {
    it("should reject a comment successfully", async () => {
      mockRequest.params.postId = "123";
      mockRequest.params.commentId = "456";
      mockRequest.body = { tenant: "airqo" };

      await CommentController.reject(mockRequest, mockResponse, mockNext);

      expect(mockCommentUtil.reject).toHaveBeenCalledWith(
        "123",
        "456",
        mockRequest.body,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockCommentUtil.reject.getCall(0).args[0].message,
        rejectedComment: mockCommentUtil.reject.getCall(0).args[0].data,
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "tenant", message: "Tenant is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await CommentController.reject(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockCommentUtil.reject.resolves({});

      await CommentController.reject(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  // Helper functions
  function setupMockRequest(methodName) {
    const mockRequest = {
      params: {},
      body: {},
      query: {},
    };

    mockRequest.params[methodName] = "123";
    mockRequest.body.tenant = constants.DEFAULT_TENANT || "airqo";

    return mockRequest;
  }

  function setupMockResponse() {
    return {
      json: sinon.spy(),
      status: sinon.spy(),
    };
  }
});
