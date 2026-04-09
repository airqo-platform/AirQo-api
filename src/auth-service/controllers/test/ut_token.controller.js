require("module-alias/register");
const sinon = require("sinon");
const { expect } = require("chai");
const { validationResult } = require("express-validator");
const tokenUtil = require("@utils/token.util");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const { logObject, logText, logElement } = require("@utils/log");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const sharedUtils = require("@utils/shared");
const httpStatus = require("http-status");

const createAccessToken = require("@controllers/token.controller");
describe("tokenUtil", () => {
  describe("create", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let tokenUtilStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon.stub(tokenUtil, "badRequest").returns(res);
      tokenUtilStub = sinon.stub(tokenUtil, "tokenUtil");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      tokenUtilStub.restore();
    });

    it("should create an access token for default tenant", async () => {
      req.query.tenant = "default-tenant"; // Set the tenant for the request.
      tokenUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: "access_token1", // Set the access token created by the tokenUtil.
      });

      await tokenUtil.create(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          message: "Access token created successfully",
          created_token: "access_token1",
        }),
      ).to.be.true;
    });

    it("should create an access token for custom tenant", async () => {
      tokenUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: "access_token2", // Set the access token created by the tokenUtil.
      });

      await tokenUtil.create(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          message: "Access token created successfully",
          created_token: "access_token2",
        }),
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await tokenUtil.create(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null),
        ),
      ).to.be.true;
    });

    it("should handle access token creation failure and return internal server error", async () => {
      const error = new Error("Failed to create access token.");
      tokenUtilStub.rejects(error);

      await tokenUtil.create(req, res);

      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
        }),
      ).to.be.true;
    });
  });

  describe("list", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let tokenUtilStub;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon.stub(tokenUtil, "badRequest").returns(res);
      tokenUtilStub = sinon.stub(tokenUtil, "listAccessToken");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      tokenUtilStub.restore();
    });

    it("should list access tokens for default tenant", async () => {
      req.query.tenant = "default-tenant"; // Set the tenant for the request.
      tokenUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: ["access_token1", "access_token2"], // Set the list of access tokens returned by the tokenUtil.
      });

      await tokenUtil.list(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          message: "Access tokens listed successfully",
          tokens: ["access_token1", "access_token2"],
        }),
      ).to.be.true;
    });

    it("should list access tokens for custom tenant", async () => {
      tokenUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: ["access_token3"], // Set the list of access tokens returned by the tokenUtil.
      });

      await tokenUtil.list(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          message: "Access tokens listed successfully",
          tokens: ["access_token3"],
        }),
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await tokenUtil.list(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null),
        ),
      ).to.be.true;
    });

    it("should handle access token listing failure and return internal server error", async () => {
      const error = new Error("Failed to list access tokens.");
      tokenUtilStub.rejects(error);

      await tokenUtil.list(req, res);

      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
        }),
      ).to.be.true;
    });
  });

  describe("verify", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let tokenUtilStub;

    beforeEach(() => {
      req = {
        query: {},
        headers: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        send: sinon.stub(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon.stub(tokenUtil, "badRequest").returns(res);
      tokenUtilStub = sinon.stub(tokenUtil, "verifyToken");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      tokenUtilStub.restore();
    });

    it("should verify access token successfully", async () => {
      req.query.tenant = "default-tenant"; // Set the tenant for the request.
      const responseFromVerifyToken = {
        success: true,
        status: httpStatus.OK,
        message: "Access token verified successfully", // Set the message returned by the tokenUtil.
      };
      tokenUtilStub.resolves(responseFromVerifyToken);

      await tokenUtil.verify(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(res.send.calledOnceWith("Access token verified successfully")).to
        .be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await tokenUtil.verify(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null),
        ),
      ).to.be.true;
    });

    it("should handle access token verification failure and return internal server error", async () => {
      const error = new Error("Failed to verify access token.");
      const responseFromVerifyToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to verify access token.", // Set the error message returned by the tokenUtil.
      };
      tokenUtilStub.rejects(error);

      await tokenUtil.verify(req, res);

      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
        }),
      ).to.be.true;
    });
  });

  describe("delete", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let tokenUtilStub;

    beforeEach(() => {
      req = {
        query: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon.stub(tokenUtil, "badRequest").returns(res);
      tokenUtilStub = sinon.stub(tokenUtil, "deleteAccessToken");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      tokenUtilStub.restore();
    });

    it("should delete access token successfully", async () => {
      req.query.tenant = "default-tenant"; // Set the tenant for the request.
      const responseFromDeleteAccessToken = {
        success: true,
        status: httpStatus.OK,
        message: "Access token deleted successfully", // Set the message returned by the tokenUtil.
        data: { deleted: true }, // Set the data returned by the tokenUtil.
      };
      tokenUtilStub.resolves(responseFromDeleteAccessToken);

      await tokenUtil.delete(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          message: "Access token deleted successfully",
          deleted_token: { deleted: true },
        }),
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await tokenUtil.delete(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null),
        ),
      ).to.be.true;
    });

    it("should handle access token deletion failure and return internal server error", async () => {
      const error = new Error("Failed to delete access token.");
      const responseFromDeleteAccessToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to delete access token.", // Set the error message returned by the tokenUtil.
      };
      tokenUtilStub.rejects(error);

      await tokenUtil.delete(req, res);

      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
        }),
      ).to.be.true;
    });
  });

  describe("update", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let tokenUtilStub;

    beforeEach(() => {
      req = {
        query: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };

      validationResultStub = sinon
        .stub(validationResult, "isEmpty")
        .returns(true);
      badRequestStub = sinon.stub(tokenUtil, "badRequest").returns(res);
      tokenUtilStub = sinon.stub(tokenUtil, "updateAccessToken");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      tokenUtilStub.restore();
    });

    it("should update access token successfully", async () => {
      req.query.tenant = "default-tenant"; // Set the tenant for the request.
      const responseFromUpdateAccessToken = {
        success: true,
        status: httpStatus.OK,
        message: "Access token updated successfully", // Set the message returned by the tokenUtil.
        data: { updated: true }, // Set the data returned by the tokenUtil.
      };
      tokenUtilStub.resolves(responseFromUpdateAccessToken);

      await tokenUtil.update(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          message: "Access token updated successfully",
          updated_token: { updated: true },
        }),
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await tokenUtil.update(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null),
        ),
      ).to.be.true;
    });

    it("should handle access token update failure and return internal server error", async () => {
      const error = new Error("Failed to update access token.");
      const responseFromUpdateAccessToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to update access token.", // Set the error message returned by the tokenUtil.
      };
      tokenUtilStub.rejects(error);

      await tokenUtil.update(req, res);

      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
        }),
      ).to.be.true;
    });
  });

  describe("getWhitelistedIPStats", () => {
    let req;
    let res;
    let next;
    let extractErrorsFromRequestStub;
    let getWhitelistedIPStatsStub;

    beforeEach(() => {
      req = {
        query: {},
        params: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      next = sinon.stub();
      extractErrorsFromRequestStub = sinon
        .stub(sharedUtils, "extractErrorsFromRequest")
        .returns(null);
      getWhitelistedIPStatsStub = sinon.stub(
        tokenUtil,
        "getWhitelistedIPStats",
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return stats for whitelisted IPs successfully", async () => {
      const mockStats = [{ ip: "1.1.1.1", total_requests: 10 }];
      getWhitelistedIPStatsStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Stats retrieved",
        data: mockStats,
      });

      await createAccessToken.getWhitelistedIPStats(req, res, next);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          message: "Stats retrieved",
          whitelisted_ip_stats: mockStats,
        }),
      ).to.be.true;
      expect(next.called).to.be.false;
    });

    it("should handle cases with no whitelisted IPs found", async () => {
      getWhitelistedIPStatsStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "No whitelisted IPs found.",
        data: [],
      });

      await createAccessToken.getWhitelistedIPStats(req, res, next);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          message: "No whitelisted IPs found.",
          whitelisted_ip_stats: [],
        }),
      ).to.be.true;
    });

    it("should handle validation errors", async () => {
      extractErrorsFromRequestStub.returns({
        msg: "validation error",
      }); // Simulate validation errors

      await createAccessToken.getWhitelistedIPStats(req, res, next);

      expect(next.calledOnce).to.be.true;
      const nextArg = next.firstCall.args[0];
      expect(nextArg).to.be.an.instanceOf(Error);
      expect(nextArg.status).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle internal server errors from the utility function", async () => {
      getWhitelistedIPStatsStub.resolves({
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "DB error",
        errors: { message: "DB error" },
      });

      await createAccessToken.getWhitelistedIPStats(req, res, next);

      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnce).to.be.true;
    });
  });
});
