require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire");
const httpStatus = require("http-status");
const constants = require("@config/constants");

describe("enhancedJWTAuth Middleware Unit Tests", () => {
  let req, res, next;
  let jwtVerifyStub, UserModelStub, loggerStub, tokenFactoryStub;
  let enhancedJWTAuth, HttpError;
  let passport;

  beforeEach(() => {
    // Reset request/response/next for each test
    req = {
      headers: {},
      query: {},
      body: {},
      originalUrl: "/api/v2/users/profile",
    };

    res = {
      set: sinon.stub().returnsThis(),
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis(),
    };

    next = sinon.stub();

    // Mock HttpError
    HttpError = class MockHttpError extends Error {
      constructor(message, statusCode, errors) {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        this.errors = errors;
      }
    };

    // Stub JWT verify
    jwtVerifyStub = sinon.stub();

    // Stub UserModel
    UserModelStub = sinon.stub().returns({
      findById: sinon.stub().returns({
        lean: sinon.stub().resolves({
          _id: "user123",
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
        }),
      }),
    });

    // Stub logger (from @utils/common)
    loggerStub = {
      warn: sinon.stub(),
      error: sinon.stub(),
      info: sinon.stub(),
    };

    // Stub token factory (from @services/atf.service)
    tokenFactoryStub = sinon.stub().returns({
      createToken: sinon.stub().resolves("new-refreshed-token"),
    });

    // Stub userUtil
    const userUtilStub = {
      _getEffectiveTokenStrategy: sinon
        .stub()
        .returns("NO_ROLES_AND_PERMISSIONS"),
    };

    // Use proxyquire with CORRECT paths
    passport = proxyquire("@middleware/passport", {
      "@models/User": UserModelStub,
      "@utils/common": {
        winstonLogger: loggerStub,
        mailer: {},
        stringify: sinon.stub(),
      },
      "@services/atf.service": {
        AbstractTokenFactory: tokenFactoryStub,
      },
      "@utils/user.util": userUtilStub,
      "@utils/shared": {
        HttpError,
        logObject: sinon.stub(),
        logText: sinon.stub(),
        logElement: sinon.stub(),
        extractErrorsFromRequest: sinon.stub(),
      },
      jsonwebtoken: {
        verify: jwtVerifyStub,
        sign: sinon.stub(),
        "@noCallThru": true,
      },
    });

    enhancedJWTAuth = passport.enhancedJWTAuth;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("Authorization Header Validation", () => {
    it("should return 401 when authorization header is missing", async () => {
      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
      expect(next.firstCall.args[0].statusCode).to.equal(
        httpStatus.UNAUTHORIZED
      );
      expect(next.firstCall.args[0].message).to.equal("Unauthorized");
    });

    it("should return 401 when authorization header format is invalid", async () => {
      req.headers.authorization = "InvalidFormat token123";

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
      expect(next.firstCall.args[0].statusCode).to.equal(
        httpStatus.UNAUTHORIZED
      );
    });

    it("should accept Bearer token format", async () => {
      req.headers.authorization = "Bearer validtoken123";

      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          _id: "user123",
          exp: Math.floor(Date.now() / 1000) + 3600,
        });
      });

      await enhancedJWTAuth(req, res, next);

      expect(jwtVerifyStub.calledOnce).to.be.true;
    });

    it("should accept JWT token format", async () => {
      req.headers.authorization = "JWT validtoken123";

      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          _id: "user123",
          exp: Math.floor(Date.now() / 1000) + 3600,
        });
      });

      await enhancedJWTAuth(req, res, next);

      expect(jwtVerifyStub.calledOnce).to.be.true;
    });

    it("should return 401 when token is empty", async () => {
      req.headers.authorization = "Bearer   ";

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
    });
  });

  describe("Route Blocking for Query-Token-Only Endpoints", () => {
    beforeEach(() => {
      req.headers.authorization = "JWT validtoken123";
    });

    it("should block JWT access to /api/v2/devices/events", async () => {
      req.originalUrl = "/api/v2/devices/events";

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
      expect(next.firstCall.args[0].statusCode).to.equal(
        httpStatus.UNAUTHORIZED
      );
      expect(next.firstCall.args[0].errors.message).to.include("query token");
    });

    it("should block JWT access to /api/v2/devices/measurements", async () => {
      req.originalUrl = "/api/v2/devices/measurements";

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
      expect(next.firstCall.args[0].statusCode).to.equal(
        httpStatus.UNAUTHORIZED
      );
    });

    it("should block JWT access to /api/v2/devices/measurements/sites", async () => {
      req.originalUrl = "/api/v2/devices/measurements/sites";

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
    });

    it("should block JWT access to /api/v2/devices/readings", async () => {
      req.originalUrl = "/api/v2/devices/readings";

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
    });

    it("should block JWT access to /api/v2/analytics/raw-data", async () => {
      req.originalUrl = "/api/v2/analytics/raw-data";

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
    });

    it("should block JWT access to /api/v2/analytics/data-download", async () => {
      req.originalUrl = "/api/v2/analytics/data-download";

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
      expect(next.firstCall.args[0].statusCode).to.equal(
        httpStatus.UNAUTHORIZED
      );
    });

    it("should block JWT access to /api/v2/analytics/data-export", async () => {
      req.originalUrl = "/api/v2/analytics/data-export";

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
      expect(next.firstCall.args[0].statusCode).to.equal(
        httpStatus.UNAUTHORIZED
      );
    });

    it("should block JWT access to /api/v2/analytics/forecasts/hourly", async () => {
      req.originalUrl = "/api/v2/analytics/forecasts/hourly";

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
      expect(next.firstCall.args[0].statusCode).to.equal(
        httpStatus.UNAUTHORIZED
      );
    });

    it("should block JWT access to /api/v2/analytics/forecasts/daily", async () => {
      req.originalUrl = "/api/v2/analytics/forecasts/daily";

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
    });

    it("should block JWT access to /api/v2/analytics/heatmaps", async () => {
      req.originalUrl = "/api/v2/analytics/heatmaps";

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
      expect(next.firstCall.args[0].statusCode).to.equal(
        httpStatus.UNAUTHORIZED
      );
    });

    it("should block JWT access to endpoints with query parameters", async () => {
      req.originalUrl = "/api/v2/devices/events?startDate=2024-01-01";

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
    });

    it("should use x-original-uri header when available", async () => {
      req.headers["x-original-uri"] = "/api/v2/devices/events";
      req.originalUrl = "/api/v2/users/profile"; // Different URL

      await enhancedJWTAuth(req, res, next);

      // Should block based on x-original-uri, not originalUrl
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
    });
  });

  describe("JWT Access to Non-Blocked Endpoints", () => {
    beforeEach(() => {
      req.headers.authorization = "JWT validtoken123";

      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          _id: "user123",
          exp: Math.floor(Date.now() / 1000) + 3600,
        });
      });
    });

    it("should allow JWT access to /api/v2/users/verify", async () => {
      req.originalUrl = "/api/v2/users/verify";

      await enhancedJWTAuth(req, res, next);

      // Should NOT return an error - should proceed with JWT verification
      expect(jwtVerifyStub.calledOnce).to.be.true;
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.undefined; // No error
    });

    it("should allow JWT access to /api/v2/users/profile/enhanced", async () => {
      req.originalUrl = "/api/v2/users/profile/enhanced";

      await enhancedJWTAuth(req, res, next);

      expect(jwtVerifyStub.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.undefined;
    });

    it("should allow JWT access to /api/v2/devices/sites", async () => {
      req.originalUrl = "/api/v2/devices/sites";

      await enhancedJWTAuth(req, res, next);

      expect(jwtVerifyStub.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.undefined;
    });
  });

  describe("JWT Token Validation", () => {
    beforeEach(() => {
      req.headers.authorization = "JWT validtoken123";
      req.originalUrl = "/api/v2/users/profile";
    });

    it("should return 401 for malformed JWT token", async () => {
      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(new Error("jwt malformed"), null);
      });

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
      expect(next.firstCall.args[0].errors.message).to.include("Invalid token");
    });

    it("should return 401 for expired token beyond grace period", async () => {
      const GRACE_PERIOD_SECONDS = constants.JWT_GRACE_PERIOD_SECONDS || 300;
      const expiredTime =
        Math.floor(Date.now() / 1000) - GRACE_PERIOD_SECONDS - 100;

      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          _id: "user123",
          exp: expiredTime,
        });
      });

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
      expect(next.firstCall.args[0].errors.message).to.include("expired");
    });

    it("should attach user to request for valid token", async () => {
      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          _id: "user123",
          exp: Math.floor(Date.now() / 1000) + 3600,
        });
      });

      await enhancedJWTAuth(req, res, next);

      expect(req.user).to.exist;
      expect(req.user._id).to.equal("user123");
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.undefined; // No error
    });

    it("should return 401 when user no longer exists in database", async () => {
      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          _id: "user123",
          exp: Math.floor(Date.now() / 1000) + 3600,
        });
      });

      // Mock user not found
      UserModelStub.returns({
        findById: sinon.stub().returns({
          lean: sinon.stub().resolves(null),
        }),
      });

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
      expect(next.firstCall.args[0].errors.message).to.include(
        "no longer exists"
      );
    });
  });

  describe("Token Refresh Logic", () => {
    beforeEach(() => {
      req.headers.authorization = "JWT validtoken123";
      req.originalUrl = "/api/v2/users/profile";
    });

    it("should set X-Access-Token header when token needs refresh", async () => {
      const REFRESH_WINDOW_SECONDS =
        constants.JWT_REFRESH_WINDOW_SECONDS || 600;
      const expiringTime =
        Math.floor(Date.now() / 1000) + REFRESH_WINDOW_SECONDS - 100;

      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          _id: "user123",
          exp: expiringTime,
        });
      });

      await enhancedJWTAuth(req, res, next);

      expect(res.set.calledWith("X-Access-Token")).to.be.true;
      expect(
        res.set.calledWith("Access-Control-Expose-Headers", "X-Access-Token")
      ).to.be.true;
    });

    it("should not fail request when token refresh fails", async () => {
      const REFRESH_WINDOW_SECONDS =
        constants.JWT_REFRESH_WINDOW_SECONDS || 600;
      const expiringTime =
        Math.floor(Date.now() / 1000) + REFRESH_WINDOW_SECONDS - 100;

      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          _id: "user123",
          exp: expiringTime,
        });
      });

      // Mock token factory failure
      tokenFactoryStub.returns({
        createToken: sinon.stub().rejects(new Error("Token creation failed")),
      });

      await enhancedJWTAuth(req, res, next);

      // Should still proceed despite refresh failure
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.undefined; // No error passed
    });
  });

  describe("Error Handling", () => {
    it("should handle unexpected errors gracefully", async () => {
      req.headers.authorization = "JWT validtoken123";
      req.originalUrl = "/api/v2/users/profile";

      // Force an unexpected error by making jwt.verify throw
      jwtVerifyStub.throws(new Error("Unexpected error"));

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
      expect(next.firstCall.args[0].statusCode).to.equal(
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });

  describe("Tenant Handling", () => {
    beforeEach(() => {
      req.headers.authorization = "JWT validtoken123";
      req.originalUrl = "/api/v2/users/profile";

      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          _id: "user123",
          exp: Math.floor(Date.now() / 1000) + 3600,
        });
      });
    });

    it("should use tenant from query parameter", async () => {
      req.query.tenant = "kcca";

      await enhancedJWTAuth(req, res, next);

      expect(UserModelStub.calledWith("kcca")).to.be.true;
    });

    it("should use tenant from body parameter", async () => {
      req.body.tenant = "usembassy";

      await enhancedJWTAuth(req, res, next);

      expect(UserModelStub.calledWith("usembassy")).to.be.true;
    });

    it("should use constants.DEFAULT_TENANT when not specified", async () => {
      // Use the actual constant value from config
      const expectedTenant = constants.DEFAULT_TENANT || "airqo";

      await enhancedJWTAuth(req, res, next);

      expect(UserModelStub.calledWith(expectedTenant.toLowerCase())).to.be.true;
    });

    it("should convert tenant to lowercase", async () => {
      req.query.tenant = "KCCA";

      await enhancedJWTAuth(req, res, next);

      expect(UserModelStub.calledWith("kcca")).to.be.true;
    });
  });

  describe("Analytics User ID Handling", () => {
    beforeEach(() => {
      req.headers.authorization = "JWT validtoken123";
      req.originalUrl = "/api/v2/users/profile";

      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          _id: "user123",
          exp: Math.floor(Date.now() / 1000) + 3600,
        });
      });
    });

    it("should set analyticsUserId on request", async () => {
      await enhancedJWTAuth(req, res, next);

      expect(req.analyticsUserId).to.exist;
      expect(req.analyticsUserId).to.be.a("string");
    });

    it("should handle ObjectId conversion to string", async () => {
      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          _id: { toString: () => "objectid123" },
          exp: Math.floor(Date.now() / 1000) + 3600,
        });
      });

      await enhancedJWTAuth(req, res, next);

      expect(req.analyticsUserId).to.equal("objectid123");
    });
  });

  describe("Logger Integration", () => {
    it("should log warnings when blocking JWT access", async () => {
      req.headers.authorization = "JWT validtoken123";
      req.originalUrl = "/api/v2/devices/events";

      await enhancedJWTAuth(req, res, next);

      expect(loggerStub.warn.calledOnce).to.be.true;
      expect(loggerStub.warn.firstCall.args[0]).to.include("JWT blocked");
    });

    it("should log errors for token refresh failures", async () => {
      req.headers.authorization = "JWT validtoken123";
      req.originalUrl = "/api/v2/users/profile";

      const REFRESH_WINDOW_SECONDS =
        constants.JWT_REFRESH_WINDOW_SECONDS || 600;
      const expiringTime =
        Math.floor(Date.now() / 1000) + REFRESH_WINDOW_SECONDS - 100;

      jwtVerifyStub.callsFake((token, secret, options, callback) => {
        callback(null, {
          _id: "user123",
          exp: expiringTime,
        });
      });

      tokenFactoryStub.returns({
        createToken: sinon.stub().rejects(new Error("Refresh failed")),
      });

      await enhancedJWTAuth(req, res, next);

      expect(loggerStub.error.called).to.be.true;
    });
  });
});
