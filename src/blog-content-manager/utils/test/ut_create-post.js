// test-create-blog-post-util.js
require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { describe, it, beforeEach, afterEach } = require("mocha");

const PostModel = require("@models/post");
const logObject = require("@utils/log");
const mailer = require("@utils/mailer");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const generateFilter = require("@utils/generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- blog-post-util`);
const { HttpError } = require("@utils/errors");

const createBlogPostUtil = require("./path/to/createBlogPostUtil"); // Adjust the path as needed

describe("createBlogPostUtil", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("create", () => {
    it("should create a new blog post", async () => {
      const request = {
        body: {
          title: "Test Blog Post",
          content: "This is a test blog post.",
          authorId: "test-author-id",
          tags: [],
          status: "draft",
          publishDate: new Date(),
          featuredImage: "",
          slug: "test-slug",
          views: 0,
        },
      };
      const next = sinon.spy();

      sandbox.stub(PostModel.prototype.create).resolves({
        success: true,
        data: {
          /* mock post object */
        },
        status: httpStatus.CREATED,
      });

      sandbox.stub(mailer.postNotification).resolves({});

      const result = await createBlogPostUtil.create(request, next);

      expect(result).to.have.property("success").that.is.true;
      expect(result)
        .to.have.property("message")
        .that.equals("Blog post created successfully");
      expect(result).to.have.property("data");
      expect(next).not.toHaveBeenCalled();
    });

    it("should throw HttpError for missing required fields", async () => {
      const request = {
        body: {},
      };
      const next = sinon.spy();

      await expect(createBlogPostUtil.create(request, next)).to.be.rejectedWith(
        HttpError
      );
    });

    it("should handle PostModel.create errors", async () => {
      const request = {
        body: {
          title: "Test Blog Post",
          content: "This is a test blog post.",
          authorId: "test-author-id",
          tags: [],
          status: "draft",
          publishDate: new Date(),
          featuredImage: "",
          slug: "test-slug",
          views: 0,
        },
      };
      const next = sinon.spy();

      sandbox
        .stub(PostModel.prototype.create)
        .rejects(new Error("Database error"));

      await expect(createBlogPostUtil.create(request, next)).to.be.rejectedWith(
        HttpError
      );
    });
  });

  describe("list", () => {
    it("should return a list of blog posts", async () => {
      const request = {
        body: {},
        query: {},
        params: {},
      };
      const next = sinon.spy();

      sandbox.stub(PostModel.prototype.list).resolves({
        success: true,
        data: [
          {
            /* mock post object */
          },
        ],
        status: httpStatus.OK,
      });

      const result = await createBlogPostUtil.list(request, next);

      expect(result).to.have.property("success").that.is.true;
      expect(result).to.have.property("data");
      expect(next).not.toHaveBeenCalled();
    });

    it("should handle PostModel.list errors", async () => {
      const request = {
        body: {},
        query: {},
        params: {},
      };
      const next = sinon.spy();

      sandbox
        .stub(PostModel.prototype.list)
        .rejects(new Error("Database error"));

      await expect(createBlogPostUtil.list(request, next)).to.be.rejectedWith(
        HttpError
      );
    });
  });

  describe("retrieve", () => {
    it("should retrieve a single blog post", async () => {
      const request = {
        params: { id: "test-post-id" },
      };
      const next = sinon.spy();

      sandbox.stub(PostModel.prototype.findById).resolves({
        success: true,
        data: {
          /* mock post object */
        },
        status: httpStatus.OK,
      });

      const result = await createBlogPostUtil.retrieve(request, next);

      expect(result).to.have.property("success").that.is.true;
      expect(result).to.have.property("data");
      expect(next).not.toHaveBeenCalled();
    });

    it("should throw HttpError for non-existent post", async () => {
      const request = {
        params: { id: "non-existent-post-id" },
      };
      const next = sinon.spy();

      sandbox.stub(PostModel.prototype.findById).resolves({});

      await expect(
        createBlogPostUtil.retrieve(request, next)
      ).to.be.rejectedWith(HttpError);
    });

    it("should handle PostModel.findById errors", async () => {
      const request = {
        params: { id: "test-post-id" },
      };
      const next = sinon.spy();

      sandbox
        .stub(PostModel.prototype.findById)
        .rejects(new Error("Database error"));

      await expect(
        createBlogPostUtil.retrieve(request, next)
      ).to.be.rejectedWith(HttpError);
    });
  });

  describe("update", () => {
    it("should update a blog post", async () => {
      const request = {
        params: { id: "test-post-id" },
        body: { title: "Updated Title" },
      };
      const next = sinon.spy();

      sandbox.stub(generateFilter.post).returns({});
      sandbox.stub(PostModel.prototype.update).resolves({
        success: true,
        data: {
          /* mock updated post object */
        },
        status: httpStatus.OK,
      });

      const result = await createBlogPostUtil.update(request, next);

      expect(result).to.have.property("success").that.is.true;
      expect(result).to.have.property("data");
      expect(next).not.toHaveBeenCalled();
    });

    it("should throw HttpError for non-existent post", async () => {
      const request = {
        params: { id: "non-existent-post-id" },
        body: { title: "Updated Title" },
      };
      const next = sinon.spy();

      sandbox.stub(generateFilter.post).returns({});
      sandbox.stub(PostModel.prototype.update).resolves({});

      await expect(createBlogPostUtil.update(request, next)).to.be.rejectedWith(
        HttpError
      );
    });

    it("should handle PostModel.update errors", async () => {
      const request = {
        params: { id: "test-post-id" },
        body: { title: "Updated Title" },
      };
      const next = sinon.spy();

      sandbox.stub(generateFilter.post).returns({});
      sandbox
        .stub(PostModel.prototype.update)
        .rejects(new Error("Database error"));

      await expect(createBlogPostUtil.update(request, next)).to.be.rejectedWith(
        HttpError
      );
    });
  });

  describe("delete", () => {
    it("should throw HttpError for non-existent post", async () => {
      const request = {
        params: { id: "non-existent-post-id" },
      };
      const next = sinon.spy();

      sandbox.stub(PostModel.prototype.remove).resolves({});

      await expect(createBlogPostUtil.delete(request, next)).to.be.rejectedWith(
        HttpError
      );
    });

    it("should handle PostModel.remove errors", async () => {
      const request = {
        params: { id: "test-post-id" },
      };
      const next = sinon.spy();

      sandbox
        .stub(PostModel.prototype.remove)
        .rejects(new Error("Database error"));

      await expect(createBlogPostUtil.delete(request, next)).to.be.rejectedWith(
        HttpError
      );
    });
  });

  describe("uploadImage", () => {
    it("should upload an image", async () => {
      const request = {
        body: {
          image: {
            originalname: "test-image.jpg",
            size: 1024 * 1024,
            mimetype: "image/jpeg",
          },
        },
      };
      const next = sinon.spy();

      const result = await createBlogPostUtil.uploadImage(request, next);

      expect(result).to.have.property("success").that.is.true;
      expect(result)
        .to.have.property("message")
        .that.equals("Image uploaded successfully");
      expect(result).to.have.property("imageUrl");
      expect(next).not.toHaveBeenCalled();
    });

    it("should throw HttpError for missing image", async () => {
      const request = {
        body: {},
      };
      const next = sinon.spy();

      await expect(
        createBlogPostUtil.uploadImage(request, next)
      ).to.be.rejectedWith(HttpError);
    });
  });

  describe("preview", () => {
    it("should generate a preview", async () => {
      const request = {
        body: {
          content: "<h1>Test Content</h1><p>This is a test.</p>",
        },
      };
      const next = sinon.spy();

      const result = await createBlogPostUtil.preview(request, next);

      expect(result).to.have.property("success").that.is.true;
      expect(result)
        .to.have.property("message")
        .that.equals("Preview generated successfully");
      expect(result).to.have.property("htmlContent");
      expect(next).not.toHaveBeenCalled();
    });

    it("should throw HttpError for missing content", async () => {
      const request = {
        body: {},
      };
      const next = sinon.spy();

      await expect(
        createBlogPostUtil.preview(request, next)
      ).to.be.rejectedWith(HttpError);
    });
  });

  describe("updateDraftStatus", () => {
    it("should update a draft status", async () => {
      const request = {
        params: { id: "test-post-id" },
        body: { status: "draft" },
        query: {},
        tenant: "test-tenant",
      };
      const next = sinon.spy();

      sandbox.stub(generateFilter.draftStatus).resolves({});

      sandbox.stub(PostModel.prototype.update).resolves({
        success: true,
        data: {
          _id: "updated-post-id",
          status: "draft",
        },
        status: httpStatus.OK,
      });

      const result = await createBlogPostUtil.updateDraftStatus(request, next);

      expect(result).to.have.property("success").that.is.true;
      expect(result).to.have.property("data");
      expect(next).not.toHaveBeenCalled();
    });

    it("should throw HttpError for non-existent post", async () => {
      const request = {
        params: { id: "non-existent-post-id" },
        body: { status: "draft" },
        query: {},
        tenant: "test-tenant",
      };
      const next = sinon.spy();

      sandbox.stub(generateFilter.draftStatus).resolves({});
      sandbox.stub(PostModel.prototype.update).resolves({});

      await expect(
        createBlogPostUtil.updateDraftStatus(request, next)
      ).to.be.rejectedWith(HttpError);
    });

    it("should handle PostModel.update errors", async () => {
      const request = {
        params: { id: "test-post-id" },
        body: { status: "draft" },
        query: {},
        tenant: "test-tenant",
      };
      const next = sinon.spy();

      sandbox.stub(generateFilter.draftStatus).resolves({});
      sandbox
        .stub(PostModel.prototype.update)
        .rejects(new Error("Database error"));

      await expect(
        createBlogPostUtil.updateDraftStatus(request, next)
      ).to.be.rejectedWith(HttpError);
    });
  });
});
