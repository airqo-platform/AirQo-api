require("module-alias/register");
const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
// .noCallThru() is required, not optional: without it, proxyquire's default
// "call thru" behavior always `Module._load()`s the REAL stubbed module (to
// merge in any keys missing from our stub), regardless of whether our stub
// is already complete. The real @controllers/candidate.controller and
// @middleware/passport both transitively require @config/constants (via
// deeper DB-touching modules), which this test suite cannot survive (see
// the ut_index.js comment for the full explanation). noCallThru skips that
// real load entirely.
const proxyquire = require("proxyquire").noCallThru();
const express = require("express");
const request = require("supertest");
const { validationResult } = require("express-validator");

// Express captures each route handler by reference at router-registration
// time (which happens once, when this router is required), so reassigning
// e.g. controllerStub.create from inside an it() block has no effect on the
// routes that already registered the old reference. Instead we register
// stable wrapper functions that delegate to a per-test-mutable variable —
// same convention used in routes/v2/test/ut_clients.routes.js.
let createImpl;
let listImpl;
let confirmImpl;
let deleteImpl;
let updateImpl;

const controllerStub = {
  create: (req, res, next) => createImpl(req, res, next),
  list: (req, res, next) => listImpl(req, res, next),
  confirm: (req, res, next) => confirmImpl(req, res, next),
  delete: (req, res, next) => deleteImpl(req, res, next),
  update: (req, res, next) => updateImpl(req, res, next),
};

// enhancedJWTAuth normally verifies a real signed JWT, which we don't have
// in a unit test, so it's stubbed out entirely (same convention as
// ut_clients.routes.js / ut_permissions.routes.js). It's only used on
// GET /, POST /confirm, DELETE / and PUT / — POST /register is public.
let enhancedJWTAuthImpl;
const passportStub = {
  enhancedJWTAuth: (req, res, next) => enhancedJWTAuthImpl(req, res, next),
};

const router = proxyquire("../candidates.routes", {
  "@controllers/candidate.controller": controllerStub,
  "@middleware/passport": passportStub,
});

const VALID_CANDIDATE_BODY = {
  email: "candidate@example.com",
  firstName: "Jane",
  lastName: "Doe",
  country: "Uganda",
  category: "individual",
  website: "https://example.com",
  description: "A candidate requesting access",
  long_organization: "Example Org",
  jobTitle: "Engineer",
};

describe("Request Access Router API Tests", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/", router);

    enhancedJWTAuthImpl = (req, res, next) => {
      req.user = { _id: "60d21b4667d0d8992e610c99" };
      next();
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("POST /register", () => {
    it("Should successfully create a new request for access", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ success: true, created_candidate: {} });
      };

      const response = await request(app)
        .post("/register")
        .send(VALID_CANDIDATE_BODY);

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
        .post("/register")
        .query({ tenant: "not-a-real-tenant" })
        .send(VALID_CANDIDATE_BODY);

      expect(response.status).to.equal(400);
      // tenant validation is wrapped in oneOf(), so express-validator
      // reports a generic "Invalid value(s)" as the top-level message and
      // puts the field-specific message under nestedErrors.
      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "the tenant value is not among the expected ones"
      );
    });

    it("Should return 400 when a required field (email) is missing", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const { email, ...withoutEmail } = VALID_CANDIDATE_BODY;
      const response = await request(app).post("/register").send(withoutEmail);

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal("the email should be provided");
    });
  });

  describe("GET /", () => {
    it("Should return a list of candidates for access", async () => {
      listImpl = (req, res) => res.status(200).json({ success: true, candidates: [] });

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

  describe("POST /confirm", () => {
    it("Should successfully confirm a request for access", async () => {
      confirmImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ success: true, confirmed_candidate: {} });
      };

      const response = await request(app).post("/confirm").send(VALID_CANDIDATE_BODY);
      expect(response.status).to.equal(200);
    });

    it("Should return an error when the tenant value is not among the expected ones", async () => {
      confirmImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app)
        .post("/confirm")
        .query({ tenant: "not-a-real-tenant" })
        .send(VALID_CANDIDATE_BODY);

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "the tenant value is not among the expected ones"
      );
    });
  });

  describe("DELETE /", () => {
    it("Should successfully delete a request for access", async () => {
      deleteImpl = (req, res) => res.status(200).json({ success: true, deleted_candidate: {} });

      const response = await request(app).delete("/").query({ tenant: "airqo" });
      expect(response.status).to.equal(200);
    });

    it("Should return an error when the tenant value is not among the expected ones", async () => {
      deleteImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app)
        .delete("/")
        .query({ tenant: "not-a-real-tenant" });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "the tenant value is not among the expected ones"
      );
    });
  });

  describe("PUT /", () => {
    it("Should successfully update a request for access", async () => {
      updateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ success: true, updated_candidate: {} });
      };

      const response = await request(app)
        .put("/")
        .query({ id: "60d21b4667d0d8992e610c85" })
        .send({ status: "rejected" });

      expect(response.status).to.equal(200);
    });

    it("Should return an error when the tenant value is not among the expected ones", async () => {
      updateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app)
        .put("/")
        .query({ id: "60d21b4667d0d8992e610c85", tenant: "not-a-real-tenant" })
        .send({ status: "rejected" });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "the tenant value is not among the expected ones"
      );
    });

    it("Should return an error when the status value is not among the expected ones", async () => {
      updateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app)
        .put("/")
        .query({ id: "60d21b4667d0d8992e610c85" })
        .send({ status: "not-a-real-status" });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "the status value is not among the expected ones which include: rejected and pending"
      );
    });
  });
});
