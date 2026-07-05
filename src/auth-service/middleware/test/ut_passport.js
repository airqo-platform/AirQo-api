require("module-alias/register");

// Prevent the Cloudinary config guard from aborting module load in test env.
// Cloudinary is never used during tests; these values are dummies.
process.env.CLOUD_NAME = process.env.CLOUD_NAME || "test-cloud";
process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "test-key";
process.env.CLOUDINARY_API_SECRET =
  process.env.CLOUDINARY_API_SECRET || "test-secret";

const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire");
const rewire = require("rewire");
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
      log4js: {
        getLogger: sinon.stub().returns(loggerStub),
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

    it("should reject Bearer token format with 401", async () => {
      req.headers.authorization = "Bearer validtoken123";

      await enhancedJWTAuth(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.instanceOf(HttpError);
      expect(next.firstCall.args[0].message).to.equal("Unauthorized");
      expect(next.firstCall.args[0].errors.message).to.equal(
        "Invalid Authorization header format. Expected 'JWT <token>'",
      );
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
      req.headers.authorization = "JWT   ";

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

    it("should allow JWT access to /api/v2/devices/grids", async () => {
      req.originalUrl = "/api/v2/devices/grids";

      await enhancedJWTAuth(req, res, next);

      // Should NOT return an error - should proceed with JWT verification
      expect(jwtVerifyStub.calledOnce).to.be.true;
      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0]).to.be.undefined; // No error
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
      // The refresh path has two async hops (lean + createToken) before res.set
      // is reached; flush all pending microtasks before asserting.
      await new Promise((resolve) => setTimeout(resolve, 0));

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
      // Flush all pending microtasks so the async callback chain completes
      // before asserting (refresh failure + auth user lookup = multiple hops).
      await new Promise((resolve) => setTimeout(resolve, 0));

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
      // Flush microtasks so the async refresh-failure path completes.
      await new Promise((resolve) => setTimeout(resolve, 0));

      // The middleware uses logger.warn (not logger.error) for best-effort
      // refresh failures since the existing token is still valid.
      expect(loggerStub.warn.called).to.be.true;
    });
  });
});

describe("setGoogleAuth — redirect_after custom-scheme validation", () => {
  let setGoogleAuth;
  let req, res, next;
  let loggerStub;

  const HttpError = class extends Error {
    constructor(message, statusCode, errors) {
      super(message);
      this.statusCode = statusCode;
      this.errors = errors;
    }
  };

  const constantsStub = {
    ...constants,
    ANALYTICS_BASE_URL: "https://analytics.airqo.net",
    VERTEX_BASE_URL: "https://vertex.airqo.net",
    ALLOWED_REDIRECT_ORIGINS: "",
    ALLOWED_CUSTOM_SCHEME_PREFIXES: "vertex://,beacon://,dataflo://,analytics://",
    OAUTH_COOKIE_DOMAIN: "",
    ENVIRONMENT: "test",
  };

  before(() => {
    loggerStub = { warn: sinon.stub(), error: sinon.stub(), info: sinon.stub() };

    const mod = proxyquire("@middleware/passport", {
      "@models/User": sinon.stub(),
      "@models/AccessToken": sinon.stub(),
      "@models/Client": sinon.stub(),
      "@models/Permission": sinon.stub(),
      "@utils/common": {
        winstonLogger: loggerStub,
        mailer: {},
        stringify: sinon.stub(),
      },
      "@services/atf.service": { AbstractTokenFactory: sinon.stub() },
      "@utils/user.util": { _getEffectiveTokenStrategy: sinon.stub() },
      "@utils/shared": {
        HttpError,
        logObject: sinon.stub(),
        logText: sinon.stub(),
        logElement: sinon.stub(),
        extractErrorsFromRequest: sinon.stub().returns(null),
      },
      "@services/analytics.service": {},
      "@config/passport-strategies": { configureStrategies: sinon.stub() },
      "@config/constants": constantsStub,
      jsonwebtoken: {
        verify: sinon.stub(),
        sign: sinon.stub(),
        "@noCallThru": true,
      },
    });

    setGoogleAuth = mod.setGoogleAuth;
  });

  beforeEach(() => {
    req = { query: {}, session: {}, cookies: {} };
    res = { clearCookie: sinon.stub(), cookie: sinon.stub() };
    next = sinon.stub();
  });

  afterEach(() => sinon.restore());

  describe("custom-scheme allowlist", () => {
    it("sets the redirect cookie for an allowed custom scheme (vertex://login)", () => {
      req.query.redirect_after = "vertex://login";
      setGoogleAuth(req, res, next);
      expect(res.cookie.calledWith("_oauth_redirect_after", "vertex://login")).to.be.true;
    });

    it("sets the redirect cookie for a second allowed scheme (beacon://home)", () => {
      req.query.redirect_after = "beacon://home";
      setGoogleAuth(req, res, next);
      expect(res.cookie.calledWith("_oauth_redirect_after", "beacon://home")).to.be.true;
    });

    it("sets the redirect cookie for dataflo://auth", () => {
      req.query.redirect_after = "dataflo://auth";
      setGoogleAuth(req, res, next);
      expect(res.cookie.calledWith("_oauth_redirect_after", "dataflo://auth")).to.be.true;
    });

    it("sets the redirect cookie for analytics://home", () => {
      req.query.redirect_after = "analytics://home";
      setGoogleAuth(req, res, next);
      expect(res.cookie.calledWith("_oauth_redirect_after", "analytics://home")).to.be.true;
    });

    it("does not set the cookie for an unrecognised custom scheme (evil://hack)", () => {
      req.query.redirect_after = "evil://hack";
      setGoogleAuth(req, res, next);
      expect(res.cookie.called).to.be.false;
    });
  });

  describe("case-insensitive scheme matching", () => {
    it("sets the cookie for VERTEX://login (uppercase scheme)", () => {
      req.query.redirect_after = "VERTEX://login";
      setGoogleAuth(req, res, next);
      expect(res.cookie.calledWith("_oauth_redirect_after", "VERTEX://login")).to.be.true;
    });

    it("sets the cookie for Vertex://login (mixed-case scheme)", () => {
      req.query.redirect_after = "Vertex://login";
      setGoogleAuth(req, res, next);
      expect(res.cookie.calledWith("_oauth_redirect_after", "Vertex://login")).to.be.true;
    });
  });

  describe("http/https origin checks are unaffected (regression guard)", () => {
    it("sets the cookie for an allowed https origin", () => {
      req.query.redirect_after = "https://analytics.airqo.net/dashboard";
      setGoogleAuth(req, res, next);
      expect(
        res.cookie.calledWith("_oauth_redirect_after", "https://analytics.airqo.net/dashboard")
      ).to.be.true;
    });

    it("does not set the cookie for an https URL not in the allowed origins", () => {
      req.query.redirect_after = "https://evil.com/phish";
      setGoogleAuth(req, res, next);
      expect(res.cookie.called).to.be.false;
    });
  });

  describe("edge cases", () => {
    it("does not set the cookie when redirect_after is absent", () => {
      setGoogleAuth(req, res, next);
      expect(res.cookie.called).to.be.false;
    });
  });
});
