require("module-alias/register");
const chai = require("chai");
const chaiHttp = require("chai-http");
const { expect } = chai;
chai.use(chaiHttp);
const sinon = require("sinon");
const proxyquire = require("proxyquire");
const supertest = require("supertest");
const express = require("express");
const { HttpError } = require("@utils/shared");

// ─── Why proxyquire + stable wrapper functions ──────────────────────────────
// Express captures each route handler by reference at router-registration
// time (which happens once, when this router is required), so reassigning
// `createTokenController.list` etc. from inside a test has no effect on
// already-registered routes. Instead we register stable wrapper functions
// that delegate to a per-test-mutable variable, and stub `enhancedJWTAuth`
// (which otherwise requires a real JWT and would 401 every request) to
// always call next(). Every method tokens.routes.js references on the
// controller must exist on the stub (even ones this file doesn't exercise),
// or Express throws "requires a callback function but got a
// [object Undefined]" the moment the router is registered.
let listImpl;
let listExpiredImpl;
let listExpiringImpl;
let listUnknownIPsImpl;
let createImpl;
let regenerateImpl;
let deleteImpl;
let verifyImpl;
let blackListIpImpl;
let blackListIpsImpl;
let removeBlacklistedIpImpl;
let listBlacklistedIpImpl;
let blackListIpRangeImpl;
let bulkInsertBlacklistIpRangesImpl;
let removeBlacklistedIpRangeImpl;
let listBlacklistedIpRangeImpl;
let whiteListIpImpl;
let bulkWhiteListIpsImpl;
let removeWhitelistedIpImpl;
let listWhitelistedIpImpl;
let ipPrefixImpl;
let bulkInsertIpPrefixImpl;
let removeIpPrefixImpl;
let listIpPrefixImpl;
let blackListIpPrefixImpl;
let bulkInsertBlacklistIpPrefixImpl;
let removeBlacklistedIpPrefixImpl;
let listBlacklistedIpPrefixImpl;

// Placeholder for controller methods this file does not exercise (they are
// behind admin-only / DB-backed middleware — @middleware/adminAccess's
// requireSystemAdmin() — that is out of scope for this route-wiring test).
// They still need to be real functions so route registration doesn't throw.
const notImplemented = (req, res) => res.status(200).json({});

const tokenControllerStub = {
  list: (req, res) => listImpl(req, res),
  listExpired: (req, res) => listExpiredImpl(req, res),
  listExpiring: (req, res) => listExpiringImpl(req, res),
  listUnknownIPs: (req, res) => listUnknownIPsImpl(req, res),
  create: (req, res) => createImpl(req, res),
  regenerate: (req, res) => regenerateImpl(req, res),
  update: notImplemented,
  delete: (req, res) => deleteImpl(req, res),
  verify: (req, res) => verifyImpl(req, res),
  blackListIp: (req, res) => blackListIpImpl(req, res),
  blackListIps: (req, res) => blackListIpsImpl(req, res),
  removeBlacklistedIp: (req, res) => removeBlacklistedIpImpl(req, res),
  listBlacklistedIp: (req, res) => listBlacklistedIpImpl(req, res),
  blackListIpRange: (req, res) => blackListIpRangeImpl(req, res),
  bulkInsertBlacklistIpRanges: (req, res) =>
    bulkInsertBlacklistIpRangesImpl(req, res),
  removeBlacklistedIpRange: (req, res) => removeBlacklistedIpRangeImpl(req, res),
  listBlacklistedIpRange: (req, res) => listBlacklistedIpRangeImpl(req, res),
  getWhitelistedIPStats: notImplemented,
  whiteListIp: (req, res) => whiteListIpImpl(req, res),
  bulkWhiteListIps: (req, res) => bulkWhiteListIpsImpl(req, res),
  removeWhitelistedIp: (req, res) => removeWhitelistedIpImpl(req, res),
  listWhitelistedIp: (req, res) => listWhitelistedIpImpl(req, res),
  blackListIpPrefix: (req, res) => blackListIpPrefixImpl(req, res),
  bulkInsertBlacklistIpPrefix: (req, res) =>
    bulkInsertBlacklistIpPrefixImpl(req, res),
  removeBlacklistedIpPrefix: (req, res) =>
    removeBlacklistedIpPrefixImpl(req, res),
  listBlacklistedIpPrefix: (req, res) => listBlacklistedIpPrefixImpl(req, res),
  ipPrefix: (req, res) => ipPrefixImpl(req, res),
  bulkInsertIpPrefix: (req, res) => bulkInsertIpPrefixImpl(req, res),
  removeIpPrefix: (req, res) => removeIpPrefixImpl(req, res),
  listIpPrefix: (req, res) => listIpPrefixImpl(req, res),
  getBotLikeIPStats: notImplemented,
  createBlockedDomain: notImplemented,
  listBlockedDomains: notImplemented,
  removeBlockedDomain: notImplemented,
  createBlockedASN: notImplemented,
  listBlockedASNs: notImplemented,
  deleteBlockedASN: notImplemented,
  listFlaggedTokens: notImplemented,
  resolveFlaggedToken: notImplemented,
  listBypassedTokens: notImplemented,
  honeypotFlag: notImplemented,
};

const passportStub = {
  enhancedJWTAuth: (req, res, next) => next(),
};

const router = proxyquire("@routes/v2/tokens.routes", {
  "@controllers/token.controller": tokenControllerStub,
  "@middleware/passport": passportStub,
});

describe("Tokens Router API Tests", () => {
  let app;
  let request;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/", router);

    // token.validators.js's dual-purpose validators (validateTenant,
    // validateTokenParam, validateTokenCreate, validateSingleIp, etc.) are
    // plain middleware — not express-validator chains wired through the
    // shared `validate` step used elsewhere — so on failure they call
    // `next(new HttpError(...))` directly rather than responding
    // themselves. Without an error-handling middleware here that error
    // would fall through to Express's default HTML error page (confirmed:
    // response.body is `{}`, content-type text/html) instead of the JSON
    // body real clients get. This mirrors the relevant branch of the real
    // handler in bin/server.js so validation-failure assertions below
    // reflect actual production behaviour.
    app.use((err, req, res, next) => {
      if (err instanceof HttpError) {
        return res.status(err.statusCode).json({
          success: false,
          message: err.message,
          errors: err.errors,
        });
      }
      return res.status(err.status || err.statusCode || 500).json({
        success: false,
        message: "Internal Server Error",
      });
    });

    request = supertest(app);
  });

  afterEach(() => {
    sinon.restore();
  });

  const AUTH_HEADER = "JWT valid-token";
  const VALID_MONGO_ID = "60d21b4667d0d8992e610c85";

  describe("GET /", () => {
    it("should list all tokens", async () => {
      const fakeTokens = [{ _id: "t1" }, { _id: "t2" }];
      listImpl = (req, res) => res.status(200).json({ tokens: fakeTokens });

      const response = await request
        .get("/")
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      expect(response.body.tokens).to.deep.equal(fakeTokens);
    });

    it("should return a 400 error for an invalid tenant", async () => {
      listImpl = (req, res) => res.status(200).json({ tokens: [] });

      // validateTenant runs before enhancedJWTAuth on this route, so the
      // request never reaches the (stubbed) controller.
      const response = await request
        .get("/")
        .query({ tenant: "invalid-tenant" })
        .set("Authorization", AUTH_HEADER)
        .expect(400);

      expect(response.body.message).to.equal("Validation Error");
      expect(response.body.errors[0].message).to.equal(
        "the tenant value is not among the expected ones"
      );
    });
  });

  describe("GET /expired", () => {
    it("should list expired tokens", async () => {
      listExpiredImpl = (req, res) => res.status(200).json({ tokens: [] });

      const response = await request
        .get("/expired")
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      expect(response.body.tokens).to.be.an("array");
    });
  });

  describe("GET /expiring", () => {
    it("should list expiring tokens", async () => {
      listExpiringImpl = (req, res) => res.status(200).json({ tokens: [] });

      const response = await request
        .get("/expiring")
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      expect(response.body.tokens).to.be.an("array");
    });
  });

  describe("GET /unknown-ip", () => {
    it("should list tokens with unknown IPs", async () => {
      listUnknownIPsImpl = (req, res) => res.status(200).json({ tokens: [] });

      const response = await request
        .get("/unknown-ip")
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      expect(response.body.tokens).to.be.an("array");
    });
  });

  describe("POST /", () => {
    it("should create a new token", async () => {
      const fakeToken = { _id: "fake-id", name: "My Token" };
      createImpl = (req, res) =>
        res.status(201).json({ created_token: fakeToken });

      const response = await request
        .post("/")
        .send({ name: "My Token" })
        .set("Authorization", AUTH_HEADER)
        .expect(201);

      expect(response.body.created_token).to.deep.equal(fakeToken);
    });

    it("should return a 400 error when name is missing", async () => {
      createImpl = (req, res) => res.status(201).json({ created_token: {} });

      // validateTokenCreate runs before enhancedJWTAuth, so this never
      // reaches the (stubbed) controller.
      const response = await request
        .post("/")
        .send({})
        .set("Authorization", AUTH_HEADER)
        .expect(400);

      expect(response.body.errors[0].message).to.equal(
        "the name is missing in your request"
      );
    });
  });

  describe("PUT /:token/regenerate", () => {
    it("should regenerate a token", async () => {
      regenerateImpl = (req, res) =>
        res.status(200).json({ regenerated_token: { _id: "fake-id" } });

      const response = await request
        .put("/sample-token-value/regenerate")
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      expect(response.body.regenerated_token).to.have.property("_id");
    });

    it("should return a 400 error for a non-boolean bypass flag", async () => {
      regenerateImpl = (req, res) => res.status(200).json({});

      // On this route validateTokenUpdate runs before enhancedJWTAuth (see
      // routes/v2/tokens.routes.js), so this never reaches the controller.
      const response = await request
        .put("/sample-token-value/regenerate")
        .send({ bypass_anomaly_detection: "yes" })
        .set("Authorization", AUTH_HEADER)
        .expect(400);

      expect(response.body.errors[0].message).to.equal(
        "bypass_anomaly_detection must be a boolean"
      );
    });
  });

  describe("DELETE /:token", () => {
    it("should delete a token", async () => {
      deleteImpl = (req, res) => res.status(204).end();

      await request
        .delete("/sample-token-value")
        .set("Authorization", AUTH_HEADER)
        .expect(204);
    });
  });

  describe("GET /:token/verify", () => {
    it("should verify a token", async () => {
      verifyImpl = (req, res) =>
        res.status(200).json({ valid: true, token: req.params.token });

      const response = await request
        .get("/sample-token-value/verify")
        .expect(200);

      expect(response.body.valid).to.equal(true);
    });

    it("should return a 400 error for an invalid tenant", async () => {
      verifyImpl = (req, res) => res.status(200).json({ valid: true });

      const response = await request
        .get("/sample-token-value/verify")
        .query({ tenant: "invalid-tenant" })
        .expect(400);

      expect(response.body.errors[0].message).to.equal(
        "the tenant value is not among the expected ones"
      );
    });
  });

  describe("GET /:token", () => {
    it("should return token information", async () => {
      listImpl = (req, res) =>
        res.status(200).json({ tokens: [{ _id: "fake-id" }] });

      const response = await request
        .get("/sample-token-value")
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      expect(response.body.tokens).to.be.an("array");
    });
  });

  describe("POST /blacklist-ip", () => {
    it("should blacklist a single IP", async () => {
      blackListIpImpl = (req, res) =>
        res.status(200).json({ blacklisted_ip: { ip: req.body.ip } });

      const response = await request
        .post("/blacklist-ip")
        .send({ ip: "192.168.1.1" })
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      expect(response.body.blacklisted_ip.ip).to.equal("192.168.1.1");
    });

    it("should return a 400 error when the ip is missing", async () => {
      blackListIpImpl = (req, res) => res.status(200).json({});

      const response = await request
        .post("/blacklist-ip")
        .send({})
        .set("Authorization", AUTH_HEADER)
        .expect(400);

      expect(response.body.errors[0].message).to.equal(
        "the ip is missing in your request body"
      );
    });
  });

  describe("POST /blacklist-ips", () => {
    it("should blacklist multiple IPs", async () => {
      blackListIpsImpl = (req, res) =>
        res.status(200).json({ blacklisted_ips: req.body.ips });

      const response = await request
        .post("/blacklist-ips")
        .send({ ips: ["192.168.1.1", "192.168.1.2"] })
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      expect(response.body.blacklisted_ips).to.deep.equal([
        "192.168.1.1",
        "192.168.1.2",
      ]);
    });

    it("should return a 400 error when ips is not an array", async () => {
      blackListIpsImpl = (req, res) => res.status(200).json({});

      const response = await request
        .post("/blacklist-ips")
        .send({ ips: "not-an-array" })
        .set("Authorization", AUTH_HEADER)
        .expect(400);

      expect(response.body.errors[0].message).to.equal(
        "the ips should be an array"
      );
    });
  });

  describe("DELETE /blacklist-ip/:ip", () => {
    it("should remove a blacklisted IP", async () => {
      removeBlacklistedIpImpl = (req, res) => res.status(204).end();

      await request
        .delete("/blacklist-ip/192.168.1.1")
        .set("Authorization", AUTH_HEADER)
        .expect(204);
    });
  });

  describe("GET /blacklist-ip", () => {
    it("should list blacklisted IPs", async () => {
      listBlacklistedIpImpl = (req, res) =>
        res.status(200).json({ blacklisted_ips: [] });

      const response = await request
        .get("/blacklist-ip")
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      expect(response.body.blacklisted_ips).to.be.an("array");
    });
  });

  describe("POST /blacklist-ip-range", () => {
    it("should blacklist an IP range", async () => {
      blackListIpRangeImpl = (req, res) =>
        res.status(200).json({ blacklisted_range: { range: req.body.range } });

      const response = await request
        .post("/blacklist-ip-range")
        .send({ range: "192.168.0.0-192.168.255.255" })
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      expect(response.body.blacklisted_range.range).to.equal(
        "192.168.0.0-192.168.255.255"
      );
    });
  });

  describe("POST /blacklist-ip-range/bulk", () => {
    it("should bulk insert blacklisted IP ranges", async () => {
      bulkInsertBlacklistIpRangesImpl = (req, res) =>
        res.status(200).json({ blacklisted_ranges: req.body.ranges });

      const response = await request
        .post("/blacklist-ip-range/bulk")
        .send({
          ranges: [
            "192.168.0.0-192.168.255.255",
            "10.0.0.0-10.255.255.255",
          ],
        })
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      expect(response.body.blacklisted_ranges).to.have.lengthOf(2);
    });

    it("should return a 400 error when ranges is not an array", async () => {
      bulkInsertBlacklistIpRangesImpl = (req, res) => res.status(200).json({});

      const response = await request
        .post("/blacklist-ip-range/bulk")
        .send({ ranges: "not-an-array" })
        .set("Authorization", AUTH_HEADER)
        .expect(400);

      expect(response.body.errors[0].message).to.equal(
        "the ranges should be an array"
      );
    });
  });

  describe("DELETE /blacklist-ip-range/:id", () => {
    it("should remove a blacklisted IP range", async () => {
      removeBlacklistedIpRangeImpl = (req, res) => res.status(204).end();

      await request
        .delete(`/blacklist-ip-range/${VALID_MONGO_ID}`)
        .set("Authorization", AUTH_HEADER)
        .expect(204);
    });

    it("should return a 400 error for a malformed id", async () => {
      removeBlacklistedIpRangeImpl = (req, res) => res.status(204).end();

      // validateIpRangeIdParam is a plain regex-based check (not an
      // express-validator isMongoId()+customSanitizer chain), so a
      // malformed, non-empty id fails cleanly instead of throwing.
      const response = await request
        .delete("/blacklist-ip-range/not-a-valid-id")
        .set("Authorization", AUTH_HEADER)
        .expect(400);

      expect(response.body.errors[0].message).to.equal(
        "the id must be an object ID"
      );
    });
  });

  describe("GET /blacklist-ip-range", () => {
    it("should list blacklisted IP ranges", async () => {
      listBlacklistedIpRangeImpl = (req, res) =>
        res.status(200).json({ blacklisted_ranges: [] });

      const response = await request
        .get("/blacklist-ip-range")
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      expect(response.body.blacklisted_ranges).to.be.an("array");
    });
  });

  describe("POST /whitelist-ip", () => {
    it("should whitelist a single IP", async () => {
      whiteListIpImpl = (req, res) =>
        res.status(200).json({ whitelisted_ip: { ip: req.body.ip } });

      const response = await request
        .post("/whitelist-ip")
        .send({ ip: "192.168.1.1" })
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      expect(response.body.whitelisted_ip.ip).to.equal("192.168.1.1");
    });
  });

  describe("POST /bulk-whitelist-ip", () => {
    it("should bulk whitelist IPs", async () => {
      bulkWhiteListIpsImpl = (req, res) =>
        res.status(200).json({ whitelisted_ips: req.body.ips });

      const response = await request
        .post("/bulk-whitelist-ip")
        .send({ ips: ["192.168.1.1", "192.168.1.2"] })
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      expect(response.body.whitelisted_ips).to.have.lengthOf(2);
    });
  });

  describe("DELETE /whitelist-ip/:ip", () => {
    it("should remove a whitelisted IP", async () => {
      removeWhitelistedIpImpl = (req, res) => res.status(204).end();

      await request
        .delete("/whitelist-ip/192.168.1.1")
        .set("Authorization", AUTH_HEADER)
        .expect(204);
    });
  });

  describe("GET /whitelist-ip", () => {
    it("should list whitelisted IPs", async () => {
      listWhitelistedIpImpl = (req, res) =>
        res.status(200).json({ whitelisted_ips: [] });

      const response = await request
        .get("/whitelist-ip")
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      expect(response.body.whitelisted_ips).to.be.an("array");
    });
  });

  describe("POST /ip-prefix", () => {
    it("should add an IP prefix", async () => {
      ipPrefixImpl = (req, res) =>
        res.status(201).json({ ip_prefix: { prefix: req.body.prefix } });

      const response = await request
        .post("/ip-prefix")
        .send({ prefix: "/24" })
        .set("Authorization", AUTH_HEADER)
        .expect(201);

      expect(response.body.ip_prefix.prefix).to.equal("/24");
    });

    it("should return a 400 error when the prefix is missing", async () => {
      ipPrefixImpl = (req, res) => res.status(201).json({});

      const response = await request
        .post("/ip-prefix")
        .send({})
        .set("Authorization", AUTH_HEADER)
        .expect(400);

      expect(response.body.errors[0].message).to.equal(
        "the prefix is missing in your request body"
      );
    });
  });

  describe("POST /ip-prefix/bulk", () => {
    it("should bulk add IP prefixes", async () => {
      bulkInsertIpPrefixImpl = (req, res) =>
        res.status(201).json({ ip_prefixes: req.body.prefixes });

      const response = await request
        .post("/ip-prefix/bulk")
        .send({ prefixes: ["/24", "/16"] })
        .set("Authorization", AUTH_HEADER)
        .expect(201);

      expect(response.body.ip_prefixes).to.have.lengthOf(2);
    });
  });

  describe("DELETE /ip-prefix/:id", () => {
    it("should remove an IP prefix", async () => {
      removeIpPrefixImpl = (req, res) => res.status(204).end();

      await request
        .delete(`/ip-prefix/${VALID_MONGO_ID}`)
        .set("Authorization", AUTH_HEADER)
        .expect(204);
    });
  });

  describe("GET /ip-prefix", () => {
    it("should list IP prefixes", async () => {
      listIpPrefixImpl = (req, res) =>
        res.status(200).json({ ip_prefixes: [] });

      const response = await request
        .get("/ip-prefix")
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      expect(response.body.ip_prefixes).to.be.an("array");
    });
  });

  describe("POST /blacklist-ip-prefix", () => {
    it("should blacklist an IP prefix", async () => {
      blackListIpPrefixImpl = (req, res) =>
        res
          .status(201)
          .json({ blacklisted_prefix: { prefix: req.body.prefix } });

      const response = await request
        .post("/blacklist-ip-prefix")
        .send({ prefix: "/24" })
        .set("Authorization", AUTH_HEADER)
        .expect(201);

      expect(response.body.blacklisted_prefix.prefix).to.equal("/24");
    });
  });

  describe("POST /blacklist-ip-prefix/bulk", () => {
    it("should bulk insert blacklisted IP prefixes", async () => {
      bulkInsertBlacklistIpPrefixImpl = (req, res) =>
        res.status(201).json({ blacklisted_prefixes: req.body.prefixes });

      const response = await request
        .post("/blacklist-ip-prefix/bulk")
        .send({ prefixes: ["/24", "/16"] })
        .set("Authorization", AUTH_HEADER)
        .expect(201);

      expect(response.body.blacklisted_prefixes).to.have.lengthOf(2);
    });
  });

  describe("DELETE /blacklist-ip-prefix/:id", () => {
    it("should remove a blacklisted IP prefix", async () => {
      removeBlacklistedIpPrefixImpl = (req, res) => res.status(204).end();

      await request
        .delete(`/blacklist-ip-prefix/${VALID_MONGO_ID}`)
        .set("Authorization", AUTH_HEADER)
        .expect(204);
    });
  });

  describe("GET /blacklist-ip-prefix", () => {
    it("should list blacklisted IP prefixes", async () => {
      listBlacklistedIpPrefixImpl = (req, res) =>
        res.status(200).json({ blacklisted_prefixes: [] });

      const response = await request
        .get("/blacklist-ip-prefix")
        .set("Authorization", AUTH_HEADER)
        .expect(200);

      expect(response.body.blacklisted_prefixes).to.be.an("array");
    });
  });

  // Dummy test to keep Mocha from exiting prematurely
  it("Dummy test to keep Mocha from exiting prematurely", () => {
    expect(true).to.equal(true);
  });
});
