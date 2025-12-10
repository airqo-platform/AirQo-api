require("module-alias/register");
const sinon = require("sinon");
const { expect } = require("chai");
const proxyquire = require("proxyquire");
const HttpError = require("@utils/errors");

describe("Enhanced JWT Authentication Middleware", () => {
  let req, res, next;
  let jwtVerifyStub, jwtStrategySpy, nextSpy;
  let UserModelStub, loggerStub, tokenFactoryStub;
  let enhancedJWTAuth, useJWTStrategy;
  let reqMock, resMock;
  let passport;

  beforeEach(() => {
    // Setup request mock
    req = {
      headers: {},
      query: {},
      body: {},
      user: null,
    };

    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis(),
    };

    next = sinon.stub();

    // Setup JWT verify stub
    jwtVerifyStub = sinon.stub();

    // Setup User Model stub with default behavior
    const createUserModelStub = (tenant) => ({
      findById: sinon.stub().returns({
        lean: sinon.stub().resolves({
          _id: "user123",
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          tenant: tenant || "airqo",
        }),
      }),
    });

    UserModelStub = sinon
      .stub()
      .callsFake((tenant) => createUserModelStub(tenant));

    // Setup logger stub
    loggerStub = {
      warn: sinon.stub(),
      error: sinon.stub(),
      info: sinon.stub(),
    };

    // Setup token factory stub with default behavior
    tokenFactoryStub = sinon.stub().returns({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
    });

    // Use proxyquire to inject dependencies
    passport = proxyquire("@middleware/passport", {
      "@models/User": UserModelStub,
      "@utils/log": loggerStub,
      "../utils/token-factory": tokenFactoryStub,
      jsonwebtoken: {
        verify: jwtVerifyStub,
      },
    });

    enhancedJWTAuth = passport.enhancedJWTAuth;
    useJWTStrategy = passport.useJWTStrategy;

    // Setup mocks for strategy tests
    reqMock = {
      headers: {
        authorization: "Bearer valid-token",
        "x-original-uri": "/api/v1/users",
      },
      query: {},
      body: {},
    };

    resMock = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis(),
    };

    nextSpy = sinon.stub();
    jwtStrategySpy = sinon.spy();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("Basic Authentication Flow", () => {
    it("should successfully authenticate with valid token", async () => {
      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          _id: "user123",
          email: "test@example.com",
          exp: Math.floor(Date.now() / 1000) + 3600,
        });
      });

      req.headers.authorization = "Bearer valid-token";

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.undefined;
      expect(req.user).to.exist;
      expect(req.user._id).to.equal("user123");
    });

    it("should return 401 when no token is provided", async () => {
      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
      expect(next.firstCall.args[0].statusCode).to.equal(401);
      expect(next.firstCall.args[0].errors.message).to.include("token");
    });

    it("should return 401 when token is invalid", async () => {
      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(new Error("Invalid token"), null);
      });

      req.headers.authorization = "Bearer invalid-token";

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
      expect(next.firstCall.args[0].statusCode).to.equal(401);
    });
  });

  describe("User Validation", () => {
    it("should return 401 when user no longer exists in database", async () => {
      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          _id: "user123",
          exp: Math.floor(Date.now() / 1000) + 3600,
        });
      });

      // Override the UserModelStub for this specific test to return null
      UserModelStub.reset();
      UserModelStub.callsFake(() => ({
        findById: sinon.stub().returns({
          lean: sinon.stub().resolves(null),
        }),
      }));

      req.headers.authorization = "Bearer valid-token";

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
      expect(next.firstCall.args[0].statusCode).to.equal(401);
      expect(next.firstCall.args[0].errors.message).to.include(
        "no longer exists"
      );
    });

    it("should handle database errors gracefully", async () => {
      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          _id: "user123",
          exp: Math.floor(Date.now() / 1000) + 3600,
        });
      });

      // Override to throw database error
      UserModelStub.reset();
      UserModelStub.callsFake(() => ({
        findById: sinon.stub().returns({
          lean: sinon.stub().rejects(new Error("Database connection failed")),
        }),
      }));

      req.headers.authorization = "Bearer valid-token";

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(Error);
      expect(loggerStub.error.calledOnce).to.be.true;
    });
  });

  describe("Token Refresh Handling", () => {
    it("should refresh token when expiring soon", async () => {
      const expiringTime = Math.floor(Date.now() / 1000) + 300; // 5 minutes

      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          _id: "user123",
          email: "test@example.com",
          exp: expiringTime,
        });
      });

      req.headers.authorization = "Bearer expiring-token";

      await enhancedJWTAuth(req, res, next);

      expect(tokenFactoryStub.calledOnce).to.be.true;
      expect(res.setHeader).to.have.been.calledWith(
        "X-New-Access-Token",
        "new-access-token"
      );
      expect(res.setHeader).to.have.been.calledWith(
        "X-New-Refresh-Token",
        "new-refresh-token"
      );
    });

    it("should handle token refresh failures gracefully", async () => {
      const expiringTime = Math.floor(Date.now() / 1000) + 300;

      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          _id: "user123",
          email: "test@example.com",
          exp: expiringTime,
        });
      });

      // Override token factory to throw error
      tokenFactoryStub.reset();
      tokenFactoryStub.throws(new Error("Token creation failed"));

      req.headers.authorization = "Bearer expiring-token";

      await enhancedJWTAuth(req, res, next);

      // Should still authenticate but log the error
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.undefined; // No error passed to next
      expect(loggerStub.error.calledOnce).to.be.true;
      expect(loggerStub.error.firstCall.args[0]).to.include("refresh");
    });

    it("should not refresh token when not expiring soon", async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour

      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          _id: "user123",
          email: "test@example.com",
          exp: futureTime,
        });
      });

      req.headers.authorization = "Bearer valid-token";

      await enhancedJWTAuth(req, res, next);

      expect(tokenFactoryStub.called).to.be.false;
    });
  });

  describe("Tenant Handling", () => {
    beforeEach(() => {
      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          _id: "user123",
          exp: Math.floor(Date.now() / 1000) + 3600,
        });
      });

      req.headers.authorization = "Bearer valid-token";
    });

    it("should use tenant from query parameter", async () => {
      req.query.tenant = "kcca";

      await enhancedJWTAuth(req, res, next);

      expect(UserModelStub.calledWith("kcca")).to.be.true;
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.undefined;
    });

    it("should use tenant from body parameter", async () => {
      req.body.tenant = "usembassy";

      await enhancedJWTAuth(req, res, next);

      expect(UserModelStub.calledWith("usembassy")).to.be.true;
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.undefined;
    });

    it("should default to 'airqo' tenant when not specified", async () => {
      await enhancedJWTAuth(req, res, next);

      expect(UserModelStub.calledWith("airqo")).to.be.true;
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.undefined;
    });

    it("should prioritize query tenant over body tenant", async () => {
      req.query.tenant = "kcca";
      req.body.tenant = "usembassy";

      await enhancedJWTAuth(req, res, next);

      expect(UserModelStub.calledWith("kcca")).to.be.true;
      expect(UserModelStub.calledWith("usembassy")).to.be.false;
    });
  });

  describe("JWT Strategy Integration", () => {
    it("should successfully use JWT strategy with valid configuration", async () => {
      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          _id: "user123",
          exp: Math.floor(Date.now() / 1000) + 3600,
        });
      });

      reqMock.headers.authorization = "Bearer valid-token";
      reqMock.headers["x-original-uri"] = "/api/v1/users";

      useJWTStrategy("airqo", reqMock, resMock, nextSpy);
      await enhancedJWTAuth(req, res, next);

      expect(jwtStrategySpy.called || nextSpy.called).to.be.true;
    });

    it("should handle invalid URI in strategy", async () => {
      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          _id: "user123",
          exp: Math.floor(Date.now() / 1000) + 3600,
        });
      });

      reqMock.headers["x-original-uri"] = "/unknown";

      useJWTStrategy("airqo", reqMock, resMock, nextSpy);

      expect(loggerStub.warn.called).to.be.true;
    });
  });

  describe("Edge Cases", () => {
    it("should handle malformed authorization header", async () => {
      req.headers.authorization = "InvalidFormat";

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
    });

    it("should handle expired tokens", async () => {
      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(new Error("jwt expired"), null);
      });

      req.headers.authorization = "Bearer expired-token";

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
      expect(next.firstCall.args[0].errors.message).to.include("expired");
    });

    it("should handle missing user ID in token payload", async () => {
      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          email: "test@example.com",
          exp: Math.floor(Date.now() / 1000) + 3600,
          // Missing _id
        });
      });

      req.headers.authorization = "Bearer valid-token";

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
    });
  });
});
