require("module-alias/register");
const chai = require("chai");
const chaiHttp = require("chai-http");
const { expect } = chai;
chai.use(chaiHttp);
const sinon = require("sinon");
// .noCallThru() is required, not optional: without it, proxyquire's default
// "call thru" behavior always `Module._load()`s the REAL stubbed module (to
// merge in any keys missing from our stub), regardless of whether our stub
// is already complete. The real @controllers/scope.controller and
// @middleware/passport transitively require @config/constants, which this
// test suite cannot survive (see the ut_index.js comment for the full
// explanation). noCallThru skips that real load entirely.
const proxyquire = require("proxyquire").noCallThru();
const supertest = require("supertest");
const express = require("express");
const { validationResult } = require("express-validator");

// Express captures each route handler by reference at router-registration
// time (which happens once, when this router is required), so reassigning
// `createScopeController.list` etc. from inside a test has no effect on
// already-registered routes. Instead we register stable wrapper functions
// that delegate to a per-test-mutable variable, and stub the auth middleware
// (which otherwise requires a real JWT) to always call next().
let listImpl;
let createImpl;
let updateImpl;
let deleteImpl;
let bulkCreateImpl;
let initializeDefaultsImpl;

const scopeControllerStub = {
  list: (req, res) => listImpl(req, res),
  create: (req, res) => createImpl(req, res),
  update: (req, res) => updateImpl(req, res),
  delete: (req, res) => deleteImpl(req, res),
  bulkCreate: (req, res) => bulkCreateImpl(req, res),
  initializeDefaults: (req, res) => initializeDefaultsImpl(req, res),
};

const passportStub = {
  enhancedJWTAuth: (req, res, next) => next(),
};

const router = proxyquire("@routes/v2/scopes.routes", {
  "@controllers/scope.controller": scopeControllerStub,
  "@middleware/passport": passportStub,
});

describe("Scope Router API Tests", () => {
  let app;
  let request;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/", router);
    request = supertest(app);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("Middleware: Headers", () => {
    it("should set CORS headers on responses", async () => {
      listImpl = (req, res) => res.status(200).json({ scopes: [] });

      const response = await request.get("/").expect(200);

      expect(response.headers["access-control-allow-origin"]).to.equal("*");
      expect(response.headers["access-control-allow-methods"]).to.include(
        "GET"
      );
    });

    it("should short-circuit an OPTIONS preflight request with 204", async () => {
      await request.options("/").expect(204);
    });
  });

  describe("GET /", () => {
    it("should return a list of scopes", async () => {
      const fakeScopes = [{ scope: "SCOPE_ONE" }, { scope: "SCOPE_TWO" }];
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ scopes: fakeScopes });
      };

      const response = await request.get("/").expect(200);

      expect(response.body.scopes).to.deep.equal(fakeScopes);
    });

    it("should apply default pagination values", async () => {
      listImpl = (req, res) => {
        return res
          .status(200)
          .json({ limit: req.query.limit, skip: req.query.skip });
      };

      const response = await request.get("/").expect(200);

      expect(response.body.limit).to.equal(100);
      expect(response.body.skip).to.equal(0);
    });

    it("should return a 400 error if an invalid tenant is provided", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ scopes: [] });
      };

      const response = await request
        .get("/")
        .query({ tenant: "invalid-tenant" })
        .expect(400);

      // The tenant check is wrapped in express-validator's oneOf(), which
      // reports a generic "Invalid value(s)" as the top-level error message
      // and puts the field-specific message(s) under nestedErrors.
      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "the tenant value is not among the expected ones"
      );
    });
  });

  describe("POST /", () => {
    it("should create a new scope", async () => {
      const fakeScope = { _id: "fake-id", scope: "NEW_SCOPE" };
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(201).json({ created_scope: fakeScope });
      };

      const response = await request
        .post("/")
        .send({
          scope: "new scope",
          description: "Description of the scope",
        })
        .expect(201);

      expect(response.body.created_scope).to.deep.equal(fakeScope);
    });

    it("should sanitize the scope field to upper case with underscores", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(201).json({ scope: req.body.scope });
      };

      const response = await request
        .post("/")
        .send({
          scope: "new scope",
          description: "Description of the scope",
        })
        .expect(201);

      expect(response.body.scope).to.equal("NEW_SCOPE");
    });

    it("should return a 400 error if invalid body parameters are provided", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(201).json({ created_scope: {} });
      };

      // network_id uses an empty string rather than a non-empty invalid one:
      // the create validator's network_id chain runs its customSanitizer
      // (ObjectId(value)) without a preceding .bail() after isMongoId(), so a
      // non-empty, non-ObjectId value throws inside the sanitizer instead of
      // producing a clean validation error. An empty string fails the
      // earlier notEmpty() check instead, which does bail, so it stays on
      // the normal validation-error path this test is meant to exercise.
      // `description` is omitted entirely (rather than sent empty) because
      // its validator only checks `.exists()`, not `.notEmpty()`.
      const response = await request
        .post("/")
        .send({
          scope: "",
          network_id: "",
        })
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "the scope must not be empty"
      );
      expect(response.body.errors[1].msg).to.equal(
        "network_id should not be empty if provided"
      );
      expect(response.body.errors[2].msg).to.equal(
        "description is missing in your request"
      );
    });
  });

  describe("PUT /:scope_id", () => {
    it("should update a scope", async () => {
      const fakeUpdatedScope = { _id: "fake-id", description: "Updated" };
      updateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ updated_scope: fakeUpdatedScope });
      };

      const response = await request
        .put("/fake-id")
        .send({ description: "Updated description" })
        .expect(200);

      expect(response.body.updated_scope).to.deep.equal(fakeUpdatedScope);
    });

    it("should return a 400 error with an empty request body, before reaching the controller", async () => {
      // The update validator chain's first entry is a plain (non
      // express-validator) middleware that responds directly with 400 when
      // `req.body` has no keys, and never calls next(). So this short
      // circuits before enhancedJWTAuth / the controller stub are ever
      // reached, and the response shape is a raw string, not an
      // express-validator errors array.
      updateImpl = () => {
        throw new Error("controller should not be reached");
      };

      const response = await request.put("/fake-id").send({}).expect(400);

      expect(response.body.errors).to.equal("request body is empty");
    });

    it("should return a 400 error if invalid body parameters are provided", async () => {
      updateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ updated_scope: {} });
      };

      // network_id again uses an empty string for the same reason as the
      // POST / test above (avoids the un-`.bail()`'d customSanitizer crash).
      const response = await request
        .put("/fake-id")
        .send({
          scope: "should_not_be_here",
          network_id: "",
          description: "",
        })
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "scope should not exist in the request body"
      );
      expect(response.body.errors[1].msg).to.equal(
        "network_id should not be empty if provided"
      );
      expect(response.body.errors[2].msg).to.equal(
        "description should not be empty if provided"
      );
    });
  });

  describe("DELETE /:scope_id", () => {
    it("should delete a scope", async () => {
      deleteImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(204).end();
      };

      await request.delete("/fake-id").expect(204);
    });

    it("should return a 400 error if an invalid tenant is provided", async () => {
      deleteImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(204).end();
      };

      const response = await request
        .delete("/fake-id?tenant=invalid-tenant")
        .expect(400);

      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "the tenant value is not among the expected ones"
      );
    });
  });

  describe("GET /:scope_id", () => {
    // This route reuses createScopeController.list (same as GET /), so it
    // is exercised through the same listImpl closure variable.
    it("should get a scope by ID", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ scopes: [{ scope: "SOME_SCOPE" }] });
      };

      await request.get("/fake-id").expect(200);
    });

    it("should return a 400 error if an invalid tenant is provided", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ scopes: [] });
      };

      const response = await request
        .get("/fake-id?tenant=invalid-tenant")
        .expect(400);

      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "the tenant value is not among the expected ones"
      );
    });
  });

  describe("POST /bulk", () => {
    it("should bulk create scopes", async () => {
      const fakeScopes = [{ scope: "BULK_ONE" }];
      bulkCreateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(201).json({ scopes: fakeScopes });
      };

      const response = await request
        .post("/bulk")
        .send({
          scopes: [{ scope: "bulk one", description: "a bulk scope" }],
        })
        .expect(201);

      expect(response.body.scopes).to.deep.equal(fakeScopes);
    });

    it("should return a 400 error if the scopes array is missing", async () => {
      bulkCreateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(201).json({ scopes: [] });
      };

      const response = await request.post("/bulk").send({}).expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "scopes array is missing in your request"
      );
    });
  });

  describe("POST /initialize", () => {
    it("should initialize default subscription-tier scopes", async () => {
      const fakeScopes = [{ scope: "FREE_TIER" }];
      initializeDefaultsImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(201).json({ scopes: fakeScopes });
      };

      const response = await request.post("/initialize").expect(201);

      expect(response.body.scopes).to.deep.equal(fakeScopes);
    });

    it("should return a 400 error if an invalid tenant is provided", async () => {
      initializeDefaultsImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(201).json({ scopes: [] });
      };

      const response = await request
        .post("/initialize?tenant=invalid-tenant")
        .expect(400);

      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "the tenant value is not among the expected ones"
      );
    });
  });

  // Dummy test to keep Mocha from exiting prematurely
  it("Dummy test to keep Mocha from exiting prematurely", () => {
    expect(true).to.equal(true);
  });
});
