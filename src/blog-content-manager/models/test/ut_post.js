require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const mongoose = require("mongoose");
const PostModel = require("@models/Post");

describe("Post Model", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("PostSchema", () => {
    it("should define the schema correctly", () => {
      const schema = PostSchema;
      expect(schema.paths).to.exist;
      expect(schema.paths.title).to.exist;
      expect(schema.paths.content).to.exist;
      expect(schema.paths.author).to.exist;
      expect(schema.paths.categories).to.exist;
      expect(schema.paths.tags).to.exist;
      expect(schema.paths.status).to.exist;
      expect(schema.paths.publishDate).to.exist;
      expect(schema.paths.featuredImage).to.exist;
      expect(schema.paths.slug).to.exist;
      expect(schema.paths.views).to.exist;
      expect(schema.options.timestamps).to.exist;
    });

    it("should validate required fields", () => {
      const validPost = {
        title: "Some post title",
        content: "Some post content",
        author: "author-id",
        categories: ["category-id"],
        tags: ["tag-id"],
        status: "draft",
        slug: "some-slug",
      };

      const invalidPost = {};

      expect(PostSchema.validate(validPost)).to.not.throw();
      expect(() => PostSchema.validate(invalidPost)).to.throw(
        /Title is required/
      );
      expect(() => PostSchema.validate(invalidPost)).to.throw(
        /Content is required/
      );
      expect(() => PostSchema.validate(invalidPost)).to.throw(
        /Author is required/
      );
      expect(() => PostSchema.validate(invalidPost)).to.throw(
        /Slug is required/
      );
    });

    it("should validate field lengths", () => {
      const validPost = {
        title: "Some post title",
        content: "This is a short content",
        slug: "some-slug",
      };

      const invalidPost = {
        title: "a".repeat(201),
        slug: "a".repeat(51),
      };

      expect(PostSchema.validate(validPost)).to.not.throw();
      expect(() => PostSchema.validate(invalidPost)).to.throw(
        /Title cannot be more than 200 characters/
      );
      expect(() => PostSchema.validate(invalidPost)).to.throw(
        /Slug cannot be more than 50 characters/
      );
    });

    it("should validate unique slug", async () => {
      const validPost = {
        title: "Unique Post",
        slug: "unique-post",
        author: "author-id",
      };

      const duplicatePost = {
        title: "Duplicate Post",
        slug: "unique-post",
        author: "different-author-id",
      };

      const db = await mongoose.connect("mongodb://localhost/test-db");
      const Post = mongoose.model("posts", PostSchema);

      await Post.create(validPost);

      await expect(PostSchema.validate(duplicatePost)).to.be.rejectedWith(
        "Slug should be unique!"
      );
    });
  });

  describe("PostSchema methods", () => {
    it("should export toJSON method", () => {
      const post = new PostModel()
        .schema({
          _id: "123",
          title: "Test Title",
          content: "Test Content",
          author: "author-id",
          categories: ["category-id"],
          tags: ["tag-id"],
          status: "draft",
          publishDate: new Date(),
          featuredImage: "test-image-url",
          slug: "test-slug",
          views: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .toObject();

      const jsonResult = post.toJSON();
      expect(jsonResult).to.deep.equal({
        _id: "123",
        title: "Test Title",
        content: "Test Content",
        author: "author-id",
        categories: ["category-id"],
        tags: ["tag-id"],
        status: "draft",
        publishDate: expect.any(Date),
        featuredImage: "test-image-url",
        slug: "test-slug",
        views: 10,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  describe("static methods", () => {
    let mockMongooseModel;

    beforeEach(() => {
      mockMongooseModel = sinon.mock(mongoose.Model);
    });

    afterEach(() => {
      mockMongooseModel.restore();
    });

    describe("create method", () => {
      it("should create a new post item", async () => {
        const mockCreate = sandbox
          .stub(mongoose.Model.prototype.create, "exec")
          .resolves({
            _id: "123",
            title: "Test Title",
            content: "Test Content",
          });

        const result = await PostModel.create(
          { title: "Test Title", content: "Test Content" },
          {}
        );

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal("Post created successfully");
        expect(result.status).to.equal(httpStatus.CREATED);
        expect(mockCreate).to.have.been.calledOnceWith({
          title: "Test Title",
          content: "Test Content",
        });
      });

      it("should fail to create when required fields are missing", async () => {
        const mockCreate = sandbox
          .stub(mongoose.Model.prototype.create, "exec")
          .resolves(null);

        const result = await PostModel.create({}, {});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Failed to create post");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(mockCreate).to.have.been.calledOnceWith({});
      });
    });

    describe("list method", () => {
      it("should list posts", async () => {
        const mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .resolves([
            {
              _id: "1",
              title: "Post 1",
              content: "Content 1",
              author: "author-1",
            },
            {
              _id: "2",
              title: "Post 2",
              content: "Content 2",
              author: "author-2",
            },
          ]);
        const mockCountDocuments = sandbox
          .stub(mongoose.Model.prototype.countDocuments, "exec")
          .resolves(2);

        const result = await PostModel.list({}, {});

        expect(result.success).to.be.true;
        expect(result.data).to.have.lengthOf(2);
        expect(result.total).to.equal(2);
        expect(result.message).to.equal("Successfully retrieved posts");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFind).to.have.been.calledOnceWith({});
        expect(mockCountDocuments).to.have.been.calledOnceWith({});
      });

      it("should handle empty results", async () => {
        const mockFind = sandbox
          .stub(mongoose.Model.prototype.find, "exec")
          .resolves([]);
        const mockCountDocuments = sandbox
          .stub(mongoose.Model.prototype.countDocuments, "exec")
          .resolves(0);

        const result = await PostModel.list({}, {});

        expect(result.success).to.be.true;
        expect(result.data).to.be.empty;
        expect(result.total).to.equal(0);
        expect(result.message).to.equal("No posts found");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFind).to.have.been.calledOnceWith({});
        expect(mockCountDocuments).to.have.been.calledOnceWith({});
      });
    });

    describe("findById method", () => {
      it("should find a post by ID", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves({
            _id: "123",
            title: "Test Title",
            content: "Test Content",
            author: "author-id",
          });

        const result = await PostModel.findById("123", {});

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal("Successfully retrieved post");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindOne).to.have.been.calledOnceWith({ _id: "123" });
      });

      it("should return not found when post does not exist", async () => {
        const mockFindOne = sandbox
          .stub(mongoose.Model.prototype.findOne, "exec")
          .resolves(null);

        const result = await PostModel.findById("nonexistent-id", {});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Post not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindOne).to.have.been.calledOnceWith({
          _id: "nonexistent-id",
        });
      });
    });

    describe("update method", () => {
      it("should update an existing post", async () => {
        const mockFindByIdAndUpdate = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .resolves({
            _id: "123",
            title: "Updated Title",
            content: "Updated Content",
          });

        const result = await PostModel.update(
          {
            id: "123",
            update: { title: "Updated Title", content: "Updated Content" },
          },
          {}
        );

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal("Successfully updated the post");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindByIdAndUpdate).to.have.been.calledOnceWith(
          "123",
          { title: "Updated Title", content: "Updated Content" },
          { new: true, runValidators: true }
        );
      });

      it("should fail to update when post not found", async () => {
        const mockFindByIdAndUpdate = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .rejects(new Error("Post not found"));

        const result = await PostModel.update(
          {
            id: "nonexistent-id",
            update: {
              title: "Non-existent post title",
              content: "Non-existent post content",
            },
          },
          {}
        );

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Post not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindByIdAndUpdate).to.have.been.calledOnceWith(
          "nonexistent-id",
          {
            title: "Non-existent post title",
            content: "Non-existent post content",
          },
          { new: true, runValidators: true }
        );
      });
    });

    describe("remove method", () => {
      it("should remove an existing post", async () => {
        const mockFindByIdAndRemove = sandbox
          .stub(mongoose.Model.prototype.findByIdAndRemove, "exec")
          .resolves({
            _id: "123",
            title: "Test Title",
            content: "Test Content",
          });

        const result = await PostModel.remove("123");

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.message).to.equal("Successfully removed the post");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindByIdAndRemove).to.have.been.calledOnceWith({
          _id: "123",
        });
      });

      it("should return not found when post does not exist", async () => {
        const mockFindByIdAndRemove = sandbox
          .stub(mongoose.Model.prototype.findByIdAndRemove, "exec")
          .resolves(null);

        const result = await PostModel.remove("nonexistent-id");

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Post not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindByIdAndRemove).to.have.been.calledOnceWith({
          _id: "nonexistent-id",
        });
      });
    });

    describe("incrementViews method", () => {
      it("should increment views for a post", async () => {
        const mockFindByIdAndUpdate = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .resolves({ _id: "123", views: 5 });

        const result = await PostModel.incrementViews("123", {});

        expect(result.success).to.be.true;
        expect(result.data._id).to.equal("123");
        expect(result.data.views).to.equal(6);
        expect(result.message).to.equal("Successfully incremented post views");
        expect(result.status).to.equal(httpStatus.OK);
        expect(mockFindByIdAndUpdate).to.have.been.calledOnceWith(
          "123",
          { $inc: { views: 1 } },
          { new: true }
        );
      });

      it("should return not found when post does not exist", async () => {
        const mockFindByIdAndUpdate = sandbox
          .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
          .rejects(new Error("Post not found"));

        const result = await PostModel.incrementViews("nonexistent-id", {});

        expect(result.success).to.be.false;
        expect(result.message).to.equal("Post not found");
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
        expect(mockFindByIdAndUpdate).to.have.been.calledOnceWith(
          "nonexistent-id",
          { $inc: { views: 1 } },
          { new: true }
        );
      });
    });

    describe("getModelByTenant function", () => {
      it("should return the model for the given tenant", async () => {
        const mockGetModelByTenant = sandbox
          .stub(getModelByTenant, "default")
          .resolves({ schema: PostSchema });

        const result = await PostModel("tenant-id");

        expect(result).to.deep.equal({ schema: PostSchema });
        expect(mockGetModelByTenant).to.have.been.calledOnceWith(
          "tenant-id",
          "post",
          PostSchema
        );
      });

      it("should throw an error if getModelByTenant fails", async () => {
        const mockGetModelByTenant = sandbox
          .stub(getModelByTenant, "default")
          .rejects(new Error("Failed to get model"));

        await expect(PostModel("tenant-id")).to.eventually.throw(
          "Failed to get model"
        );
        expect(mockGetModelByTenant).to.have.been.calledOnceWith(
          "tenant-id",
          "post",
          PostSchema
        );
      });
    });
  });
});
