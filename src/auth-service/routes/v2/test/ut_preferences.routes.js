require("module-alias/register");
const chai = require("chai");
const chaiHttp = require("chai-http");
const { expect } = chai;
chai.use(chaiHttp);
const sinon = require("sinon");
const proxyquire = require("proxyquire");
const supertest = require("supertest");
const express = require("express");
const { validationResult } = require("express-validator");

// Express captures each route handler by reference at router-registration
// time (which happens once, when this router is required), so reassigning
// e.g. `preferenceController.create` from inside a test has no effect on
// already-registered routes. Instead we register stable wrapper functions
// that delegate to a per-test-mutable variable, and stub the auth middleware
// (which otherwise requires a real JWT) to always call next().
//
// preferences.routes.js references every one of these controller methods at
// require time, so every one of them must resolve to a function on the stub
// -- even the ones this file doesn't exercise -- or Express throws while
// registering the routes ("argument handler must be a function").
let listImpl;
let createImpl;
let deleteImpl;
let addSelectedSitesImpl;
let updateSelectedSiteImpl;
let deleteSelectedSiteImpl;

const defaultHandler = (req, res) => res.status(200).json({ success: true });

const preferenceControllerStub = {
  validatePreferenceData: defaultHandler,
  upsert: defaultHandler,
  replace: defaultHandler,
  update: defaultHandler,
  create: (req, res) => createImpl(req, res),
  list: (req, res) => listImpl(req, res),
  delete: (req, res) => deleteImpl(req, res),
  listSelectedSites: defaultHandler,
  addSelectedSites: (req, res) => addSelectedSitesImpl(req, res),
  updateSelectedSite: (req, res) => updateSelectedSiteImpl(req, res),
  deleteSelectedSite: (req, res) => deleteSelectedSiteImpl(req, res),
  getMostRecent: defaultHandler,
  listAll: defaultHandler,
  createChart: defaultHandler,
  updateChart: defaultHandler,
  deleteChart: defaultHandler,
  getChartConfigurations: defaultHandler,
  copyChart: defaultHandler,
  getChartConfigurationById: defaultHandler,
  getUserPersonalTheme: defaultHandler,
  updateUserPersonalTheme: defaultHandler,
  getUserGroupTheme: defaultHandler,
  updateUserGroupTheme: defaultHandler,
  getUserDefaultGroupTheme: defaultHandler,
  updateUserDefaultGroupTheme: defaultHandler,
  getUserNetworkTheme: defaultHandler,
  updateUserNetworkTheme: defaultHandler,
  getUserDefaultNetworkTheme: defaultHandler,
  updateUserDefaultNetworkTheme: defaultHandler,
  getGroupTheme: defaultHandler,
  updateGroupTheme: defaultHandler,
  getNetworkTheme: defaultHandler,
  updateNetworkTheme: defaultHandler,
  getEffectiveTheme: defaultHandler,
};

const passportStub = {
  enhancedJWTAuth: (req, res, next) => next(),
};

const router = proxyquire("../preferences.routes", {
  "@controllers/preference.controller": preferenceControllerStub,
  "@middleware/passport": passportStub,
});

// A couple of realistic-looking 24-char hex ObjectId strings for tests that
// need to pass isMongoId() checks.
const VALID_USER_ID = "60d21b4667d0d8992e610c85";
const VALID_SITE_ID = "60d21b4667d0d8992e610c86";

describe("Preferences Router API Tests", () => {
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

  describe("GET / (list)", () => {
    it("should list preferences successfully", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ preferences: [] });
      };

      const response = await request.get("/").expect(200);

      expect(response.body.preferences).to.deep.equal([]);
    });

    it("should return a 400 error if the tenant query param is invalid", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ preferences: [] });
      };

      // Unlike permissions.validators.js, preferences.validators.js's
      // `tenant` chain is NOT wrapped in oneOf(), so an invalid tenant
      // surfaces its .withMessage() text directly as errors[0].msg, not
      // nested under errors[0].nestedErrors.
      const response = await request
        .get("/")
        .query({ tenant: "invalid-tenant" })
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "the tenant value is not among the expected ones"
      );
    });

    it("should return a 400 error if a body/query filter is invalid", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ preferences: [] });
      };

      // `list` also runs commonValidations.preferenceBody, which wraps a
      // single group of otherwise-independent field chains in oneOf(), so a
      // failure inside it (here: an invalid site_id query param) surfaces as
      // a generic "Invalid value(s)" with the real message under
      // nestedErrors.
      const response = await request
        .get("/")
        .query({ site_id: "not-a-valid-id" })
        .expect(400);

      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "the site_id must be an object ID"
      );
    });
  });

  describe("POST / (create)", () => {
    it("should create a preference", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(201).json({ preference: { user_id: VALID_USER_ID } });
      };

      const response = await request
        .post("/")
        .send({ user_id: VALID_USER_ID })
        .expect(201);

      expect(response.body.preference.user_id).to.equal(VALID_USER_ID);
    });

    it("should return a 400 error if user_id is missing", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(201).json({ preference: {} });
      };

      // `create` requires either a :user_id route param (absent here, since
      // this route is POST /) or a body.user_id, via oneOf([param, body]).
      // With neither present, both branches fail and their messages land in
      // nestedErrors in declaration order (param branch, then body branch).
      const response = await request.post("/").send({}).expect(400);

      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "the record's identifier is missing in request, consider using the user_id"
      );
      expect(response.body.errors[0].nestedErrors[1].msg).to.equal(
        "the user_id should be provided in the request body"
      );
    });

    it("should return a 400 error if pollutant is not among the accepted values", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(201).json({ preference: {} });
      };

      const response = await request
        .post("/")
        .send({ user_id: VALID_USER_ID, pollutant: "invalid_pollutant" })
        .expect(400);

      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "the pollutant value is not among the expected ones which include: no2, pm2_5, pm10, pm1"
      );
    });

    it("should return a 400 error if a selected_sites entry is missing a required field", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(201).json({ preference: {} });
      };

      // The selected_sites check for `create` is a plain (non-express-
      // validator) middleware that responds directly with a different error
      // shape, and it never even reaches createImpl.
      const response = await request
        .post("/")
        .send({
          user_id: VALID_USER_ID,
          selected_sites: [{ _id: VALID_SITE_ID, search_name: "Kampala" }],
        })
        .expect(400);

      expect(response.body.success).to.equal(false);
      expect(response.body.errors["selected_sites[0]"]).to.deep.equal([
        'Field "name" is missing',
      ]);
    });
  });

  describe("DELETE /:user_id", () => {
    it("should delete a preference", async () => {
      deleteImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      await request.delete(`/${VALID_USER_ID}`).expect(200);
    });

    it("should return a 400 error if user_id is not a valid ObjectId", async () => {
      deleteImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      // deletePreference's param("user_id") chain is a plain chain, not
      // wrapped in oneOf, so its message is the direct top-level msg.
      const response = await request
        .delete("/not-a-valid-id")
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "user_id must be an object ID"
      );
    });
  });

  describe("POST /selected-sites (addSelectedSites)", () => {
    it("should add selected sites", async () => {
      addSelectedSitesImpl = (req, res) => {
        return res.status(200).json({ success: true });
      };

      await request
        .post("/selected-sites")
        .send({
          selected_sites: [
            {
              site_id: VALID_SITE_ID,
              search_name: "Kampala",
              name: "Kampala Site",
            },
          ],
        })
        .expect(200);
    });

    it("should return a 400 error if a required field is missing", async () => {
      addSelectedSitesImpl = (req, res) => {
        return res.status(200).json({ success: true });
      };

      const response = await request
        .post("/selected-sites")
        .send({ selected_sites: [{ site_id: VALID_SITE_ID }] })
        .expect(400);

      expect(response.body.success).to.equal(false);
      expect(response.body.errors["selected_sites[0]"]).to.deep.equal([
        'Field "search_name" is missing',
        'Field "name" is missing',
      ]);
    });

    it("should return a 400 error if _id is provided (not allowed here)", async () => {
      addSelectedSitesImpl = (req, res) => {
        return res.status(200).json({ success: true });
      };

      // addSelectedSites validates with allowId=false, unlike create's
      // allowId=true -- so _id is rejected here even though it is accepted
      // on create.
      const response = await request
        .post("/selected-sites")
        .send({
          selected_sites: [
            {
              _id: VALID_SITE_ID,
              site_id: VALID_SITE_ID,
              search_name: "Kampala",
              name: "Kampala Site",
            },
          ],
        })
        .expect(400);

      expect(response.body.errors["selected_sites[0]"]).to.deep.equal([
        "_id field is not allowed",
      ]);
    });
  });

  describe("PUT /selected-sites/:site_id (updateSelectedSite)", () => {
    it("should update a selected site", async () => {
      updateSelectedSiteImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      await request
        .put(`/selected-sites/${VALID_SITE_ID}`)
        .send({})
        .expect(200);
    });

    it("should return a 400 error if site_id is not a valid ObjectId", async () => {
      updateSelectedSiteImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      // Not wrapped in oneOf, so the message is the direct top-level msg.
      const response = await request
        .put("/selected-sites/not-a-valid-id")
        .send({})
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "site_id must be a valid MongoDB ObjectId"
      );
    });
  });

  describe("DELETE /selected-sites/:site_id (deleteSelectedSite)", () => {
    it("should delete a selected site", async () => {
      deleteSelectedSiteImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      await request.delete(`/selected-sites/${VALID_SITE_ID}`).expect(200);
    });

    it("should return a 400 error if site_id is not a valid ObjectId", async () => {
      deleteSelectedSiteImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        return res.status(200).json({ success: true });
      };

      const response = await request
        .delete("/selected-sites/not-a-valid-id")
        .expect(400);

      expect(response.body.errors[0].msg).to.equal(
        "site_id must be a valid MongoDB ObjectId"
      );
    });
  });

  // Dummy test to keep Mocha from exiting prematurely
  it("Dummy test to keep Mocha from exiting prematurely", () => {
    expect(true).to.equal(true);
  });
});
