require("module-alias/register");

// Guard env vars that throw at require-time (cloudinary, session HMAC, log4js).
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-session-secret";
process.env.CLOUD_NAME = process.env.CLOUD_NAME || "test";
process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "test";
process.env.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "test";

const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();

// ---------------------------------------------------------------------------
// Load TwitterCookieTokenStore via proxyquire to avoid heavy transitive deps.
// passport-strategies.js requires @utils/social-auth.util which loads database
// models — stub everything that would trigger an outbound connection.
// ---------------------------------------------------------------------------

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

const { TwitterCookieTokenStore } = proxyquire("@config/passport-strategies", {
  "passport-google-oauth20": { Strategy: class {} },
  "passport-github2": { Strategy: class {} },
  "passport-oauth2": { Strategy: class {}, InternalOAuthError: class {} },
  "passport-linkedin-openidconnect": { Strategy: class {} },
  "@config/constants": {
    SESSION_SECRET: "test-session-secret",
    OAUTH_COOKIE_DOMAIN: ".airqo.net",
    DEFAULT_TENANT: "airqo",
    ENVIRONMENT: "TEST",
    TWITTER_CONSUMER_KEY: "tw-key",
    TWITTER_CONSUMER_SECRET: "tw-secret",
    ANALYTICS_BASE_URL: "https://analytics.airqo.net",
    PLATFORM_BASE_URL: "https://analytics.airqo.net",
  },
  "@utils/social-auth.util": { handleOAuthProfile: () => {} },
  "@utils/shared": { logObject: () => {} },
  "log4js": { getLogger: () => noopLogger },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore(overrides = {}) {
  return new TwitterCookieTokenStore({
    secret: "test-session-secret",
    cookieName: "_oauth1_tw",
    domain: ".airqo.net",
    ...overrides,
  });
}

function makeReq({ sessionOauth = null, cookies = {}, tenant = "airqo" } = {}) {
  const session = { oauthTenant: tenant };
  if (sessionOauth) session.oauth = sessionOauth;
  const res = {
    cookie: sinon.stub(),
    clearCookie: sinon.stub(),
  };
  return { session, cookies, res };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TwitterCookieTokenStore", () => {
  afterEach(() => sinon.restore());

  describe("constructor", () => {
    it("throws when secret is omitted", () => {
      expect(() => new TwitterCookieTokenStore({})).to.throw(
        "TwitterCookieTokenStore: secret is required",
      );
    });

    it("accepts optional domain and cookieName", () => {
      const store = new TwitterCookieTokenStore({
        secret: "s",
        cookieName: "_custom",
        domain: ".example.com",
      });
      expect(store._cookieName).to.equal("_custom");
      expect(store._domain).to.equal(".example.com");
    });
  });

  describe("set()", () => {
    it("sets HMAC-signed cookie with four base64url parts", (done) => {
      const store = makeStore();
      const req = makeReq();

      store.set(req, "mytoken", "mysecret", () => {
        expect(req.res.cookie.calledOnce).to.be.true;
        expect(req.res.cookie.args[0][0]).to.equal("_oauth1_tw");
        const val = req.res.cookie.args[0][1];
        expect(val.split(".").length).to.equal(4);
        done();
      });
    });

    it("mirrors token+secret to session.oauth", (done) => {
      const store = makeStore();
      const req = makeReq();

      store.set(req, "tok", "sec", () => {
        expect(req.session.oauth.oauth_token).to.equal("tok");
        expect(req.session.oauth.oauth_token_secret).to.equal("sec");
        done();
      });
    });

    it("applies domain to the cookie options", (done) => {
      const store = makeStore({ domain: ".airqo.net" });
      const req = makeReq();

      store.set(req, "t", "s", () => {
        const opts = req.res.cookie.args[0][2];
        expect(opts.domain).to.equal(".airqo.net");
        done();
      });
    });

    it("omits domain attribute when domain is not configured", (done) => {
      const store = makeStore({ domain: undefined });
      const req = makeReq();

      store.set(req, "t", "s", () => {
        const opts = req.res.cookie.args[0][2];
        expect(opts.domain).to.be.undefined;
        done();
      });
    });

    it("calls cb() even when req.res is absent", (done) => {
      const store = makeStore();
      const req = makeReq();
      delete req.res;

      store.set(req, "t", "s", done);
    });
  });

  describe("get() — session path", () => {
    it("returns secret from session without touching cookie", (done) => {
      const store = makeStore();
      const req = makeReq({
        sessionOauth: { oauth_token: "tok", oauth_token_secret: "sec" },
      });

      store.get(req, "tok", (err, secret) => {
        expect(err).to.be.null;
        expect(secret).to.equal("sec");
        done();
      });
    });

    it("falls through to error when session oauth_token mismatches callback token", (done) => {
      const store = makeStore();
      const req = makeReq({
        sessionOauth: { oauth_token: "tok-A", oauth_token_secret: "sec" },
        cookies: {},
      });

      store.get(req, "tok-B", (err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal("Failed to find request token in session");
        done();
      });
    });
  });

  describe("get() — cookie fallback (full round-trip)", () => {
    it("restores secret from a valid cookie when session is empty", (done) => {
      const store = makeStore();
      const setReq = makeReq({ tenant: "airqo" });

      store.set(setReq, "realtoken", "realsecret", () => {
        const signedCookie = setReq.res.cookie.args[0][1];
        const getReq = makeReq({ cookies: { _oauth1_tw: signedCookie } });

        store.get(getReq, "realtoken", (err, secret) => {
          expect(err).to.be.null;
          expect(secret).to.equal("realsecret");
          expect(getReq.session.oauth.oauth_token).to.equal("realtoken");
          expect(getReq.session.oauth.oauth_token_secret).to.equal("realsecret");
          expect(getReq.session.oauthTenant).to.equal("airqo");
          done();
        });
      });
    });

    it("returns error when cookie is absent and session has no oauth", (done) => {
      const store = makeStore();
      const req = makeReq({ cookies: {} });

      store.get(req, "tok", (err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal("Failed to find request token in session");
        done();
      });
    });

    it("returns error when cookie HMAC is tampered", (done) => {
      const store = makeStore();
      const setReq = makeReq();

      store.set(setReq, "tok", "sec", () => {
        const valid = setReq.res.cookie.args[0][1];
        const parts = valid.split(".");
        parts[0] = Buffer.from("tampered").toString("base64url");
        const tampered = parts.join(".");

        const getReq = makeReq({ cookies: { _oauth1_tw: tampered } });
        store.get(getReq, "tok", (err) => {
          expect(err).to.be.instanceOf(Error);
          done();
        });
      });
    });

    it("returns error when cookie token does not match requested token", (done) => {
      const store = makeStore();
      const setReq = makeReq();

      store.set(setReq, "token-A", "sec", () => {
        const signedCookie = setReq.res.cookie.args[0][1];
        const getReq = makeReq({ cookies: { _oauth1_tw: signedCookie } });

        store.get(getReq, "token-B", (err) => {
          expect(err).to.be.instanceOf(Error);
          done();
        });
      });
    });
  });

  describe("destroy()", () => {
    it("removes oauth keys from session and clears cookie", (done) => {
      const store = makeStore();
      const req = makeReq({
        sessionOauth: { oauth_token: "t", oauth_token_secret: "s" },
      });

      store.destroy(req, "t", () => {
        expect(req.session.oauth).to.be.undefined;
        expect(req.res.clearCookie.calledWith("_oauth1_tw")).to.be.true;
        done();
      });
    });

    it("calls cb() gracefully when session has no oauth key", (done) => {
      const store = makeStore();
      const req = makeReq();

      store.destroy(req, "t", done);
    });

    it("passes domain to clearCookie", (done) => {
      const store = makeStore({ domain: ".airqo.net" });
      const req = makeReq({
        sessionOauth: { oauth_token: "t", oauth_token_secret: "s" },
      });

      store.destroy(req, "t", () => {
        const opts = req.res.clearCookie.args[0][1];
        expect(opts.domain).to.equal(".airqo.net");
        done();
      });
    });

    it("completes without throwing when req.res is absent", (done) => {
      const store = makeStore();
      const req = makeReq({
        sessionOauth: { oauth_token: "t", oauth_token_secret: "s" },
      });
      delete req.res;

      store.destroy(req, "t", () => {
        expect(req.session.oauth).to.be.undefined;
        done();
      });
    });
  });
});
