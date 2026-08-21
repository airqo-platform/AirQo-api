require("module-alias/register");
const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
// .noCallThru() is required, not optional: without it, proxyquire's default
// "call thru" behavior always `Module._load()`s the REAL stubbed module (to
// merge in any keys missing from our stub), regardless of whether our stub
// is already complete. The real @controllers/network.controller,
// @middleware/passport and @middleware/permissionAuth all transitively
// require @config/constants (via deeper DB-touching modules like
// @services/rbac.service), which this test suite cannot survive (see the
// ut_index.js comment for the full explanation). noCallThru skips that real
// load entirely.
const proxyquire = require("proxyquire").noCallThru();
const express = require("express");
const request = require("supertest");
const { validationResult } = require("express-validator");

// Express captures each route handler by reference at router-registration
// time (which happens once, when this router is required), so reassigning
// e.g. controllerStub.list from inside an it() block has no effect on the
// routes that already registered the old reference. Instead we register
// stable wrapper functions that delegate to a per-test-mutable variable —
// same convention used in routes/v2/test/ut_clients.routes.js.
let listImpl;
let createImpl;

const controllerStub = {
  list: (req, res, next) => listImpl(req, res, next),
  create: (req, res, next) => createImpl(req, res, next),
};

// enhancedJWTAuth normally verifies a real signed JWT, which we don't have
// in a unit test, so it's stubbed out entirely (same convention as
// ut_clients.routes.js). Only POST / requires it; GET / is public.
let enhancedJWTAuthImpl;
const passportStub = {
  enhancedJWTAuth: (req, res, next) => enhancedJWTAuthImpl(req, res, next),
};

// networks.routes.js also guards POST / with requirePermissions([...]),
// which normally talks to RBACService (a real, DB-backed module). It's
// stubbed out here the same way passport is, via a mutable closure so
// individual tests can exercise both the granted and denied paths.
let requirePermissionsImpl;
const permissionAuthStub = {
  requirePermissions: (requiredPermissions, options) => (req, res, next) =>
    requirePermissionsImpl(req, res, next),
};

const router = proxyquire("../networks.routes", {
  "@controllers/network.controller": controllerStub,
  "@middleware/passport": passportStub,
  "@middleware/permissionAuth": permissionAuthStub,
});

const VALID_NETWORK_BODY = {
  admin_secret: "super-secret",
  net_username: "net-user",
  net_connection_endpoint: "https://example.com/endpoint",
  net_connection_string: "connection-string",
  net_email: "network@example.com",
  net_website: "https://example.com",
  net_status: "active",
  net_phoneNumber: "+256700000000",
  net_category: "research",
  net_description: "A test network",
};

describe("Network Router API Tests", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/", router);

    enhancedJWTAuthImpl = (req, res, next) => {
      req.user = { _id: "60d21b4667d0d8992e610c99" };
      next();
    };
    // Default: caller is granted the required permissions, so POST /
    // reaches the (stubbed) controller. Individual tests override this to
    // exercise the permission-denied path.
    requirePermissionsImpl = (req, res, next) => next();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("GET /", () => {
    it("Should return a list of networks", async () => {
      listImpl = (req, res) => res.status(200).json({ success: true, networks: [] });

      const response = await request(app).get("/").query({ tenant: "airqo" });
      expect(response.status).to.equal(200);
    });

    it("Should return an error when the tenant value is not among the expected ones", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app)
        .get("/")
        .query({ tenant: "not-a-real-tenant" });

      expect(response.status).to.equal(400);
      // tenant validation is wrapped in oneOf(), so express-validator
      // reports a generic "Invalid value(s)" as the top-level message and
      // puts the field-specific message under nestedErrors.
      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "the tenant value is not among the expected ones"
      );
    });

    it("defaults pagination limit/skip", async () => {
      listImpl = (req, res) =>
        res.status(200).json({ limit: req.query.limit, skip: req.query.skip });

      const response = await request(app).get("/");
      expect(response.body.limit).to.equal(100);
      expect(response.body.skip).to.equal(0);
    });
  });

  describe("POST /", () => {
    it("Should successfully create a new network with valid data", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ success: true, created_network: {} });
      };

      const response = await request(app).post("/").send(VALID_NETWORK_BODY);
      expect(response.status).to.equal(200);
    });

    it("Should return an error when the tenant value is not among the expected ones", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app)
        .post("/")
        .query({ tenant: "not-a-real-tenant" })
        .send(VALID_NETWORK_BODY);

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "the tenant value is not among the expected ones"
      );
    });

    it("Should return 400 when admin_secret is missing", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const { admin_secret, ...withoutAdminSecret } = VALID_NETWORK_BODY;
      const response = await request(app).post("/").send(withoutAdminSecret);

      expect(response.status).to.equal(400);
      const adminSecretError = response.body.errors.find(
        (err) => err.param === "admin_secret"
      );
      expect(adminSecretError).to.exist;
      expect(adminSecretError.msg).to.equal("the admin secret is required");
    });

    it("Should return 403 when the caller lacks the required permissions", async () => {
      createImpl = sinon.stub();
      requirePermissionsImpl = (req, res, next) =>
        res.status(403).json({ success: false, message: "Permission denied" });

      const response = await request(app).post("/").send(VALID_NETWORK_BODY);

      expect(response.status).to.equal(403);
      expect(createImpl.called).to.equal(false);
    });
  });
});
