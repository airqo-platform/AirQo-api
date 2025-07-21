const sinon = require("sinon");
const chai = require("chai");
const chaiHttp = require("chai-http");
const expect = chai.expect;
const UserInteractionController = require("./user-interaction.controller");

describe("UserInteractionController", () => {
  let mockRequest;
  let mockResponse;
  let mockNext;
  let mockUserInteractionUtil;

  beforeEach(() => {
    mockRequest = {
      params: {},
      body: {},
      query: {},
    };
    mockResponse = {
      status: sinon.spy(),
      json: sinon.spy(),
    };
    mockNext = sinon.spy();
    mockUserInteractionUtil = {
      follow: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Followed",
          data: {},
        }),
      notifications: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Notifications fetched",
          data: [],
        }),
      like: sinon
        .stub()
        .resolves({ success: true, status: 200, message: "Liked", data: {} }),
      bookmark: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Bookmarked",
          data: {},
        }),
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("follow", () => {
    it("should follow a user", async () => {
      mockRequest.params.userId = "123";
      mockRequest.body = { tenant: "airqo" };

      await UserInteractionController.follow(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockUserInteractionUtil.follow).toHaveBeenCalledWith(
        "123",
        mockRequest.body,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Followed",
        followedUser: {},
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "tenant", message: "Tenant is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await UserInteractionController.follow(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockUserInteractionUtil.follow.resolves({});

      await UserInteractionController.follow(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("notifications", () => {
    it("should fetch notifications", async () => {
      mockRequest.query.tenant = "airqo";

      await UserInteractionController.notifications(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockUserInteractionUtil.notifications).toHaveBeenCalledWith(
        mockRequest,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Notifications fetched",
        notificationsData: [],
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "tenant", message: "Tenant is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await UserInteractionController.notifications(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockUserInteractionUtil.notifications.resolves({});

      await UserInteractionController.notifications(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("like", () => {
    it("should like a post", async () => {
      mockRequest.params.postId = "456";
      mockRequest.body = { tenant: "airqo" };

      await UserInteractionController.like(mockRequest, mockResponse, mockNext);

      expect(mockUserInteractionUtil.like).toHaveBeenCalledWith(
        "456",
        mockRequest.body,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Liked",
        likedPost: {},
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "tenant", message: "Tenant is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await UserInteractionController.like(mockRequest, mockResponse, mockNext);

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockUserInteractionUtil.like.resolves({});

      await UserInteractionController.like(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("bookmark", () => {
    it("should bookmark a post", async () => {
      mockRequest.params.postId = "789";
      mockRequest.body = { tenant: "airqo" };

      await UserInteractionController.bookmark(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockUserInteractionUtil.bookmark).toHaveBeenCalledWith(
        "789",
        mockRequest.body,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Bookmarked",
        bookmarkedPost: {},
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "tenant", message: "Tenant is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await UserInteractionController.bookmark(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockUserInteractionUtil.bookmark.resolves({});

      await UserInteractionController.bookmark(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.json).not.to.have.been.called;
    });
  });
});
