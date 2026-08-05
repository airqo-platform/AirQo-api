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
const constants = require("@config/constants");

const HttpError = class extends Error {
  constructor(message, statusCode, errors) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
};

const constantsStub = {
  ...constants,
  NEXUS_BASE_URL: "https://nexus.airqo.net",
  VERTEX_BASE_URL: "https://vertex.airqo.net",
  ALLOWED_REDIRECT_ORIGINS: "",
  ALLOWED_CUSTOM_SCHEME_PREFIXES: "vertex://,beacon://,airqo://",
  OAUTH_COOKIE_DOMAIN: "",
  GMAIL_VERIFICATION_SUCCESS_REDIRECT: "https://nexus.airqo.net",
  GMAIL_VERIFICATION_FAILURE_REDIRECT: "https://nexus.airqo.net/user/login",
  DEFAULT_TENANT: "airqo",
  ENVIRONMENT: "test",
};

describe("googleCallback — custom-scheme redirect_after validation", () => {
  let userController;
  let req, res, next;
  const FAKE_TOKEN = "fake-jwt-token-abc123";

  before(() => {
    const fakeUser = {
      _id: "user123",
      email: "test@example.com",
      toAuthJSON: sinon.stub().resolves({ token: FAKE_TOKEN }),
    };

    const userModelStub = sinon.stub().returns({
      findById: sinon.stub().resolves(fakeUser),
      findByIdAndUpdate: sinon.stub().resolves(),
    });

    const userUtilStub = {
      ensureDefaultAirqoRole: sinon.stub().resolves(),
      _getEffectiveTokenStrategy: sinon.stub(),
    };

    userController = proxyquire("@controllers/user.controller", {
      "@models/User": userModelStub,
      "@utils/user.util": userUtilStub,
      "@utils/shared": {
        HttpError,
        logObject: sinon.stub(),
        logText: sinon.stub(),
        logElement: sinon.stub(),
        stringify: sinon.stub().returns(""),
        extractErrorsFromRequest: sinon.stub().returns(null),
      },
      "@services/analytics.service": { track: sinon.stub() },
      "@services/atf.service": { AbstractTokenFactory: sinon.stub() },
      "@utils/token.util": {},
      "@config/constants": constantsStub,
    });
  });

  beforeEach(() => {
    req = {
      query: { tenant: "airqo" },
      body: {},
      cookies: {},
      session: {},
      user: {
        _id: "user123",
        email: "test@example.com",
        analyticsVersion: 3,
        verified: true,
      },
    };
    res = {
      clearCookie: sinon.stub(),
      cookie: sinon.stub(),
      redirect: sinon.stub(),
      headersSent: false,
    };
    next = sinon.stub();
  });

  afterEach(() => sinon.restore());

  describe("custom-scheme allowlist", () => {
    it("redirects to vertex:// deep-link when cookie is vertex://login", async () => {
      req.cookies._oauth_redirect_after = "vertex://login";
      await userController.googleCallback(req, res, next);
      expect(res.redirect.calledOnce).to.be.true;
      expect(res.redirect.firstCall.args[0]).to.match(/^vertex:\/\//);
    });

    it("redirect URL contains the token hash for vertex:// deep-link", async () => {
      req.cookies._oauth_redirect_after = "vertex://login";
      await userController.googleCallback(req, res, next);
      expect(res.redirect.firstCall.args[0]).to.include("#token=");
    });

    it("redirects to beacon:// deep-link when cookie is beacon://home", async () => {
      req.cookies._oauth_redirect_after = "beacon://home";
      await userController.googleCallback(req, res, next);
      expect(res.redirect.firstCall.args[0]).to.match(/^beacon:\/\//);
    });

    it("redirects to airqo:// deep-link when cookie is airqo://oauth", async () => {
      req.cookies._oauth_redirect_after = "airqo://oauth";
      await userController.googleCallback(req, res, next);
      expect(res.redirect.calledOnce).to.be.true;
      expect(res.redirect.firstCall.args[0]).to.match(/^airqo:\/\//);
      expect(res.redirect.firstCall.args[0]).to.include("#token=");
    });

    it("falls back to analytics URL for an unrecognised scheme (evil://hack)", async () => {
      req.cookies._oauth_redirect_after = "evil://hack";
      await userController.googleCallback(req, res, next);
      expect(res.redirect.firstCall.args[0]).to.include("nexus.airqo.net");
      expect(res.redirect.firstCall.args[0]).not.to.match(/^evil:\/\//);
    });

    it("falls back to analytics URL when no redirect cookie is present", async () => {
      await userController.googleCallback(req, res, next);
      expect(res.redirect.firstCall.args[0]).to.include("nexus.airqo.net");
    });
  });

  describe("case-insensitive scheme matching", () => {
    it("accepts VERTEX://login (uppercase) and redirects to it", async () => {
      req.cookies._oauth_redirect_after = "VERTEX://login";
      await userController.googleCallback(req, res, next);
      expect(res.redirect.firstCall.args[0]).to.match(/^VERTEX:\/\//i);
      expect(res.redirect.firstCall.args[0]).to.include("#token=");
    });

    it("accepts Beacon://home (mixed-case) and redirects to it", async () => {
      req.cookies._oauth_redirect_after = "Beacon://home";
      await userController.googleCallback(req, res, next);
      expect(res.redirect.firstCall.args[0]).to.match(/^Beacon:\/\//i);
    });
  });

  describe("http/https origin checks are unaffected (regression guard)", () => {
    it("redirects to the allowed https origin with token hash", async () => {
      req.cookies._oauth_redirect_after = "https://nexus.airqo.net/dashboard";
      await userController.googleCallback(req, res, next);
      expect(res.redirect.firstCall.args[0]).to.include("nexus.airqo.net");
      expect(res.redirect.firstCall.args[0]).to.include("#token=");
    });

    it("falls back to default when https URL is not in the allowed origins", async () => {
      req.cookies._oauth_redirect_after = "https://evil.com/phish";
      await userController.googleCallback(req, res, next);
      expect(res.redirect.firstCall.args[0]).to.include("nexus.airqo.net");
      expect(res.redirect.firstCall.args[0]).not.to.include("evil.com");
    });
  });
});

describe("googleCallback — custom-scheme allowlist default fallback", () => {
  let userControllerWithDefaultSchemes;
  let req, res, next;
  const FAKE_TOKEN = "fake-jwt-token-default";

  before(() => {
    const fakeUser = {
      _id: "user456",
      email: "default@example.com",
      toAuthJSON: sinon.stub().resolves({ token: FAKE_TOKEN }),
    };

    const userModelStub = sinon.stub().returns({
      findById: sinon.stub().resolves(fakeUser),
      findByIdAndUpdate: sinon.stub().resolves(),
    });

    const userUtilStub = {
      ensureDefaultAirqoRole: sinon.stub().resolves(),
      _getEffectiveTokenStrategy: sinon.stub(),
    };

    // Omit ALLOWED_CUSTOM_SCHEME_PREFIXES entirely so the code falls through
    // to its hardcoded default of "vertex://,airqo://".
    const constantsStubNoSchemes = {
      ...constants,
      NEXUS_BASE_URL: "https://nexus.airqo.net",
      VERTEX_BASE_URL: "https://vertex.airqo.net",
      ALLOWED_REDIRECT_ORIGINS: "",
      ALLOWED_CUSTOM_SCHEME_PREFIXES: undefined,
      OAUTH_COOKIE_DOMAIN: "",
      GMAIL_VERIFICATION_SUCCESS_REDIRECT: "https://nexus.airqo.net",
      GMAIL_VERIFICATION_FAILURE_REDIRECT: "https://nexus.airqo.net/user/login",
      DEFAULT_TENANT: "airqo",
      ENVIRONMENT: "test",
    };

    userControllerWithDefaultSchemes = proxyquire("@controllers/user.controller", {
      "@models/User": userModelStub,
      "@utils/user.util": userUtilStub,
      "@utils/shared": {
        HttpError: class extends Error {
          constructor(message, statusCode, errors) {
            super(message);
            this.statusCode = statusCode;
            this.errors = errors;
          }
        },
        logObject: sinon.stub(),
        logText: sinon.stub(),
        logElement: sinon.stub(),
        stringify: sinon.stub().returns(""),
        extractErrorsFromRequest: sinon.stub().returns(null),
      },
      "@services/analytics.service": { track: sinon.stub() },
      "@services/atf.service": { AbstractTokenFactory: sinon.stub() },
      "@utils/token.util": {},
      "@config/constants": constantsStubNoSchemes,
    });
  });

  beforeEach(() => {
    req = {
      query: { tenant: "airqo" },
      body: {},
      cookies: {},
      session: {},
      user: {
        _id: "user456",
        email: "default@example.com",
        analyticsVersion: 3,
        verified: true,
      },
    };
    res = {
      clearCookie: sinon.stub(),
      cookie: sinon.stub(),
      redirect: sinon.stub(),
      headersSent: false,
    };
    next = sinon.stub();
  });

  afterEach(() => sinon.restore());

  it("accepts airqo://oauth when ALLOWED_CUSTOM_SCHEME_PREFIXES is unset (default fallback)", async () => {
    req.cookies._oauth_redirect_after = "airqo://oauth";
    await userControllerWithDefaultSchemes.googleCallback(req, res, next);
    expect(res.redirect.calledOnce).to.be.true;
    expect(res.redirect.firstCall.args[0]).to.match(/^airqo:\/\//);
    expect(res.redirect.firstCall.args[0]).to.include("#token=");
  });

  it("accepts vertex://login when ALLOWED_CUSTOM_SCHEME_PREFIXES is unset (default fallback)", async () => {
    req.cookies._oauth_redirect_after = "vertex://login";
    await userControllerWithDefaultSchemes.googleCallback(req, res, next);
    expect(res.redirect.calledOnce).to.be.true;
    expect(res.redirect.firstCall.args[0]).to.match(/^vertex:\/\//);
    expect(res.redirect.firstCall.args[0]).to.include("#token=");
  });

  it("still rejects evil:// when ALLOWED_CUSTOM_SCHEME_PREFIXES is unset", async () => {
    req.cookies._oauth_redirect_after = "evil://hack";
    await userControllerWithDefaultSchemes.googleCallback(req, res, next);
    expect(res.redirect.firstCall.args[0]).to.include("nexus.airqo.net");
    expect(res.redirect.firstCall.args[0]).not.to.match(/^evil:\/\//);
  });
});
