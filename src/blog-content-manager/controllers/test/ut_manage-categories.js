const sinon = require("sinon");
const chai = require("chai");
const chaiHttp = require("chai-http");
const expect = chai.expect;
const CategoryTagController = require("./categoryTag.controller");

describe("CategoryTagController", () => {
  let mockRequest;
  let mockResponse;
  let mockNext;
  let mockCategoryTagUtil;

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
    mockCategoryTagUtil = {
      create: sinon
        .stub()
        .resolves({
          success: true,
          status: 201,
          message: "Created",
          data: { id: "123" },
        }),
      list: sinon
        .stub()
        .resolves({ success: true, status: 200, message: "OK", data: [] }),
      update: sinon
        .stub()
        .resolves({ success: true, status: 200, message: "Updated", data: {} }),
      delete: sinon
        .stub()
        .resolves({ success: true, status: 204, message: "" }),
      assign: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Assigned",
          data: {},
        }),
      posts: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Posts fetched",
          data: [],
        }),
      browseCategories: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Categories browsed",
          data: [],
        }),
      browseTags: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Tags browsed",
          data: [],
        }),
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("create", () => {
    it("should create a new category tag", async () => {
      mockRequest.body = { name: "Test Category Tag" };

      await CategoryTagController.create(mockRequest, mockResponse, mockNext);

      expect(mockCategoryTagUtil.create).toHaveBeenCalledWith(
        mockRequest.body,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(201);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Created",
        categoryId: "123",
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "name", message: "Name is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await CategoryTagController.create(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockCategoryTagUtil.create.resolves({});

      await CategoryTagController.create(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("list", () => {
    it("should list all category tags", async () => {
      mockRequest.query = { limit: 10, offset: 0 };

      await CategoryTagController.list(mockRequest, mockResponse, mockNext);

      expect(mockCategoryTagUtil.list).toHaveBeenCalledWith(
        mockRequest,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "OK",
        categoriesTagsData: [],
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "limit", message: "Limit is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await CategoryTagController.list(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockCategoryTagUtil.list.resolves({});

      await CategoryTagController.list(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("update", () => {
    it("should update an existing category tag", async () => {
      mockRequest.params.id = "123";
      mockRequest.body = { name: "Updated Name" };

      await CategoryTagController.update(mockRequest, mockResponse, mockNext);

      expect(mockCategoryTagUtil.update).toHaveBeenCalledWith(
        "123",
        mockRequest.body,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Updated",
        updatedCategoryTag: {},
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "name", message: "Name is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await CategoryTagController.update(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockCategoryTagUtil.update.resolves({});

      await CategoryTagController.update(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("delete", () => {
    it("should delete a category tag", async () => {
      mockRequest.params.id = "123";

      await CategoryTagController.delete(mockRequest, mockResponse, mockNext);

      expect(mockCategoryTagUtil.delete).toHaveBeenCalledWith(
        "123",
        {},
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(204);
      expect(mockResponse.json).to.have.been.calledWith({});
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "id", message: "ID is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await CategoryTagController.delete(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockCategoryTagUtil.delete.resolves({});

      await CategoryTagController.delete(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("assign", () => {
    it("should fetch posts associated with a category tag", async () => {
      mockRequest.params.id = "123";
      mockRequest.query = { limit: 10, offset: 0 };

      await CategoryTagController.posts(mockRequest, mockResponse, mockNext);

      expect(mockCategoryTagUtil.posts).toHaveBeenCalledWith(
        "123",
        mockRequest,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Posts fetched",
        postsData: [],
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "id", message: "ID is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await CategoryTagController.posts(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockCategoryTagUtil.posts.resolves({});

      await CategoryTagController.posts(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("browseCategories", () => {
    it("should browse categories", async () => {
      mockRequest.query = { limit: 10, offset: 0 };

      await CategoryTagController.browseCategories(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockCategoryTagUtil.browseCategories).toHaveBeenCalledWith(
        mockRequest,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Categories browsed",
        categoriesData: [],
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "limit", message: "Limit is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await CategoryTagController.browseCategories(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockCategoryTagUtil.browseCategories.resolves({});

      await CategoryTagController.browseCategories(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("browseTags", () => {
    it("should browse tags", async () => {
      mockRequest.query = { limit: 10, offset: 0 };

      await CategoryTagController.browseTags(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockCategoryTagUtil.browseTags).toHaveBeenCalledWith(
        mockRequest,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Tags browsed",
        tagsData: [],
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "limit", message: "Limit is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await CategoryTagController.browseTags(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockCategoryTagUtil.browseTags.resolves({});

      await CategoryTagController.browseTags(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.json).not.to.have.been.called;
    });
  });
});
