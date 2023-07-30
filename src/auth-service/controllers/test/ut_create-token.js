require("module-alias/register");
const sinon = require("sinon");
const { expect } = require("chai");
const { validationResult } = require("express-validator");
const createAccessToken = require("@utils/control-access");
const controlAccessUtil = require("@utils/control-access");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const { logObject, logText, logElement } = require("@utils/log");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");

describe("createAccessToken", () => {
  describe("create", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;

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
      badRequestStub = sinon.stub(createAccessToken, "badRequest").returns(res);
      controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "createAccessToken"
      );
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
    });

    it("should create an access token for default tenant", async () => {
      req.query.tenant = "default-tenant"; // Set the tenant for the request.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: "access_token1", // Set the access token created by the controlAccessUtil.
      });

      await createAccessToken.create(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          message: "Access token created successfully",
          created_token: "access_token1",
        })
      ).to.be.true;
    });

    it("should create an access token for custom tenant", async () => {
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: "access_token2", // Set the access token created by the controlAccessUtil.
      });

      await createAccessToken.create(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          message: "Access token created successfully",
          created_token: "access_token2",
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await createAccessToken.create(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle access token creation failure and return internal server error", async () => {
      const error = new Error("Failed to create access token.");
      controlAccessUtilStub.rejects(error);

      await createAccessToken.create(req, res);

      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });

  describe("list", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;

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
      badRequestStub = sinon.stub(createAccessToken, "badRequest").returns(res);
      controlAccessUtilStub = sinon.stub(controlAccessUtil, "listAccessToken");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
    });

    it("should list access tokens for default tenant", async () => {
      req.query.tenant = "default-tenant"; // Set the tenant for the request.
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: ["access_token1", "access_token2"], // Set the list of access tokens returned by the controlAccessUtil.
      });

      await createAccessToken.list(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          message: "Access tokens listed successfully",
          tokens: ["access_token1", "access_token2"],
        })
      ).to.be.true;
    });

    it("should list access tokens for custom tenant", async () => {
      controlAccessUtilStub.resolves({
        success: true,
        status: httpStatus.OK,
        data: ["access_token3"], // Set the list of access tokens returned by the controlAccessUtil.
      });

      await createAccessToken.list(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          message: "Access tokens listed successfully",
          tokens: ["access_token3"],
        })
      ).to.be.true;
      expect(req.query.tenant).to.equal(constants.DEFAULT_TENANT);
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await createAccessToken.list(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle access token listing failure and return internal server error", async () => {
      const error = new Error("Failed to list access tokens.");
      controlAccessUtilStub.rejects(error);

      await createAccessToken.list(req, res);

      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });

  describe("verify", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;

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
      badRequestStub = sinon.stub(createAccessToken, "badRequest").returns(res);
      controlAccessUtilStub = sinon.stub(controlAccessUtil, "verifyToken");
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
    });

    it("should verify access token successfully", async () => {
      req.query.tenant = "default-tenant"; // Set the tenant for the request.
      const responseFromVerifyToken = {
        success: true,
        status: httpStatus.OK,
        message: "Access token verified successfully", // Set the message returned by the controlAccessUtil.
      };
      controlAccessUtilStub.resolves(responseFromVerifyToken);

      await createAccessToken.verify(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(res.send.calledOnceWith("Access token verified successfully")).to
        .be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await createAccessToken.verify(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle access token verification failure and return internal server error", async () => {
      const error = new Error("Failed to verify access token.");
      const responseFromVerifyToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to verify access token.", // Set the error message returned by the controlAccessUtil.
      };
      controlAccessUtilStub.rejects(error);

      await createAccessToken.verify(req, res);

      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });

  describe("delete", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;

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
      badRequestStub = sinon.stub(createAccessToken, "badRequest").returns(res);
      controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "deleteAccessToken"
      );
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
    });

    it("should delete access token successfully", async () => {
      req.query.tenant = "default-tenant"; // Set the tenant for the request.
      const responseFromDeleteAccessToken = {
        success: true,
        status: httpStatus.OK,
        message: "Access token deleted successfully", // Set the message returned by the controlAccessUtil.
        data: { deleted: true }, // Set the data returned by the controlAccessUtil.
      };
      controlAccessUtilStub.resolves(responseFromDeleteAccessToken);

      await createAccessToken.delete(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          message: "Access token deleted successfully",
          deleted_token: { deleted: true },
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await createAccessToken.delete(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle access token deletion failure and return internal server error", async () => {
      const error = new Error("Failed to delete access token.");
      const responseFromDeleteAccessToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to delete access token.", // Set the error message returned by the controlAccessUtil.
      };
      controlAccessUtilStub.rejects(error);

      await createAccessToken.delete(req, res);

      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });

  describe("update", () => {
    let req;
    let res;
    let validationResultStub;
    let badRequestStub;
    let controlAccessUtilStub;

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
      badRequestStub = sinon.stub(createAccessToken, "badRequest").returns(res);
      controlAccessUtilStub = sinon.stub(
        controlAccessUtil,
        "updateAccessToken"
      );
    });

    afterEach(() => {
      validationResultStub.restore();
      badRequestStub.restore();
      controlAccessUtilStub.restore();
    });

    it("should update access token successfully", async () => {
      req.query.tenant = "default-tenant"; // Set the tenant for the request.
      const responseFromUpdateAccessToken = {
        success: true,
        status: httpStatus.OK,
        message: "Access token updated successfully", // Set the message returned by the controlAccessUtil.
        data: { updated: true }, // Set the data returned by the controlAccessUtil.
      };
      controlAccessUtilStub.resolves(responseFromUpdateAccessToken);

      await createAccessToken.update(req, res);

      expect(res.status.calledOnceWith(httpStatus.OK)).to.be.true;
      expect(
        res.json.calledOnceWith({
          message: "Access token updated successfully",
          updated_token: { updated: true },
        })
      ).to.be.true;
    });

    it("should handle validation errors and return bad request response", async () => {
      validationResultStub.returns(false);

      await createAccessToken.update(req, res);

      expect(
        badRequestStub.calledOnceWith(
          res,
          "bad request errors",
          convertErrorArrayToObject(null)
        )
      ).to.be.true;
    });

    it("should handle access token update failure and return internal server error", async () => {
      const error = new Error("Failed to update access token.");
      const responseFromUpdateAccessToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to update access token.", // Set the error message returned by the controlAccessUtil.
      };
      controlAccessUtilStub.rejects(error);

      await createAccessToken.update(req, res);

      expect(res.status.calledOnceWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(
        res.json.calledOnceWith({
          message: "Internal Server Error",
          errors: { message: error.message },
        })
      ).to.be.true;
    });
  });
});
