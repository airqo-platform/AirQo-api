require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const { CookieStateStore } = require("@config/passport-strategies");

const SECRET = "test-secret-for-unit-tests-32bytes!!";
const COOKIE_NAME = "_oauth2_state_test";

describe("CookieStateStore", () => {
  let store;

  beforeEach(() => {
    store = new CookieStateStore({ secret: SECRET, cookieName: COOKIE_NAME });
  });

  afterEach(() => {
    sinon.restore();
  });

  function makeReq(cookies = {}) {
    return {
      cookies,
      res: {
        cookie: sinon.spy(),
        clearCookie: sinon.spy(),
      },
    };
  }

  // ── store() ─────────────────────────────────────────────────────────────────

  describe("store()", () => {
    it("generates a non-empty state and returns it via callback(null, state)", (done) => {
      const req = makeReq();
      store.store(req, undefined, {}, (err, state) => {
        expect(err).to.be.null;
        expect(state).to.be.a("string").with.length.greaterThan(0);
        done();
      });
    });

    it("sets the signed cookie whose value starts with the returned state", (done) => {
      const req = makeReq();
      store.store(req, undefined, {}, (err, state) => {
        expect(req.res.cookie.calledOnce).to.be.true;
        const [name, value] = req.res.cookie.firstCall.args;
        expect(name).to.equal(COOKIE_NAME);
        // Signed format is "state.hmac_signature" — value begins with the state
        expect(value).to.satisfy((v) => v.startsWith(state + "."));
        done();
      });
    });

    it("sets the cookie with httpOnly, sameSite=lax, and a positive maxAge", (done) => {
      const req = makeReq();
      store.store(req, undefined, {}, () => {
        const opts = req.res.cookie.firstCall.args[2];
        expect(opts.httpOnly).to.be.true;
        expect(opts.sameSite).to.equal("lax");
        expect(opts.maxAge).to.be.a("number").greaterThan(0);
        done();
      });
    });

    it("produces a different state on each call", (done) => {
      const req1 = makeReq();
      const req2 = makeReq();
      store.store(req1, undefined, {}, (err, state1) => {
        store.store(req2, undefined, {}, (err2, state2) => {
          expect(state1).to.not.equal(state2);
          done();
        });
      });
    });

    it("calls back with an error when req.res is absent", (done) => {
      const req = { cookies: {} };
      store.store(req, undefined, {}, (err) => {
        expect(err).to.be.an("error");
        expect(err.message).to.include("response object unavailable");
        done();
      });
    });
  });

  // ── verify() ────────────────────────────────────────────────────────────────

  describe("verify()", () => {
    // Helper: run store() against a fresh req and hand back the generated
    // state + the raw signed cookie value for use in verify() tests.
    function runStore(cb) {
      const req = makeReq();
      store.store(req, undefined, {}, (err, state) => {
        const [, signedCookie] = req.res.cookie.firstCall.args;
        cb(state, signedCookie);
      });
    }

    it("calls back with true and clears the cookie for a valid matching state", (done) => {
      runStore((state, signedCookie) => {
        const req = makeReq({ [COOKIE_NAME]: signedCookie });
        store.verify(req, state, {}, (err, ok) => {
          expect(err).to.be.null;
          expect(ok).to.be.true;
          expect(req.res.clearCookie.calledOnce).to.be.true;
          done();
        });
      });
    });

    it("calls back with false when the state cookie is missing", (done) => {
      store.verify(makeReq(), "any-state", {}, (err, ok, info) => {
        expect(err).to.be.null;
        expect(ok).to.be.false;
        expect(info).to.have.property("message");
        done();
      });
    });

    it("calls back with false when the cookie signature has been tampered with", (done) => {
      const req = makeReq({ [COOKIE_NAME]: "legitimate-state.invalidsignatureXXX" });
      store.verify(req, "legitimate-state", {}, (err, ok) => {
        expect(err).to.be.null;
        expect(ok).to.be.false;
        done();
      });
    });

    it("calls back with false when the URL state does not match the cookie state", (done) => {
      runStore((state, signedCookie) => {
        const req = makeReq({ [COOKIE_NAME]: signedCookie });
        store.verify(req, state + "-tampered", {}, (err, ok) => {
          expect(err).to.be.null;
          expect(ok).to.be.false;
          done();
        });
      });
    });
  });
});
