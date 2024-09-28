require("module-alias/register");
// Import necessary modules
const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const RSSFeedController = require("../controllers/rss-feed");

// Import middleware
const validateCustomization = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
};

// Mock route handlers
const mockGenerateFeedHandler = sinon
  .stub(RSSFeedController, "generateFeed")
  .resolves({
    status: 200,
    body: {
      title: "Blog Title",
      link: "https://example.com/feed",
      description: "RSS Feed Description",
      items: [
        {
          title: "Article 1",
          link: "https://example.com/article1",
          pubDate: new Date().toISOString(),
        },
        {
          title: "Article 2",
          link: "https://example.com/article2",
          pubDate: new Date(
            new Date().setDate(new Date().getDate() - 1)
          ).toISOString(),
        },
      ],
    },
  });

describe("RSS Feed Management Routes", () => {
  describe("GET /:blogId/rss", () => {
    it("should generate an RSS feed for a blog", async () => {
      const req = { params: { blogId: "validBlogId" } };
      const res = {};

      await router.get("/:blogId/rss", validateCustomization)(req, res);

      expect(mockGenerateFeedHandler).toHaveBeenCalledWith(req, res);
      expect(res.status).to.have.been.calledWith(200);
      expect(res.body).to.deep.equal({
        title: "Blog Title",
        link: "https://example.com/feed",
        description: "RSS Feed Description",
        items: [
          {
            title: "Article 1",
            link: "https://example.com/article1",
            pubDate: expect.any(String),
          },
          {
            title: "Article 2",
            link: "https://example.com/article2",
            pubDate: expect.any(String),
          },
        ],
      });
    });

    it("should handle validation errors", async () => {
      const req = { params: { blogId: "invalidBlogId" } };
      const res = {};

      await router.get("/invalidBlogId/rss", validateCustomization)(req, res);

      expect(res.status).to.have.been.calledWith(400);
      expect(res.body.errors).to.exist;
    });
  });
});

// Helper function
const mockRequest = sinon.mock();
const mockResponse = sinon.mock();

describe("Helper Functions", () => {
  describe("validateCustomization", () => {
    it("should validate customization fields", async () => {
      const req = {
        params: { blogId: "validBlogId" },
        body: { title: "Valid Title" },
      };
      const res = {};
      const next = sinon.stub();

      validateCustomization(req, res, next);

      expect(next).to.have.been.calledWith();
      expect(res.status).to.not.have.been.called;
    });

    it("should return validation errors", async () => {
      const req = {
        params: { blogId: "invalidBlogId" },
        body: { invalidTitle: "too long" },
      };
      const res = {};
      const next = sinon.stub();

      validateCustomization(req, res, next);

      expect(next).to.not.have.been.called;
      expect(res.status).to.have.been.calledWith(400);
      expect(res.json).to.have.been.calledWith({ errors: expect.any(Array) });
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
        "Origin, X-Requested-With, Content-Type, Accept"
      );
      expect(next).to.have.been.calledWith();
    });
  });
});

// Cleanup
afterEach(() => {
  sinon.restore();
});
