const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const sinonChai = require("sinon-chai");

const httpStatus = require("http-status");
const RSSFeedController = require("../path/to/RSSFeedController");
const rssFeedUtil = require("@utils/rss-feed");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- rssFeed-controller`
);
const { logText, logObject } = require("@utils/log");

// Mock dependencies
const mockRequest = {
  params: { blogId: "test-blog-id" },
  query: {},
  body: {},
};
const mockResponse = {
  json: sinon.spy(),
  status: sinon.spy(),
};
const mockNext = sinon.spy();

describe("RSSFeedController", () => {
  beforeEach(() => {
    sinon.replace(log4js, "getLogger", sinon.stub().returns(logger));
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("generateFeed", () => {
    it("should call rssFeedUtil.generateFeed with correct arguments", async () => {
      const mockResult = { success: true, data: "https://example.com/feed" };
      sinon.stub(rssFeedUtil, "generateFeed").resolves(mockResult);

      await RSSFeedController.generateFeed(mockRequest, mockResponse, mockNext);

      expect(rssFeedUtil.generateFeed).toHaveBeenCalledWith(
        "test-blog-id",
        mockRequest,
        mockNext
      );
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
        feedUrl: mockResult.data,
      });
    });

    it("should handle errors from rssFeedUtil.generateFeed", async () => {
      const mockError = new Error("Test error");
      sinon.stub(rssFeedUtil, "generateFeed").rejects(mockError);

      await RSSFeedController.generateFeed(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle bad request errors", async () => {
      const mockError = new Error("Bad request error");
      sinon.stub(extractErrorsFromRequest, "default").throws(mockError);

      await RSSFeedController.generateFeed(mockRequest, mockResponse, mockNext);

      expect(next).to.have.been.calledWith(sinon.match.instanceOf(HttpError));
    });

    it("should handle empty result", async () => {
      sinon.stub(rssFeedUtil, "generateFeed").resolves({});

      await RSSFeedController.generateFeed(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).not.to.have.been.called;
    });
  });
});
