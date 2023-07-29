// Mocking dependencies
require("module-alias/register");
const UserModel = sinon.stub();
const AccessTokenModel = sinon.stub();
const jwt = require("jsonwebtoken");
const httpStatus = require("http-status");
const { expect } = require("chai");
const sinon = require("sinon");

// Require the module to test
const {
  setLocalAuth,
  setJWTAuth,
  setGoogleAuth,
  setGuestToken,
  authLocal,
  authJWT,
  authGoogle,
  authGoogleCallback,
  authGuest,
} = require("@middleware/passport");

// Sample request and response objects
const req = {
  query: { tenant: "airqo" },
  body: { userName: "testuser@example.com", password: "password" },
  headers: { authorization: "Bearer test-token" },
};
const res = {
  status: sinon.stub().returnsThis(),
  json: sinon.stub(),
};

describe("Authentication Module Unit Tests", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("setLocalAuth", () => {
    it("should set local strategy and call next", () => {
      const next = sinon.stub();
      const validationResultStub = sinon
        .stub()
        .returns({ isEmpty: () => true });

      sinon.replace(
        require("express-validator"),
        "validationResult",
        validationResultStub
      );
      sinon.replace(require("@models/User"), "UserModel", UserModel);
      UserModel.findOne = sinon
        .stub()
        .returns({ exec: () => Promise.resolve({}) });

      setLocalAuth(req, res, next);

      expect(validationResultStub.calledOnce).to.be.true;
      expect(UserModel.findOne.calledOnce).to.be.true;
      expect(next.calledOnce).to.be.true;
    });

    // Add more test cases for different scenarios and validations
  });

  // Add unit tests for other functions (setJWTAuth, setGoogleAuth, setGuestToken, etc.)

  describe("authLocal", () => {
    it("should authenticate with local strategy", () => {
      const authenticateStub = sinon
        .stub()
        .callsFake((strategy, options, cb) => cb(null, {}));
      sinon.replace(passport, "authenticate", authenticateStub);

      authLocal(req, res);

      expect(authenticateStub.calledOnce).to.be.true;
      expect(authenticateStub.args[0][0]).to.equal("user-local");
      expect(authenticateStub.args[0][1]).to.eql({
        session: false,
        failureFlash: true,
      });
    });

    // Add more test cases for different scenarios and validations
  });

  // Add unit tests for other authentication functions (authJWT, authGoogle, etc.)

  describe("authGuest", () => {
    it("should call next for valid guest user", () => {
      const verifyStub = sinon
        .stub(jwt, "verify")
        .returns({ guest: true, role: "guest" });

      const next = sinon.stub();
      authGuest(req, res, next);

      expect(verifyStub.calledOnce).to.be.true;
      expect(next.calledOnce).to.be.true;
    });

    // Add more test cases for different scenarios and validations
  });
});
