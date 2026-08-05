require("module-alias/register");
const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
// .noCallThru() is required, not optional: without it, proxyquire's default
// "call thru" behavior always `Module._load()`s the REAL stubbed module (to
// merge in any keys missing from our stub), regardless of whether our stub
// is already complete. The real @controllers/client.controller,
// @middleware/passport, @services/rbac.service, and @models/Client all
// transitively require @config/constants, which this test suite cannot
// survive (see the ut_index.js comment for the full explanation).
// noCallThru skips that real load entirely.
const proxyquire = require("proxyquire").noCallThru();
const express = require("express");
const request = require("supertest");
const { validationResult } = require("express-validator");

const CLIENT_ID = "60d21b4667d0d8992e610c85";
const USER_ID = "60d21b4667d0d8992e610c99";

// Express captures each route handler by reference at router-registration
// time (which happens once, when this router is required), so reassigning
// e.g. createClientController.list from inside an it() block has no effect
// on the routes that already registered the old reference. Instead we
// register stable wrapper functions that delegate to a per-test-mutable
// variable — same convention used in routes/v2/test/ut_permissions.routes.js.
let listImpl;
let createImpl;
let updateClientSecretImpl;
let updateImpl;
let activateClientImpl;
let activateClientRequestImpl;
let deleteImpl;
let getByIdImpl;

const controllerStub = {
  list: (req, res, next) => listImpl(req, res, next),
  create: (req, res, next) => createImpl(req, res, next),
  updateClientSecret: (req, res, next) => updateClientSecretImpl(req, res, next),
  update: (req, res, next) => updateImpl(req, res, next),
  activateClient: (req, res, next) => activateClientImpl(req, res, next),
  activateClientRequest: (req, res, next) =>
    activateClientRequestImpl(req, res, next),
  delete: (req, res, next) => deleteImpl(req, res, next),
  getById: (req, res, next) => getByIdImpl(req, res, next),
};

// enhancedJWTAuth normally verifies a real signed JWT, which we don't have
// in a unit test, so it's stubbed out entirely (same convention as
// ut_permissions.routes.js: it just calls next()). It's extended here to
// also set req.user, because clients.routes.js's own scopeListToUser /
// scopeCreateToUser / requireClientOwnership middleware (defined inline in
// that file, NOT proxyquired away) read req.user._id directly.
let enhancedJWTAuthImpl;
const passportStub = {
  enhancedJWTAuth: (req, res, next) => enhancedJWTAuthImpl(req, res, next),
};

// clients.routes.js also talks directly to RBACService (to decide whether a
// caller is an admin, for scoping/ownership purposes) and to the Client
// model (to look up a client's owner). Both are real modules that would
// otherwise need a live DB connection, so they're proxyquired out too,
// using the same stable-wrapper-delegating-to-a-closure convention.
let isSystemSuperAdminImpl;
const rbacServiceStub = {
  getInstance: () => ({
    isSystemSuperAdmin: (...args) => isSystemSuperAdminImpl(...args),
  }),
};

let findByIdImpl;
let findOneImpl;
const ClientModelStub = () => ({
  findById: (id) => ({ lean: () => findByIdImpl(id) }),
  findOne: (query, projection) => findOneImpl(query, projection),
});

const router = proxyquire("../clients.routes", {
  "@controllers/client.controller": controllerStub,
  "@middleware/passport": passportStub,
  "@services/rbac.service": rbacServiceStub,
  "@models/Client": ClientModelStub,
});

describe("v2 clients route", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/", router);
    // clients.routes.js's inline middleware (scopeListToUser,
    // scopeCreateToUser, requireClientOwnership) reports failures via
    // next(new HttpError(...)); an app-level error handler is needed to turn
    // that into an actual HTTP response, the way the real app does.
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message,
        errors: err.errors || {},
      });
    });

    // Defaults: authenticated as USER_ID, and treated as a system super
    // admin so scopeListToUser/scopeCreateToUser/requireClientOwnership are
    // all no-ops and requests reach the (stubbed) controller. Individual
    // tests override isSystemSuperAdminImpl to exercise the non-admin path.
    enhancedJWTAuthImpl = (req, res, next) => {
      req.user = { _id: USER_ID };
      next();
    };
    isSystemSuperAdminImpl = async () => true;
    findByIdImpl = async () => null;
    findOneImpl = async () => null;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("headers (CORS)", () => {
    // Routed through OPTIONS "/" so the request never needs to clear
    // validators/auth/ownership to reach the headers middleware's effects.
    it("sets the Access-Control-Allow-Origin header", async () => {
      const response = await request(app).options("/");
      expect(response.header["access-control-allow-origin"]).to.equal("*");
    });

    it("sets the Access-Control-Allow-Headers header", async () => {
      const response = await request(app).options("/");
      expect(response.header["access-control-allow-headers"]).to.equal(
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
      );
    });

    it("sets the Access-Control-Allow-Methods header", async () => {
      const response = await request(app).options("/");
      expect(response.header["access-control-allow-methods"]).to.equal(
        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
      );
    });

    it("short-circuits OPTIONS requests with a 204", async () => {
      const response = await request(app).options("/");
      expect(response.status).to.equal(204);
    });
  });

  describe("GET /", () => {
    it("returns 200 when the request is valid", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ clients: [] });
      };

      const response = await request(app).get("/").query({ tenant: "airqo" });
      expect(response.status).to.equal(200);
    });

    it("returns 200 when tenant is not provided (it's optional)", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ clients: [] });
      };

      const response = await request(app).get("/");
      expect(response.status).to.equal(200);
    });

    it("returns 400 with a nested tenant message for an invalid tenant", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ clients: [] });
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

    it("scopes non-admin callers to their own clients", async () => {
      isSystemSuperAdminImpl = async () => false;
      listImpl = (req, res) => res.status(200).json({ user_id: req.query.user_id });

      const response = await request(app).get("/").query({ user_id: "someone-else" });
      // scopeListToUser silently overrides any caller-supplied user_id for
      // non-admins.
      expect(response.body.user_id).to.equal(USER_ID);
    });

    it("does not override user_id for admin callers", async () => {
      isSystemSuperAdminImpl = async () => true;
      listImpl = (req, res) =>
        res.status(200).json({ user_id: req.query.user_id || null });

      const response = await request(app).get("/").query({ user_id: "someone-else" });
      expect(response.body.user_id).to.equal("someone-else");
    });
  });

  describe("POST /", () => {
    it("returns 200 and creates a new client with valid data", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ created_client: {} });
      };

      const response = await request(app)
        .post("/")
        .send({
          user_id: USER_ID,
          name: "Test Client",
          redirect_url: "https://example.com",
        });

      expect(response.status).to.equal(200);
    });

    it("returns 400 when name is missing", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app).post("/").send({ user_id: USER_ID });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "the name is missing in your request"
      );
    });

    it("returns 400 when user_id is missing", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app)
        .post("/")
        .send({ name: "Test Client" });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "the user_id is missing in the request"
      );
    });

    it("returns 400 when redirect_url is not a valid URL", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app).post("/").send({
        user_id: USER_ID,
        name: "Test Client",
        redirect_url: "not-a-url",
      });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "the redirect_url is not a valid URL"
      );
    });

    it("silently overrides body.user_id for non-admin callers", async () => {
      isSystemSuperAdminImpl = async () => false;
      createImpl = (req, res) => res.status(200).json({ user_id: req.body.user_id });

      const response = await request(app)
        .post("/")
        .send({ user_id: "attacker-supplied-id", name: "Test Client" });

      expect(response.status).to.equal(200);
      expect(response.body.user_id).to.equal(USER_ID);
    });
  });

  describe("PATCH /:client_id/secret", () => {
    it("returns 200 and updates the client secret with a valid client_id", async () => {
      updateClientSecretImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ updated_client_secret: {} });
      };

      const response = await request(app).patch(`/${CLIENT_ID}/secret`);
      expect(response.status).to.equal(200);
    });

    it("returns 400 with a nested message when client_id is not a valid object id", async () => {
      updateClientSecretImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app).patch("/not-a-valid-id/secret");

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "client_id must be an object ID"
      );
    });

    it("returns 403 when a non-admin does not own the client", async () => {
      isSystemSuperAdminImpl = async () => false;
      findByIdImpl = async () => ({ user_id: "someone-else" });
      updateClientSecretImpl = sinon.stub();

      const response = await request(app).patch(`/${CLIENT_ID}/secret`);

      expect(response.status).to.equal(403);
      expect(updateClientSecretImpl.called).to.equal(false);
    });

    it("returns 404 when a non-admin's client does not exist", async () => {
      isSystemSuperAdminImpl = async () => false;
      findByIdImpl = async () => null;
      updateClientSecretImpl = sinon.stub();

      const response = await request(app).patch(`/${CLIENT_ID}/secret`);

      expect(response.status).to.equal(404);
      expect(updateClientSecretImpl.called).to.equal(false);
    });

    it("lets a non-admin owner through", async () => {
      isSystemSuperAdminImpl = async () => false;
      findByIdImpl = async () => ({ user_id: USER_ID });
      updateClientSecretImpl = (req, res) => res.status(200).json({ ok: true });

      const response = await request(app).patch(`/${CLIENT_ID}/secret`);

      expect(response.status).to.equal(200);
    });
  });

  describe("PUT /:client_id", () => {
    it("returns 200 and updates the client data with valid data", async () => {
      updateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ updated_client: {} });
      };

      const response = await request(app)
        .put(`/${CLIENT_ID}`)
        .send({ name: "New Client Name", redirect_url: "https://example.com/callback" });

      expect(response.status).to.equal(200);
    });

    it("returns 400 with a nested message when client_id is not a valid object id", async () => {
      updateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app)
        .put("/not-a-valid-id")
        .send({ name: "New Client Name" });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "client_id must be an object ID"
      );
    });

    it("returns 400 when the body contains client_id", async () => {
      updateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app)
        .put(`/${CLIENT_ID}`)
        .send({ client_id: "some-id" });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "the client_id should not exist in the request body"
      );
    });

    it("returns 400 when the body contains client_secret", async () => {
      updateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app)
        .put(`/${CLIENT_ID}`)
        .send({ client_secret: "shh" });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "the client_secret should not exist in the request body"
      );
    });

    it("returns 400 when requireClientSecret=true but no secret exists yet", async () => {
      findOneImpl = async () => null;
      updateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app)
        .put(`/${CLIENT_ID}`)
        .send({ requireClientSecret: true });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "A client_secret must exist before enabling requireClientSecret — call PATCH /:client_id/secret first"
      );
    });

    it("returns 403 when a non-admin does not own the client", async () => {
      isSystemSuperAdminImpl = async () => false;
      findByIdImpl = async () => ({ user_id: "someone-else" });
      updateImpl = sinon.stub();

      const response = await request(app)
        .put(`/${CLIENT_ID}`)
        .send({ name: "New Client Name" });

      expect(response.status).to.equal(403);
      expect(updateImpl.called).to.equal(false);
    });
  });

  describe("POST /activate/:client_id", () => {
    it("returns 200 and activates the client with valid data", async () => {
      activateClientImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ activated_client: {} });
      };

      const response = await request(app)
        .post(`/activate/${CLIENT_ID}`)
        .send({ isActive: true });

      expect(response.status).to.equal(200);
    });

    it("returns 400 when isActive is missing", async () => {
      activateClientImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app).post(`/activate/${CLIENT_ID}`).send({});

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal("isActive field is missing");
    });

    it("returns 400 when isActive is not a boolean", async () => {
      activateClientImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app)
        .post(`/activate/${CLIENT_ID}`)
        .send({ isActive: "not-a-boolean" });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "isActive should be a Boolean value"
      );
    });
  });

  describe("GET /activate-request/:client_id", () => {
    it("returns 200 for a valid client_id", async () => {
      activateClientRequestImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ success: true });
      };

      const response = await request(app).get(`/activate-request/${CLIENT_ID}`);
      expect(response.status).to.equal(200);
    });

    it("returns 400 with a nested message for an invalid client_id", async () => {
      activateClientRequestImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app).get("/activate-request/not-a-valid-id");

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "client_id must be an object ID"
      );
    });
  });

  describe("DELETE /:client_id", () => {
    it("returns 200 and deletes the client with a valid client_id", async () => {
      deleteImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ deleted_client: {} });
      };

      const response = await request(app).delete(`/${CLIENT_ID}`);
      expect(response.status).to.equal(200);
    });

    it("returns 400 with a nested message for an invalid client_id", async () => {
      deleteImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app).delete("/not-a-valid-id");

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "client_id must be an object ID"
      );
    });

    it("returns 403 when a non-admin does not own the client", async () => {
      isSystemSuperAdminImpl = async () => false;
      findByIdImpl = async () => ({ user_id: "someone-else" });
      deleteImpl = sinon.stub();

      const response = await request(app).delete(`/${CLIENT_ID}`);

      expect(response.status).to.equal(403);
      expect(deleteImpl.called).to.equal(false);
    });
  });

  describe("GET /:client_id", () => {
    it("returns 200 and client data with a valid client_id", async () => {
      getByIdImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ clients: {} });
      };

      const response = await request(app).get(`/${CLIENT_ID}`);
      expect(response.status).to.equal(200);
    });

    it("returns 400 with a nested message for an invalid client_id", async () => {
      getByIdImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app).get("/not-a-valid-id");

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "client_id must be an object ID"
      );
    });

    it("returns 404 when a non-admin's client does not exist", async () => {
      isSystemSuperAdminImpl = async () => false;
      findByIdImpl = async () => null;
      getByIdImpl = sinon.stub();

      const response = await request(app).get(`/${CLIENT_ID}`);

      expect(response.status).to.equal(404);
      expect(getByIdImpl.called).to.equal(false);
    });
  });
});
