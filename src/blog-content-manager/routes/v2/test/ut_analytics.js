require("module-alias/register");
// Import necessary modules
const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const AnalyticsReportingController = require("@controllers/generate-reports");

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
  res.header("Access-Control-Allow-Methods", "GET, POST");
  next();
};

router.use(headers);
router.use(validatePagination);

// Authentication middleware
router.use(setJWTAuth);
router.use(authJWT);

// Validation middleware
const validateAnalyticsReport = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Mock route handlers
const mockViewsHandler = sinon
  .stub(AnalyticsReportingController, "views")
  .resolves({
    status: 200,
    body: { views: 100 },
  });

const mockCommentsHandler = sinon
  .stub(AnalyticsReportingController, "comments")
  .resolves({
    status: 200,
    body: { comments: 50 },
  });

const mockPopularPostsHandler = sinon
  .stub(AnalyticsReportingController, "popularPosts")
  .resolves({
    status: 200,
    body: { popularPosts: ["post1", "post2"] },
  });

const mockUserViewsHandler = sinon
  .stub(AnalyticsReportingController, "userViews")
  .resolves({
    status: 200,
    body: { views: 150 },
  });

const mockUserCommentsHandler = sinon
  .stub(AnalyticsReportingController, "userComments")
  .resolves({
    status: 200,
    body: { comments: 75 },
  });

const mockUserActivityHandler = sinon
  .stub(AnalyticsReportingController, "userActivity")
  .resolves({
    status: 200,
    body: { activity: ["activity1", "activity2"] },
  });

const mockUserGrowthReportHandler = sinon
  .stub(AnalyticsReportingController, "userGrowthReport")
  .resolves({
    status: 200,
    body: { growthReport: "growth report data" },
  });

const mockPostPerformanceReportHandler = sinon
  .stub(AnalyticsReportingController, "postPerformanceReport")
  .resolves({
    status: 200,
    body: { performanceReport: "performance report data" },
  });

describe("Analytics Reporting Routes", () => {
  describe("GET /posts/:postId/views", () => {
    it("should return views for a post", async () => {
      const req = {
        params: { postId: "testPostId" },
        query: { limit: 50, skip: 0 },
      };
      const res = {};

      await router.get("/posts/testPostId/views", validateAnalyticsReport)(
        req,
        res
      );

      expect(mockViewsHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({ views: 100 });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { postId: "invalidPostId" },
        query: { invalidLimit: "notANumber" },
      };
      const res = {};

      await router.get("/posts/invalidPostId/views", validateAnalyticsReport)(
        req,
        res
      );

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("GET /posts/:postId/comments", () => {
    it("should return comments for a post", async () => {
      const req = {
        params: { postId: "testPostId" },
        query: { limit: 50, skip: 0 },
      };
      const res = {};

      await router.get("/posts/testPostId/comments", validateAnalyticsReport)(
        req,
        res
      );

      expect(mockCommentsHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({ comments: 50 });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { postId: "invalidPostId" },
        query: { invalidLimit: "notANumber" },
      };
      const res = {};

      await router.get(
        "/posts/invalidPostId/comments",
        validateAnalyticsReport
      )(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("GET /posts/popular", () => {
    it("should return popular posts", async () => {
      const req = {};
      const res = {};

      await router.get("/posts/popular", validateAnalyticsReport)(req, res);

      expect(mockPopularPostsHandler).toHaveBeenCalled();
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({ popularPosts: ["post1", "post2"] });
    });

    it("should handle validation errors", async () => {
      const req = {};
      const res = {};

      await router.get("/posts/popular", validateAnalyticsReport)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("GET /users/:userId/views", () => {
    it("should return views for a user", async () => {
      const req = {
        params: { userId: "testUserId" },
        query: { limit: 50, skip: 0 },
      };
      const res = {};

      await router.get("/users/testUserId/views", validateAnalyticsReport)(
        req,
        res
      );

      expect(mockUserViewsHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({ views: 150 });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { userId: "invalidUserId" },
        query: { invalidLimit: "notANumber" },
      };
      const res = {};

      await router.get("/users/invalidUserId/views", validateAnalyticsReport)(
        req,
        res
      );

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("GET /users/:userId/comments", () => {
    it("should return comments for a user", async () => {
      const req = {
        params: { userId: "testUserId" },
        query: { limit: 50, skip: 0 },
      };
      const res = {};

      await router.get("/users/testUserId/comments", validateAnalyticsReport)(
        req,
        res
      );

      expect(mockUserCommentsHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({ comments: 75 });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { userId: "invalidUserId" },
        query: { invalidLimit: "notANumber" },
      };
      const res = {};

      await router.get(
        "/users/invalidUserId/comments",
        validateAnalyticsReport
      )(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("GET /users/:userId/activity", () => {
    it("should return activity for a user", async () => {
      const req = {
        params: { userId: "testUserId" },
        query: { limit: 50, skip: 0 },
      };
      const res = {};

      await router.get("/users/testUserId/activity", validateAnalyticsReport)(
        req,
        res
      );

      expect(mockUserActivityHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({ activity: ["activity1", "activity2"] });
    });

    it("should handle validation errors", async () => {
      const req = {
        params: { userId: "invalidUserId" },
        query: { invalidLimit: "notANumber" },
      };
      const res = {};

      await router.get(
        "/users/invalidUserId/activity",
        validateAnalyticsReport
      )(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("POST /reports/user-growth", () => {
    it("should return user growth report", async () => {
      const req = {};
      const res = {};

      await router.post("/reports/user-growth", validateAnalyticsReport)(
        req,
        res
      );

      expect(mockUserGrowthReportHandler).toHaveBeenCalled();
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({ growthReport: "growth report data" });
    });

    it("should handle validation errors", async () => {
      const req = {};
      const res = {};

      await router.post("/reports/user-growth", validateAnalyticsReport)(
        req,
        res
      );

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });

  describe("POST /reports/post-performance", () => {
    it("should return post performance report", async () => {
      const req = {};
      const res = {};

      await router.post("/reports/post-performance", validateAnalyticsReport)(
        req,
        res
      );

      expect(mockPostPerformanceReportHandler).toHaveBeenCalled();
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({
        performanceReport: "performance report data",
      });
    });

    it("should handle validation errors", async () => {
      const req = {};
      const res = {};

      await router.post("/reports/post-performance", validateAnalyticsReport)(
        req,
        res
      );

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });
});
