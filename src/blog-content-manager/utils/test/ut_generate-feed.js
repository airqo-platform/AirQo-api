// test-rss-feed-util.js
require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { describe, it, beforeEach, afterEach } = require("mocha");

const PostModel = require("@models/post");
const { logObject } = require("@utils/log");
const mailer = require("@utils/mailer");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- rssFeed-util`);
const { HttpError } = require("@utils/errors");

const generateFilter = require("@utils/generate-filter");

const rssFeedUtil = require("./path/to/rssFeedUtil"); // Adjust the path as needed

describe("rssFeedUtil", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("generateFeed", () => {
    it("should return RSS feed URL and items", async () => {
      const blogId = "test-blog-id";
      const request = {
        query: { tenant: "test-tenant" },
        body: {},
      };
      const next = sinon.spy();

      sandbox.stub(PostModel.prototype.list).resolves([
        {
          /* mock post object */
        },
      ]);
      sandbox.stub(generateFilter.post).returns({});
      sandbox.stub(mailer.rssFeedNotification).resolves({});

      const result = await rssFeedUtil.generateFeed(blogId, request, next);

      expect(result).to.have.property("success").that.is.true;
      expect(result)
        .to.have.property("message")
        .that.equals("RSS feed generated successfully");
      expect(result).to.have.property("data");
      expect(result.data)
        .to.have.property("url")
        .that.equals(`http://${constants.HOST}/rss/feed`);
      expect(result.data).to.have.property("items");
      expect(next).not.toHaveBeenCalled();
    });

    it("should call next with HttpError for bad request errors", async () => {
      const blogId = "test-blog-id";
      const request = {
        query: { tenant: "test-tenant" },
        body: {},
      };
      const next = sinon.spy();

      sandbox.stub(PostModel.prototype.list).resolves([
        {
          /* mock post object */
        },
      ]);
      sandbox.stub(generateFilter.post).returns({});
      sandbox.stub(mailer.rssFeedNotification).resolves({});

      const result = await rssFeedUtil.generateFeed(blogId, request, next);

      expect(result.success).to.be.false;
      expect(next).toHaveBeenCalled();
      expect(next.args[0][0]).to.be.an.instanceOf(HttpError);
      expect(next.args[0][1]).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should call next with HttpError for internal server errors", async () => {
      const blogId = "test-blog-id";
      const request = {
        query: { tenant: "test-tenant" },
        body: {},
      };
      const next = sinon.spy();

      sandbox
        .stub(PostModel.prototype.list)
        .rejects(new Error("Database error"));
      sandbox.stub(generateFilter.post).returns({});
      sandbox.stub(mailer.rssFeedNotification).resolves({});

      await expect(
        rssFeedUtil.generateFeed(blogId, request, next)
      ).to.be.rejectedWith(HttpError);
    });
  });

  describe("prepareFeedData", () => {
    it("should prepare RSS feed items correctly", () => {
      const posts = [
        {
          /* mock post object */
        },
      ];
      const result = rssFeedUtil.prepareFeedData(posts);

      expect(result).to.have.property("url");
      expect(result.url).to.equal(`http://${constants.HOST}/rss/feed`);
      expect(result.items).to.be.an("array");
      expect(result.items.length).to.equal(1);
      expect(result.items[0]).to.have.property("title");
      expect(result.items[0]).to.have.property("link");
      expect(result.items[0]).to.have.property("pubDate");
      expect(result.items[0]).to.have.property("author");
      expect(result.items[0]).to.have.property("content");
    });
  });

  describe("extractErrorsFromRequest", () => {
    it("should extract errors from request body", () => {
      const request = {
        body: { field1: "", field2: "" },
      };

      const result = rssFeedUtil.extractErrorsFromRequest(request);

      expect(result).to.deep.equal({
        field1: "Field is required",
        field2: "Field is required",
      });
    });

    it("should not extract errors for existing fields", () => {
      const request = {
        body: { field1: "value", field2: "" },
      };

      const result = rssFeedUtil.extractErrorsFromRequest(request);

      expect(result).to.deep.equal({});
    });
  });
});
