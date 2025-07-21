require("module-alias/register");
// Import necessary modules
const express = require("express");
const router = express.Router();
const path = require("path");

// Mock sub-routes
const analyticsRouter = require("@routes/v2/analytics");
const articlesRouter = require("@routes/v2/articles");
const categoriesRouter = require("@routes/v2/categories");
const commentsRouter = require("@routes/v2/comments");
const feedsRouter = require("@routes/v2/feeds");
const interactionsRouter = require("@routes/v2/interactions");
const moderationRouter = require("@routes/v2/moderation");
const postsRouter = require("@routes/v2/posts");
const searchRouter = require("@routes/v2/search");

// Mock route handlers
const mockAnalyticsHandler = sinon.stub(analyticsRouter, "get").returns({
  status: 200,
  body: { message: "Analytics data retrieved successfully" },
});

const mockArticlesHandler = sinon.stub(articlesRouter, "get").returns({
  status: 200,
  body: [{ id: 1, title: "Article 1", content: "Content 1" }],
});

const mockCategoriesHandler = sinon.stub(categoriesRouter, "get").returns({
  status: 200,
  body: [{ id: 1, name: "Category 1" }],
});

const mockCommentsHandler = sinon
  .stub(commentsRouter, "post")
  .callsFake((req, res) => ({
    status: 201,
    body: { message: "Comment added successfully" },
  }));

const mockFeedsHandler = sinon.stub(feedsRouter, "get").returns({
  status: 200,
  body: [{ id: 1, title: "Feed 1", link: "https://example.com/feed1" }],
});

const mockInteractionsHandler = sinon
  .stub(interactionsRouter, "post")
  .callsFake((req, res) => ({
    status: 201,
    body: { message: "Interaction recorded successfully" },
  }));

const mockModerationHandler = sinon
  .stub(moderationRouter, "patch")
  .callsFake((req, res) => ({
    status: 200,
    body: { message: "Moderation action completed successfully" },
  }));

const mockPostsHandler = sinon
  .stub(postsRouter, "get")
  .callsFake((req, res) => ({
    status: 200,
    body: [{ id: 1, title: "Post 1", content: "Content 1" }],
  }));

const mockSearchHandler = sinon
  .stub(searchRouter, "get")
  .callsFake((req, res) => ({
    status: 200,
    body: [{ id: 1, title: "Search result 1", content: "Content 1" }],
  }));

describe("V2 Router", () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockAnalyticsHandler.reset();
    mockArticlesHandler.reset();
    mockCategoriesHandler.reset();
    mockCommentsHandler.reset();
    mockFeedsHandler.reset();
    mockInteractionsHandler.reset();
    mockModerationHandler.reset();
    mockPostsHandler.reset();
    mockSearchHandler.reset();
  });

  describe("GET /analytics", () => {
    it("should return analytics data", async () => {
      const req = {};
      const res = {};

      await router.get("/analytics")(req, res);

      expect(mockAnalyticsHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({
        message: "Analytics data retrieved successfully",
      });
    });
  });

  describe("GET /articles", () => {
    it("should return article data", async () => {
      const req = {};
      const res = {};

      await router.get("/articles")(req, res);

      expect(mockArticlesHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal([
        { id: 1, title: "Article 1", content: "Content 1" },
      ]);
    });
  });

  describe("GET /categories", () => {
    it("should return category data", async () => {
      const req = {};
      const res = {};

      await router.get("/categories")(req, res);

      expect(mockCategoriesHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal([{ id: 1, name: "Category 1" }]);
    });
  });

  describe("POST /comments", () => {
    it("should add a comment", async () => {
      const req = { body: { postId: 1, content: "New comment" } };
      const res = {};

      await router.post("/comments")(req, res);

      expect(mockCommentsHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(201);
      expect(res.body).to.deep.equal({ message: "Comment added successfully" });
    });
  });

  describe("GET /feeds", () => {
    it("should return feed data", async () => {
      const req = {};
      const res = {};

      await router.get("/feeds")(req, res);

      expect(mockFeedsHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal([
        { id: 1, title: "Feed 1", link: "https://example.com/feed1" },
      ]);
    });
  });

  describe("POST /interactions", () => {
    it("should record an interaction", async () => {
      const req = { body: { postId: 1, type: "like" } };
      const res = {};

      await router.post("/interactions")(req, res);

      expect(mockInteractionsHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(201);
      expect(res.body).to.deep.equal({
        message: "Interaction recorded successfully",
      });
    });
  });

  describe("PATCH /moderation", () => {
    it("should perform moderation action", async () => {
      const req = { params: { postId: 1 }, body: { action: "flag" } };
      const res = {};

      await router.patch("/moderation")(req, res);

      expect(mockModerationHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({
        message: "Moderation action completed successfully",
      });
    });
  });

  describe("GET /posts", () => {
    it("should return post data", async () => {
      const req = {};
      const res = {};

      await router.get("/posts")(req, res);

      expect(mockPostsHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal([
        { id: 1, title: "Post 1", content: "Content 1" },
      ]);
    });
  });

  describe("GET /search", () => {
    it("should perform search", async () => {
      const req = { query: { q: "test" } };
      const res = {};

      await router.get("/search")(req, res);

      expect(mockSearchHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal([
        { id: 1, title: "Search result 1", content: "Content 1" },
      ]);
    });
  });
});

// Cleanup
afterEach(() => {
  sinon.restore();
});
