require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const express = require("express");
const request = require("supertest");
const { validationResult } = require("express-validator");
// .noCallThru() is required, not optional: without it, proxyquire's default
// "call thru" behavior always `Module._load()`s the REAL stubbed module (to
// merge in any keys missing from our stub), regardless of whether our stub
// is already complete. The real @controllers/search-history.controller and
// @middleware/passport transitively require @config/constants and touch
// real DB-backed utils, which this isolated unit-test run cannot survive.
// noCallThru skips that real load entirely (same convention as
// ut_clients.routes.js).
const proxyquire = require("proxyquire").noCallThru();

const SEARCH_HISTORY_ID = "60d21b4667d0d8992e610c85";
const FIREBASE_USER_ID = "some_firebase_user_id";

const validSearchHistoryBody = {
  name: "Test Name",
  location: "Test Location",
  place_id: "Test Place ID",
  firebase_user_id: "Test Firebase User ID",
  latitude: "1.23456",
  longitude: "12.34567",
  date_time: "2023-07-25T12:34:56Z",
};

// Express captures each route handler by reference at router-registration
// time (which happens once, when this router is required), so reassigning
// e.g. createSearchHistoryController.list from inside an it() block has no
// effect on the routes that already registered the old reference. Instead
// we register stable wrapper functions that delegate to a per-test-mutable
// variable — same convention used in ut_clients.routes.js.
let listImpl;
let createImpl;
let syncSearchHistoryImpl;
let updateImpl;
let deleteImpl;

const controllerStub = {
  list: (req, res, next) => listImpl(req, res, next),
  create: (req, res, next) => createImpl(req, res, next),
  syncSearchHistory: (req, res, next) => syncSearchHistoryImpl(req, res, next),
  update: (req, res, next) => updateImpl(req, res, next),
  delete: (req, res, next) => deleteImpl(req, res, next),
};

// enhancedJWTAuth normally verifies a real signed JWT, which we don't have
// in a unit test, so it's stubbed out entirely (same convention as
// ut_clients.routes.js / ut_inquiries.routes.js: it just calls next()).
// Every route on this router requires it.
let enhancedJWTAuthImpl;
const passportStub = {
  enhancedJWTAuth: (req, res, next) => enhancedJWTAuthImpl(req, res, next),
};

const router = proxyquire("../search-history.routes", {
  "@controllers/search-history.controller": controllerStub,
  "@middleware/passport": passportStub,
});

describe("v2 search-history route", () => {
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

  describe("headers (CORS)", () => {
    // Routed through OPTIONS "/" so the request never needs to clear
    // validators/auth to reach the headers middleware's effects.
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
    it("returns 200 and search histories when a valid tenant is provided", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ success: false, errors: errors.array() });
        return res.status(200).json({ success: true, search_histories: [] });
      };

      const response = await request(app).get("/").query({ tenant: "airqo" });

      expect(response.status).to.equal(200);
      expect(response.body.success).to.equal(true);
      expect(response.body.search_histories).to.be.an("array");
    });

    it("returns 400 with a nested tenant message for an invalid tenant", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ success: false, errors: errors.array() });
        return res.status(200).json({ success: true, search_histories: [] });
      };

      const response = await request(app)
        .get("/")
        .query({ tenant: "not-a-real-tenant" });

      expect(response.status).to.equal(400);
      expect(response.body.success).to.equal(false);
      // tenant validation is wrapped in oneOf(), so express-validator
      // reports a generic "Invalid value(s)" as the top-level message and
      // puts the field-specific message under nestedErrors.
      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "the tenant value is not among the expected ones"
      );
    });
  });

  describe("GET /users/:firebase_user_id", () => {
    it("returns 200 and search histories for a valid request", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ success: false, errors: errors.array() });
        return res.status(200).json({ success: true, search_histories: [] });
      };

      const response = await request(app)
        .get(`/users/${FIREBASE_USER_ID}`)
        .query({ tenant: "airqo" });

      expect(response.status).to.equal(200);
      expect(response.body.search_histories).to.be.an("array");
    });

    it("returns 400 with a nested tenant message for an invalid tenant", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ success: false, errors: errors.array() });
        return res.status(200).json({ success: true, search_histories: [] });
      };

      const response = await request(app)
        .get(`/users/${FIREBASE_USER_ID}`)
        .query({ tenant: "not-a-real-tenant" });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "the tenant value is not among the expected ones"
      );
    });
  });

  describe("POST /", () => {
    it("returns 200 and creates a search history with valid data", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ success: false, errors: errors.array() });
        return res.status(200).json({ success: true, message: "created" });
      };

      const response = await request(app)
        .post("/")
        .query({ tenant: "airqo" })
        .send(validSearchHistoryBody);

      expect(response.status).to.equal(200);
      expect(response.body.success).to.equal(true);
    });

    it("returns 400 when required fields are missing", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ success: false, errors: errors.array() });
        return res.status(200).json({ success: true, message: "created" });
      };

      const response = await request(app)
        .post("/")
        .query({ tenant: "airqo" })
        .send({});

      expect(response.status).to.equal(400);
      expect(response.body.success).to.equal(false);
      expect(response.body.errors[0].msg).to.equal(
        "name is missing in your request"
      );
    });
  });

  describe("POST /syncSearchHistory/:firebase_user_id", () => {
    it("returns 200 and syncs search histories with valid data", async () => {
      syncSearchHistoryImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ success: false, errors: errors.array() });
        return res.status(200).json({ success: true, message: "synced" });
      };

      const response = await request(app)
        .post(`/syncSearchHistory/${FIREBASE_USER_ID}`)
        .query({ tenant: "airqo" })
        .send({ search_histories: [validSearchHistoryBody] });

      expect(response.status).to.equal(200);
      expect(response.body.success).to.equal(true);
    });

    it("returns 400 when search_histories is missing from the body", async () => {
      syncSearchHistoryImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ success: false, errors: errors.array() });
        return res.status(200).json({ success: true, message: "synced" });
      };

      const response = await request(app)
        .post(`/syncSearchHistory/${FIREBASE_USER_ID}`)
        .query({ tenant: "airqo" })
        .send({});

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "the search_histories are missing in the request body"
      );
    });
  });

  describe("PUT /:search_history_id", () => {
    it("returns 200 and updates the search history with valid data", async () => {
      updateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ success: false, errors: errors.array() });
        return res.status(200).json({ success: true, message: "updated" });
      };

      const response = await request(app)
        .put(`/${SEARCH_HISTORY_ID}`)
        .send({ name: "Updated Name" });

      expect(response.status).to.equal(200);
      expect(response.body.success).to.equal(true);
    });

    it("returns 400 when the request body is empty", async () => {
      // This is handled by an inline route middleware (before the
      // search_history_id/tenant validators even run), so updateImpl is
      // never invoked for this case.
      updateImpl = sinon.stub();

      const response = await request(app).put(`/${SEARCH_HISTORY_ID}`).send({});

      expect(response.status).to.equal(400);
      expect(response.body.errors).to.equal("request body is empty");
      expect(updateImpl.called).to.equal(false);
    });

    it("returns 400 when search_history_id is not a valid object id", async () => {
      updateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ success: false, errors: errors.array() });
        return res.status(200).json({ success: true, message: "updated" });
      };

      const response = await request(app)
        .put("/not-a-valid-id")
        .send({ name: "Updated Name" });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "search_history_id must be an object ID"
      );
    });
  });

  describe("DELETE /:search_history_id", () => {
    it("returns 200 and deletes the search history with a valid id", async () => {
      deleteImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ success: false, errors: errors.array() });
        return res.status(200).json({ success: true, message: "deleted" });
      };

      const response = await request(app).delete(`/${SEARCH_HISTORY_ID}`);

      expect(response.status).to.equal(200);
      expect(response.body.success).to.equal(true);
    });

    it("returns 400 when search_history_id is not a valid object id", async () => {
      deleteImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ success: false, errors: errors.array() });
        return res.status(200).json({ success: true, message: "deleted" });
      };

      const response = await request(app).delete("/not-a-valid-id");

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "search_history_id must be an object ID"
      );
    });
  });

  describe("GET /:search_history_id", () => {
    it("returns 200 and data for a valid id", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ success: false, errors: errors.array() });
        return res.status(200).json({ success: true, data: {} });
      };

      const response = await request(app).get(`/${SEARCH_HISTORY_ID}`);

      expect(response.status).to.equal(200);
      expect(response.body.data).to.be.an("object");
    });

    it("returns 400 when search_history_id is not a valid object id", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ success: false, errors: errors.array() });
        return res.status(200).json({ success: true, data: {} });
      };

      const response = await request(app).get("/not-a-valid-id");

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "search_history_id must be an object ID"
      );
    });
  });
});
