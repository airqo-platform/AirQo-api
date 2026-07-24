require("module-alias/register");
const chai = require("chai");
const chaiHttp = require("chai-http");
const { expect } = chai;
chai.use(chaiHttp);
const sinon = require("sinon");
// .noCallThru() is required, not optional: without it, proxyquire's default
// "call thru" behavior always `Module._load()`s the REAL stubbed module (to
// merge in any keys missing from our stub), regardless of whether our stub
// is already complete. The real @controllers/default.controller and
// @middleware/passport transitively require @config/constants, which this
// test suite cannot survive (see the ut_index.js comment for the full
// explanation). noCallThru skips that real load entirely.
const proxyquire = require("proxyquire").noCallThru();
const supertest = require("supertest");
const express = require("express");
const { validationResult } = require("express-validator");

// Express captures each route handler by reference at router-registration
// time (which happens once, when this router is required), so reassigning
// `createDefaultController.list` etc. from inside a test has no effect on
// already-registered routes. Instead we register stable wrapper functions
// that delegate to a per-test-mutable variable, and stub the auth middleware
// (which otherwise requires a real JWT) to always call next(). Only the
// DELETE / route in defaults.routes.js actually uses enhancedJWTAuth, but we
// stub it regardless since it's the only passport export the router imports.
let updateImpl;
let createImpl;
let listImpl;
let deleteImpl;

const defaultControllerStub = {
  update: (req, res) => updateImpl(req, res),
  create: (req, res) => createImpl(req, res),
  list: (req, res) => listImpl(req, res),
  delete: (req, res) => deleteImpl(req, res),
};

const passportStub = {
  enhancedJWTAuth: (req, res, next) => next(),
};

const router = proxyquire("@routes/v2/defaults.routes", {
  "@controllers/default.controller": defaultControllerStub,
  "@middleware/passport": passportStub,
});

// Realistic 24-char hex Mongo ObjectId strings for fields validated with
// isMongoId() - placeholder strings like "your_id" fail format validation
// and never reach the (stubbed) controller.
const VALID_ID = "60d21b4667d0d8992e610c85";
const VALID_USER_ID = "60d21b4667d0d8992e610c86";
const VALID_AIRQLOUD_ID = "60d21b4667d0d8992e610c87";
const VALID_SITE_ID_1 = "60d21b4667d0d8992e610c88";
const VALID_SITE_ID_2 = "60d21b4667d0d8992e610c89";
const VALID_NETWORK_ID = "60d21b4667d0d8992e610c8a";

describe("Default Router API Tests", () => {
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

  describe("PUT /", () => {
    it("should return 200 and update the default with valid inputs", async () => {
      updateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ message: "default updated" });
      };

      // defaultValidations.update requires the record identifier (id or
      // user_id) to be supplied as a QUERY param, not in the body, via the
      // validateIdOrUserId oneOf().
      const response = await request
        .put("/")
        .query({ id: VALID_ID })
        .send({
          pollutant: "pm2_5",
          frequency: "daily",
          chartType: "bar",
          startDate: "2023-07-25T10:00:00.000Z",
          endDate: "2023-07-26T10:00:00.000Z",
          user: VALID_USER_ID,
          airqloud: VALID_AIRQLOUD_ID,
          chartTitle: "Sample Chart",
          period: {
            start: "2023-07-25T10:00:00.000Z",
            end: "2023-07-26T10:00:00.000Z",
          },
          chartSubTitle: "Sample Subtitle",
          sites: [VALID_SITE_ID_1, VALID_SITE_ID_2],
        })
        .expect(200);

      expect(response.body.message).to.equal("default updated");
    });

    it("should return 400 if neither id nor user_id is provided in the query", async () => {
      updateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ message: "default updated" });
      };

      const response = await request.put("/").send({}).expect(400);

      // validateIdOrUserId is a oneOf() with two chains (id, user_id); when
      // both are missing, express-validator reports a generic top-level
      // "Invalid value(s)" and puts each chain's specific failure message
      // under nestedErrors, in chain-declaration order (id first).
      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "the record's identifier is missing in request, consider using the id"
      );
      expect(response.body.errors[0].nestedErrors[1].msg).to.equal(
        "the record's identifier is missing in request, consider using the user_id"
      );
    });

    it("should return 400 if pollutant is not among the accepted values", async () => {
      updateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ message: "default updated" });
      };

      const response = await request
        .put("/")
        .query({ id: VALID_ID })
        .send({ pollutant: "co2" })
        .expect(400);

      // pollutant is a plain body() chain (not wrapped in oneOf), so its
      // .withMessage() text is the literal errors[0].msg.
      expect(response.body.errors[0].msg).to.equal(
        "the pollutant value is not among the expected ones which include: no2, pm2_5, pm10, pm1"
      );
    });
  });

  describe("POST /", () => {
    it("should return 201 and create a new default entry with valid inputs", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(201).json({ message: "default created" });
      };

      const response = await request
        .post("/")
        .send({
          pollutant: "no2",
          frequency: "hourly",
          chartType: "line",
          startDate: "2023-07-25T10:00:00.000Z",
          endDate: "2023-07-26T10:00:00.000Z",
          user: VALID_USER_ID,
          chartTitle: "Sample Chart",
          period: {
            start: "2023-07-25T10:00:00.000Z",
            end: "2023-07-26T10:00:00.000Z",
          },
          chartSubTitle: "Sample Subtitle",
          airqloud: VALID_AIRQLOUD_ID,
          network_id: VALID_NETWORK_ID,
          sites: [VALID_SITE_ID_1, VALID_SITE_ID_2],
        })
        .expect(201);

      expect(response.body.message).to.equal("default created");
    });

    it("should return 400 if the required user field is missing", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(201).json({ message: "default created" });
      };

      const response = await request
        .post("/")
        .send({ pollutant: "no2" })
        .expect(400);

      // "user" is required (exists()) on create, unlike update where it's
      // optional; this is a plain body() chain so the message is direct.
      expect(response.body.errors[0].msg).to.equal(
        "the user should be provided in the request body"
      );
    });
  });

  describe("GET /", () => {
    it("should return 200 and list default entries with no query params", async () => {
      const fakeDefaults = [{ _id: VALID_ID, pollutant: "pm2_5" }];
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ defaults: fakeDefaults });
      };

      // Every field in defaultValidations.list is optional, so an empty
      // query string is valid.
      const response = await request.get("/").expect(200);

      expect(response.body.defaults).to.deep.equal(fakeDefaults);
    });

    it("should return 200 and list default entries with valid query params", async () => {
      const fakeDefaults = [{ _id: VALID_ID, pollutant: "pm2_5" }];
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ defaults: fakeDefaults });
      };

      const response = await request
        .get("/")
        .query({
          id: VALID_ID,
          user: VALID_USER_ID,
          user_id: VALID_USER_ID,
          airqloud: VALID_AIRQLOUD_ID,
          site: VALID_SITE_ID_1,
        })
        .expect(200);

      expect(response.body.defaults).to.deep.equal(fakeDefaults);
    });

    it("should return 400 if tenant is not among the expected ones", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ defaults: [] });
      };

      const response = await request
        .get("/")
        .query({ tenant: "invalid-tenant" })
        .expect(400);

      // tenant validation is wrapped in oneOf() (validateTenant), so the
      // specific message is under nestedErrors, not errors[0].msg directly.
      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "the tenant value is not among the expected ones"
      );
    });

    it("should return 400 if id is not a valid object ID", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ defaults: [] });
      };

      // Unlike validateIdOrUserId, list's `id` query field is a standalone
      // query() chain (not oneOf), so its message is direct, and it does
      // have a .bail() after isMongoId() before the customSanitizer, so a
      // malformed non-empty value produces a clean 400 rather than throwing.
      const response = await request
        .get("/")
        .query({ id: "not-a-real-id" })
        .expect(400);

      expect(response.body.errors[0].msg).to.equal("id must be an object ID");
    });
  });

  describe("DELETE /", () => {
    it("should return 204 and delete the default entry with a valid id", async () => {
      deleteImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(204).end();
      };

      await request.delete("/").query({ id: VALID_ID }).expect(204);
    });

    it("should return 400 if neither id nor user_id is provided in the query", async () => {
      deleteImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(204).end();
      };

      // Note: express-validator's chain/oneOf middleware never short-circuits
      // the route on failure - it just records errors on req and always
      // calls next(), so this request still passes through enhancedJWTAuth
      // (stubbed here to next()) before reaching deleteImpl, which is what
      // actually inspects validationResult(req) and returns 400.
      const response = await request.delete("/").expect(400);

      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "the record's identifier is missing in request, consider using the id"
      );
      expect(response.body.errors[0].nestedErrors[1].msg).to.equal(
        "the record's identifier is missing in request, consider using the user_id"
      );
    });
  });

  // Dummy test to keep Mocha from exiting prematurely
  it("Dummy test to keep Mocha from exiting prematurely", () => {
    expect(true).to.equal(true);
  });
});
