require("module-alias/register");

// Guard env vars that throw at require-time (cloudinary, session HMAC, log4js).
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-session-secret";
process.env.CLOUD_NAME = process.env.CLOUD_NAME || "test";
process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "test";
process.env.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "test";

const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire");
const { HttpError } = require("@utils/shared");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockRes() {
  return {
    cookie: sinon.stub(),
    clearCookie: sinon.stub(),
  };
}

function makeInitiationReq(oauthEntry = { testtoken: "testsecret" }) {
  return {
    oauthProvider: "twitter",
    params: { provider: "twitter" },
    session: {
      oauth: oauthEntry,
      save: sinon.stub().callsFake((cb) => cb(null)),
    },
  };
}

function makeCallbackReq(cookieValue) {
  return {
    oauthProvider: "twitter",
    params: { provider: "twitter" },
    session: {},
    cookies: cookieValue ? { _oauth1_tw: cookieValue } : {},
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Twitter OAuth 1.0a Cookie Bridge", () => {
  let passportModule;
  let setupTwitterOAuthBridge;
  let restoreTwitterOAuthFromCookie;

  beforeEach(() => {
    const loggerStub = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
    };

    passportModule = proxyquire("@middleware/passport", {
      "@models/User": sinon.stub().returns({
        findById: sinon.stub().returns({ lean: sinon.stub().resolves({}) }),
      }),
      "@utils/common": {
        winstonLogger: loggerStub,
        mailer: {},
        stringify: sinon.stub(),
      },
      "@services/atf.service": {
        AbstractTokenFactory: sinon.stub().returns({
          createToken: sinon.stub().resolves("token"),
          _getEffectiveTokenStrategy: sinon
            .stub()
            .returns("NO_ROLES_AND_PERMISSIONS"),
        }),
      },
      "@utils/user.util": { getUser: sinon.stub().resolves({}) },
      "@utils/shared": {
        HttpError,
        logObject: sinon.stub(),
        logText: sinon.stub(),
        logElement: sinon.stub(),
        extractErrorsFromRequest: sinon.stub().returns(null),
      },
      jsonwebtoken: {
        verify: sinon.stub(),
        sign: sinon.stub(),
        "@noCallThru": true,
      },
    });

    setupTwitterOAuthBridge = passportModule.setupTwitterOAuthBridge;
    restoreTwitterOAuthFromCookie = passportModule.restoreTwitterOAuthFromCookie;
  });

  afterEach(() => {
    sinon.restore();
  });

  // ── setupTwitterOAuthBridge ────────────────────────────────────────────────

  describe("setupTwitterOAuthBridge", () => {
    it("is a no-op for non-twitter providers", () => {
      const next = sinon.stub();
      const req = { oauthProvider: "google", session: {}, params: {} };
      setupTwitterOAuthBridge(req, makeMockRes(), next);
      expect(next.calledOnce).to.be.true;
    });

    it("is a no-op when session is absent", () => {
      const next = sinon.stub();
      const req = { oauthProvider: "twitter", session: null, params: {} };
      setupTwitterOAuthBridge(req, makeMockRes(), next);
      expect(next.calledOnce).to.be.true;
    });

    it("calls next and wraps session.save for twitter", () => {
      const next = sinon.stub();
      const req = makeInitiationReq();
      setupTwitterOAuthBridge(req, makeMockRes(), next);
      expect(next.calledOnce).to.be.true;
      // save was replaced by the wrapper
      expect(req.session.save).to.not.equal(sinon.stub()); // wrapped, not the original
    });

    it("sets _oauth1_tw cookie with three-part base64url.base64url.sig value", () => {
      const next = sinon.stub();
      const saveCb = sinon.stub();
      const req = makeInitiationReq({ mytoken: "mysecret" });
      const res = makeMockRes();

      setupTwitterOAuthBridge(req, res, next);
      req.session.save(saveCb);

      expect(res.cookie.calledOnce).to.be.true;
      expect(res.cookie.args[0][0]).to.equal("_oauth1_tw");
      const cookieValue = res.cookie.args[0][1];
      expect(cookieValue).to.be.a("string");
      expect(cookieValue.split(".").length).to.equal(3);
    });

    it("calls the original session.save after setting the cookie", () => {
      const saveCb = sinon.stub();
      const req = makeInitiationReq();
      const originalSave = req.session.save;
      const res = makeMockRes();

      setupTwitterOAuthBridge(req, makeMockRes(), sinon.stub());
      req.session.save(saveCb);

      expect(originalSave.calledOnce).to.be.true;
      expect(saveCb.calledOnce).to.be.true;
    });

    it("does not set cookie when session has no oauth key", () => {
      const req = {
        oauthProvider: "twitter",
        params: { provider: "twitter" },
        session: {
          save: sinon.stub().callsFake((cb) => cb(null)),
        },
      };
      const res = makeMockRes();

      setupTwitterOAuthBridge(req, res, sinon.stub());
      req.session.save(() => {});

      expect(res.cookie.called).to.be.false;
    });
  });

  // ── restoreTwitterOAuthFromCookie ──────────────────────────────────────────

  describe("restoreTwitterOAuthFromCookie", () => {
    it("is a no-op for non-twitter providers", () => {
      const next = sinon.stub();
      const req = {
        oauthProvider: "linkedin",
        session: {},
        cookies: {},
        params: {},
      };
      restoreTwitterOAuthFromCookie(req, makeMockRes(), next);
      expect(next.calledOnce).to.be.true;
    });

    it("does not overwrite session.oauth when it is already present", () => {
      const next = sinon.stub();
      const existing = { tok: "sec" };
      const req = makeCallbackReq("somevalue");
      req.session.oauth = existing;
      const res = makeMockRes();

      restoreTwitterOAuthFromCookie(req, res, next);

      expect(req.session.oauth).to.deep.equal(existing);
      expect(res.clearCookie.calledWith("_oauth1_tw")).to.be.true;
      expect(next.calledOnce).to.be.true;
    });

    it("clears cookie and calls next when no cookie is present", () => {
      const next = sinon.stub();
      const req = makeCallbackReq(null);
      const res = makeMockRes();

      restoreTwitterOAuthFromCookie(req, res, next);

      expect(req.session.oauth).to.be.undefined;
      expect(res.clearCookie.calledWith("_oauth1_tw")).to.be.true;
      expect(next.calledOnce).to.be.true;
    });

    it("restores session.oauth from a valid cookie (full round-trip)", () => {
      // ── Initiation: generate signed cookie via setupTwitterOAuthBridge ──
      const initReq = makeInitiationReq({ realtoken: "realsecret" });
      const initRes = makeMockRes();
      setupTwitterOAuthBridge(initReq, initRes, sinon.stub());
      initReq.session.save(() => {});
      const signedCookie = initRes.cookie.args[0][1];

      // ── Callback: restore from that cookie ──
      const callbackReq = makeCallbackReq(signedCookie);
      const callbackRes = makeMockRes();
      const callbackNext = sinon.stub();

      restoreTwitterOAuthFromCookie(callbackReq, callbackRes, callbackNext);

      expect(callbackReq.session.oauth).to.deep.equal({
        realtoken: "realsecret",
      });
      expect(callbackRes.clearCookie.calledWith("_oauth1_tw")).to.be.true;
      expect(callbackNext.calledOnce).to.be.true;
    });

    it("does not restore when cookie payload is tampered", () => {
      const next = sinon.stub();
      // Generate a valid cookie then corrupt the payload portion
      const initReq = makeInitiationReq({ tok: "sec" });
      const initRes = makeMockRes();
      setupTwitterOAuthBridge(initReq, initRes, sinon.stub());
      initReq.session.save(() => {});
      const valid = initRes.cookie.args[0][1];
      const parts = valid.split(".");
      parts[0] = Buffer.from("tampered").toString("base64url");
      const tampered = parts.join(".");

      const req = makeCallbackReq(tampered);
      const res = makeMockRes();
      restoreTwitterOAuthFromCookie(req, res, next);

      expect(req.session.oauth).to.be.undefined;
      expect(res.clearCookie.calledWith("_oauth1_tw")).to.be.true;
      expect(next.calledOnce).to.be.true;
    });

    it("does not restore when cookie has a bad format", () => {
      const next = sinon.stub();
      const req = makeCallbackReq("not.a.valid.hmac.cookie.at.all");
      const res = makeMockRes();

      restoreTwitterOAuthFromCookie(req, res, next);

      expect(req.session.oauth).to.be.undefined;
      expect(res.clearCookie.calledWith("_oauth1_tw")).to.be.true;
      expect(next.calledOnce).to.be.true;
    });
  });
});
