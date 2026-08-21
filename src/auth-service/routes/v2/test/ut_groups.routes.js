require("module-alias/register");
const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
// .noCallThru() is required, not optional: without it, proxyquire's default
// "call thru" behavior always `Module._load()`s the REAL stubbed module (to
// merge in any keys missing from our stub), regardless of whether our stub
// is already complete. The real @controllers/group.controller,
// @middleware/passport, @middleware/permissionAuth, @middleware/adminAccess
// and @middleware/groupNetworkAuth all transitively require @config/constants
// and RBAC/DB-backed services, which this test suite cannot survive (see the
// ut_index.js comment for the full explanation). noCallThru skips that real
// load entirely.
const proxyquire = require("proxyquire").noCallThru();
const express = require("express");
const request = require("supertest");
const { validationResult } = require("express-validator");

const GROUP_ID = "60d21b4667d0d8992e610c85";
const USER_ID = "60d21b4667d0d8992e610c99";

// Express captures each route handler by reference at router-registration
// time (which happens once, when this router is required), so reassigning
// e.g. groupController.list from inside an it() block has no effect on the
// routes that already registered the old reference. Instead we register
// stable wrapper functions that delegate to a per-test-mutable variable —
// same convention used in ut_clients.routes.js / ut_permissions.routes.js —
// for every controller method actually exercised by a test below. Methods
// that group.routes.js wires up but this file doesn't test are given a
// fixed no-op response, just so proxyquire's stub has every property
// group.routes.js reads (Express throws at registration time if a route
// handler is undefined).
let listImpl;
let listSummaryImpl;
let createImpl;
let updateImpl;
let deleteImpl;
let assignOneUserImpl;
let assignUsersImpl;
let unAssignUserImpl;
let unAssignManyUsersImpl;
let listAssignedUsersImpl;
let listAvailableUsersImpl;

const notExercised = (req, res) => res.status(200).json({});

const controllerStub = {
  populateSlugs: notExercised,
  updateSlug: notExercised,
  list: (req, res, next) => listImpl(req, res, next),
  listSummary: (req, res, next) => listSummaryImpl(req, res, next),
  create: (req, res, next) => createImpl(req, res, next),
  update: (req, res, next) => updateImpl(req, res, next),
  updateName: notExercised,
  delete: (req, res, next) => deleteImpl(req, res, next),
  getDashboard: notExercised,
  getMembers: notExercised,
  getSettings: notExercised,
  updateSettings: notExercised,
  assignOneUser: (req, res, next) => assignOneUserImpl(req, res, next),
  assignUsers: (req, res, next) => assignUsersImpl(req, res, next),
  unAssignUser: (req, res, next) => unAssignUserImpl(req, res, next),
  unAssignManyUsers: (req, res, next) => unAssignManyUsersImpl(req, res, next),
  leaveGroup: notExercised,
  enhancedSetManager: notExercised,
  listAssignedUsers: (req, res, next) => listAssignedUsersImpl(req, res, next),
  listAllGroupUsers: notExercised,
  listAvailableUsers: (req, res, next) => listAvailableUsersImpl(req, res, next),
  listRolesForGroup: notExercised,
  getManagerDashboard: notExercised,
  getGroupAnalytics: notExercised,
  bulkMemberManagement: notExercised,
  manageAccessRequests: notExercised,
  assignMemberRole: notExercised,
  sendGroupInvitations: notExercised,
  listGroupInvitations: notExercised,
  updateGroupStatus: notExercised,
  getGroupActivityLog: notExercised,
  searchGroupMembers: notExercised,
  exportGroupData: notExercised,
  getGroupHealth: notExercised,
  updateOnboarding: notExercised,
  assignCohortsToGroup: notExercised,
  unassignCohortsFromGroup: notExercised,
  listGroupCohorts: notExercised,
  removeUniqueConstraint: notExercised,
};

// enhancedJWTAuth normally verifies a real signed JWT, which we don't have in
// a unit test, so it's stubbed out entirely (same convention as
// ut_clients.routes.js: it just sets req.user and calls next()).
let enhancedJWTAuthImpl;
const passportStub = {
  enhancedJWTAuth: (req, res, next) => enhancedJWTAuthImpl(req, res, next),
};

// group.routes.js gates almost every route behind RBAC middleware from these
// three modules (requirePermissions, requireGroupAccess, requireGroupAdmin,
// requireGroupUserManagement, requireGroupPermissions, debugPermissions,
// etc). None of that RBAC decision logic is under test here — this file is
// only exercising route wiring (does the right controller method get called
// for the right method+path) and request validation (does a malformed
// request get rejected before reaching the controller) — so every one of
// these factories is stubbed to a permissive pass-through that always calls
// next(), regardless of the arguments group.routes.js passes them.
const passthroughFactory = () => (req, res, next) => next();
const permissionAuthStub = {
  requirePermissions: passthroughFactory,
  requireGroupPermissions: passthroughFactory,
  requireGroupMembership: passthroughFactory,
  requireGroupManager: passthroughFactory,
  debugPermissions: passthroughFactory,
};
const adminAccessStub = {
  requireGroupAdmin: passthroughFactory,
  requireGroupAccess: passthroughFactory,
  requireGroupUserManagement: passthroughFactory,
  requireGroupSettings: passthroughFactory,
};
const groupNetworkAuthStub = {
  requireGroupManagerAccess: passthroughFactory,
  requireGroupAdminAccess: passthroughFactory,
  requireGroupMemberManagementAccess: passthroughFactory,
};

const router = proxyquire("../groups.routes", {
  "@controllers/group.controller": controllerStub,
  "@middleware/passport": passportStub,
  "@middleware/permissionAuth": permissionAuthStub,
  "@middleware/adminAccess": adminAccessStub,
  "@middleware/groupNetworkAuth": groupNetworkAuthStub,
});

describe("v2 groups route", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/", router);
    // group.routes.js's own middleware reports failures via
    // next(new HttpError(...)); an app-level error handler is needed to turn
    // that into an actual HTTP response, the way the real app does.
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message,
        errors: err.errors || {},
      });
    });

    enhancedJWTAuthImpl = (req, res, next) => {
      req.user = { _id: USER_ID };
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
    it("returns 200 when the request is valid", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ groups: [] });
      };

      const response = await request(app).get("/").query({ tenant: "airqo" });
      expect(response.status).to.equal(200);
    });

    it("returns 200 when tenant is not provided (it's optional)", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ groups: [] });
      };

      const response = await request(app).get("/");
      expect(response.status).to.equal(200);
    });

    it("returns 400 for an invalid tenant", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ groups: [] });
      };

      const response = await request(app)
        .get("/")
        .query({ tenant: "not-a-real-tenant" });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "Invalid tenant. Must be one of: airqo"
      );
    });

    it("returns 400 when grp_id is not a valid object id", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app)
        .get("/")
        .query({ grp_id: "not-a-valid-id" });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "grp_id must be an object ID IF provided"
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

  describe("GET /summary", () => {
    it("returns 200 when the request is valid", async () => {
      listSummaryImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ groups: [] });
      };

      const response = await request(app)
        .get("/summary")
        .query({ tenant: "airqo" });
      expect(response.status).to.equal(200);
    });

    it("returns 400 for an invalid tenant", async () => {
      listSummaryImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app)
        .get("/summary")
        .query({ tenant: "not-a-real-tenant" });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "Invalid tenant. Must be one of: airqo"
      );
    });
  });

  describe("POST /", () => {
    it("returns 200 and creates a new group with valid data", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ created_group: {} });
      };

      const response = await request(app).post("/").send({
        grp_title: "Test Group",
        grp_description: "A group used in tests",
      });

      expect(response.status).to.equal(200);
    });

    it("returns 400 when grp_title is missing", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app)
        .post("/")
        .send({ grp_description: "A group used in tests" });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal("the grp_title is required");
    });

    it("returns 400 when grp_description is missing", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app)
        .post("/")
        .send({ grp_title: "Test Group" });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "the grp_description is required"
      );
    });

    it("returns 400 when grp_title contains disallowed characters", async () => {
      createImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app).post("/").send({
        grp_title: "Not Allowed!!",
        grp_description: "A group used in tests",
      });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "the grp_title can only contain letters, numbers, spaces, hyphens and underscores"
      );
    });
  });

  describe("GET /:grp_id", () => {
    it("returns 200 and group data with a valid grp_id", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ groups: {} });
      };

      const response = await request(app).get(`/${GROUP_ID}`);
      expect(response.status).to.equal(200);
    });

    it("returns 400 for an invalid grp_id", async () => {
      listImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app).get("/not-a-valid-id");

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal("grp_id must be an object ID");
    });
  });

  describe("PUT /:grp_id", () => {
    it("returns 200 and updates the group with valid data", async () => {
      updateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ updated_group: {} });
      };

      const response = await request(app)
        .put(`/${GROUP_ID}`)
        .send({ grp_description: "Updated Description", grp_status: "ACTIVE" });

      expect(response.status).to.equal(200);
    });

    it("returns 400 for an invalid grp_id", async () => {
      updateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app)
        .put("/not-a-valid-id")
        .send({ grp_description: "Updated Description" });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "The group ID parameter must be a valid MongoDB ObjectId."
      );
    });

    it("returns 400 when grp_status is not ACTIVE or INACTIVE", async () => {
      updateImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app)
        .put(`/${GROUP_ID}`)
        .send({ grp_status: "not-a-status" });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "the grp_status value is not among the expected ones, use ACTIVE or INACTIVE"
      );
    });
  });

  describe("DELETE /:grp_id", () => {
    it("returns 200 and deletes the group with a valid grp_id", async () => {
      deleteImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ deleted_group: {} });
      };

      const response = await request(app).delete(`/${GROUP_ID}`);
      expect(response.status).to.equal(200);
    });

    it("returns 400 for an invalid grp_id", async () => {
      deleteImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app).delete("/not-a-valid-id");

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "The group ID parameter must be a valid MongoDB ObjectId."
      );
    });
  });

  describe("PUT /:grp_id/assign-user/:user_id", () => {
    it("returns 200 and assigns a user to the group with valid ids", async () => {
      assignOneUserImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ updated_group: {} });
      };

      const response = await request(app).put(
        `/${GROUP_ID}/assign-user/${USER_ID}`
      );

      expect(response.status).to.equal(200);
    });

    it("returns 400 with a nested message for an invalid user_id", async () => {
      assignOneUserImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app).put(
        `/${GROUP_ID}/assign-user/not-a-valid-id`
      );

      expect(response.status).to.equal(400);
      // user_id validation is wrapped in oneOf(), so express-validator
      // reports a generic "Invalid value(s)" as the top-level message and
      // puts the field-specific message under nestedErrors.
      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "the user ID parameter must be an object ID"
      );
    });

    it("returns 400 for an invalid grp_id", async () => {
      assignOneUserImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app).put(
        `/not-a-valid-id/assign-user/${USER_ID}`
      );

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "The group ID parameter must be a valid MongoDB ObjectId."
      );
    });
  });

  describe("POST /:grp_id/assign-users", () => {
    it("returns 200 and assigns users to the group with valid data", async () => {
      assignUsersImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ updated_group: {} });
      };

      const response = await request(app)
        .post(`/${GROUP_ID}/assign-users`)
        .send({ user_ids: [USER_ID] });

      expect(response.status).to.equal(200);
    });

    it("returns 400 when user_ids is missing", async () => {
      assignUsersImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app)
        .post(`/${GROUP_ID}/assign-users`)
        .send({});

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "the user_ids should be provided"
      );
    });

    it("returns 400 when a user_ids entry is not a valid object id", async () => {
      assignUsersImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app)
        .post(`/${GROUP_ID}/assign-users`)
        .send({ user_ids: ["not-a-valid-id"] });

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "user_id provided must be an object ID"
      );
    });
  });

  describe("DELETE /:grp_id/unassign-user/:user_id", () => {
    it("returns 200 and unassigns the user with valid ids", async () => {
      unAssignUserImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ updated_group: {} });
      };

      const response = await request(app).delete(
        `/${GROUP_ID}/unassign-user/${USER_ID}`
      );

      expect(response.status).to.equal(200);
    });

    it("returns 400 with a nested message for an invalid user_id", async () => {
      unAssignUserImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app).delete(
        `/${GROUP_ID}/unassign-user/not-a-valid-id`
      );

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal("Invalid value(s)");
      expect(response.body.errors[0].nestedErrors[0].msg).to.equal(
        "the user ID parameter must be an object ID"
      );
    });
  });

  describe("DELETE /:grp_id/unassign-many-users", () => {
    it("returns 200 and unassigns multiple users with valid data", async () => {
      unAssignManyUsersImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ updated_group: {} });
      };

      const response = await request(app)
        .delete(`/${GROUP_ID}/unassign-many-users`)
        .send({ user_ids: [USER_ID] });

      expect(response.status).to.equal(200);
    });

    it("returns 400 when user_ids is missing", async () => {
      unAssignManyUsersImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app)
        .delete(`/${GROUP_ID}/unassign-many-users`)
        .send({});

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "the user_ids should be provided"
      );
    });
  });

  describe("GET /:grp_id/assigned-users", () => {
    it("returns 200 with a valid grp_id", async () => {
      listAssignedUsersImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ assigned_users: [] });
      };

      const response = await request(app).get(`/${GROUP_ID}/assigned-users`);
      expect(response.status).to.equal(200);
    });

    it("returns 400 for an invalid grp_id", async () => {
      listAssignedUsersImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app).get(
        "/not-a-valid-id/assigned-users"
      );

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "The group ID parameter must be a valid MongoDB ObjectId."
      );
    });
  });

  describe("GET /:grp_id/available-users", () => {
    it("returns 200 with a valid grp_id", async () => {
      listAvailableUsersImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({ available_users: [] });
      };

      const response = await request(app).get(`/${GROUP_ID}/available-users`);
      expect(response.status).to.equal(200);
    });

    it("returns 400 for an invalid grp_id", async () => {
      listAvailableUsersImpl = (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
          return res.status(400).json({ errors: errors.array() });
        return res.status(200).json({});
      };

      const response = await request(app).get(
        "/not-a-valid-id/available-users"
      );

      expect(response.status).to.equal(400);
      expect(response.body.errors[0].msg).to.equal(
        "The group ID parameter must be a valid MongoDB ObjectId."
      );
    });
  });
});
