const chai = require("chai");
const sinon = require("sinon");
const chaiHttp = require("chai-http");
const mongoose = require("mongoose");

// Import the module being tested
const moderateContent = require("./moderate-content"); // Adjust the path as needed

// Configure chai plugins
chai.use(chaiHttp);
chai.should();

describe("Moderate Content", () => {
  let sandbox;
  let mockRequest;
  let mockResponse;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockRequest = {
      query: {},
      params: {},
      body: {},
    };
    mockResponse = {
      status: sinon.stub().returns(mockResponse),
      json: sinon.stub(),
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("reviewAuthor", () => {
    it("should return success when author exists", async () => {
      const tenant = "test-tenant";
      const authorId = "1234567890abcdef";

      mockRequest.query.tenant = tenant;
      mockRequest.params.authorId = authorId;

      const AuthorModelMock = {
        findById: sandbox.stub().resolves({
          _id: authorId,
          name: "Test Author",
          __v: 0,
        }),
      };

      sandbox
        .stub(mongoose.model.bind(mongoose), "call")
        .returns(AuthorModelMock);

      await moderateContent.reviewAuthor(mockRequest, mockResponse);

      mockResponse.status.should.have.been.calledWith(httpStatus.OK);
      mockResponse.json.should.have.been.calledWith(sinon.match.object);
    });

    it("should throw HttpError when author does not exist", async () => {
      const tenant = "test-tenant";
      const authorId = "1234567890abcdef";

      mockRequest.query.tenant = tenant;
      mockRequest.params.authorId = authorId;

      const AuthorModelMock = {
        findById: sandbox.stub().resolves(null),
      };

      sandbox
        .stub(mongoose.model.bind(mongoose), "call")
        .returns(AuthorModelMock);

      await moderateContent
        .reviewAuthor(mockRequest, mockResponse)
        .should.be.rejectedWith(HttpError);
    });
  });

  describe("flagComment", () => {
    it("should return success when comment exists", async () => {
      const tenant = "test-tenant";
      const commentId = "9876543210fedcba";

      mockRequest.query.tenant = tenant;
      mockRequest.params.commentId = commentId;

      const CommentModelMock = {
        findById: sandbox.stub().resolves({
          _id: commentId,
          content: "Test comment",
          __v: 0,
        }),
        find: sandbox.stub().resolves([{ _id: commentId, flags: [] }]),
      };

      sandbox
        .stub(mongoose.model.bind(mongoose), "call")
        .returns(CommentModelMock);

      await moderateContent.flagComment(mockRequest, mockResponse);

      mockResponse.status.should.have.been.calledWith(httpStatus.OK);
      mockResponse.json.should.have.been.calledWith(sinon.match.object);
    });

    it("should throw HttpError when comment does not exist", async () => {
      const tenant = "test-tenant";
      const commentId = "9876543210fedcba";

      mockRequest.query.tenant = tenant;
      mockRequest.params.commentId = commentId;

      const CommentModelMock = {
        findById: sandbox.stub().resolves(null),
      };

      sandbox
        .stub(mongoose.model.bind(mongoose), "call")
        .returns(CommentModelMock);

      await moderateContent
        .flagComment(mockRequest, mockResponse)
        .should.be.rejectedWith(HttpError);
    });
  });

  describe("viewFlags", () => {
    it("should return success when flags exist", async () => {
      const tenant = "test-tenant";
      const commentId = "9876543210fedcba";

      mockRequest.query.tenant = tenant;
      mockRequest.params.commentId = commentId;

      const CommentModelMock = {
        find: sandbox
          .stub()
          .resolves([{ _id: commentId, flags: [{ flagger: "User1" }] }]),
      };

      sandbox
        .stub(mongoose.model.bind(mongoose), "call")
        .returns(CommentModelMock);

      await moderateContent.viewFlags(mockRequest, mockResponse);

      mockResponse.status.should.have.been.calledWith(httpStatus.OK);
      mockResponse.json.should.have.been.calledWith(sinon.match.object);
    });

    it("should return empty array when no flags exist", async () => {
      const tenant = "test-tenant";
      const commentId = "9876543210fedcba";

      mockRequest.query.tenant = tenant;
      mockRequest.params.commentId = commentId;

      const CommentModelMock = {
        find: sandbox.stub().resolves([]),
      };

      sandbox
        .stub(mongoose.model.bind(mongoose), "call")
        .returns(CommentModelMock);

      await moderateContent.viewFlags(mockRequest, mockResponse);

      mockResponse.status.should.have.been.calledWith(httpStatus.OK);
      mockResponse.json.should.have.been.calledWith(sinon.match.object);
    });
  });

  describe("manageAuthors", () => {
    it("should call appropriate method based on request method", async () => {
      const tenant = "test-tenant";
      const authorId = "1234567890abcdef";
      const requestBody = { action: "update" };

      mockRequest.query.tenant = tenant;
      mockRequest.params.authorId = authorId;
      mockRequest.body = requestBody;

      const AuthorModelMock = {
        update: sinon.spy(),
        delete: sinon.spy(),
      };

      sandbox
        .stub(mongoose.model.bind(mongoose), "call")
        .returns(AuthorModelMock);

      await moderateContent.manageAuthors(mockRequest, mockResponse);

      sinon.assert.calledOnce(AuthorModelMock.update);
      sinon.assert.notCalled(AuthorModelMock.delete);
    });

    it("should handle internal server error", async () => {
      const tenant = "test-tenant";
      const authorId = "1234567890abcdef";
      const requestBody = { action: "delete" };

      mockRequest.query.tenant = tenant;
      mockRequest.params.authorId = authorId;
      mockRequest.body = requestBody;

      const AuthorModelMock = {
        delete: sinon.spy().throws(new Error("Database error")),
      };

      sandbox
        .stub(mongoose.model.bind(mongoose), "call")
        .returns(AuthorModelMock);

      await moderateContent
        .manageAuthors(mockRequest, mockResponse)
        .should.be.rejectedWith(HttpError);
    });
  });
});
