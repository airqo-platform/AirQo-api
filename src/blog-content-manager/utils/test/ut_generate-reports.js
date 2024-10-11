// test-analytics-reporting-util.js
require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { describe, it, beforeEach, afterEach } = require("mocha");

const AnalyticsReportingUtil = require("../path/to/AnalyticsReportingUtil"); // Adjust the path as needed
const AnalyticsModel = require("@models/analytics");
const HttpError = require("@utils/http-error");

describe("AnalyticsReportingUtil", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("views", () => {
    it("should return view data for a post", async () => {
      const postId = "test-post-id";
      const tenant = "test-tenant";

      const mockAnalyticsEntry = {
        timestamp: new Date(),
        value: 100,
      };

      sandbox
        .stub(AnalyticsModel.prototype.find)
        .withArgs({ tenant })
        .resolves([mockAnalyticsEntry]);

      const result = await AnalyticsReportingUtil.views(
        postId,
        { query: { tenant } },
        null
      );

      expect(result).to.have.property("success").that.is.true;
      expect(result).to.have.property("data");
      expect(result.data).to.deep.equal(mockAnalyticsEntry);
      expect(result)
        .to.have.property("message")
        .that.equals("Successfully retrieved view data");
      expect(result).to.have.property("status").that.equals(200);
    });

    it("should handle internal server errors", async () => {
      const postId = "test-post-id";
      const tenant = "test-tenant";

      sandbox
        .stub(AnalyticsModel.prototype.find)
        .withArgs({ tenant })
        .rejects(new Error("Database error"));

      await expect(
        AnalyticsReportingUtil.views(postId, { query: { tenant } }, null)
      ).to.be.rejectedWith(HttpError);
    });
  });

  describe("comments", () => {
    it("should return comment data for a post", async () => {
      const postId = "test-post-id";
      const tenant = "test-tenant";

      const mockAnalyticsEntry = {
        timestamp: new Date(),
        value: 100,
      };

      sandbox
        .stub(AnalyticsModel.prototype.find)
        .withArgs({ tenant })
        .resolves([mockAnalyticsEntry]);

      const result = await AnalyticsReportingUtil.comments(
        postId,
        { query: { tenant } },
        null
      );

      expect(result).to.have.property("success").that.is.true;
      expect(result).to.have.property("data");
      expect(result.data).to.deep.equal(mockAnalyticsEntry);
      expect(result)
        .to.have.property("message")
        .that.equals("Successfully retrieved comment data");
      expect(result).to.have.property("status").that.equals(200);
    });

    it("should handle internal server errors", async () => {
      const postId = "test-post-id";
      const tenant = "test-tenant";

      sandbox
        .stub(AnalyticsModel.prototype.find)
        .withArgs({ tenant })
        .rejects(new Error("Database error"));

      await expect(
        AnalyticsReportingUtil.comments(postId, { query: { tenant } }, null)
      ).to.be.rejectedWith(HttpError);
    });
  });

  // Add similar tests for other methods like popularPosts, userViews, userComments, etc.

  describe("popularPosts", () => {
    it("should return popular posts data", async () => {
      const tenant = "test-tenant";

      const mockAnalyticsEntries = [
        { metricName: "views", category: "post", count: 100 },
        { metricName: "views", category: "post", count: 50 },
      ];

      sandbox
        .stub(AnalyticsModel.prototype.aggregate)
        .resolves(mockAnalyticsEntries);

      const result = await AnalyticsReportingUtil.popularPosts({}, null);

      expect(result).to.have.property("success").that.is.true;
      expect(result).to.have.property("data");
      expect(result.data).to.deep.equal([
        { title: "Post 1", views: 100 },
        { title: "Post 2", views: 50 },
      ]);
      expect(result)
        .to.have.property("message")
        .that.equals("Successfully retrieved popular posts data");
      expect(result).to.have.property("status").that.equals(200);
    });

    it("should handle internal server errors", async () => {
      sandbox
        .stub(AnalyticsModel.prototype.aggregate)
        .rejects(new Error("Database error"));

      await expect(
        AnalyticsReportingUtil.popularPosts({}, null)
      ).to.be.rejectedWith(HttpError);
    });
  });

  // Add similar tests for other methods like userActivity, userGrowthReport, postPerformanceReport, etc.

  describe("generateReport", () => {
    it("should generate report based on the reportType", async () => {
      const mockResult = { success: true, data: {}, message: "", status: 200 };
      const mockParams = { postId: "test-post-id" };

      sandbox.stub(AnalyticsReportingUtil.views).resolves(mockResult);
      sandbox.stub(AnalyticsReportingUtil.comments).resolves(mockResult);

      const result = await AnalyticsReportingUtil.generateReport(
        "postViews",
        mockParams,
        {},
        null
      );

      expect(result).to.deep.equal(mockResult);
    });

    it("should handle invalid report type", async () => {
      const mockParams = {};

      const result = await AnalyticsReportingUtil.generateReport(
        "invalid-type",
        mockParams,
        {},
        null
      );

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Invalid report type");
      expect(result.status).to.equal(400);
    });

    it("should handle errors in report generation", async () => {
      const mockParams = { postId: "test-post-id" };

      sandbox
        .stub(AnalyticsReportingUtil.views)
        .rejects(new Error("View generation failed"));

      await expect(
        AnalyticsReportingUtil.generateReport("postViews", mockParams, {}, null)
      ).to.be.rejectedWith(HttpError);
    });
  });
});
