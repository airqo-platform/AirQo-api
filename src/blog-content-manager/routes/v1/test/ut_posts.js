require("module-alias/register");
// Import necessary modules
const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const BlogPostController = require("@controllers/create-post");

// Import middleware
const validatePagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};

// Mock route handlers
const mockListHandler = sinon.stub(BlogPostController, "list").resolves({
  status: 200,
  body: [
    { id: 1, title: "Test Post 1", content: "Content 1" },
    { id: 2, title: "Test Post 2", content: "Content 2" },
  ],
});

const mockCreateHandler = sinon.stub(BlogPostController, "create").resolves({
  status: 201,
  body: { message: "Blog post created successfully" },
});

const mockUpdateDraftStatusHandler = sinon
  .stub(BlogPostController, "updateDraftStatus")
  .resolves({
    status: 200,
    body: { message: "Draft status updated successfully" },
  });

const mockRetrieveHandler = sinon
  .stub(BlogPostController, "retrieve")
  .resolves({
    status: 200,
    body: { id: 1, title: "Test Post", content: "Content" },
  });

const mockUpdateHandler = sinon.stub(BlogPostController, "update").resolves({
  status: 200,
  body: { message: "Blog post updated successfully" },
});

const mockDeleteHandler = sinon.stub(BlogPostController, "delete").resolves({
  status: 204,
  body: {},
});

const mockUploadImageHandler = sinon
  .stub(BlogPostController, "uploadImage")
  .resolves({
    status: 200,
    body: { url: "http://example.com/image.jpg" },
  });

const mockPreviewHandler = sinon.stub(BlogPostController, "preview").resolves({
  status: 200,
  body: "<html>Preview</html>",
});

describe("Blog Post Routes", () => {
  describe("GET /", () => {
    it("should list blog posts", async () => {
      const req = {};
      const res = {};

      await router.get("/", validateBlogPost)(req, res);

      expect(mockListHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal([
        { id: 1, title: expect.any(String), content: expect.any(String) },
        { id: 2, title: expect.any(String), content: expect.any(String) },
      ]);
    });

    it("should handle validation errors", async () => {
      const req = {};
      const res = {};

      await router.get("/invalid", validateBlogPost)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("POST /", () => {
    it("should create a new blog post", async () => {
      const req = {
        body: { title: "New Test Post", content: "This is a test." },
      };
      const res = {};

      await router.post("/", validateBlogPost)(req, res);

      expect(mockCreateHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(201);
      expect(res.body).to.deep.equal({
        message: "Blog post created successfully",
      });
    });

    it("should handle validation errors", async () => {
      const req = {
        body: { invalidTitle: "too long" },
      };
      const res = {};

      await router.post("/invalid", validateBlogPost)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("PATCH /:id/draft", () => {
    it("should update draft status", async () => {
      const req = {
        params: { id: "validId" },
        body: { draft: true },
      };
      const res = {};

      await router.patch("/:id/draft", validateBlogPost)(req, res);

      expect(mockUpdateDraftStatusHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({
        message: "Draft status updated successfully",
      });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { id: "invalidId" },
        body: { invalidDraft: "not a boolean" },
      };
      const res = {};

      await router.patch("/invalidId/draft", validateBlogPost)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("GET /:id", () => {
    it("should retrieve a blog post", async () => {
      const req = { params: { id: "validId" } };
      const res = {};

      await router.get("/:id", validateBlogPost)(req, res);

      expect(mockRetrieveHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({
        id: expect.any(Number),
        title: expect.any(String),
        content: expect.any(String),
      });
    });

    it("should handle validation errors", async () => {
      const req = { params: { id: "invalidId" } };
      const res = {};

      await router.get("/invalidId", validateBlogPost)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("PUT /:id", () => {
    it("should update a blog post", async () => {
      const req = {
        params: { id: "validId" },
        body: { title: "Updated Title", content: "Updated Content" },
      };
      const res = {};

      await router.put("/:id", validateBlogPost)(req, res);

      expect(mockUpdateHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({
        message: "Blog post updated successfully",
      });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { id: "invalidId" },
        body: { invalidTitle: "too long" },
      };
      const res = {};

      await router.put("/invalidId", validateBlogPost)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("DELETE /:id", () => {
    it("should delete a blog post", async () => {
      const req = { params: { id: "validId" } };
      const res = {};

      await router.delete("/:id", validateBlogPost)(req, res);

      expect(mockDeleteHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(204);
      expect(res.body).to.deep.equal({});
    });

    it("should handle validation errors", async () => {
      const req = { params: { id: "invalidId" } };
      const res = {};

      await router.delete("/invalidId", validateBlogPost)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("POST /:id/images", () => {
    it("should upload an image to a blog post", async () => {
      const req = {
        params: { id: "validId" },
        files: [
          {
            fieldname: "image",
            originalname: "test.jpg",
            mimetype: "image/jpeg",
            buffer: Buffer.from([]),
          },
        ],
      };
      const res = {};

      await router.post(
        "/:id/images",
        express.raw({ type: "multipart/form-data" }),
        BlogPostController.uploadImage
      )(req, res);

      expect(mockUploadImageHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({ url: "http://example.com/image.jpg" });
    });

    it("should handle invalid file types", async () => {
      const req = {
        params: { id: "validId" },
        files: [
          {
            fieldname: "image",
            originalname: "test.txt",
            mimetype: "text/plain",
            buffer: Buffer.from([]),
          },
        ],
      };
      const res = {};

      await router.post(
        "/:id/images",
        express.raw({ type: "multipart/form-data" }),
        BlogPostController.uploadImage
      )(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("GET /:id/preview", () => {
    it("should return preview HTML", async () => {
      const req = { params: { id: "validId" } };
      const res = {};

      await router.get("/:id/preview", validateBlogPost)(req, res);

      expect(mockPreviewHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.equal("<html>Preview</html>");
    });

    it("should handle validation errors", async () => {
      const req = { params: { id: "invalidId" } };
      const res = {};

      await router.get("/invalidId/preview", validateBlogPost)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("Helper Functions", () => {
    describe("validatePagination", () => {
      it("should set default values for pagination", async () => {
        const req = { query: {} };
        const res = {};
        const next = sinon.stub();

        validatePagination(req, res, next);

        expect(next).to.have.been.calledWith();
        expect(req.query.limit).to.equal(100);
        expect(req.query.skip).to.equal(0);
      });

      it("should handle invalid limit", async () => {
        const req = { query: { limit: "invalid" } };
        const res = {};
        const next = sinon.stub();

        validatePagination(req, res, next);

        expect(next).to.have.been.calledWith();
        expect(req.query.limit).to.equal(100);
      });

      it("should handle invalid skip", async () => {
        const req = { query: { skip: "-1" } };
        const res = {};
        const next = sinon.stub();

        validatePagination(req, res, next);

        expect(next).to.have.been.calledWith();
        expect(req.query.skip).to.equal(0);
      });
    });

    describe("headers", () => {
      it("should set CORS headers", async () => {
        const req = {};
        const res = {};
        const next = sinon.stub();

        headers(req, res, next);

        expect(res.header).to.have.been.calledThrice;
        expect(res.header.firstCall.args[0]).to.equal(
          "Access-Control-Allow-Origin"
        );
        expect(res.header.firstCall.args[1]).to.equal("*");
        expect(res.header.secondCall.args[0]).to.equal(
          "Access-Control-Allow-Headers"
        );
        expect(res.header.secondCall.args[1]).to.equal(
          "Origin, X-Requested-With, Content-Type, Accept, Authorization"
        );
        expect(res.header.thirdCall.args[0]).to.equal(
          "Access-Control-Allow-Methods"
        );
        expect(res.header.thirdCall.args[1]).to.equal("GET, POST, PUT, DELETE");
        expect(next).to.have.been.calledWith();
      });
    });

    describe("validateBlogPost", () => {
      it("should validate blog post fields", async () => {
        const req = {
          body: { title: "Valid Title", content: "Valid Content" },
        };
        const res = {};
        const next = sinon.stub();

        validateBlogPost(req, res, next);

        expect(next).to.have.been.calledWith();
        expect(res.status).to.not.have.been.called;
      });

      it("should return validation errors", async () => {
        const req = {
          body: { invalidTitle: "too long" },
        };
        const res = {};
        const next = sinon.stub();

        validateBlogPost(req, res, next);

        expect(next).to.not.have.been.called;
        expect(res.status).to.have.been.calledWith(400);
        expect(res.json).to.have.been.calledWith({ errors: expect.any(Array) });
      });
    });
  });
});

// Cleanup
afterEach(() => {
  sinon.restore();
});
