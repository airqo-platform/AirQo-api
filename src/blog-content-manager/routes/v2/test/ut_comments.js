require("module-alias/register");
// Import necessary modules
const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const CommentController = require("@controllers/handle-comments");

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
const validateComment = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Mock route handlers
const mockCreateHandler = sinon.stub(CommentController, "create").resolves({
  status: 201,
  body: { id: 1, content: "Test Comment" },
});

const mockListHandler = sinon.stub(CommentController, "list").resolves({
  status: 200,
  body: [
    { id: 1, content: "First Comment" },
    { id: 2, content: "Second Comment" },
  ],
});

const mockRepliesHandler = sinon.stub(CommentController, "replies").resolves({
  status: 200,
  body: [
    { id: 1, content: "Reply 1" },
    { id: 2, content: "Reply 2" },
  ],
});

const mockEditHandler = sinon.stub(CommentController, "edit").resolves({
  status: 200,
  body: { success: true },
});

const mockDeleteHandler = sinon.stub(CommentController, "delete").resolves({
  status: 204,
  body: null,
});

const mockApproveHandler = sinon.stub(CommentController, "approve").resolves({
  status: 200,
  body: { approved: true },
});

const mockRejectHandler = sinon.stub(CommentController, "reject").resolves({
  status: 200,
  body: { rejected: true },
});

describe("Comment Management Routes", () => {
  describe("POST /:postId/comments", () => {
    it("should create a new comment", async () => {
      const req = {
        params: { postId: 1 },
        body: { content: "Test Comment" },
      };
      const res = {};

      await router.post("/:postId/comments", validateComment)(req, res);

      expect(mockCreateHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(201);
      expect(res.body).to.deep.equal({ id: 1, content: "Test Comment" });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { postId: "invalidPostId" },
        body: { invalidContent: "too long" },
      };
      const res = {};

      await router.post("/invalidPostId/comments", validateComment)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("GET /:postId/comments", () => {
    it("should list comments for a post", async () => {
      const req = { params: { postId: 1 } };
      const res = {};

      await router.get("/:postId/comments", validateComment)(req, res);

      expect(mockListHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal([
        { id: 1, content: "First Comment" },
        { id: 2, content: "Second Comment" },
      ]);
    });

    it("should handle validation errors", async () => {
      const req = { params: { postId: "invalidPostId" } };
      const res = {};

      await router.get("/invalidPostId/comments", validateComment)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("GET /:postId/comments/:commentId/replies", () => {
    it("should retrieve replies for a comment", async () => {
      const req = {
        params: { postId: 1, commentId: 1 },
      };
      const res = {};

      await router.get("/:postId/comments/:commentId/replies", validateComment)(
        req,
        res
      );

      expect(mockRepliesHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal([
        { id: 1, content: "Reply 1" },
        { id: 2, content: "Reply 2" },
      ]);
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { postId: "invalidPostId", commentId: "invalidCommentId" },
      };
      const res = {};

      await router.get(
        "/invalidPostId/comments/invalidCommentId/replies",
        validateComment
      )(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("PUT /:postId/comments/:commentId/edit", () => {
    it("should edit a comment", async () => {
      const req = {
        params: { postId: 1, commentId: 1 },
        body: { content: "Edited Comment" },
      };
      const res = {};

      await router.put("/:postId/comments/:commentId/edit", validateComment)(
        req,
        res
      );

      expect(mockEditHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({ success: true });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { postId: "invalidPostId", commentId: "invalidCommentId" },
        body: { invalidContent: "too long" },
      };
      const res = {};

      await router.put(
        "/invalidPostId/comments/invalidCommentId/edit",
        validateComment
      )(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("DELETE /:postId/comments/:commentId/delete", () => {
    it("should delete a comment", async () => {
      const req = { params: { postId: 1, commentId: 1 } };
      const res = {};

      await router.delete(
        "/:postId/comments/:commentId/delete",
        validateComment
      )(req, res);

      expect(mockDeleteHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(204);
      expect(res.body).to.be.null;
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { postId: "invalidPostId", commentId: "invalidCommentId" },
      };
      const res = {};

      await router.delete(
        "/invalidPostId/comments/invalidCommentId/delete",
        validateComment
      )(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("PATCH /:postId/comments/:commentId/approve", () => {
    it("should approve a comment", async () => {
      const req = { params: { postId: 1, commentId: 1 } };
      const res = {};

      await router.patch(
        "/:postId/comments/:commentId/approve",
        validateComment
      )(req, res);

      expect(mockApproveHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({ approved: true });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { postId: "invalidPostId", commentId: "invalidCommentId" },
      };
      const res = {};

      await router.patch(
        "/invalidPostId/comments/invalidCommentId/approve",
        validateComment
      )(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("PATCH /:postId/comments/:commentId/reject", () => {
    it("should reject a comment", async () => {
      const req = { params: { postId: 1, commentId: 1 } };
      const res = {};

      await router.patch(
        "/:postId/comments/:commentId/reject",
        validateComment
      )(req, res);

      expect(mockRejectHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({ rejected: true });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { postId: "invalidPostId", commentId: "invalidCommentId" },
      };
      const res = {};

      await router.patch(
        "/invalidPostId/comments/invalidCommentId/reject",
        validateComment
      )(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });
});

// Helper functions
const mockRequest = sinon.mock();
const mockResponse = sinon.mock();

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

      expect(res.header).to.have.been.calledTwice;
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
});

// Cleanup
afterEach(() => {
  sinon.restore();
});
