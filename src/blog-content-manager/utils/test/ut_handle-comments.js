const chai = require("chai");
const sinon = require("sinon");
const chaiHttp = require("chai-http");
const mongoose = require("mongoose");
const { HttpError } = require("@utils/errors");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- comment-util`);
const CommentModel = require("@models/Comment");
const PostModel = require("@models/Post");

const commentUtil = require("./comment-util"); // Adjust the path as needed

// Configure chai plugins
chai.use(chaiHttp);
chai.should();

describe("Comment Util", () => {
  let sandbox;
  let mockRequest;
  let mockNext;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockRequest = {
      query: {},
      body: {},
    };
    mockNext = sinon.spy();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("create", () => {
    it("should return success when creating a new comment", async () => {
      const postId = "test-post-id";
      const requestBody = {
        author: "Test User",
        content: "This is a test comment",
      };

      const PostModelMock = {
        findById: sandbox.stub().resolves({}),
      };

      const CommentModelMock = {
        save: sandbox.stub().resolves({
          toJSON: () => ({
            id: "test-comment-id",
            author: "Test User",
            content: "This is a test comment",
          }),
        }),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        PostModel: PostModelMock,
        CommentModel: CommentModelMock,
      });

      const result = await commentUtil.create(postId, requestBody, mockNext);

      result.should.have.property("success");
      result.success.should.be.true;
      result.status.should.equal(httpStatus.CREATED);
      result.data.should.deep.equal({
        id: "test-comment-id",
        author: "Test User",
        content: "This is a test comment",
      });
    });

    it("should handle errors when creating a new comment", async () => {
      const postId = "test-post-id";
      const requestBody = {
        author: "Test User",
        content: "This is a test comment",
      };

      const PostModelMock = {
        findById: sandbox.stub().rejects(new Error("Post not found")),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        PostModel: PostModelMock,
      });

      await commentUtil
        .create(postId, requestBody, mockNext)
        .should.be.rejectedWith(HttpError);
    });
  });

  describe("list", () => {
    it("should return comments for a post", async () => {
      const postId = "test-post-id";
      const query = { limit: 10, skip: 0 };
      const mockComments = [
        { id: "comment1", author: "User1", content: "Comment 1" },
        { id: "comment2", author: "User2", content: "Comment 2" },
      ];

      const CommentModelMock = {
        getCommentsByPost: sandbox
          .stub()
          .resolves({ success: true, comments: mockComments }),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        CommentModel: CommentModelMock,
      });

      const result = await commentUtil.list(postId, mockRequest, mockNext);

      result.should.deep.equal(mockComments);
    });

    it("should handle errors when listing comments", async () => {
      const postId = "test-post-id";

      const CommentModelMock = {
        getCommentsByPost: sandbox.stub().rejects(new Error("Database error")),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        CommentModel: CommentModelMock,
      });

      await commentUtil
        .list(postId, mockRequest, mockNext)
        .should.be.rejectedWith(HttpError);
    });
  });

  describe("replies", () => {
    it("should return replies for a comment", async () => {
      const postId = "test-post-id";
      const commentId = "test-comment-id";
      const query = { limit: 10, skip: 0 };
      const mockReplies = [
        { id: "reply1", author: "User1", content: "Reply 1" },
        { id: "reply2", author: "User2", content: "Reply 2" },
      ];

      const CommentModelMock = {
        list: sandbox.stub().resolves({ success: true, comments: mockReplies }),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        CommentModel: CommentModelMock,
      });

      const result = await commentUtil.replies(
        postId,
        commentId,
        mockRequest,
        mockNext
      );

      result.should.deep.equal(mockReplies);
    });

    it("should handle errors when retrieving replies", async () => {
      const postId = "test-post-id";
      const commentId = "test-comment-id";

      const CommentModelMock = {
        list: sandbox.stub().rejects(new Error("Database error")),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        CommentModel: CommentModelMock,
      });

      await commentUtil
        .replies(postId, commentId, mockRequest, mockNext)
        .should.be.rejectedWith(HttpError);
    });
  });

  describe("edit", () => {
    it("should successfully edit a comment", async () => {
      const postId = "test-post-id";
      const commentId = "test-comment-id";
      const requestBody = { content: "Edited comment" };

      const CommentModelMock = {
        findByIdAndUpdate: sandbox.stub().resolves({ nModified: 1 }),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        CommentModel: CommentModelMock,
      });

      const result = await commentUtil.edit(
        postId,
        commentId,
        requestBody,
        mockNext
      );

      result.should.have.property("success");
      result.success.should.be.true;
      result.status.should.equal(httpStatus.OK);
      result.data.should.deep.equal({
        id: "test-comment-id",
        content: "Edited comment",
      });
    });

    it("should handle errors when editing a comment", async () => {
      const postId = "test-post-id";
      const commentId = "test-comment-id";
      const requestBody = { content: "Edited comment" };

      const CommentModelMock = {
        findByIdAndUpdate: sandbox.stub().resolves({ nModified: 0 }),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        CommentModel: CommentModelMock,
      });

      await commentUtil
        .edit(postId, commentId, requestBody, mockNext)
        .should.be.rejectedWith(HttpError);
    });
  });

  describe("delete", () => {
    it("should delete a comment and its replies", async () => {
      const postId = "test-post-id";
      const commentId = "test-comment-id";

      const CommentModelMock = {
        findByIdAndRemove: sandbox.stub().resolves({}),
        deleteMany: sandbox.stub().resolves({}),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        CommentModel: CommentModelMock,
      });

      const result = await commentUtil.delete(postId, commentId, {}, mockNext);

      result.should.have.property("success");
      result.success.should.be.true;
      result.status.should.equal(httpStatus.NO_CONTENT);
    });

    it("should handle errors when deleting a comment", async () => {
      const postId = "test-post-id";
      const commentId = "test-comment-id";

      const CommentModelMock = {
        findByIdAndRemove: sandbox.stub().rejects(new Error("Database error")),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        CommentModel: CommentModelMock,
      });

      await commentUtil
        .delete(postId, commentId, {}, mockNext)
        .should.be.rejectedWith(HttpError);
    });
  });

  describe("approve", () => {
    it("should approve a comment", async () => {
      const postId = "test-post-id";
      const commentId = "test-comment-id";

      const requestBody = { status: "approved" };

      const CommentModelMock = {
        findByIdAndUpdate: sandbox.stub().resolves({}),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        CommentModel: CommentModelMock,
      });

      const result = await commentUtil.approve(
        postId,
        commentId,
        requestBody,
        mockNext
      );

      result.should.have.property("success");
      result.success.should.be.true;
      result.status.should.equal(httpStatus.OK);
      result.data.should.deep.equal({
        id: "test-comment-id",
        status: "approved",
      });
    });

    it("should handle errors when approving a comment", async () => {
      const postId = "test-post-id";
      const commentId = "test-comment-id";

      const requestBody = { status: "approved" };

      const CommentModelMock = {
        findByIdAndUpdate: sandbox.stub().rejects(new Error("Database error")),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        CommentModel: CommentModelMock,
      });

      await commentUtil
        .approve(postId, commentId, requestBody, mockNext)
        .should.be.rejectedWith(HttpError);
    });
  });

  describe("reject", () => {
    it("should reject a comment", async () => {
      const postId = "test-post-id";
      const commentId = "test-comment-id";

      const requestBody = { status: "rejected" };

      const CommentModelMock = {
        findByIdAndUpdate: sandbox.stub().resolves({}),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        CommentModel: CommentModelMock,
      });

      const result = await commentUtil.reject(
        postId,
        commentId,
        requestBody,
        mockNext
      );

      result.should.have.property("success");
      result.success.should.be.true;
      result.status.should.equal(httpStatus.OK);
      result.data.should.deep.equal({
        id: "test-comment-id",
        status: "rejected",
      });
    });

    it("should handle errors when rejecting a comment", async () => {
      const postId = "test-post-id";
      const commentId = "test-comment-id";

      const requestBody = { status: "rejected" };

      const CommentModelMock = {
        findByIdAndUpdate: sandbox.stub().rejects(new Error("Database error")),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        CommentModel: CommentModelMock,
      });

      await commentUtil
        .reject(postId, commentId, requestBody, mockNext)
        .should.be.rejectedWith(HttpError);
    });
  });
});
