const chai = require("chai");
const sinon = require("sinon");
const chaiHttp = require("chai-http");
const mongoose = require("mongoose");

// Import the module being tested
const searchUtil = require("./search-util"); // Adjust the path as needed

// Configure chai plugins
chai.use(chaiHttp);
chai.should();

describe("Search Util", () => {
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

  describe("search", () => {
    it("should return success when search finds results", async () => {
      const tenant = "test-tenant";
      const query = "test";

      mockRequest.query.tenant = tenant;
      mockRequest.query.q = query.toLowerCase();

      const PostModelMock = {
        find: sandbox
          .stub()
          .resolves([
            {
              title: "Test Post",
              content: "This is a test post",
              author: { name: "Test Author" },
              categories: [{ name: "Test Category" }],
              tags: [{ name: "Test Tag" }],
              slug: "test-post",
            },
          ]),
      };

      const AuthorModelMock = {
        find: sandbox
          .stub()
          .resolves([{ name: "Test Author", email: "test@example.com" }]),
      };

      const CategoryModelMock = {
        find: sandbox
          .stub()
          .resolves([{ name: "Test Category", slug: "test-category" }]),
      };

      const TagModelMock = {
        find: sandbox.stub().resolves([{ name: "Test Tag", slug: "test-tag" }]),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        PostModel: PostModelMock,
        AuthorModel: AuthorModelMock,
        CategoryModel: CategoryMock,
        TagModel: TagModelMock,
      });

      await searchUtil.search(query, mockRequest, mockResponse);

      mockResponse.status.should.have.been.calledWith(httpStatus.OK);
      mockResponse.json.should.have.been.calledWith(sinon.match.object);
    });

    it("should handle internal server errors", async () => {
      const tenant = "test-tenant";
      const query = "test";

      mockRequest.query.tenant = tenant;
      mockRequest.query.q = query.toLowerCase();

      const PostModelMock = {
        find: sandbox.stub().rejects(new Error("Database error")),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        PostModel: PostModelMock,
      });

      await searchUtil
        .search(query, mockRequest, mockResponse)
        .should.be.rejectedWith(HttpError);
    });
  });

  describe("autocomplete", () => {
    it("should return autocomplete results for posts", async () => {
      const tenant = "test-tenant";
      const query = "test";

      mockRequest.query.tenant = tenant;
      mockRequest.query.q = query.toLowerCase();

      const PostModelMock = {
        aggregate: sandbox
          .stub()
          .resolves([
            {
              title: "Test Post",
              author: "Test Author",
              categories: [{ name: "Test Category" }],
              tags: [{ name: "Test Tag" }],
              slug: "test-post",
            },
          ]),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        PostModel: PostModelMock,
      });

      await searchUtil.autocomplete(query, mockRequest, mockResponse);

      mockResponse.status.should.have.been.calledWith(httpStatus.OK);
      mockResponse.json.should.have.been.calledWith(sinon.match.object);
    });

    it("should return autocomplete results for authors", async () => {
      const tenant = "test-tenant";
      const query = "test";

      mockRequest.query.tenant = tenant;
      mockRequest.query.q = query.toLowerCase();

      const AuthorModelMock = {
        aggregate: sandbox
          .stub()
          .resolves([{ name: "Test Author", email: "test@example.com" }]),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        AuthorModel: AuthorModelMock,
      });

      await searchUtil.autocomplete(query, mockRequest, mockResponse);

      mockResponse.status.should.have.been.calledWith(httpStatus.OK);
      mockResponse.json.should.have.been.calledWith(sinon.match.object);
    });

    it("should return autocomplete results for categories", async () => {
      const tenant = "test-tenant";
      const query = "test";

      mockRequest.query.tenant = tenant;
      mockRequest.query.q = query.toLowerCase();

      const CategoryModelMock = {
        aggregate: sandbox
          .stub()
          .resolves([{ name: "Test Category", slug: "test-category" }]),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        CategoryModel: CategoryModelMock,
      });

      await searchUtil.autocomplete(query, mockRequest, mockResponse);

      mockResponse.status.should.have.been.calledWith(httpStatus.OK);
      mockResponse.json.should.have.been.calledWith(sinon.match.object);
    });

    it("should return autocomplete results for tags", async () => {
      const tenant = "test-tenant";
      const query = "test";

      mockRequest.query.tenant = tenant;
      mockRequest.query.q = query.toLowerCase();

      const TagModelMock = {
        aggregate: sandbox
          .stub()
          .resolves([{ name: "Test Tag", slug: "test-tag" }]),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        TagModel: TagModelMock,
      });

      await searchUtil.autocomplete(query, mockRequest, mockResponse);

      mockResponse.status.should.have.been.calledWith(httpStatus.OK);
      mockResponse.json.should.have.been.calledWith(sinon.match.object);
    });
  });

  describe("filter", () => {
    it("should filter posts correctly", async () => {
      const tenant = "test-tenant";
      const query = "test";

      mockRequest.query.tenant = tenant;
      mockRequest.query.q = query.toLowerCase();

      const PostModelMock = {
        find: sandbox
          .stub()
          .resolves([
            {
              title: "Test Post",
              content: "This is a test post",
              author: { name: "Test Author" },
              categories: [{ name: "Test Category" }],
              tags: [{ name: "Test Tag" }],
              slug: "test-post",
            },
          ]),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        PostModel: PostModelMock,
      });

      await searchUtil.filter(query, mockRequest, mockResponse);

      mockResponse.status.should.have.been.calledWith(httpStatus.OK);
      mockResponse.json.should.have.been.calledWith(sinon.match.object);
    });

    it("should filter authors correctly", async () => {
      const tenant = "test-tenant";
      const query = "test";

      mockRequest.query.tenant = tenant;
      mockRequest.query.q = query.toLowerCase();

      const AuthorModelMock = {
        find: sandbox
          .stub()
          .resolves([{ name: "Test Author", email: "test@example.com" }]),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        AuthorModel: AuthorModelMock,
      });

      await searchUtil.filter(query, mockRequest, mockResponse);

      mockResponse.status.should.have.been.calledWith(httpStatus.OK);
      mockResponse.json.should.have.been.calledWith(sinon.match.object);
    });

    it("should filter categories correctly", async () => {
      const tenant = "test-tenant";
      const query = "test";

      mockRequest.query.tenant = tenant;
      mockRequest.query.q = query.toLowerCase();

      const CategoryModelMock = {
        find: sandbox
          .stub()
          .resolves([{ name: "Test Category", slug: "test-category" }]),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        CategoryModel: CategoryModelMock,
      });

      await searchUtil.filter(query, mockRequest, mockResponse);

      mockResponse.status.should.have.been.calledWith(httpStatus.OK);
      mockResponse.json.should.have.been.calledWith(sinon.match.object);
    });

    it("should filter tags correctly", async () => {
      const tenant = "test-tenant";
      const query = "test";

      mockRequest.query.tenant = tenant;
      mockRequest.query.q = query.toLowerCase();

      const TagModelMock = {
        find: sandbox.stub().resolves([{ name: "Test Tag", slug: "test-tag" }]),
      };

      sandbox.stub(mongoose.model.bind(mongoose), "call").returns({
        TagModel: TagModelMock,
      });

      await searchUtil.filter(query, mockRequest, mockResponse);

      mockResponse.status.should.have.been.calledWith(httpStatus.OK);
      mockResponse.json.should.have.been.calledWith(sinon.match.object);
    });
  });
});
