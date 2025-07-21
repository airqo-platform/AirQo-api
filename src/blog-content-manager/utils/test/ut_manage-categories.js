// test-category-tag-util.js
require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const expect = chai.expect;
const mongoose = require("mongoose");
const CategoryModel = require("@models/category");
const TagModel = require("@models/tag");
const PostModel = require("@models/post");
const { logObject } = require("@utils/log");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- manage-categories`
);

const categoryTagUtil = require("../path/to/categoryTagUtil"); // Adjust the path as needed

describe("categoryTagUtil", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("create", () => {
    it("should create a new category successfully", async () => {
      const mockBody = {
        tenant: "testTenant",
        name: "TestCategory",
      };

      const mockResult = {
        success: true,
        message: "Category created successfully",
        data: { id: "newCategoryId" },
        status: httpStatus.CREATED,
      };

      sandbox.stub(CategoryModel.prototype.create).resolves(mockResult);

      const result = await categoryTagUtil.create(mockBody);
      expect(result.success).to.be.true;
      expect(result.message).to.equal(mockResult.message);
      expect(result.data.id).to.equal(mockResult.data.id);
      expect(result.status).to.equal(mockResult.status);
    });

    it("should handle errors during creation", async () => {
      const mockBody = {
        tenant: "testTenant",
        name: "",
      };

      const mockResult = {
        success: false,
        message: "Invalid name",
      };

      sandbox
        .stub(CategoryModel.prototype.create)
        .rejects(new Error(mockResult.message));

      await expect(categoryTagUtil.create(mockBody)).to.be.rejectedWith(Error);
      expect(logger.error).to.have.been.calledWith(
        `🐛🐛 Internal Server Error ${mockResult.message}`
      );
    });
  });

  describe("list", () => {
    it("should return a list of categories", async () => {
      const mockQuery = {
        tenant: "testTenant",
        limit: 10,
        offset: 0,
      };

      const mockResult = {
        success: true,
        message: "Categories listed successfully",
        data: [{ id: "categoryId1", name: "Category1" }],
        total: 100,
        status: httpStatus.OK,
      };

      sandbox.stub(CategoryModel.prototype.list).resolves(mockResult);

      const result = await categoryTagUtil.list(mockQuery);
      expect(result.success).to.be.true;
      expect(result.message).to.equal(mockResult.message);
      expect(result.data[0].id).to.equal(mockResult.data[0].id);
      expect(result.total).to.equal(mockResult.total);
      expect(result.status).to.equal(mockResult.status);
    });

    it("should handle errors during listing", async () => {
      const mockQuery = {
        tenant: "testTenant",
        limit: 10,
        offset: 0,
      };

      const mockResult = {
        success: false,
        message: "Internal Server Error",
      };

      sandbox
        .stub(CategoryModel.prototype.list)
        .rejects(new Error(mockResult.message));

      await expect(categoryTagUtil.list(mockQuery)).to.be.rejectedWith(Error);
      expect(logger.error).to.have.been.calledWith(
        `🐛🐛 Internal Server Error ${mockResult.message}`
      );
    });
  });

  describe("update", () => {
    it("should update a category successfully", async () => {
      const mockId = "categoryId";
      const mockBody = { name: "Updated Category" };
      const mockResult = {
        success: true,
        message: "Category updated successfully",
        data: { id: mockId },
        status: httpStatus.OK,
      };

      sandbox.stub(CategoryModel.prototype.update).resolves(mockResult);

      const result = await categoryTagUtil.update(mockId, mockBody);
      expect(result.success).to.be.true;
      expect(result.message).to.equal(mockResult.message);
      expect(result.data.id).to.equal(mockResult.data.id);
      expect(result.status).to.equal(mockResult.status);
    });

    it("should handle errors during updating", async () => {
      const mockId = "categoryId";
      const mockBody = { invalidField: "" };

      const mockResult = {
        success: false,
        message: "Invalid field",
      };

      sandbox
        .stub(CategoryModel.prototype.update)
        .rejects(new Error(mockResult.message));

      await expect(categoryTagUtil.update(mockId, mockBody)).to.be.rejectedWith(
        Error
      );
      expect(logger.error).to.have.been.calledWith(
        `🐛🐛 Internal Server Error ${mockResult.message}`
      );
    });
  });

  describe("delete", () => {
    it("should delete a category successfully", async () => {
      const mockId = "categoryId";

      const mockResult = {
        success: true,
        message: "Category deleted successfully",
        status: httpStatus.NO_CONTENT,
      };

      sandbox.stub(CategoryModel.prototype.remove).resolves(mockResult);

      const result = await categoryTagUtil.delete(mockId);
      expect(result.success).to.be.true;
      expect(result.message).to.equal(mockResult.message);
      expect(result.status).to.equal(mockResult.status);
    });

    it("should handle errors during deletion", async () => {
      const mockId = "categoryId";

      const mockResult = {
        success: false,
        message: "Category not found",
      };

      sandbox
        .stub(CategoryModel.prototype.remove)
        .rejects(new Error(mockResult.message));

      await expect(categoryTagUtil.delete(mockId)).to.be.rejectedWith(Error);
      expect(logger.error).to.have.been.calledWith(
        `🐛🐛 Internal Server Error ${mockResult.message}`
      );
    });
  });

  describe("assign", () => {
    it("should assign views to a post", async () => {
      const mockPostId = "postId";
      const mockBody = { tenant: "testTenant" };
      const mockResult = {
        success: true,
        message: "Views assigned successfully",
        data: { id: mockPostId },
        status: httpStatus.OK,
      };

      sandbox.stub(PostModel.prototype.incrementViews).resolves(mockResult);

      const result = await categoryTagUtil.assign(mockPostId, mockBody);
      expect(result.success).to.be.true;
      expect(result.message).to.equal(mockResult.message);
      expect(result.data.id).to.equal(mockResult.data.id);
      expect(result.status).to.equal(mockResult.status);
    });

    it("should handle errors during assignment", async () => {
      const mockPostId = "postId";
      const mockBody = { invalidField: "" };

      const mockResult = {
        success: false,
        message: "Invalid field",
      };

      sandbox
        .stub(PostModel.prototype.incrementViews)
        .rejects(new Error(mockResult.message));

      await expect(
        categoryTagUtil.assign(mockPostId, mockBody)
      ).to.be.rejectedWith(Error);
      expect(logger.error).to.have.been.calledWith(
        `🐛🐛 Internal Server Error ${mockResult.message}`
      );
    });
  });

  // test-category-tag-util.js (continued)

  describe("posts", () => {
    it("should list posts for a category", async () => {
      const mockCategoryId = "categoryId";
      const mockQuery = { limit: 10, offset: 0 };
      const mockResult = {
        success: true,
        message: "Posts listed successfully",
        data: [{ id: "postId1", title: "Post1" }],
        total: 100,
        status: httpStatus.OK,
      };

      sandbox.stub(PostModel.prototype.list).resolves(mockResult);

      const result = await categoryTagUtil.posts(mockCategoryId, mockQuery);
      expect(result.success).to.be.true;
      expect(result.message).to.equal(mockResult.message);
      expect(result.data[0].id).to.equal(mockResult.data[0].id);
      expect(result.total).to.equal(mockResult.total);
      expect(result.status).to.equal(mockResult.status);
    });

    it("should handle errors during post listing", async () => {
      const mockCategoryId = "categoryId";
      const mockQuery = { invalidField: "" };

      const mockResult = {
        success: false,
        message: "Invalid query",
      };

      sandbox
        .stub(PostModel.prototype.list)
        .rejects(new Error(mockResult.message));

      await expect(
        categoryTagUtil.posts(mockCategoryId, mockQuery)
      ).to.be.rejectedWith(Error);
      expect(logger.error).to.have.been.calledWith(
        `🐛🐛 Internal Server Error ${mockResult.message}`
      );
    });
  });

  describe("browseCategories", () => {
    it("should browse categories successfully", async () => {
      const mockResult = {
        success: true,
        message: "Categories browsed successfully",
        data: [{ id: "categoryId1", name: "Category1" }],
        status: httpStatus.OK,
      };

      sandbox.stub(CategoryModel.prototype.getHierarchy).resolves(mockResult);

      const result = await categoryTagUtil.browseCategories({});
      expect(result.success).to.be.true;
      expect(result.message).to.equal(mockResult.message);
      expect(result.data[0].id).to.equal(mockResult.data[0].id);
      expect(result.status).to.equal(mockResult.status);
    });

    it("should handle errors during browsing categories", async () => {
      const mockResult = {
        success: false,
        message: "Internal Server Error",
      };

      sandbox
        .stub(CategoryModel.prototype.getHierarchy)
        .rejects(new Error(mockResult.message));

      await expect(categoryTagUtil.browseCategories({})).to.be.rejectedWith(
        Error
      );
      expect(logger.error).to.have.been.calledWith(
        `🐛🐛 Internal Server Error ${mockResult.message}`
      );
    });
  });

  describe("browseTags", () => {
    it("should browse tags successfully", async () => {
      const mockQuery = { limit: 10, offset: 0 };
      const mockResult = {
        success: true,
        message: "Tags browsed successfully",
        data: [{ id: "tagId1", name: "Tag1" }],
        total: 100,
        status: httpStatus.OK,
      };

      sandbox.stub(TagModel.prototype.list).resolves(mockResult);

      const result = await categoryTagUtil.browseTags(mockQuery);
      expect(result.success).to.be.true;
      expect(result.message).to.equal(mockResult.message);
      expect(result.data[0].id).to.equal(mockResult.data[0].id);
      expect(result.total).to.equal(mockResult.total);
      expect(result.status).to.equal(mockResult.status);
    });

    it("should handle errors during browsing tags", async () => {
      const mockQuery = { invalidField: "" };

      const mockResult = {
        success: false,
        message: "Invalid query",
      };

      sandbox
        .stub(TagModel.prototype.list)
        .rejects(new Error(mockResult.message));

      await expect(categoryTagUtil.browseTags(mockQuery)).to.be.rejectedWith(
        Error
      );
      expect(logger.error).to.have.been.calledWith(
        `🐛🐛 Internal Server Error ${mockResult.message}`
      );
    });
  });
});
