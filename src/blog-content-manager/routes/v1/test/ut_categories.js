require("module-alias/register");
// Import necessary modules
const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const CategoryTagController = require("@controllers/manage-categories");

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

router.use(headers);
router.use(validatePagination);

// Authentication middleware
router.use(setJWTAuth);
router.use(authJWT);

// Validation middleware
const validateCategoryTag = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Mock route handlers
const mockCreateHandler = sinon.stub(CategoryTagController, "create").resolves({
  status: 201,
  body: { id: 1, name: "Test Category" },
});

const mockListHandler = sinon.stub(CategoryTagController, "list").resolves({
  status: 200,
  body: [
    { id: 1, name: "Category 1" },
    { id: 2, name: "Category 2" },
  ],
});

const mockUpdateHandler = sinon.stub(CategoryTagController, "update").resolves({
  status: 200,
  body: { success: true },
});

const mockDeleteHandler = sinon.stub(CategoryTagController, "delete").resolves({
  status: 204,
  body: null,
});

const mockAssignHandler = sinon.stub(CategoryTagController, "assign").resolves({
  status: 200,
  body: { assigned: true },
});

const mockPostsHandler = sinon.stub(CategoryTagController, "posts").resolves({
  status: 200,
  body: [
    { id: 1, title: "Post 1" },
    { id: 2, title: "Post 2" },
  ],
});

const mockBrowseCategoriesHandler = sinon
  .stub(CategoryTagController, "browseCategories")
  .resolves({
    status: 200,
    body: [
      { id: 1, name: "Category 1" },
      { id: 2, name: "Category 2" },
    ],
  });

const mockBrowseTagsHandler = sinon
  .stub(CategoryTagController, "browseTags")
  .resolves({
    status: 200,
    body: [
      { id: 1, name: "Tag 1" },
      { id: 2, name: "Tag 2" },
    ],
  });

describe("Category and Tag Management Routes", () => {
  describe("POST /", () => {
    it("should create a new category/tag", async () => {
      const req = { body: { name: "Test Category" } };
      const res = {};

      await router.post("/", validateCategoryTag)(req, res);

      expect(mockCreateHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(201);
      expect(res.body).to.deep.equal({ id: 1, name: "Test Category" });
    });

    it("should handle validation errors", async () => {
      const req = { body: { invalidName: "too long" } };
      const res = {};

      await router.post("/", validateCategoryTag)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("GET /", () => {
    it("should list categories/tags", async () => {
      const req = {};
      const res = {};

      await router.get("/", validateCategoryTag)(req, res);

      expect(mockListHandler).toHaveBeenCalled();
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal([
        { id: 1, name: "Category 1" },
        { id: 2, name: "Category 2" },
      ]);
    });

    it("should handle validation errors", async () => {
      const req = {};
      const res = {};

      await router.get("/", validateCategoryTag)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("PUT /:id", () => {
    it("should update a category/tag", async () => {
      const req = {
        params: { id: 1 },
        body: { name: "Updated Test Category" },
      };
      const res = {};

      await router.put("/:id", validateCategoryTag)(req, res);

      expect(mockUpdateHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({ success: true });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { id: "invalidId" },
        body: { invalidName: "too long" },
      };
      const res = {};

      await router.put("/invalidId", validateCategoryTag)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("DELETE /:id", () => {
    it("should delete a category/tag", async () => {
      const req = { params: { id: 1 } };
      const res = {};

      await router.delete("/:id", validateCategoryTag)(req, res);

      expect(mockDeleteHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(204);
      expect(res.body).to.be.null;
    });

    it("should handle validation errors", async () => {
      const req = { params: { id: "invalidId" } };
      const res = {};

      await router.delete("/invalidId", validateCategoryTag)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("POST /assign/:postId", () => {
    it("should assign a category/tag to a post", async () => {
      const req = {
        params: { postId: 1 },
        body: { categoryId: 1 },
      };
      const res = {};

      await router.post("/assign/1", validateCategoryTag)(req, res);

      expect(mockAssignHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({ assigned: true });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { postId: "invalidPostId" },
        body: { invalidCategoryId: "notANumber" },
      };
      const res = {};

      await router.post("/assign/invalidPostId", validateCategoryTag)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("GET /posts/:id", () => {
    it("should retrieve posts associated with a category/tag", async () => {
      const req = { params: { id: 1 } };
      const res = {};

      await router.get("/posts/1", validateCategoryTag)(req, res);

      expect(mockPostsHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal([
        { id: 1, title: "Post 1" },
        { id: 2, title: "Post 2" },
      ]);
    });

    it("should handle validation errors", async () => {
      const req = { params: { id: "invalidId" } };
      const res = {};

      await router.get("/posts/invalidId", validateCategoryTag)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("GET /browse/categories", () => {
    it("should browse categories", async () => {
      const req = {};
      const res = {};

      await router.get("/browse/categories", validateCategoryTag)(req, res);

      expect(mockBrowseCategoriesHandler).toHaveBeenCalled();
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal([
        { id: 1, name: "Category 1" },
        { id: 2, name: "Category 2" },
      ]);
    });

    it("should handle validation errors", async () => {
      const req = {};
      const res = {};

      await router.get("/browse/categories", validateCategoryTag)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("GET /browse/tags", () => {
    it("should browse tags", async () => {
      const req = {};
      const res = {};

      await router.get("/browse/tags", validateCategoryTag)(req, res);

      expect(mockBrowseTagsHandler).toHaveBeenCalled();
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal([
        { id: 1, name: "Tag 1" },
        { id: 2, name: "Tag 2" },
      ]);
    });

    it("should handle validation errors", async () => {
      const req = {};
      const res = {};

      await router.get("/browse/tags", validateCategoryTag)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });
});
