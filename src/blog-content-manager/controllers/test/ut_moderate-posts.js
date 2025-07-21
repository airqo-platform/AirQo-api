const sinon = require("sinon");
const chai = require("chai");
const chaiHttp = require("chai-http");
const expect = chai.expect;
const ContentModerationController = require("./content-moderation.controller");

describe("ContentModerationController", () => {
  let mockRequest;
  let mockResponse;
  let mockNext;
  let mockContentModerationUtil;

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
    mockContentModerationUtil = {
      listRegistrations: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Listed successfully",
          data: [],
        }),
      approveRegistration: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Approved successfully",
          data: {},
        }),
      rejectRegistration: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Rejected successfully",
          data: {},
        }),
      flagPost: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Flagged successfully",
          data: {},
        }),
      viewFlags: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Viewed flags successfully",
          data: [],
        }),
      suspendUser: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Suspended user successfully",
          data: {},
        }),
      banUser: sinon
        .stub()
        .resolves({
          success: true,
          status: 200,
          message: "Banned user successfully",
          data: {},
        }),
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("listRegistrations", () => {
    it("should list registrations", async () => {
      mockRequest.query.tenant = "testtenant";

      await ContentModerationController.listRegistrations(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockContentModerationUtil.listRegistrations).toHaveBeenCalledWith(
        mockRequest,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Listed successfully",
        registrationsData: [],
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [
        { field: "requiredField", message: "Required field is missing" },
      ];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await ContentModerationController.listRegistrations(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockContentModerationUtil.listRegistrations.resolves({});

      await ContentModerationController.listRegistrations(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("approveRegistration", () => {
    it("should approve registration", async () => {
      mockRequest.params.userId = "123";
      mockRequest.body = { reason: "Reason for approval" };

      await ContentModerationController.approveRegistration(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(
        mockContentModerationUtil.approveRegistration
      ).toHaveBeenCalledWith("123", mockRequest.body, mockNext);
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Approved successfully",
        approvedRegistration: {},
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "reason", message: "Reason is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await ContentModerationController.approveRegistration(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockContentModerationUtil.approveRegistration.resolves({});

      await ContentModerationController.approveRegistration(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("rejectRegistration", () => {
    it("should reject registration", async () => {
      mockRequest.params.userId = "456";
      mockRequest.body = { reason: "Reason for rejection" };

      await ContentModerationController.rejectRegistration(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockContentModerationUtil.rejectRegistration).toHaveBeenCalledWith(
        "456",
        mockRequest.body,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Rejected successfully",
        rejectedRegistration: {},
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "reason", message: "Reason is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await ContentModerationController.rejectRegistration(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockContentModerationUtil.rejectRegistration.resolves({});

      await ContentModerationController.rejectRegistration(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("flagPost", () => {
    it("should flag a post", async () => {
      mockRequest.params.postId = "789";
      mockRequest.body = { reason: "Reason for flagging" };

      await ContentModerationController.flagPost(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockContentModerationUtil.flagPost).toHaveBeenCalledWith(
        "789",
        mockRequest.body,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Flagged successfully",
        flaggedPost: {},
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "reason", message: "Reason is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await ContentModerationController.flagPost(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockContentModerationUtil.flagPost.resolves({});

      await ContentModerationController.flagPost(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("viewFlags", () => {
    it("should view flags", async () => {
      mockRequest.params.postId = "1010";
      mockRequest.query.tenant = "testtenant";

      await ContentModerationController.viewFlags(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockContentModerationUtil.viewFlags).toHaveBeenCalledWith(
        "1010",
        mockRequest,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Viewed flags successfully",
        flagsData: [],
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "postId", message: "Post ID is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await ContentModerationController.viewFlags(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockContentModerationUtil.viewFlags.resolves({});

      await ContentModerationController.viewFlags(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("suspendUser", () => {
    it("should suspend a user", async () => {
      mockRequest.params.userId = "1111";
      mockRequest.body = { reason: "Reason for suspension" };

      await ContentModerationController.suspendUser(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockContentModerationUtil.suspendUser).toHaveBeenCalledWith(
        "1111",
        mockRequest.body,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Suspended user successfully",
        suspendedUser: {},
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "reason", message: "Reason is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await ContentModerationController.suspendUser(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockContentModerationUtil.suspendUser.resolves({});

      await ContentModerationController.suspendUser(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  describe("banUser", () => {
    it("should ban a user", async () => {
      mockRequest.params.userId = "2222";
      mockRequest.body = { reason: "Reason for banning" };

      await ContentModerationController.banUser(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockContentModerationUtil.banUser).toHaveBeenCalledWith(
        "2222",
        mockRequest.body,
        mockNext
      );
      expect(mockResponse.status).to.have.been.calledWith(200);
      expect(mockResponse.json).to.have.been.calledWith({
        success: true,
        message: "Banned user successfully",
        bannedUser: {},
      });
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "reason", message: "Reason is required" }];
      sinon.stub(extractErrorsFromRequest, "default").returns(errors);

      await ContentModerationController.banUser(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).to.have.been.calledWith(
        sinon.match.instanceOf(HttpError)
      );
    });

    it("should handle empty result", async () => {
      mockContentModerationUtil.banUser.resolves({});

      await ContentModerationController.banUser(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.json).not.to.have.been.called;
    });
  });

  // Helper functions

  function extractErrorsFromRequest() {
    return [];
  }

  class HttpError extends Error {
    constructor(message, statusCode, errors) {
      super(message);
      this.name = "HttpError";
      this.statusCode = statusCode;
      this.errors = errors;
    }
  }
});
