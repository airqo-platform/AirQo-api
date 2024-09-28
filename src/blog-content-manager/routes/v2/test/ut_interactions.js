require("module-alias/register");
// Import necessary modules
const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const UserInteractionController = require("@controllers/manage-interactions");

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
const mockFollowHandler = sinon
  .stub(UserInteractionController, "follow")
  .resolves({
    status: 200,
    body: { message: "User followed successfully" },
  });

const mockNotificationsHandler = sinon
  .stub(UserInteractionController, "notifications")
  .resolves({
    status: 200,
    body: [{ id: 1, type: "like", timestamp: new Date().toISOString() }],
  });

const mockLikeHandler = sinon.stub(UserInteractionController, "like").resolves({
  status: 200,
  body: { message: "Post liked successfully" },
});

const mockBookmarkHandler = sinon
  .stub(UserInteractionController, "bookmark")
  .resolves({
    status: 200,
    body: { message: "Post bookmarked successfully" },
  });

describe("User Interaction Management Routes", () => {
  describe("POST /follow/:userId", () => {
    it("should follow a user", async () => {
      const req = {
        params: { userId: "validUserId" },
        body: { content: "Following user" },
      };
      const res = {};

      await router.post("/follow/:userId", validateUserInteraction)(req, res);

      expect(mockFollowHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({ message: "User followed successfully" });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { userId: "invalidUserId" },
        body: { invalidContent: "too long" },
      };
      const res = {};

      await router.post("/invalidUserId/follow", validateUserInteraction)(
        req,
        res
      );

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("GET /notifications", () => {
    it("should retrieve notifications", async () => {
      const req = {};
      const res = {};

      await router.get("/notifications", validateUserInteraction)(req, res);

      expect(mockNotificationsHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal([
        { id: 1, type: "like", timestamp: expect.any(String) },
      ]);
    });

    it("should handle validation errors", async () => {
      const req = {};
      const res = {};

      await router.get("/invalidNotifications", validateUserInteraction)(
        req,
        res
      );

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("POST /:postId/like", () => {
    it("should like a post", async () => {
      const req = {
        params: { postId: "validPostId" },
        body: { content: "Liking post" },
      };
      const res = {};

      await router.post("/:postId/like", validateUserInteraction)(req, res);

      expect(mockLikeHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({ message: "Post liked successfully" });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { postId: "invalidPostId" },
        body: { invalidContent: "too long" },
      };
      const res = {};

      await router.post("/invalidPostId/like", validateUserInteraction)(
        req,
        res
      );

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("POST /:postId/bookmark", () => {
    it("should bookmark a post", async () => {
      const req = {
        params: { postId: "validPostId" },
        body: { content: "Bookmarking post" },
      };
      const res = {};

      await router.post("/:postId/bookmark", validateUserInteraction)(req, res);

      expect(mockBookmarkHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({
        message: "Post bookmarked successfully",
      });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { postId: "invalidPostId" },
        body: { invalidContent: "too long" },
      };
      const res = {};

      await router.post("/invalidPostId/bookmark", validateUserInteraction)(
        req,
        res
      );

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

  describe("validateUserInteraction", () => {
    it("should validate user interaction fields", async () => {
      const req = {
        params: { userId: "validUserId" },
        body: { content: "Valid action" },
      };
      const res = {};
      const next = sinon.stub();

      validateUserInteraction(req, res, next);

      expect(next).to.have.been.calledWith();
      expect(res.status).to.not.have.been.called;
    });

    it("should return validation errors", async () => {
      const req = {
        params: { userId: "invalidUserId" },
        body: { invalidContent: "too long" },
      };
      const res = {};
      const next = sinon.stub();

      validateUserInteraction(req, res, next);

      expect(next).to.not.have.been.called;
      expect(res.status).to.have.been.calledWith(400);
      expect(res.json).to.have.been.calledWith({ errors: expect.any(Array) });
    });
  });
});

// Cleanup
afterEach(() => {
  sinon.restore();
});
