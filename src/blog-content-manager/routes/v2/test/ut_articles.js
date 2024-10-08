require("module-alias/register");
// Import necessary modules
const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const BlogPostManagementController = require("@controllers/manage-posts");

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
const validateBlogPostUpdate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Mock route handlers
const mockEditHandler = sinon
  .stub(BlogPostManagementController, "edit")
  .resolves({
    status: 200,
    body: { post: { id: "123", title: "Test Post" } },
  });

const mockUpdateHandler = sinon
  .stub(BlogPostManagementController, "update")
  .resolves({
    status: 200,
    body: { success: true },
  });

const mockDeleteHandler = sinon
  .stub(BlogPostManagementController, "delete")
  .resolves({
    status: 204,
    body: null,
  });

const mockScheduleHandler = sinon
  .stub(BlogPostManagementController, "schedule")
  .resolves({
    status: 200,
    body: { scheduled: true },
  });

const mockHistoryHandler = sinon
  .stub(BlogPostManagementController, "history")
  .resolves({
    status: 200,
    body: [{ id: "123", action: "created" }],
  });

describe("Blog Post Management Routes", () => {
  describe("GET /edit/:id", () => {
    it("should return edit form data for a post", async () => {
      const req = { params: { id: "123" }, query: { limit: 20, skip: 0 } };
      const res = {};

      await router.get("/edit/123", validateBlogPostUpdate)(req, res);

      expect(mockEditHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({
        post: { id: "123", title: "Test Post" },
      });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { id: "invalidId" },
        query: { invalidLimit: "notANumber" },
      };
      const res = {};

      await router.get("/edit/invalidId", validateBlogPostUpdate)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("PUT /edit/:id", () => {
    it("should update a blog post", async () => {
      const req = {
        params: { id: "123" },
        body: { title: "Updated Title" },
        query: { limit: 20, skip: 0 },
      };
      const res = {};

      await router.put("/edit/123", validateBlogPostUpdate)(req, res);

      expect(mockUpdateHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({ success: true });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { id: "invalidId" },
        body: { invalidTitle: "too long" },
        query: { invalidLimit: "notANumber" },
      };
      const res = {};

      await router.put("/edit/invalidId", validateBlogPostUpdate)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("DELETE /delete/:id", () => {
    it("should delete a blog post", async () => {
      const req = { params: { id: "123" }, query: { limit: 20, skip: 0 } };
      const res = {};

      await router.delete("/delete/123", validateBlogPostUpdate)(req, res);

      expect(mockDeleteHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(204);
      expect(res.body).to.be.null;
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { id: "invalidId" },
        query: { invalidLimit: "notANumber" },
      };
      const res = {};

      await router.delete("/delete/invalidId", validateBlogPostUpdate)(
        req,
        res
      );

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("POST /schedule/:id", () => {
    it("should schedule a blog post", async () => {
      const req = { params: { id: "123" }, query: { limit: 20, skip: 0 } };
      const res = {};

      await router.post("/schedule/123", validateBlogPostUpdate)(req, res);

      expect(mockScheduleHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({ scheduled: true });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { id: "invalidId" },
        query: { invalidLimit: "notANumber" },
      };
      const res = {};

      await router.post("/schedule/invalidId", validateBlogPostUpdate)(
        req,
        res
      );

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("GET /history/:id", () => {
    it("should return history for a blog post", async () => {
      const req = { params: { id: "123" }, query: { limit: 20, skip: 0 } };
      const res = {};

      await router.get("/history/123", validateBlogPostUpdate)(req, res);

      expect(mockHistoryHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal([{ id: "123", action: "created" }]);
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { id: "invalidId" },
        query: { invalidLimit: "notANumber" },
      };
      const res = {};

      await router.get("/history/invalidId", validateBlogPostUpdate)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });
});

// Helper functions for testing
function setupMockHandlers() {
  mockEditHandler.reset();
  mockUpdateHandler.reset();
  mockDeleteHandler.reset();
  mockScheduleHandler.reset();
  mockHistoryHandler.reset();
}

async function runRouteTests(router, routePath, method, ...args) {
  const req = { params: {}, query: {} };
  const res = {};

  switch (method.toUpperCase()) {
    case "GET":
      await router.get(routePath, validateBlogPostUpdate)(req, res);
      break;
    case "PUT":
      req.body = {};
      await router.put(routePath, validateBlogPostUpdate)(req, res);
      break;
    case "POST":
      await router.post(routePath, validateBlogPostUpdate)(req, res);
      break;
    case "DELETE":
      await router.delete(routePath, validateBlogPostUpdate)(req, res);
      break;
  }

  return { req, res };
}
