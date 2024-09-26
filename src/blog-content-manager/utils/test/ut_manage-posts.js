require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const mongoose = require("mongoose");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- manage-posts`);
const { HttpError } = require("@utils/errors");
const isEmpty = require("is-empty");
const { getModelByTenant } = require("@config/database");
const PostModel = require("@models/Post");
const TagModel = require("@models/Tag");
const CategoryModel = require("@models/Category");
const AuthorModel = require("@models/Author");
const CommentModel = require("@models/Comment");
const ReplyModel = require("@models/Reply");

const managePosts = require("./manage-posts"); // Adjust the path as needed

const expect = chai.expect;
chai.use(sinonChai);

describe("managePosts", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("createPost", () => {
    it("should create a new post", async () => {
      const mockPost = {
        title: "Test Title",
        content: "Test Content",
        authorId: "authorId",
        categories: ["category1"],
        tags: ["tag1"],
        status: "draft",
        publishDate: new Date(),
        featuredImage: "image-url",
        slug: "test-slug",
      };

      const mockNext = sinon.spy();

      sandbox.stub(mongoose.Model, "create").resolves(mockPost);

      const result = await managePosts.createPost(mockPost, mockNext);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(mockPost);
      expect(result.message).to.equal("Post created successfully");
      expect(result.status).to.equal(httpStatus.CREATED);
      expect(mockNext).not.to.have.been.called;
    });

    it("should throw an error if post creation fails", async () => {
      const mockPost = {
        title: "Test Title",
        content: "Test Content",
        authorId: "authorId",
        categories: ["category1"],
        tags: ["tag1"],
        status: "draft",
        publishDate: new Date(),
        featuredImage: "image-url",
        slug: "test-slug",
      };

      const mockNext = sinon.spy();

      sandbox
        .stub(mongoose.Model, "create")
        .rejects(new Error("Creation failed"));

      await expect(
        managePosts.createPost(mockPost, mockNext)
      ).to.be.rejectedWith(HttpError);
      expect(logger.error).to.have.been.calledWith(
        "🐛🐛 Internal Server Error Creation failed"
      );
    });
  });

  describe("list", () => {
    it("should return a list of posts", async () => {
      const mockFilter = { title: "Test Title" };
      const mockSkip = 0;
      const mockLimit = 20;

      sandbox.stub(mongoose.Model, "find").resolves([
        { _id: "postId1", title: "Post 1" },
        { _id: "postId2", title: "Post 2" },
      ]);

      sandbox.stub(mongoose.Model.prototype.countDocuments).resolves(2);

      const result = await managePosts.list({
        filter: mockFilter,
        skip: mockSkip,
        limit: mockLimit,
      });

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal([
        { _id: "postId1", title: "Post 1" },
        { _id: "postId2", title: "Post 2" },
      ]);
      expect(result.total).to.equal(2);
      expect(result.message).to.equal("Successfully retrieved posts");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle no posts found", async () => {
      const mockFilter = { title: "Non-existent Post" };
      const mockSkip = 0;
      const mockLimit = 20;

      sandbox.stub(mongoose.Model, "find").resolves([]);
      sandbox.stub(mongoose.Model.prototype.countDocuments).resolves(0);

      const result = await managePosts.list({
        filter: mockFilter,
        skip: mockSkip,
        limit: mockLimit,
      });

      expect(result.success).to.be.true;
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.total).to.equal(0);
      expect(result.message).to.equal("No posts found");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should throw an error if listing fails", async () => {
      const mockFilter = { title: "Test Title" };
      const mockSkip = 0;
      const mockLimit = 20;

      sandbox.stub(mongoose.Model, "find").rejects(new Error("Listing failed"));

      await expect(
        managePosts.list({
          filter: mockFilter,
          skip: mockSkip,
          limit: mockLimit,
        })
      ).to.be.rejectedWith(HttpError);
      expect(logger.error).to.have.been.calledWith(
        "🐛🐛 Internal Server Error Listing failed"
      );
    });
  });

  describe("update", () => {
    it("should successfully update a post", async () => {
      const mockUpdate = { title: "Updated Title" };
      sandbox.stub(mongoose.Model.prototype.findByIdAndUpdate).resolves({});

      const result = await managePosts.update(
        { id: "testId", update: mockUpdate },
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully updated the post");
      expect(result.data).to.deep.equal({});
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle post not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findByIdAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.update({ id: "nonExistentId" }, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle data conflicts", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findByIdAndUpdate)
        .rejects(new Error("Data conflicts detected"));

      const nextSpy = sinon.spy();
      await managePosts.update({ id: "testId" }, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Data conflicts detected -- Data conflicts detected",
          httpStatus.INTERNAL_SERVER_ERROR
        )
      );
    });
  });

  describe("remove", () => {
    it("should successfully remove a post", async () => {
      const mockPost = { title: "Test Post", content: "Test Content" };
      sandbox
        .stub(mongoose.Model.prototype.findByIdAndRemove)
        .resolves(mockPost);

      const result = await managePosts.remove("testId", () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully removed the post");
      expect(result.data).to.deep.equal(mockPost);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle post not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findByIdAndRemove).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.remove("nonExistentId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findByIdAndRemove)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.remove("testId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("addTags", () => {
    it("should successfully add tags to a post", async () => {
      const mockTags = ["tag1", "tag2"];
      const mockUpdate = { tags: ["tag1", "tag2"] };
      sandbox.stub(mongoose.Model.prototype.findOneAndUpdate).resolves({});

      const result = await managePosts.addTags("testId", mockTags, () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Tags added successfully");
      expect(result.data).to.deep.equal({});
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle post not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findOneAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.addTags("nonExistentId", ["tag1"], nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.addTags("testId", ["tag1"], nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("removeTag", () => {
    it("should successfully remove a tag from a post", async () => {
      const mockPost = {
        title: "Test Post",
        content: "Test Content",
        tags: ["tag1", "tag2"],
      };
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .resolves(mockPost);

      const result = await managePosts.removeTag("testId", "tag1", () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Tag removed successfully");
      expect(result.data.tags).to.deep.equal(["tag2"]);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle post not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findOneAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.removeTag("nonExistentId", "tag1", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.removeTag("testId", "tag1", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("addCategory", () => {
    it("should successfully add a category to a post", async () => {
      const mockPost = {
        title: "Test Post",
        content: "Test Content",
        categories: [],
      };
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .resolves(mockPost);

      const result = await managePosts.addCategory(
        "testId",
        "categoryId",
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Category added successfully");
      expect(result.data.categories).to.deep.equal(["categoryId"]);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle post not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findOneAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.addCategory("nonExistentId", "categoryId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.addCategory("testId", "categoryId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("removeCategory", () => {
    it("should successfully remove a category from a post", async () => {
      const mockPost = {
        title: "Test Post",
        content: "Test Content",
        categories: ["category1", "category2"],
      };
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .resolves(mockPost);

      const result = await managePosts.removeCategory(
        "testId",
        "category1",
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Category removed successfully");
      expect(result.data.categories).to.deep.equal(["category2"]);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle post not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findOneAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.removeCategory("nonExistentId", "categoryId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.removeCategory("testId", "categoryId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("addAuthor", () => {
    it("should successfully add an author to a post", async () => {
      const mockAuthor = { _id: "authorId", name: "Test Author" };
      const mockPost = {
        title: "Test Post",
        content: "Test Content",
        author: null,
      };
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .resolves(mockPost);

      const result = await managePosts.addAuthor(
        "testId",
        "authorId",
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Author added successfully");
      expect(result.data.author).to.deep.equal({
        _id: "authorId",
        name: "Test Author",
      });
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle post not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findOneAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.addAuthor("nonExistentId", "authorId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.addAuthor("testId", "authorId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("removeAuthor", () => {
    it("should successfully remove the author from a post", async () => {
      const mockPost = {
        title: "Test Post",
        content: "Test Content",
        author: { _id: "authorId", name: "Test Author" },
      };
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .resolves(mockPost);

      const result = await managePosts.removeAuthor("testId", () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Author removed successfully");
      expect(result.data.author).to.be.undefined;
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle post not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findOneAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.removeAuthor("nonExistentId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.removeAuthor("testId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("updateFeaturedImage", () => {
    it("should successfully update the featured image of a post", async () => {
      const mockFeaturedImage = "https://example.com/image.jpg";
      const mockUpdate = { featuredImage: mockFeaturedImage };
      const mockPost = {
        title: "Test Post",
        content: "Test Content",
        featuredImage: null,
      };
      sandbox
        .stub(mongoose.Model.prototype.findByIdAndUpdate)
        .resolves(mockPost);

      const result = await managePosts.updateFeaturedImage(
        { id: "testId", featuredImage: mockFeaturedImage },
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Featured image updated successfully");
      expect(result.data.featuredImage).to.equal(mockFeaturedImage);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle post not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findByIdAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.updateFeaturedImage({ id: "nonExistentId" }, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findByIdAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.updateFeaturedImage({ id: "testId" }, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("updateSlug", () => {
    it("should successfully update the slug of a post", async () => {
      const mockSlug = "new-slug";
      const mockUpdate = { slug: mockSlug };
      const mockPost = {
        title: "Test Post",
        content: "Test Content",
        slug: null,
      };
      sandbox
        .stub(mongoose.Model.prototype.findByIdAndUpdate)
        .resolves(mockPost);

      const result = await managePosts.updateSlug(
        { id: "testId", slug: mockSlug },
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Slug updated successfully");
      expect(result.data.slug).to.equal(mockSlug);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle post not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findByIdAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.updateSlug({ id: "nonExistentId" }, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findByIdAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.updateSlug({ id: "testId" }, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("updatePublishDate", () => {
    it("should successfully update the publish date of a post", async () => {
      const mockPublishDate = new Date("2024-01-01T12:00:00Z");
      const mockUpdate = { publishDate: mockPublishDate };
      const mockPost = {
        title: "Test Post",
        content: "Test Content",
        publishDate: null,
      };
      sandbox
        .stub(mongoose.Model.prototype.findByIdAndUpdate)
        .resolves(mockPost);

      const result = await managePosts.updatePublishDate(
        { id: "testId", publishDate: mockPublishDate },
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Publish date updated successfully");
      expect(result.data.publishDate).to.deep.equal(mockPublishDate);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle post not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findByIdAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.updatePublishDate({ id: "nonExistentId" }, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findByIdAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.updatePublishDate({ id: "testId" }, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("updateStatus", () => {
    it("should successfully update the status of a post", async () => {
      const mockStatus = "draft";
      const mockUpdate = { status: mockStatus };
      const mockPost = {
        title: "Test Post",
        content: "Test Content",
        status: "published",
      };
      sandbox
        .stub(mongoose.Model.prototype.findByIdAndUpdate)
        .resolves(mockPost);

      const result = await managePosts.updateStatus(
        { id: "testId", status: mockStatus },
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Status updated successfully");
      expect(result.data.status).to.equal(mockStatus);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle post not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findByIdAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.updateStatus({ id: "nonExistentId" }, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findByIdAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.updateStatus({ id: "testId" }, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getTags", () => {
    it("should successfully retrieve tags", async () => {
      const mockTags = [
        { _id: "tag1", name: "Tag 1" },
        { _id: "tag2", name: "Tag 2" },
      ];
      sandbox.stub(TagModel.prototype.find).resolves(mockTags);

      const result = await managePosts.getTags(() => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved tags");
      expect(result.data).to.deep.equal(mockTags);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return no tags found when none exist", async () => {
      sandbox.stub(TagModel.prototype.find).resolves([]);

      const result = await managePosts.getTags(() => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("No tags found");
      expect(result.data).to.deep.equal([]);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(TagModel.prototype.find)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getTags(nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getCategories", () => {
    it("should successfully retrieve categories", async () => {
      const mockCategories = [
        { _id: "category1", name: "Category 1" },
        { _id: "category2", name: "Category 2" },
      ];
      sandbox.stub(CategoryModel.prototype.find).resolves(mockCategories);

      const result = await managePosts.getCategories(() => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved categories");
      expect(result.data).to.deep.equal(mockCategories);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return no categories found when none exist", async () => {
      sandbox.stub(CategoryModel.prototype.find).resolves([]);

      const result = await managePosts.getCategories(() => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("No categories found");
      expect(result.data).to.deep.equal([]);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(CategoryModel.prototype.find)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getCategories(nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getAuthors", () => {
    it("should successfully retrieve authors", async () => {
      const mockAuthors = [
        { _id: "author1", name: "Author 1", email: "author1@example.com" },
        { _id: "author2", name: "Author 2", email: "author2@example.com" },
      ];
      sandbox.stub(AuthorModel.prototype.find).resolves(mockAuthors);

      const result = await managePosts.getAuthors(() => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved authors");
      expect(result.data).to.deep.equal(mockAuthors);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return no authors found when none exist", async () => {
      sandbox.stub(AuthorModel.prototype.find).resolves([]);

      const result = await managePosts.getAuthors(() => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("No authors found");
      expect(result.data).to.deep.equal([]);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(AuthorModel.prototype.find)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getAuthors(nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getComments", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.find).resolves([]);
      sandbox.stub(mongoose.Model.prototype.populate).resolves([]);
      sandbox.stub(mongoose.Model.prototype.sort).resolves([]);
      sandbox.stub(mongoose.Model.prototype.limit).resolves([]);
    });

    it("should successfully retrieve comments", async () => {
      const mockComments = [
        {
          _id: "comment1",
          post: "postId1",
          author: { name: "Author 1" },
          createdAt: new Date(),
        },
        {
          _id: "comment2",
          post: "postId1",
          author: { name: "Author 2" },
          createdAt: new Date(),
        },
      ];
      sandbox.stub(mongoose.Model.prototype.find).resolves(mockComments);
      sandbox.stub(mongoose.Model.prototype.populate).resolves(mockComments);
      sandbox.stub(mongoose.Model.prototype.sort).resolves(mockComments);
      sandbox.stub(mongoose.Model.prototype.limit).resolves(mockComments);

      const result = await managePosts.getComments("postId1", () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved comments");
      expect(result.data).to.deep.equal(mockComments);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return no comments found when none exist", async () => {
      sandbox.stub(mongoose.Model.prototype.find).resolves([]);

      const result = await managePosts.getComments("postId1", () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("No comments found");
      expect(result.data).to.deep.equal([]);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.find)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getComments("postId1", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("deleteComment", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox
        .stub(mongoose.Model.prototype.deleteOne)
        .resolves({ deletedCount: 0 });
    });

    it("should successfully delete a comment", async () => {
      const mockDeleteResult = { deletedCount: 1 };
      sandbox
        .stub(mongoose.Model.prototype.deleteOne)
        .resolves(mockDeleteResult);

      const result = await managePosts.deleteComment("commentId", () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Comment deleted successfully");
      expect(result.status).to.equal(httpStatus.NO_CONTENT);
    });

    it("should handle comment not found", async () => {
      sandbox
        .stub(mongoose.Model.prototype.deleteOne)
        .resolves({ deletedCount: 0 });

      const nextSpy = sinon.spy();
      await managePosts.deleteComment("nonExistentId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Comment not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.deleteOne)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.deleteComment("commentId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("updateComment", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.findByIdAndUpdate).resolves({});
    });

    it("should successfully update a comment", async () => {
      const mockUpdate = { title: "Updated Title" };
      const mockComment = { _id: "commentId", title: "Original Title" };
      sandbox
        .stub(mongoose.Model.prototype.findByIdAndUpdate)
        .resolves(mockComment);

      const result = await managePosts.updateComment(
        "commentId",
        mockUpdate,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Comment updated successfully");
      expect(result.data.title).to.equal("Updated Title");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle comment not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findByIdAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.updateComment("commentId", {}, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Comment not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle data conflicts", async () => {
      const mockUpdate = { title: "Updated Title" };
      sandbox
        .stub(mongoose.Model.prototype.findByIdAndUpdate)
        .rejects(new Error("Data conflicts detected"));

      const nextSpy = sinon.spy();
      await managePosts.updateComment("commentId", mockUpdate, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Data conflicts detected -- Data conflicts detected",
          httpStatus.INTERNAL_SERVER_ERROR
        )
      );
    });
  });

  describe("getReplies", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.find).resolves([]);
      sandbox.stub(mongoose.Model.prototype.populate).resolves([]);
      sandbox.stub(mongoose.Model.prototype.sort).resolves([]);
      sandbox.stub(mongoose.Model.prototype.limit).resolves([]);
    });

    it("should successfully retrieve replies", async () => {
      const mockReplies = [
        {
          _id: "reply1",
          parent: "commentId",
          author: { name: "Author 1" },
          createdAt: new Date(),
        },
        {
          _id: "reply2",
          parent: "commentId",
          author: { name: "Author 2" },
          createdAt: new Date(),
        },
      ];
      sandbox.stub(mongoose.Model.prototype.find).resolves(mockReplies);
      sandbox.stub(mongoose.Model.prototype.populate).resolves(mockReplies);
      sandbox.stub(mongoose.Model.prototype.sort).resolves(mockReplies);
      sandbox.stub(mongoose.Model.prototype.limit).resolves(mockReplies);

      const result = await managePosts.getReplies("commentId", () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved replies");
      expect(result.data).to.deep.equal(mockReplies);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return no replies found when none exist", async () => {
      sandbox.stub(mongoose.Model.prototype.find).resolves([]);

      const result = await managePosts.getReplies("commentId", () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("No replies found");
      expect(result.data).to.deep.equal([]);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.find)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getReplies("commentId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("addReply", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox
        .stub(mongoose.Model.prototype.create)
        .resolves({ _id: "newReplyId" });
    });

    it("should successfully create a new reply", async () => {
      const mockParentId = "parentId";
      const mockReplyContent = "New reply content";

      const result = await managePosts.addReply(
        mockParentId,
        mockReplyContent,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Reply created successfully");
      expect(result.data._id).to.equal("newReplyId");
      expect(result.status).to.equal(httpStatus.CREATED);
    });

    it("should handle failed reply creation", async () => {
      sandbox.stub(mongoose.Model.prototype.create).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.addReply("parentId", "replyContent", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Failed to create reply",
          httpStatus.INTERNAL_SERVER_ERROR
        )
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.create)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.addReply("parentId", "replyContent", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("updateReply", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox
        .stub(mongoose.Model.prototype.findByIdAndUpdate)
        .resolves({ _id: "updatedReplyId" });
    });

    it("should successfully update a reply", async () => {
      const mockUpdate = { title: "Updated Title" };
      const mockReplyId = "replyId";

      const result = await managePosts.updateReply(
        mockReplyId,
        mockUpdate,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Reply updated successfully");
      expect(result.data._id).to.equal("updatedReplyId");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle reply not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findByIdAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.updateReply("nonExistentId", {}, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Reply not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle data conflicts", async () => {
      const mockUpdate = { title: "Updated Title" };
      sandbox
        .stub(mongoose.Model.prototype.findByIdAndUpdate)
        .rejects(new Error("Data conflicts detected"));

      const nextSpy = sinon.spy();
      await managePosts.updateReply("replyId", mockUpdate, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Data conflicts detected -- Data conflicts detected",
          httpStatus.INTERNAL_SERVER_ERROR
        )
      );
    });
  });

  describe("deleteReply", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox
        .stub(mongoose.Model.prototype.deleteOne)
        .resolves({ deletedCount: 0 });
    });

    it("should successfully delete a reply", async () => {
      const mockReplyId = "replyId";

      const result = await managePosts.deleteReply(mockReplyId, () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Reply deleted successfully");
      expect(result.status).to.equal(httpStatus.NO_CONTENT);
    });

    it("should handle reply not found", async () => {
      sandbox
        .stub(mongoose.Model.prototype.deleteOne)
        .resolves({ deletedCount: 0 });

      const nextSpy = sinon.spy();
      await managePosts.deleteReply("nonExistentId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Reply not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.deleteOne)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.deleteReply("replyId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getPostStatistics", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.aggregate).resolves({
        views: 100,
        likes: 50,
        dislikes: 10,
        comments: 5,
      });
    });

    it("should successfully retrieve post statistics", async () => {
      const mockPostId = "postId";

      const result = await managePosts.getPostStatistics(mockPostId, () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved post statistics");
      expect(result.data.views).to.equal(100);
      expect(result.data.likes).to.equal(50);
      expect(result.data.dislikes).to.equal(10);
      expect(result.data.comments).to.equal(5);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return no statistics available when none exist", async () => {
      sandbox.stub(mongoose.Model.prototype.aggregate).resolves(null);

      const result = await managePosts.getPostStatistics("postId", () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("No statistics available");
      expect(result.data).to.deep.equal({});
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.aggregate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getPostStatistics("postId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("updateViewCount", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .resolves({ _id: "postId" });
    });

    it("should successfully update view count", async () => {
      const mockPostId = "postId";

      const result = await managePosts.updateViewCount(mockPostId, () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("View count updated successfully");
      expect(result.data._id).to.equal("postId");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle post not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findOneAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.updateViewCount("nonExistentId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.updateViewCount("postId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("updateLikeCount", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .resolves({ _id: "postId" });
    });

    it("should successfully update like count", async () => {
      const mockPostId = "postId";
      const mockLike = true;

      const result = await managePosts.updateLikeCount(
        mockPostId,
        mockLike,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Like count updated successfully");
      expect(result.data._id).to.equal("postId");
      expect(result.data.likes).to.equal(1);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle post not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findOneAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.updateLikeCount("nonExistentId", true, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.updateLikeCount("postId", true, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("updateDislikeCount", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .resolves({ _id: "postId" });
    });

    it("should successfully update dislike count", async () => {
      const mockPostId = "postId";
      const mockDislike = true;

      const result = await managePosts.updateDislikeCount(
        mockPostId,
        mockDislike,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Dislike count updated successfully");
      expect(result.data._id).to.equal("postId");
      expect(result.data.dislikes).to.equal(1);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle post not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findOneAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.updateDislikeCount("nonExistentId", true, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.updateDislikeCount("postId", true, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("updateEngagement", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .resolves({ _id: "postId" });
    });

    it("should successfully update engagement counts", async () => {
      const mockPostId = "postId";
      const mockEngagement = {
        likes: 1,
        dislikes: 0,
        views: 1,
      };

      const result = await managePosts.updateEngagement(
        mockPostId,
        mockEngagement,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Engagement updated successfully");
      expect(result.data._id).to.equal("postId");
      expect(result.data.likes).to.equal(1);
      expect(result.data.dislikes).to.equal(0);
      expect(result.data.views).to.equal(1);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle post not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findOneAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.updateEngagement("nonExistentId", {}, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.updateEngagement("postId", {}, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("updateTimestamps", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .resolves({ _id: "postId" });
    });

    it("should successfully update timestamps", async () => {
      const mockPostId = "postId";

      const result = await managePosts.updateTimestamps(mockPostId, () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Timestamps updated successfully");
      expect(result.data._id).to.equal("postId");
      expect(result.data.updatedAt).to.be.a("date");
      expect(result.data.lastModified).to.be.a("date");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle post not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findOneAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.updateTimestamps("nonExistentId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.updateTimestamps("postId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getPostBySlug", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox
        .stub(mongoose.Model.prototype.findOne)
        .resolves({ _id: "postId", slug: "test-slug", author: {} });
    });

    it("should successfully retrieve post by slug", async () => {
      const mockSlug = "test-slug";

      const result = await managePosts.getPostBySlug(mockSlug, () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved post");
      expect(result.data._id).to.equal("postId");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return no post found message when post not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findOne).resolves(null);

      const result = await managePosts.getPostBySlug(
        "nonExistentSlug",
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("No post found with the given slug");
      expect(result.data).to.be.null;
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findOne)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getPostBySlug("postId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getPostsByTag", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.find).resolves([
        {
          _id: "post1Id",
          title: "Test Post 1",
          slug: "test-slug-1",
          tags: ["tag1"],
        },
        {
          _id: "post2Id",
          title: "Test Post 2",
          slug: "test-slug-2",
          tags: ["tag2"],
        },
      ]);
    });

    it("should successfully retrieve posts by tag", async () => {
      const mockTagId = "tag1";

      const result = await managePosts.getPostsByTag(mockTagId, () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved posts");
      expect(result.data.length).to.equal(1);
      expect(result.data[0]._id).to.equal("post1Id");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return empty array when no posts found with the given tag", async () => {
      sandbox.stub(mongoose.Model.prototype.find).resolves([]);

      const result = await managePosts.getPostsByTag(
        "nonExistentTag",
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("No posts found with the given tag");
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.find)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getPostsByTag("tagId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getPostsByCategory", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.find).resolves([
        {
          _id: "post1Id",
          title: "Test Post 1",
          slug: "test-slug-1",
          categories: ["category1"],
        },
        {
          _id: "post2Id",
          title: "Test Post 2",
          slug: "test-slug-2",
          categories: ["category2"],
        },
      ]);
    });

    it("should successfully retrieve posts by category", async () => {
      const mockCategoryId = "category1";

      const result = await managePosts.getPostsByCategory(
        mockCategoryId,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved posts");
      expect(result.data.length).to.equal(1);
      expect(result.data[0]._id).to.equal("post1Id");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return empty array when no posts found with the given category", async () => {
      sandbox.stub(mongoose.Model.prototype.find).resolves([]);

      const result = await managePosts.getPostsByCategory(
        "nonExistentCategory",
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("No posts found with the given category");
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.find)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getPostsByCategory("categoryId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getPostsByAuthor", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.find).resolves([
        {
          _id: "post1Id",
          title: "Test Post 1",
          slug: "test-slug-1",
          author: "author1Id",
        },
        {
          _id: "post2Id",
          title: "Test Post 2",
          slug: "test-slug-2",
          author: "author1Id",
        },
      ]);
    });

    it("should successfully retrieve posts by author", async () => {
      const mockAuthorId = "author1Id";

      const result = await managePosts.getPostsByAuthor(mockAuthorId, () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved posts");
      expect(result.data.length).to.equal(2);
      expect(result.data[0]._id).to.equal("post1Id");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return empty array when no posts found for the given author", async () => {
      sandbox.stub(mongoose.Model.prototype.find).resolves([]);

      const result = await managePosts.getPostsByAuthor(
        "nonExistentAuthor",
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("No posts found for the given author");
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.find)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getPostsByAuthor("authorId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getPostsByDateRange", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.find).resolves([
        {
          _id: "post1Id",
          title: "Test Post 1",
          slug: "test-slug-1",
          publishDate: new Date("2023-01-01"),
        },
        {
          _id: "post2Id",
          title: "Test Post 2",
          slug: "test-slug-2",
          publishDate: new Date("2023-01-31"),
        },
      ]);
    });

    it("should successfully retrieve posts by date range", async () => {
      const mockStartDate = new Date("2023-01-01");
      const mockEndDate = new Date("2023-01-31");

      const result = await managePosts.getPostsByDateRange(
        mockStartDate,
        mockEndDate,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved posts");
      expect(result.data.length).to.equal(2);
      expect(result.data[0]._id).to.equal("post1Id");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return empty array when no posts found in the given date range", async () => {
      sandbox.stub(mongoose.Model.prototype.find).resolves([]);

      const result = await managePosts.getPostsByDateRange(
        new Date("2023-01-01"),
        new Date("2023-01-31"),
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("No posts found in the given date range");
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.find)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getPostsByDateRange(
        new Date("2023-01-01"),
        new Date("2023-01-31"),
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getPostCount", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.countDocuments).resolves(5);
    });

    it("should successfully retrieve post count", async () => {
      const result = await managePosts.getPostCount(() => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved post count");
      expect(result.data.count).to.equal(5);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.countDocuments)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getPostCount(nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getPopularPosts", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.aggregate).resolves([
        {
          _id: "postId",
          title: "Test Post",
          slug: "test-slug",
          author: {},
          publishDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          lastModified: new Date(),
          categories: [],
          featuredImage: "",
          status: "published",
          views: 100,
          likes: 50,
          dislikes: 10,
          commentCount: 5,
        },
        {
          _id: "anotherPostId",
          title: "Another Test Post",
          slug: "another-test-slug",
          author: {},
          publishDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          lastModified: new Date(),
          categories: [],
          featuredImage: "",
          status: "draft",
          views: 150,
          likes: 75,
          dislikes: 15,
          commentCount: 7,
        },
      ]);
    });

    it("should successfully retrieve popular posts", async () => {
      const limit = 2;

      const result = await managePosts.getPopularPosts(limit, () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved popular posts");
      expect(result.data.length).to.equal(2);
      expect(result.data[0]._id).to.equal("postId");
      expect(result.data[0].commentCount).to.equal(5);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return empty array when no popular posts found", async () => {
      sandbox.stub(mongoose.Model.prototype.aggregate).resolves([]);

      const result = await managePosts.getPopularPosts(2, () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("No popular posts found");
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.aggregate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getPopularPosts(2, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getPostByAuthorAndDateRange", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.find).resolves([
        {
          _id: "postId",
          title: "Test Post",
          slug: "test-slug",
          author: "authorId",
          publishDate: new Date("2023-01-01"),
        },
        {
          _id: "anotherPostId",
          title: "Another Test Post",
          slug: "another-test-slug",
          author: "authorId",
          publishDate: new Date("2023-01-31"),
        },
      ]);
    });

    it("should successfully retrieve posts by author and date range", async () => {
      const mockAuthorId = "authorId";
      const startDate = new Date("2023-01-01");
      const endDate = new Date("2023-01-31");

      const result = await managePosts.getPostByAuthorAndDateRange(
        mockAuthorId,
        startDate,
        endDate,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved posts");
      expect(result.data.length).to.equal(2);
      expect(result.data[0]._id).to.equal("postId");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return empty array when no posts found for the given author and date range", async () => {
      sandbox.stub(mongoose.Model.prototype.find).resolves([]);

      const result = await managePosts.getPostByAuthorAndDateRange(
        "authorId",
        new Date("2023-01-01"),
        new Date("2023-01-31"),
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "No posts found for the given author and date range"
      );
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.find)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getPostByAuthorAndDateRange(
        "authorId",
        new Date("2023-01-01"),
        new Date("2023-01-31"),
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getPostsByCategoryAndDateRange", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.find).resolves([
        {
          _id: "postId",
          title: "Test Post",
          slug: "test-slug",
          categories: ["category1"],
          publishDate: new Date("2023-01-01"),
        },
        {
          _id: "anotherPostId",
          title: "Another Test Post",
          slug: "another-test-slug",
          categories: ["category1"],
          publishDate: new Date("2023-01-31"),
        },
      ]);
    });

    it("should successfully retrieve posts by category and date range", async () => {
      const mockCategoryId = "category1";
      const startDate = new Date("2023-01-01");
      const endDate = new Date("2023-01-31");

      const result = await managePosts.getPostsByCategoryAndDateRange(
        mockCategoryId,
        startDate,
        endDate,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved posts");
      expect(result.data.length).to.equal(2);
      expect(result.data[0]._id).to.equal("postId");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return empty array when no posts found for the given category and date range", async () => {
      sandbox.stub(mongoose.Model.prototype.find).resolves([]);

      const result = await managePosts.getPostsByCategoryAndDateRange(
        "nonExistentCategory",
        new Date("2023-01-01"),
        new Date("2023-01-31"),
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "No posts found for the given category and date range"
      );
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.find)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getPostsByCategoryAndDateRange(
        "categoryId",
        new Date("2023-01-01"),
        new Date("2023-01-31"),
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getPostsByTagAndDateRange", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.find).resolves([
        {
          _id: "postId",
          title: "Test Post",
          slug: "test-slug",
          tags: ["tag1"],
          publishDate: new Date("2023-01-01"),
        },
        {
          _id: "anotherPostId",
          title: "Another Test Post",
          slug: "another-test-slug",
          tags: ["tag1"],
          publishDate: new Date("2023-01-31"),
        },
      ]);
    });

    it("should successfully retrieve posts by tag and date range", async () => {
      const mockTagId = "tag1";
      const startDate = new Date("2023-01-01");
      const endDate = new Date("2023-01-31");

      const result = await managePosts.getPostsByTagAndDateRange(
        mockTagId,
        startDate,
        endDate,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved posts");
      expect(result.data.length).to.equal(2);
      expect(result.data[0]._id).to.equal("postId");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return empty array when no posts found for the given tag and date range", async () => {
      sandbox.stub(mongoose.Model.prototype.find).resolves([]);

      const result = await managePosts.getPostsByTagAndDateRange(
        "nonExistentTag",
        new Date("2023-01-01"),
        new Date("2023-01-31"),
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "No posts found for the given tag and date range"
      );
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.find)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getPostsByTagAndDateRange(
        "tagId",
        new Date("2023-01-01"),
        new Date("2023-01-31"),
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getPostsByCategoryAndAuthor", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.find).resolves([
        {
          _id: "postId",
          title: "Test Post",
          slug: "test-slug",
          categories: ["category1"],
          author: "authorId",
          publishDate: new Date("2023-01-01"),
        },
        {
          _id: "anotherPostId",
          title: "Another Test Post",
          slug: "another-test-slug",
          categories: ["category1"],
          author: "authorId",
          publishDate: new Date("2023-01-31"),
        },
      ]);
    });

    it("should successfully retrieve posts by category and author", async () => {
      const mockCategoryId = "category1";
      const mockAuthorId = "authorId";

      const result = await managePosts.getPostsByCategoryAndAuthor(
        mockCategoryId,
        mockAuthorId,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved posts");
      expect(result.data.length).to.equal(2);
      expect(result.data[0]._id).to.equal("postId");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return empty array when no posts found for the given category and author", async () => {
      sandbox.stub(mongoose.Model.prototype.find).resolves([]);

      const result = await managePosts.getPostsByCategoryAndAuthor(
        "category1",
        "nonExistentAuthor",
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "No posts found for the given category and author"
      );
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.find)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getPostsByCategoryAndAuthor(
        "category1",
        "authorId",
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getPostsByTagAndAuthor", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.find).resolves([
        {
          _id: "postId",
          title: "Test Post",
          slug: "test-slug",
          tags: ["tag1"],
          author: "authorId",
          publishDate: new Date("2023-01-01"),
        },
        {
          _id: "anotherPostId",
          title: "Another Test Post",
          slug: "another-test-slug",
          tags: ["tag1"],
          author: "authorId",
          publishDate: new Date("2023-01-31"),
        },
      ]);
    });

    it("should successfully retrieve posts by tag and author", async () => {
      const mockTagId = "tag1";
      const mockAuthorId = "authorId";

      const result = await managePosts.getPostsByTagAndAuthor(
        mockTagId,
        mockAuthorId,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved posts");
      expect(result.data.length).to.equal(2);
      expect(result.data[0]._id).to.equal("postId");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return empty array when no posts found for the given tag and author", async () => {
      sandbox.stub(mongoose.Model.prototype.find).resolves([]);

      const result = await managePosts.getPostsByTagAndAuthor(
        "nonExistentTag",
        "nonExistentAuthor",
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "No posts found for the given tag and author"
      );
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.find)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getPostsByTagAndAuthor("tagId", "authorId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getPostsByDateRangeAndLimit", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.find).resolves([
        {
          _id: "postId",
          title: "Test Post",
          slug: "test-slug",
          publishDate: new Date("2023-01-01"),
        },
        {
          _id: "anotherPostId",
          title: "Another Test Post",
          slug: "another-test-slug",
          publishDate: new Date("2023-01-31"),
        },
      ]);
    });

    it("should successfully retrieve posts within the given date range and limit", async () => {
      const startDate = new Date("2023-01-01");
      const endDate = new Date("2023-01-31");
      const mockLimit = 2;

      const result = await managePosts.getPostsByDateRangeAndLimit(
        startDate,
        endDate,
        mockLimit,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved posts");
      expect(result.data.length).to.equal(mockLimit);
      expect(result.data[0]._id).to.equal("postId");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return empty array when no posts found in the given date range", async () => {
      sandbox.stub(mongoose.Model.prototype.find).resolves([]);

      const result = await managePosts.getPostsByDateRangeAndLimit(
        new Date("2023-02-01"),
        new Date("2023-02-28"),
        10,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("No posts found in the given date range");
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.find)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getPostsByDateRangeAndLimit(
        new Date("2023-01-01"),
        new Date("2023-01-31"),
        10,
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getFeaturedPosts", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.find).resolves([
        {
          _id: "postId",
          title: "Test Post",
          slug: "test-slug",
          featured: true,
          createdAt: new Date("2023-01-01"),
        },
        {
          _id: "anotherPostId",
          title: "Another Test Post",
          slug: "another-test-slug",
          featured: true,
          createdAt: new Date("2023-01-31"),
        },
      ]);
    });

    it("should successfully retrieve featured posts", async () => {
      const mockLimit = 2;

      const result = await managePosts.getFeaturedPosts(mockLimit, () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved featured posts");
      expect(result.data.length).to.equal(mockLimit);
      expect(result.data[0]._id).to.equal("postId");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return empty array when no featured posts found", async () => {
      sandbox.stub(mongoose.Model.prototype.find).resolves([]);

      const result = await managePosts.getFeaturedPosts(10, () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("No featured posts found");
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.find)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getFeaturedPosts(10, nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getDrafts", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.find).resolves([
        {
          _id: "draftId",
          title: "Draft Post",
          slug: "draft-slug",
          status: "draft",
          author: "userId",
          createdAt: new Date("2023-01-01"),
        },
      ]);
    });

    it("should successfully retrieve drafts", async () => {
      const mockUserId = "userId";

      const result = await managePosts.getDrafts(mockUserId, () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved drafts");
      expect(result.data.length).to.equal(1);
      expect(result.data[0]._id).to.equal("draftId");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return empty array when no drafts found", async () => {
      sandbox.stub(mongoose.Model.prototype.find).resolves([]);

      const result = await managePosts.getDrafts("nonExistentUserId", () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("No drafts found");
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.find)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getDrafts("userId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getTrash", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.find).resolves([
        {
          _id: "postId",
          title: "Trashed Post",
          slug: "trashed-slug",
          status: "trashed",
          createdAt: new Date("2023-01-01"),
        },
        {
          _id: "anotherPostId",
          title: "Another Trashed Post",
          slug: "another-trashed-slug",
          status: "trashed",
          createdAt: new Date("2023-01-15"),
        },
      ]);
    });

    it("should successfully retrieve trashed posts", async () => {
      const mockUserId = "userId";

      const result = await managePosts.getTrash(mockUserId, () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved trashed posts");
      expect(result.data.length).to.equal(2);
      expect(result.data[0]._id).to.equal("postId");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return empty array when no posts found in trash", async () => {
      sandbox.stub(mongoose.Model.prototype.find).resolves([]);

      const result = await managePosts.getTrash("userId", () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("No posts found in trash");
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.find)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getTrash("userId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("restoreFromTrash", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.findOneAndUpdate).resolves({
        _id: "postId",
        title: "Restored Post",
        slug: "restored-slug",
        status: "draft",
        createdAt: new Date("2023-01-01"),
      });
    });

    it("should successfully restore a post from trash", async () => {
      const mockPostId = "postId";
      const mockUserId = "userId";

      const result = await managePosts.restoreFromTrash(
        mockPostId,
        mockUserId,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Post restored from trash successfully");
      expect(result.data._id).to.equal("postId");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return not found error when post not found in trash", async () => {
      sandbox.stub(mongoose.Model.prototype.findOneAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.restoreFromTrash(
        "nonExistentPostId",
        "userId",
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found in trash", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.restoreFromTrash("postId", "userId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("permanentlyDelete", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.findOneAndDelete).resolves({
        _id: "postId",
        title: "Deleted Post",
        slug: "deleted-slug",
      });
    });

    it("should successfully delete a post permanently", async () => {
      const mockPostId = "postId";
      const mockUserId = "userId";

      const result = await managePosts.permanentlyDelete(
        mockPostId,
        mockUserId,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Post permanently deleted");
      expect(result.status).to.equal(httpStatus.NO_CONTENT);
    });

    it("should return not found error when post not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findOneAndDelete).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.permanentlyDelete(
        "nonExistentPostId",
        "userId",
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findOneAndDelete)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.permanentlyDelete("postId", "userId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("bulkUpdatePosts", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox
        .stub(mongoose.Model.prototype.updateMany)
        .resolves({ nModified: 1, nMatched: 1, nUpserted: 0 });
    });

    it("should successfully update multiple posts", async () => {
      const mockUpdates = { status: "draft" };
      const mockUserId = "userId";

      const result = await managePosts.bulkUpdatePosts(
        mockUpdates,
        mockUserId,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Posts updated successfully");
      expect(result.data.nModified).to.equal(1);
      expect(result.data.nMatched).to.equal(1);
      expect(result.data.nUpserted).to.equal(0);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return not found error when no posts found to update", async () => {
      sandbox
        .stub(mongoose.Model.prototype.updateMany)
        .resolves({ nModified: 0, nMatched: 0, nUpserted: 0 });

      const nextSpy = sinon.spy();
      await managePosts.bulkUpdatePosts({ status: "draft" }, "userId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("No posts found to update", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(mongoose.Model.prototype.updateMany)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.bulkUpdatePosts({ status: "draft" }, "userId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getPostCategories", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox
        .stub(CategoryModel.prototype.distinct)
        .resolves(["Category1", "Category2"]);
    });

    it("should successfully retrieve post categories", async () => {
      const result = await managePosts.getPostCategories(() => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved post categories");
      expect(result.data).to.deep.equal(["Category1", "Category2"]);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return empty array when no categories found", async () => {
      sandbox.stub(CategoryModel.prototype.distinct).resolves([]);

      const result = await managePosts.getPostCategories(() => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("No categories found");
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(CategoryModel.prototype.distinct)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getPostCategories(nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getPostTags", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(TagModel.prototype.distinct).resolves(["Tag1", "Tag2"]);
    });

    it("should successfully retrieve post tags", async () => {
      const result = await managePosts.getPostTags(() => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved post tags");
      expect(result.data).to.deep.equal(["Tag1", "Tag2"]);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return empty array when no tags found", async () => {
      sandbox.stub(TagModel.prototype.distinct).resolves([]);

      const result = await managePosts.getPostTags(() => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("No tags found");
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(TagModel.prototype.distinct)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getPostTags(nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getPostAuthors", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox
        .stub(AuthorModel.prototype.distinct)
        .resolves(["Author1", "Author2"]);
    });

    it("should successfully retrieve post authors", async () => {
      const result = await managePosts.getPostAuthors(() => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved post authors");
      expect(result.data).to.deep.equal(["Author1", "Author2"]);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return empty array when no authors found", async () => {
      sandbox.stub(AuthorModel.prototype.distinct).resolves([]);

      const result = await managePosts.getPostAuthors(() => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("No authors found");
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(AuthorModel.prototype.distinct)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getPostAuthors(nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("getPostComments", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(CommentModel.prototype.find).resolves([
        {
          _id: "commentId",
          content: "Test comment",
          createdAt: new Date(),
          updatedAt: new Date(),
          author: "userId",
        },
      ]);
    });

    it("should successfully retrieve comments for a post", async () => {
      const mockPostId = "postId";

      const result = await managePosts.getPostComments(mockPostId, () => {});

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved comments");
      expect(result.data.length).to.equal(1);
      expect(result.data[0]._id).to.equal("commentId");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return empty array when no comments found for the post", async () => {
      sandbox.stub(CommentModel.prototype.find).resolves([]);

      const result = await managePosts.getPostComments(
        "nonExistentPostId",
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("No comments found for this post");
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle internal server error", async () => {
      sandbox
        .stub(CommentModel.prototype.find)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.getPostComments("postId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("createComment", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.save).resolves({
        _id: "commentId",
        post: "postId",
        author: "userId",
        content: "Test comment",
      });
    });

    it("should successfully create a new comment", async () => {
      const mockPostId = "postId";
      const mockUserId = "userId";
      const mockContent = "Test comment";

      const result = await managePosts.createComment(
        mockPostId,
        mockUserId,
        mockContent,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Comment created successfully");
      expect(result.data._id).to.equal("commentId");
      expect(result.status).to.equal(httpStatus.CREATED);
    });

    it("should return internal server error when comment creation fails", async () => {
      sandbox
        .stub(mongoose.Model.prototype.save)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.createComment(
        "postId",
        "userId",
        "Test comment",
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Failed to create comment",
          httpStatus.INTERNAL_SERVER_ERROR
        )
      );
    });

    it("should handle internal server errors", async () => {
      sandbox
        .stub(mongoose.Model.prototype.save)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.createComment(
        "postId",
        "userId",
        "Test comment",
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("updateComment", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.findOneAndUpdate).resolves({
        _id: "commentId",
        content: "Updated Test comment",
      });
    });

    it("should successfully update an existing comment", async () => {
      const mockCommentId = "commentId";
      const mockUserId = "userId";
      const mockContent = "Updated Test comment";

      const result = await managePosts.updateComment(
        mockCommentId,
        mockUserId,
        mockContent,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Comment updated successfully");
      expect(result.data._id).to.equal("commentId");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return not found error when comment not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findOneAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.updateComment(
        "nonExistentCommentId",
        "userId",
        "New content",
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Comment not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server errors", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findOneAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.updateComment(
        "commentId",
        "userId",
        "Updated Test comment",
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("deleteComment", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(mongoose.Model.prototype.findOneAndDelete).resolves({
        _id: "commentId",
        post: "postId",
        author: "userId",
      });
    });

    it("should successfully delete a comment", async () => {
      const mockCommentId = "commentId";
      const mockUserId = "userId";

      const result = await managePosts.deleteComment(
        mockCommentId,
        mockUserId,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Comment deleted successfully");
      expect(result.status).to.equal(httpStatus.NO_CONTENT);
    });

    it("should return not found error when comment not found", async () => {
      sandbox.stub(mongoose.Model.prototype.findOneAndDelete).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.deleteComment(
        "nonExistentCommentId",
        "userId",
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Comment not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server errors", async () => {
      sandbox
        .stub(mongoose.Model.prototype.findOneAndDelete)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.deleteComment("commentId", "userId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("toggleLike", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(PostModel.prototype.findOne).resolves({
        _id: "postId",
        likes: ["userId1", "userId2"],
      });
    });

    it("should successfully toggle like on a post", async () => {
      const mockPostId = "postId";
      const mockUserId = "userId1";

      const result = await managePosts.toggleLike(
        mockPostId,
        mockUserId,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Like toggled successfully");
      expect(result.data._id).to.equal("postId");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should remove user from likes array when already liked", async () => {
      sandbox.stub(PostModel.prototype.findOne).resolves({
        _id: "postId",
        likes: ["userId1", "userId2"],
      });

      const result = await managePosts.toggleLike(
        "postId",
        "userId1",
        () => {}
      );
      expect(result.data.likes).to.deep.equal(["userId2"]);
    });

    it("should add user to likes array when not liked yet", async () => {
      sandbox.stub(PostModel.prototype.findOne).resolves({
        _id: "postId",
        likes: [],
      });

      const result = await managePosts.toggleLike(
        "postId",
        "userId1",
        () => {}
      );
      expect(result.data.likes).to.deep.equal(["userId1"]);
    });

    it("should return not found error when post not found", async () => {
      sandbox.stub(PostModel.prototype.findOne).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.toggleLike("nonExistentPostId", "userId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server errors", async () => {
      sandbox
        .stub(PostModel.prototype.findOne)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.toggleLike("postId", "userId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Failed to update post likes",
          httpStatus.INTERNAL_SERVER_ERROR
        )
      );
    });
  });

  describe("toggleDislike", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(PostModel.prototype.findOne).resolves({
        _id: "postId",
        dislikes: ["userId1"],
      });
    });

    it("should successfully toggle dislike on a post", async () => {
      const mockPostId = "postId";
      const mockUserId = "userId1";

      const result = await managePosts.toggleDislike(
        mockPostId,
        mockUserId,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Dislike toggled successfully");
      expect(result.data._id).to.equal("postId");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should remove user from dislikes array when already disliked", async () => {
      sandbox.stub(PostModel.prototype.findOne).resolves({
        _id: "postId",
        dislikes: ["userId1"],
      });

      const result = await managePosts.toggleDislike(
        "postId",
        "userId1",
        () => {}
      );
      expect(result.data.dislikes).to.deep.equal([]);
    });

    it("should add user to dislikes array when not disliked yet", async () => {
      sandbox.stub(PostModel.prototype.findOne).resolves({
        _id: "postId",
        dislikes: [],
      });

      const result = await managePosts.toggleDislike(
        "postId",
        "userId1",
        () => {}
      );
      expect(result.data.dislikes).to.deep.equal(["userId1"]);
    });

    it("should return not found error when post not found", async () => {
      sandbox.stub(PostModel.prototype.findOne).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.toggleDislike("nonExistentPostId", "userId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server errors", async () => {
      sandbox
        .stub(PostModel.prototype.findOne)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.toggleDislike("postId", "userId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Failed to update post dislikes",
          httpStatus.INTERNAL_SERVER_ERROR
        )
      );
    });
  });

  describe("incrementViewCount", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(PostModel.prototype.findOne).resolves({
        _id: "postId",
        views: 0,
      });
    });

    it("should successfully increment view count on a post", async () => {
      const mockPostId = "postId";
      const mockUserId = "userId";

      const result = await managePosts.incrementViewCount(
        mockPostId,
        mockUserId,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("View count incremented successfully");
      expect(result.data._id).to.equal("postId");
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data.views).to.equal(1);
    });

    it("should return not found error when post not found", async () => {
      sandbox.stub(PostModel.prototype.findOne).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.incrementViewCount(
        "nonExistentPostId",
        "userId",
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server errors", async () => {
      sandbox
        .stub(PostModel.prototype.findOne)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.incrementViewCount("postId", "userId", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Failed to increment view count",
          httpStatus.INTERNAL_SERVER_ERROR
        )
      );
    });
  });

  describe("updatePostStatus", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(PostModel.prototype.findOneAndUpdate).resolves({
        _id: "postId",
        status: "draft",
      });
    });

    it("should successfully update post status", async () => {
      const mockPostId = "postId";
      const mockUserId = "userId";

      const result = await managePosts.updatePostStatus(
        mockPostId,
        mockUserId,
        "draft",
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Post status updated successfully");
      expect(result.data._id).to.equal("postId");
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data.status).to.equal("draft");
    });

    it("should return not found error when post not found", async () => {
      sandbox.stub(PostModel.prototype.findOneAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.updatePostStatus(
        "nonExistentPostId",
        "userId",
        "draft",
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server errors", async () => {
      sandbox
        .stub(PostModel.prototype.findOneAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.updatePostStatus("postId", "userId", "draft", nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("updatePostFeaturedImage", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(PostModel.prototype.findOneAndUpdate).resolves({
        _id: "postId",
        featuredImage: "new-image-url.jpg",
      });
    });

    it("should successfully update post featured image", async () => {
      const mockPostId = "postId";
      const mockUserId = "userId";
      const mockFeaturedImage = "new-image-url.jpg";

      const result = await managePosts.updatePostFeaturedImage(
        mockPostId,
        mockUserId,
        mockFeaturedImage,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Featured image updated successfully");
      expect(result.data._id).to.equal("postId");
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data.featuredImage).to.equal("new-image-url.jpg");
    });

    it("should return not found error when post not found", async () => {
      sandbox.stub(PostModel.prototype.findOneAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.updatePostFeaturedImage(
        "nonExistentPostId",
        "userId",
        "new-image-url.jpg",
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server errors", async () => {
      sandbox
        .stub(PostModel.prototype.findOneAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.updatePostFeaturedImage(
        "postId",
        "userId",
        "new-image-url.jpg",
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("updatePostCategories", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(PostModel.prototype.findOneAndUpdate).resolves({
        _id: "postId",
        categories: ["oldCategory1", "oldCategory2"],
      });
    });

    it("should successfully update post categories", async () => {
      const mockPostId = "postId";
      const mockUserId = "userId";
      const mockCategories = ["newCategory1", "newCategory2"];

      const result = await managePosts.updatePostCategories(
        mockPostId,
        mockUserId,
        mockCategories,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Post categories updated successfully");
      expect(result.data._id).to.equal("postId");
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data.categories).to.deep.equal([
        "newCategory1",
        "newCategory2",
      ]);
    });

    it("should return not found error when post not found", async () => {
      sandbox.stub(PostModel.prototype.findOneAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.updatePostCategories(
        "nonExistentPostId",
        "userId",
        ["category"],
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server errors", async () => {
      sandbox
        .stub(PostModel.prototype.findOneAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.updatePostCategories(
        "postId",
        "userId",
        ["category"],
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("updatePostTags", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(PostModel.prototype.findOneAndUpdate).resolves({
        _id: "postId",
        tags: ["oldTag1", "oldTag2"],
      });
    });

    it("should successfully update post tags", async () => {
      const mockPostId = "postId";
      const mockUserId = "userId";
      const mockTags = ["newTag1", "newTag2"];

      const result = await managePosts.updatePostTags(
        mockPostId,
        mockUserId,
        mockTags,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Post tags updated successfully");
      expect(result.data._id).to.equal("postId");
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data.tags).to.deep.equal(["newTag1", "newTag2"]);
    });

    it("should return not found error when post not found", async () => {
      sandbox.stub(PostModel.prototype.findOneAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.updatePostTags(
        "nonExistentPostId",
        "userId",
        ["tag"],
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server errors", async () => {
      sandbox
        .stub(PostModel.prototype.findOneAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.updatePostTags("postId", "userId", ["tag"], nextSpy);

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("updatePostTitleAndSlug", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(PostModel.prototype.findOneAndUpdate).resolves({
        _id: "postId",
        title: "Old Title",
        slug: "old-slug",
      });
    });

    it("should successfully update post title and slug", async () => {
      const mockPostId = "postId";
      const mockUserId = "userId";
      const mockTitle = "New Title";
      const mockSlug = "new-slug";

      const result = await managePosts.updatePostTitleAndSlug(
        mockPostId,
        mockUserId,
        mockTitle,
        mockSlug,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "Post title and slug updated successfully"
      );
      expect(result.data._id).to.equal("postId");
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data.title).to.equal(mockTitle);
      expect(result.data.slug).to.equal(mockSlug);
    });

    it("should return not found error when post not found", async () => {
      sandbox.stub(PostModel.prototype.findOneAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.updatePostTitleAndSlug(
        "nonExistentPostId",
        "userId",
        "title",
        "slug",
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server errors", async () => {
      sandbox
        .stub(PostModel.prototype.findOneAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.updatePostTitleAndSlug(
        "postId",
        "userId",
        "title",
        "slug",
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("updatePostAuthor", () => {
    beforeEach(() => {
      // Reset the database before each test
      sandbox.restore();
      sandbox.stub(PostModel.prototype.findOneAndUpdate).resolves({
        _id: "postId",
        author: "oldAuthorId",
      });
    });

    it("should successfully update post author", async () => {
      const mockPostId = "postId";
      const mockUserId = "userId";
      const mockAuthorId = "newAuthorId";

      const result = await managePosts.updatePostAuthor(
        mockPostId,
        mockUserId,
        mockAuthorId,
        () => {}
      );

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Post author updated successfully");
      expect(result.data._id).to.equal("postId");
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data.author).to.equal(mockAuthorId);
    });

    it("should return not found error when post not found", async () => {
      sandbox.stub(PostModel.prototype.findOneAndUpdate).resolves(null);

      const nextSpy = sinon.spy();
      await managePosts.updatePostAuthor(
        "nonExistentPostId",
        "userId",
        "authorId",
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError("Post not found", httpStatus.NOT_FOUND)
      );
    });

    it("should handle internal server errors", async () => {
      sandbox
        .stub(PostModel.prototype.findOneAndUpdate)
        .rejects(new Error("Database error"));

      const nextSpy = sinon.spy();
      await managePosts.updatePostAuthor(
        "postId",
        "userId",
        "authorId",
        nextSpy
      );

      expect(nextSpy).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Database error" }
        )
      );
    });
  });

  describe("updatePostPublishDate", () => {
    it("should update post publish date successfully", async () => {
      const userId = "test-user";
      const postId = "1234567890abcdef";
      const publishDate = new Date().toISOString();

      const PostModelMock = {
        findOneAndUpdate: sandbox.stub().resolves({
          _id: postId,
          publishDate: publishDate,
          __v: 0,
        }),
      };

      sandbox.stub(getModelByTenant, "call").returns(PostModelMock);

      const result = await managePosts.updatePostPublishDate(
        postId,
        userId,
        publishDate
      );

      result.should.be.an("object");
      result.success.should.equal(true);
      result.message.should.equal("Post publish date updated successfully");
      result.data._id.should.equal(postId);
      result.data.publishDate.should.equal(publishDate);

      sinon.assert.calledOnce(getModelByTenant.call);
      sinon.assert.calledWith(getModelByTenant.call, userId, "post");
      sinon.assert.calledOnce(PostModelMock.findOneAndUpdate);
      sinon.assert.calledWith(
        PostModelMock.findOneAndUpdate,
        { _id: postId },
        { publishDate: publishDate },
        { new: true }
      );
    });

    it("should return post not found error", async () => {
      const userId = "test-user";
      const postId = "1234567890abcdef";
      const publishDate = new Date().toISOString();

      const PostModelMock = {
        findOneAndUpdate: sandbox.stub().resolves(null),
      };

      sandbox.stub(getModelByTenant, "call").returns(PostModelMock);

      await managePosts
        .updatePostPublishDate(postId, userId, publishDate)
        .should.be.rejectedWith(HttpError);
    });

    it("should handle internal server error", async () => {
      const userId = "test-user";
      const postId = "1234567890abcdef";
      const publishDate = new Date().toISOString();

      const PostModelMock = {
        findOneAndUpdate: sandbox.stub().rejects(new Error("Database error")),
      };

      sandbox.stub(getModelByTenant, "call").returns(PostModelMock);

      await managePosts
        .updatePostPublishDate(postId, userId, publishDate)
        .should.be.rejectedWith(HttpError);
    });
  });

  describe("Manage Posts", () => {
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    // ... (previous tests)

    describe("updatePostFeatured", () => {
      it("should update post featured status successfully", async () => {
        const userId = "test-user";
        const postId = "1234567890abcdef";
        const featured = true;

        const PostModelMock = {
          findOneAndUpdate: sandbox.stub().resolves({
            _id: postId,
            featured: true,
            __v: 0,
          }),
        };

        sandbox.stub(getModelByTenant, "call").returns(PostModelMock);

        const result = await managePosts.updatePostFeatured(
          postId,
          userId,
          featured
        );

        result.should.be.an("object");
        result.success.should.equal(true);
        result.message.should.equal(
          "Post featured status updated successfully"
        );
        result.data._id.should.equal(postId);
        result.data.featured.should.equal(true);

        sinon.assert.calledOnce(getModelByTenant.call);
        sinon.assert.calledWith(getModelByTenant.call, userId, "post");
        sinon.assert.calledOnce(PostModelMock.findOneAndUpdate);
        sinon.assert.calledWith(
          PostModelMock.findOneAndUpdate,
          { _id: postId },
          { featured: true },
          { new: true }
        );
      });

      it("should return post not found error", async () => {
        const userId = "test-user";
        const postId = "1234567890abcdef";
        const featured = true;

        const PostModelMock = {
          findOneAndUpdate: sandbox.stub().resolves(null),
        };

        sandbox.stub(getModelByTenant, "call").returns(PostModelMock);

        await managePosts
          .updatePostFeatured(postId, userId, featured)
          .should.be.rejectedWith(HttpError);
      });

      it("should handle internal server error", async () => {
        const userId = "test-user";
        const postId = "1234567890abcdef";
        const featured = true;

        const PostModelMock = {
          findOneAndUpdate: sandbox.stub().rejects(new Error("Database error")),
        };

        sandbox.stub(getModelByTenant, "call").returns(PostModelMock);

        await managePosts
          .updatePostFeatured(postId, userId, featured)
          .should.be.rejectedWith(HttpError);
      });
    });

    describe("updatePostStatusAndFeatured", () => {
      it("should update post status and featured status successfully", async () => {
        const userId = "test-user";
        const postId = "1234567890abcdef";
        const status = "draft";
        const featured = true;

        const PostModelMock = {
          findOneAndUpdate: sandbox.stub().resolves({
            _id: postId,
            status: "draft",
            featured: true,
            __v: 0,
          }),
        };

        sandbox.stub(getModelByTenant, "call").returns(PostModelMock);

        const result = await managePosts.updatePostStatusAndFeatured(
          postId,
          userId,
          status,
          featured
        );

        result.should.be.an("object");
        result.success.should.equal(true);
        result.message.should.equal(
          "Post status and featured status updated successfully"
        );
        result.data._id.should.equal(postId);
        result.data.status.should.equal(status);
        result.data.featured.should.equal(true);

        sinon.assert.calledOnce(getModelByTenant.call);
        sinon.assert.calledWith(getModelByTenant.call, userId, "post");
        sinon.assert.calledOnce(PostModelMock.findOneAndUpdate);
        sinon.assert.calledWith(
          PostModelMock.findOneAndUpdate,
          { _id: postId },
          { status, featured },
          { new: true }
        );
      });

      it("should return post not found error", async () => {
        const userId = "test-user";
        const postId = "1234567890abcdef";
        const status = "draft";
        const featured = true;

        const PostModelMock = {
          findOneAndUpdate: sandbox.stub().resolves(null),
        };

        sandbox.stub(getModelByTenant, "call").returns(PostModelMock);

        await managePosts
          .updatePostStatusAndFeatured(postId, userId, status, featured)
          .should.be.rejectedWith(HttpError);
      });

      it("should handle internal server error", async () => {
        const userId = "test-user";
        const postId = "1234567890abcdef";
        const status = "draft";
        const featured = true;

        const PostModelMock = {
          findOneAndUpdate: sandbox.stub().rejects(new Error("Database error")),
        };

        sandbox.stub(getModelByTenant, "call").returns(PostModelMock);

        await managePosts
          .updatePostStatusAndFeatured(postId, userId, status, featured)
          .should.be.rejectedWith(HttpError);
      });
    });

    describe("updatePostCategoriesAndTags", () => {
      it("should update post categories and tags successfully", async () => {
        const userId = "test-user";
        const postId = "1234567890abcdef";
        const categories = ["category1", "category2"];
        const tags = ["tag1", "tag2"];

        const PostModelMock = {
          findOneAndUpdate: sandbox.stub().resolves({
            _id: postId,
            categories: categories,
            tags: tags,
            __v: 0,
          }),
        };

        sandbox.stub(getModelByTenant, "call").returns(PostModelMock);

        const result = await managePosts.updatePostCategoriesAndTags(
          postId,
          userId,
          categories,
          tags
        );

        result.should.be.an("object");
        result.success.should.equal(true);
        result.message.should.equal(
          "Post categories and tags updated successfully"
        );
        result.data._id.should.equal(postId);
        result.data.categories.should.deep.equal(categories);
        result.data.tags.should.deep.equal(tags);

        sinon.assert.calledOnce(getModelByTenant.call);
        sinon.assert.calledWith(getModelByTenant.call, userId, "post");
        sinon.assert.calledOnce(PostModelMock.findOneAndUpdate);
        sinon.assert.calledWith(
          PostModelMock.findOneAndUpdate,
          { _id: postId },
          { categories, tags },
          { new: true }
        );
      });

      it("should return post not found error", async () => {
        const userId = "test-user";
        const postId = "1234567890abcdef";
        const categories = ["category1", "category2"];
        const tags = ["tag1", "tag2"];

        const PostModelMock = {
          findOneAndUpdate: sandbox.stub().resolves(null),
        };

        sandbox.stub(getModelByTenant, "call").returns(PostModelMock);

        await managePosts
          .updatePostCategoriesAndTags(postId, userId, categories, tags)
          .should.be.rejectedWith(HttpError);
      });

      it("should handle internal server error", async () => {
        const userId = "test-user";
        const postId = "1234567890abcdef";
        const categories = ["category1", "category2"];
        const tags = ["tag1", "tag2"];

        const PostModelMock = {
          findOneAndUpdate: sandbox.stub().rejects(new Error("Database error")),
        };

        sandbox.stub(getModelByTenant, "call").returns(PostModelMock);

        await managePosts
          .updatePostCategoriesAndTags(postId, userId, categories, tags)
          .should.be.rejectedWith(HttpError);
      });
    });

    describe("updatePostContent", () => {
      it("should update post content successfully", async () => {
        const userId = "test-user";
        const postId = "1234567890abcdef";
        const content = "New blog post content";

        const PostModelMock = {
          findOneAndUpdate: sandbox.stub().resolves({
            _id: postId,
            content: content,
            __v: 0,
          }),
        };

        sandbox.stub(getModelByTenant, "call").returns(PostModelMock);

        const result = await managePosts.updatePostContent(
          postId,
          userId,
          content
        );

        result.should.be.an("object");
        result.success.should.equal(true);
        result.message.should.equal("Post content updated successfully");
        result.data._id.should.equal(postId);
        result.data.content.should.equal(content);

        sinon.assert.calledOnce(getModelByTenant.call);
        sinon.assert.calledWith(getModelByTenant.call, userId, "post");
        sinon.assert.calledOnce(PostModelMock.findOneAndUpdate);
        sinon.assert.calledWith(
          PostModelMock.findOneAndUpdate,
          { _id: postId },
          { content },
          { new: true }
        );
      });

      it("should return post not found error", async () => {
        const userId = "test-user";
        const postId = "1234567890abcdef";
        const content = "New blog post content";

        const PostModelMock = {
          findOneAndUpdate: sandbox.stub().resolves(null),
        };

        sandbox.stub(getModelByTenant, "call").returns(PostModelMock);

        await managePosts
          .updatePostContent(postId, userId, content)
          .should.be.rejectedWith(HttpError);
      });

      it("should handle internal server error", async () => {
        const userId = "test-user";
        const postId = "1234567890abcdef";
        const content = "New blog post content";

        const PostModelMock = {
          findOneAndUpdate: sandbox.stub().rejects(new Error("Database error")),
        };

        sandbox.stub(getModelByTenant, "call").returns(PostModelMock);

        await managePosts
          .updatePostContent(postId, userId, content)
          .should.be.rejectedWith(HttpError);
      });
    });
  });
});
