require("module-alias/register");
const sinon = require("sinon");
const { expect } = require("chai");
const httpStatus = require("http-status");
const rewire = require("rewire");
const tokenUtil = require("@utils/token.util");

const createAccessToken = rewire("@controllers/token.controller");
const realExtractErrors = require("@utils/shared").extractErrorsFromRequest;
const mockBadRequest = () => [{ param: "key", message: "required" }];

describe("tokenUtil", () => {
  let req, res, next;

  beforeEach(() => {
    req = { query: { tenant: "airqo" }, body: {}, params: {}, headers: {} };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
      send: sinon.stub(),
      headersSent: false,
    };
    next = sinon.stub();
  });

  afterEach(() => {
    sinon.restore();
    createAccessToken.__set__("extractErrorsFromRequest", realExtractErrors);
  });

  describe("create", () => {
    it("should create an access token successfully", async () => {
      sinon.stub(tokenUtil, "createAccessToken").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Access token created successfully",
        data: "access_token1",
      });

      await createAccessToken.create(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ message: "Access token created successfully", created_token: "access_token1" })).to.be.true;
    });

    it("should handle validation errors and return bad request", async () => {
      createAccessToken.__set__("extractErrorsFromRequest", mockBadRequest);

      await createAccessToken.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle access token creation failure", async () => {
      sinon.stub(tokenUtil, "createAccessToken").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to create",
        errors: { message: "Error" },
      });

      await createAccessToken.create(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(tokenUtil, "createAccessToken").rejects(new Error("Unexpected error"));

      await createAccessToken.create(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("list", () => {
    it("should list access tokens successfully", async () => {
      sinon.stub(tokenUtil, "listAccessToken").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Access tokens listed successfully",
        data: ["token1", "token2"],
      });

      await createAccessToken.list(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ message: "Access tokens listed successfully", tokens: sinon.match.array })).to.be.true;
    });

    it("should handle validation errors and return bad request", async () => {
      createAccessToken.__set__("extractErrorsFromRequest", mockBadRequest);

      await createAccessToken.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle listing failure", async () => {
      sinon.stub(tokenUtil, "listAccessToken").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to list",
        errors: { message: "Error" },
      });

      await createAccessToken.list(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(tokenUtil, "listAccessToken").rejects(new Error("Unexpected error"));

      await createAccessToken.list(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("verify", () => {
    it("should verify access token successfully", async () => {
      sinon.stub(tokenUtil, "verifyToken").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Token valid",
      });

      await createAccessToken.verify(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
    });

    it("should handle validation errors and return bad request", async () => {
      createAccessToken.__set__("extractErrorsFromRequest", mockBadRequest);

      await createAccessToken.verify(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(tokenUtil, "verifyToken").rejects(new Error("Unexpected error"));

      await createAccessToken.verify(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("delete", () => {
    it("should delete access token successfully", async () => {
      sinon.stub(tokenUtil, "deleteAccessToken").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Access token deleted successfully",
        data: { deleted: true },
      });

      await createAccessToken.delete(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ message: "Access token deleted successfully", deleted_token: sinon.match.object })).to.be.true;
    });

    it("should handle validation errors and return bad request", async () => {
      createAccessToken.__set__("extractErrorsFromRequest", mockBadRequest);

      await createAccessToken.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(tokenUtil, "deleteAccessToken").rejects(new Error("Unexpected error"));

      await createAccessToken.delete(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("update", () => {
    it("should update access token successfully", async () => {
      sinon.stub(tokenUtil, "updateAccessToken").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Access token updated successfully",
        data: { updated: true },
      });

      await createAccessToken.update(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ message: "Access token updated successfully", updated_token: sinon.match.object })).to.be.true;
    });

    it("should handle validation errors and return bad request", async () => {
      createAccessToken.__set__("extractErrorsFromRequest", mockBadRequest);

      await createAccessToken.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle unexpected errors", async () => {
      sinon.stub(tokenUtil, "updateAccessToken").rejects(new Error("Unexpected error"));

      await createAccessToken.update(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("getWhitelistedIPStats", () => {
    it("should return stats for whitelisted IPs successfully", async () => {
      const mockStats = [{ ip: "1.1.1.1", total_requests: 10 }];
      sinon.stub(tokenUtil, "getWhitelistedIPStats").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Stats retrieved",
        data: mockStats,
      });

      await createAccessToken.getWhitelistedIPStats(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ message: "Stats retrieved", whitelisted_ip_stats: mockStats })).to.be.true;
      expect(next.called).to.be.false;
    });

    it("should handle cases with no whitelisted IPs found", async () => {
      sinon.stub(tokenUtil, "getWhitelistedIPStats").resolves({
        success: true,
        status: httpStatus.OK,
        message: "No whitelisted IPs found.",
        data: [],
      });

      await createAccessToken.getWhitelistedIPStats(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledWithMatch({ message: "No whitelisted IPs found.", whitelisted_ip_stats: [] })).to.be.true;
    });

    it("should handle validation errors", async () => {
      createAccessToken.__set__("extractErrorsFromRequest", mockBadRequest);

      await createAccessToken.getWhitelistedIPStats(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle internal server errors from the utility function", async () => {
      sinon.stub(tokenUtil, "getWhitelistedIPStats").resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "DB error",
        errors: { message: "DB error" },
      });

      await createAccessToken.getWhitelistedIPStats(req, res, next);

      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
    });
  });
});
