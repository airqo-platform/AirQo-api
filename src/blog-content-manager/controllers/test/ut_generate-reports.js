const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const sinonChai = require("sinon-chai");

const httpStatus = require("http-status");
const AnalyticsReportingController = require("../path/to/AnalyticsReportingController");
const analyticsUtil = require("@utils/analytics");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- analytics-reporting-controller`
);
const { logText, logObject } = require("@utils/log");

// Mock dependencies
const mockRequest = {
  params: { postId: "test-post-id" },
  query: {},
  body: {},
};
const mockResponse = {
  json: sinon.spy(),
  status: sinon.spy(),
};
const mockNext = sinon.spy();

describe("AnalyticsReportingController", () => {
  beforeEach(() => {
    sinon.replace(log4js, "getLogger", sinon.stub().returns(logger));
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("views", () => {
    it("should call analyticsUtil.views with correct arguments", async () => {
      const mockResult = {
        success: true,
        data: [{ id: 1, title: "Test Post" }],
      };
      sinon.stub(analyticsUtil, "views").resolves(mockResult);

      await AnalyticsReportingController.views(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(analyticsUtil.views).toHaveBeenCalledWith(
        "test-post-id",
        mockRequest,
        mockNext
      );
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
        viewsData: mockResult.data,
      });
    });

    it("should handle errors from analyticsUtil.views", async () => {
      const mockError = new Error("Test error");
      sinon.stub(analyticsUtil, "views").rejects(mockError);

      await AnalyticsReportingController.views(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle bad request errors", async () => {
      const mockError = new Error("Bad request error");
      sinon.stub(extractErrorsFromRequest, "default").throws(mockError);

      await AnalyticsReportingController.views(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      sinon.stub(analyticsUtil, "views").resolves({});

      await AnalyticsReportingController.views(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("comments", () => {
    it("should call analyticsUtil.comments with correct arguments", async () => {
      const mockResult = {
        success: true,
        data: [{ id: 1, text: "Test comment" }],
      };
      sinon.stub(analyticsUtil, "comments").resolves(mockResult);

      await AnalyticsReportingController.comments(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(analyticsUtil.comments).toHaveBeenCalledWith(
        "test-post-id",
        mockRequest,
        mockNext
      );
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
        commentsData: mockResult.data,
      });
    });

    // Add similar tests for views, userViews, popularPosts, userComments, userActivity, userGrowthReport, postPerformanceReport
  });

  describe("popularPosts", () => {
    it("should call analyticsUtil.popularPosts with correct arguments", async () => {
      const mockResult = {
        success: true,
        data: [{ id: 1, title: "Popular Post" }],
      };
      sinon.stub(analyticsUtil, "popularPosts").resolves(mockResult);

      await AnalyticsReportingController.popularPosts(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(analyticsUtil.popularPosts).toHaveBeenCalledWith(
        mockRequest,
        mockNext
      );
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
        popularPostsData: mockResult.data,
      });
    });

    // Add similar tests for views, userViews, comments, userComments, userActivity, userGrowthReport, postPerformanceReport
  });

  describe("userViews", () => {
    it("should call analyticsUtil.userViews with correct arguments", async () => {
      const mockResult = { success: true, data: [{ userId: 1, views: 10 }] };
      sinon.stub(analyticsUtil, "userViews").resolves(mockResult);

      await AnalyticsReportingController.userViews(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(analyticsUtil.userViews).toHaveBeenCalledWith(
        "test-user-id",
        mockRequest,
        mockNext
      );
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
        userViewsData: mockResult.data,
      });
    });

    // Add similar tests for views, comments, popularPosts, userComments, userActivity, userGrowthReport, postPerformanceReport
  });

  describe("userComments", () => {
    it("should call analyticsUtil.userComments with correct arguments", async () => {
      const mockResult = { success: true, data: [{ userId: 1, commentId: 1 }] };
      sinon.stub(analyticsUtil, "userComments").resolves(mockResult);

      await AnalyticsReportingController.userComments(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(analyticsUtil.userComments).toHaveBeenCalledWith(
        "test-user-id",
        mockRequest,
        mockNext
      );
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
        userCommentsData: mockResult.data,
      });
    });

    // Add similar tests for views, comments, popularPosts, userViews, userActivity, userGrowthReport, postPerformanceReport
  });

  describe("userActivity", () => {
    it("should call analyticsUtil.userActivity with correct arguments", async () => {
      const mockResult = {
        success: true,
        data: [{ userId: 1, activityType: "view" }],
      };
      sinon.stub(analyticsUtil, "userActivity").resolves(mockResult);

      await AnalyticsReportingController.userActivity(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(analyticsUtil.userActivity).toHaveBeenCalledWith(
        "test-user-id",
        mockRequest,
        mockNext
      );
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
        userActivityData: mockResult.data,
      });
    });

    // Add similar tests for views, comments, popularPosts, userViews, userComments, userGrowthReport, postPerformanceReport
  });

  describe("userGrowthReport", () => {
    it("should call analyticsUtil.userGrowthReport with correct arguments", async () => {
      const mockResult = { success: true, data: [{ userId: 1, growth: 10 }] };
      sinon.stub(analyticsUtil, "userGrowthReport").resolves(mockResult);

      await AnalyticsReportingController.userGrowthReport(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(analyticsUtil.userGrowthReport).toHaveBeenCalledWith(
        mockRequest,
        mockNext
      );
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
        growthData: mockResult.data,
      });
    });

    // Add similar tests for views, comments, popularPosts, userViews, userComments, userActivity, postPerformanceReport
  });

  describe("postPerformanceReport", () => {
    it("should call analyticsUtil.postPerformanceReport with correct arguments", async () => {
      const mockResult = {
        success: true,
        data: [{ postId: 1, performance: 80 }],
      };
      sinon.stub(analyticsUtil, "postPerformanceReport").resolves(mockResult);

      await AnalyticsReportingController.postPerformanceReport(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(analyticsUtil.postPerformanceReport).toHaveBeenCalledWith(
        mockRequest,
        mockNext
      );
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
        performanceData: mockResult.data,
      });
    });

    describe("views", () => {
      it("should call analyticsUtil.views with correct arguments", async () => {
        const mockResult = {
          success: true,
          data: [{ id: 1, title: "Test Post" }],
        };
        sinon.stub(analyticsUtil, "views").resolves(mockResult);

        await AnalyticsReportingController.views(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(analyticsUtil.views).toHaveBeenCalledWith(
          "test-post-id",
          mockRequest,
          mockNext
        );
        expect(mockResponse.json).to.have.been.calledWith({
          success: true,
          message: mockResult.message,
          viewsData: mockResult.data,
        });
      });

      it("should handle errors from analyticsUtil.views", async () => {
        const mockError = new Error("Test error");
        sinon.stub(analyticsUtil, "views").rejects(mockError);

        await AnalyticsReportingController.views(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockNext).to.have.been.calledWith(
          sinon.match.instanceOf(HttpError)
        );
      });

      it("should handle bad request errors", async () => {
        const mockError = new Error("Bad request error");
        sinon.stub(extractErrorsFromRequest, "default").throws(mockError);

        await AnalyticsReportingController.views(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockNext).to.have.been.calledWith(
          sinon.match.instanceOf(HttpError)
        );
      });

      it("should handle empty result", async () => {
        sinon.stub(analyticsUtil, "views").resolves({});

        await AnalyticsReportingController.views(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockResponse.json).not.to.have.been.called;
      });
    });

    describe("comments", () => {
      it("should call analyticsUtil.comments with correct arguments", async () => {
        const mockResult = {
          success: true,
          data: [{ id: 1, text: "Test comment" }],
        };
        sinon.stub(analyticsUtil, "comments").resolves(mockResult);

        await AnalyticsReportingController.comments(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(analyticsUtil.comments).toHaveBeenCalledWith(
          "test-post-id",
          mockRequest,
          mockNext
        );
        expect(mockResponse.json).to.have.been.calledWith({
          success: true,
          message: mockResult.message,
          commentsData: mockResult.data,
        });
      });

      it("should handle errors from analyticsUtil.comments", async () => {
        const mockError = new Error("Test error");
        sinon.stub(analyticsUtil, "comments").rejects(mockError);

        await AnalyticsReportingController.comments(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockNext).to.have.been.calledWith(
          sinon.match.instanceOf(HttpError)
        );
      });

      it("should handle bad request errors", async () => {
        const mockError = new Error("Bad request error");
        sinon.stub(extractErrorsFromRequest, "default").throws(mockError);

        await AnalyticsReportingController.comments(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockNext).to.have.been.calledWith(
          sinon.match.instanceOf(HttpError)
        );
      });

      it("should handle empty result", async () => {
        sinon.stub(analyticsUtil, "comments").resolves({});

        await AnalyticsReportingController.comments(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockResponse.json).not.to.have.been.called;
      });
    });

    describe("popularPosts", () => {
      it("should call analyticsUtil.popularPosts with correct arguments", async () => {
        const mockResult = {
          success: true,
          data: [{ id: 1, title: "Popular Post" }],
        };
        sinon.stub(analyticsUtil, "popularPosts").resolves(mockResult);

        await AnalyticsReportingController.popularPosts(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(analyticsUtil.popularPosts).toHaveBeenCalledWith(
          mockRequest,
          mockNext
        );
        expect(mockResponse.json).to.have.been.calledWith({
          success: true,
          message: mockResult.message,
          popularPostsData: mockResult.data,
        });
      });

      it("should handle errors from analyticsUtil.popularPosts", async () => {
        const mockError = new Error("Test error");
        sinon.stub(analyticsUtil, "popularPosts").rejects(mockError);

        await AnalyticsReportingController.popularPosts(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockNext).to.have.been.calledWith(
          sinon.match.instanceOf(HttpError)
        );
      });

      it("should handle bad request errors", async () => {
        const mockError = new Error("Bad request error");
        sinon.stub(extractErrorsFromRequest, "default").throws(mockError);

        await AnalyticsReportingController.popularPosts(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockNext).to.have.been.calledWith(
          sinon.match.instanceOf(HttpError)
        );
      });

      it("should handle empty result", async () => {
        sinon.stub(analyticsUtil, "popularPosts").resolves({});

        await AnalyticsReportingController.popularPosts(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockResponse.json).not.to.have.been.called;
      });
    });

    describe("userViews", () => {
      it("should call analyticsUtil.userViews with correct arguments", async () => {
        const mockResult = { success: true, data: [{ userId: 1, views: 10 }] };
        sinon.stub(analyticsUtil, "userViews").resolves(mockResult);

        await AnalyticsReportingController.userViews(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(analyticsUtil.userViews).toHaveBeenCalledWith(
          "test-user-id",
          mockRequest,
          mockNext
        );
        expect(mockResponse.json).to.have.been.calledWith({
          success: true,
          message: mockResult.message,
          userViewsData: mockResult.data,
        });
      });

      it("should handle errors from analyticsUtil.userViews", async () => {
        const mockError = new Error("Test error");
        sinon.stub(analyticsUtil, "userViews").rejects(mockError);

        await AnalyticsReportingController.userViews(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockNext).to.have.been.calledWith(
          sinon.match.instanceOf(HttpError)
        );
      });

      it("should handle bad request errors", async () => {
        const mockError = new Error("Bad request error");
        sinon.stub(extractErrorsFromRequest, "default").throws(mockError);

        await AnalyticsReportingController.userViews(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockNext).to.have.been.calledWith(
          sinon.match.instanceOf(HttpError)
        );
      });

      it("should handle empty result", async () => {
        sinon.stub(analyticsUtil, "userViews").resolves({});

        await AnalyticsReportingController.userViews(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockResponse.json).not.to.have.been.called;
      });
    });

    describe("userComments", () => {
      it("should call analyticsUtil.userComments with correct arguments", async () => {
        const mockResult = {
          success: true,
          data: [{ userId: 1, commentId: 1 }],
        };
        sinon.stub(analyticsUtil, "userComments").resolves(mockResult);

        await AnalyticsReportingController.userComments(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(analyticsUtil.userComments).toHaveBeenCalledWith(
          "test-user-id",
          mockRequest,
          mockNext
        );
        expect(mockResponse.json).to.have.been.calledWith({
          success: true,
          message: mockResult.message,
          userCommentsData: mockResult.data,
        });
      });

      it("should handle errors from analyticsUtil.userComments", async () => {
        const mockError = new Error("Test error");
        sinon.stub(analyticsUtil, "userComments").rejects(mockError);

        await AnalyticsReportingController.userComments(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockNext).to.have.been.calledWith(
          sinon.match.instanceOf(HttpError)
        );
      });

      it("should handle bad request errors", async () => {
        const mockError = new Error("Bad request error");
        sinon.stub(extractErrorsFromRequest, "default").throws(mockError);

        await AnalyticsReportingController.userComments(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockNext).to.have.been.calledWith(
          sinon.match.instanceOf(HttpError)
        );
      });

      it("should handle empty result", async () => {
        sinon.stub(analyticsUtil, "userComments").resolves({});

        await AnalyticsReportingController.userComments(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockResponse.json).not.to.have.been.called;
      });
    });

    describe("userActivity", () => {
      it("should call analyticsUtil.userActivity with correct arguments", async () => {
        const mockResult = {
          success: true,
          data: [{ userId: 1, activityType: "view" }],
        };
        sinon.stub(analyticsUtil, "userActivity").resolves(mockResult);

        await AnalyticsReportingController.userActivity(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(analyticsUtil.userActivity).toHaveBeenCalledWith(
          "test-user-id",
          mockRequest,
          mockNext
        );
        expect(mockResponse.json).to.have.been.calledWith({
          success: true,
          message: mockResult.message,
          userActivityData: mockResult.data,
        });
      });

      it("should handle errors from analyticsUtil.userActivity", async () => {
        const mockError = new Error("Test error");
        sinon.stub(analyticsUtil, "userActivity").rejects(mockError);

        await AnalyticsReportingController.userActivity(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockNext).to.have.been.calledWith(
          sinon.match.instanceOf(HttpError)
        );
      });

      it("should handle bad request errors", async () => {
        const mockError = new Error("Bad request error");
        sinon.stub(extractErrorsFromRequest, "default").throws(mockError);

        await AnalyticsReportingController.userActivity(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockNext).to.have.been.calledWith(
          sinon.match.instanceOf(HttpError)
        );
      });

      it("should handle empty result", async () => {
        sinon.stub(analyticsUtil, "userActivity").resolves({});

        await AnalyticsReportingController.userActivity(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockResponse.json).not.to.have.been.called;
      });
    });

    describe("userGrowthReport", () => {
      it("should call analyticsUtil.userGrowthReport with correct arguments", async () => {
        const mockResult = { success: true, data: [{ userId: 1, growth: 10 }] };
        sinon.stub(analyticsUtil, "userGrowthReport").resolves(mockResult);

        await AnalyticsReportingController.userGrowthReport(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(analyticsUtil.userGrowthReport).toHaveBeenCalledWith(
          mockRequest,
          mockNext
        );
        expect(mockResponse.json).to.have.been.calledWith({
          success: true,
          message: mockResult.message,
          growthData: mockResult.data,
        });
      });

      it("should handle errors from analyticsUtil.userGrowthReport", async () => {
        const mockError = new Error("Test error");
        sinon.stub(analyticsUtil, "userGrowthReport").rejects(mockError);

        await AnalyticsReportingController.userGrowthReport(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockNext).to.have.been.calledWith(
          sinon.match.instanceOf(HttpError)
        );
      });

      it("should handle bad request errors", async () => {
        const mockError = new Error("Bad request error");
        sinon.stub(extractErrorsFromRequest, "default").throws(mockError);

        await AnalyticsReportingController.userGrowthReport(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockNext).to.have.been.calledWith(
          sinon.match.instanceOf(HttpError)
        );
      });

      it("should handle empty result", async () => {
        sinon.stub(analyticsUtil, "userGrowthReport").resolves({});

        await AnalyticsReportingController.userGrowthReport(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockResponse.json).not.to.have.been.called;
      });
    });

    describe("postPerformanceReport", () => {
      it("should call analyticsUtil.postPerformanceReport with correct arguments", async () => {
        const mockResult = {
          success: true,
          data: [{ postId: 1, performance: 80 }],
        };
        sinon.stub(analyticsUtil, "postPerformanceReport").resolves(mockResult);

        await AnalyticsReportingController.postPerformanceReport(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(analyticsUtil.postPerformanceReport).toHaveBeenCalledWith(
          mockRequest,
          mockNext
        );
        expect(mockResponse.json).to.have.been.calledWith({
          success: true,
          message: mockResult.message,
          performanceData: mockResult.data,
        });
      });

      it("should handle errors from analyticsUtil.postPerformanceReport", async () => {
        const mockError = new Error("Test error");
        sinon.stub(analyticsUtil, "postPerformanceReport").rejects(mockError);

        await AnalyticsReportingController.postPerformanceReport(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockNext).to.have.been.calledWith(
          sinon.match.instanceOf(HttpError)
        );
      });

      it("should handle bad request errors", async () => {
        const mockError = new Error("Bad request error");
        sinon.stub(extractErrorsFromRequest, "default").throws(mockError);

        await AnalyticsReportingController.postPerformanceReport(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockNext).to.have.been.calledWith(
          sinon.match.instanceOf(HttpError)
        );
      });

      it("should handle empty result", async () => {
        sinon.stub(analyticsUtil, "postPerformanceReport").resolves({});

        await AnalyticsReportingController.postPerformanceReport(
          mockRequest,
          mockResponse,
          mockNext
        );

        expect(mockResponse.json).not.to.have.been.called;
      });
    });
  });
});
