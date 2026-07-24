require("module-alias/register");
const chai = require("chai");
const chaiHttp = require("chai-http");
const { expect } = chai;
chai.use(chaiHttp);
const sinon = require("sinon");
const proxyquire = require("proxyquire");
const supertest = require("supertest");
const express = require("express");
const httpStatus = require("http-status");
const { extractErrorsFromRequest, HttpError } = require("@utils/shared");

// Express captures each route handler by reference at router-registration
// time (which happens once, when this router file is required), so
// reassigning `roleController.list` etc. from inside a test has no effect on
// already-registered routes. Instead we register stable wrapper functions
// that delegate to per-test-mutable *Impl variables, and stub the auth /
// admin-check middleware (which would otherwise require a real JWT and a
// real DB-backed admin role lookup) to always call next().
let listImpl;
let listSummaryImpl;
let createImpl;
let updateImpl;
let deleteImpl;
let assignUserToRoleImpl;
let unAssignUserFromRoleImpl;
let assignPermissionToRoleImpl;
let unAssignPermissionFromRoleImpl;

const roleControllerStub = {
  list: (req, res, next) => listImpl(req, res, next),
  listSummary: (req, res, next) => listSummaryImpl(req, res, next),
  create: (req, res, next) => createImpl(req, res, next),
  update: (req, res, next) => updateImpl(req, res, next),
  delete: (req, res, next) => deleteImpl(req, res, next),
  assignUserToRole: (req, res, next) => assignUserToRoleImpl(req, res, next),
  unAssignUserFromRole: (req, res, next) =>
    unAssignUserFromRoleImpl(req, res, next),
  assignPermissionToRole: (req, res, next) =>
    assignPermissionToRoleImpl(req, res, next),
  unAssignPermissionFromRole: (req, res, next) =>
    unAssignPermissionFromRoleImpl(req, res, next),
};

const passportStub = {
  enhancedJWTAuth: (req, res, next) => next(),
};

// roles.routes.js additionally gates GET /summary behind
// requireSystemAdmin() from @middleware/adminAccess, which in production
// does a real DB-backed role/permission lookup. Stub it the same way as
// passport so admin-gated routes are reachable in isolation. Note
// requireSystemAdmin is a factory (called once at router-registration time
// to produce the actual middleware), so the stub must mirror that shape.
const adminAccessStub = {
  requireSystemAdmin: () => (req, res, next) => next(),
};

const router = proxyquire("@routes/v2/roles.routes", {
  "@controllers/role.controller": roleControllerStub,
  "@middleware/passport": passportStub,
  "@middleware/adminAccess": adminAccessStub,
});

// Most routes in roles.routes.js run the shared `validate` middleware
// (@validators/common/validate.validators.js) between the express-validator
// chains and the controller. On failure it calls
// next(new HttpError("Validation Error", 400, extractErrorsFromRequest(req)))
// -- i.e. it short-circuits before ever reaching our controller stub, so for
// those routes the *Impl functions below only need to handle the success
// path.
//
// A couple of routes (e.g. DELETE /:role_id/user/:user_id) omit `validate`
// entirely; in production the real controller performs the equivalent check
// itself via a `validateAndSetupRequest` helper that also uses
// extractErrorsFromRequest()/HttpError, just with a different message
// ("bad request errors" instead of "Validation Error"). withValidation()
// reproduces that helper's behavior so the one route exercising that path is
// tested against real, reachable behavior rather than being skipped.
const withValidation = (successResponder) => (req, res, next) => {
  const errors = extractErrorsFromRequest(req);
  if (errors) {
    return next(
      new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
    );
  }
  return successResponder(req, res);
};

describe("Roles Router API Tests", () => {
  let app;
  let request;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/", router);
    // Minimal stand-in for the HttpError branch of bin/server.js's global
    // error handler (the rest of that handler pulls in activity-logging and
    // other app-bootstrap concerns unrelated to what's under test here).
    // This is what `validate` and withValidation() above ultimately funnel
    // validation failures into, via next(err).
    app.use((err, req, res, next) => {
      if (err instanceof HttpError) {
        return res.status(err.statusCode).json({
          success: false,
          message: err.message,
          errors: err.errors ?? { message: err.message },
        });
      }
      return res.status(err.status || err.statusCode || 500).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: err.message },
      });
    });
    request = supertest(app);
  });

  afterEach(() => {
    sinon.restore();
  });

  const roleId = "60d21b4667d0d8992e610c85";
  const userId = "60d21b4667d0d8992e610c90";
  const permissionId = "60d21b4667d0d8992e610c91";
  const groupId = "60d21b4667d0d8992e610c92";

  describe("GET /", () => {
    it("should return a list of roles for valid (optional) query params", async () => {
      const fakeRoles = [{ role_name: "ROLE_ONE" }, { role_name: "ROLE_TWO" }];
      listImpl = (req, res) =>
        res.status(200).json({ success: true, roles: fakeRoles });

      const response = await request.get("/").expect(200);

      expect(response.body.roles).to.deep.equal(fakeRoles);
    });

    it("should return a 400 error for an invalid tenant", async () => {
      listImpl = (req, res) =>
        res.status(200).json({ success: true, roles: [] });

      const response = await request
        .get("/")
        .query({ tenant: "invalid_tenant" })
        .expect(400);

      // `validate` short-circuits before the controller stub runs; this is
      // not wrapped in oneOf() in roles.validators.js, so the specific
      // .withMessage() text is the real message directly.
      expect(response.body.message).to.equal("Validation Error");
      const tenantError = response.body.errors.find(
        (e) => e.param === "tenant"
      );
      expect(tenantError.message).to.equal(
        "the tenant value is not among the expected ones"
      );
    });

    it("should return a 400 error for a malformed network_id", async () => {
      listImpl = (req, res) =>
        res.status(200).json({ success: true, roles: [] });

      const response = await request
        .get("/")
        .query({ network_id: "not-a-mongo-id" })
        .expect(400);

      const networkIdError = response.body.errors.find(
        (e) => e.param === "network_id"
      );
      expect(networkIdError.message).to.equal(
        "network_id must be an object ID"
      );
    });
  });

  describe("GET /summary", () => {
    it("should return a summary for a valid (optional) tenant", async () => {
      listSummaryImpl = (req, res) =>
        res.status(200).json({ success: true, roles_summary: [] });

      await request.get("/summary").expect(200);
    });

    it("should return a 400 error for an invalid tenant", async () => {
      listSummaryImpl = (req, res) =>
        res.status(200).json({ success: true, roles_summary: [] });

      const response = await request
        .get("/summary")
        .query({ tenant: "invalid_tenant" })
        .expect(400);

      const tenantError = response.body.errors.find(
        (e) => e.param === "tenant"
      );
      expect(tenantError.message).to.equal(
        "the tenant value is not among the expected ones"
      );
    });
  });

  describe("POST /", () => {
    it("should create a role given a group_id and role_name", async () => {
      const fakeRole = { _id: roleId, role_name: "NEW_ROLE" };
      createImpl = (req, res) =>
        res.status(201).json({ success: true, created_role: fakeRole });

      const response = await request
        .post("/")
        .send({ group_id: groupId, role_name: "New Role" })
        .expect(201);

      expect(response.body.created_role).to.deep.equal(fakeRole);
    });

    it("should return a 400 error when role_name is missing", async () => {
      createImpl = (req, res) =>
        res.status(201).json({ success: true, created_role: {} });

      const response = await request
        .post("/")
        .send({ group_id: groupId })
        .expect(400);

      const roleNameError = response.body.errors.find(
        (e) => e.param === "role_name"
      );
      expect(roleNameError.message).to.equal(
        "role_name is missing in your request"
      );
    });

    it("should return a 400 error when both network_id and group_id are provided", async () => {
      createImpl = (req, res) =>
        res.status(201).json({ success: true, created_role: {} });

      const response = await request
        .post("/")
        .send({
          group_id: groupId,
          network_id: "60d21b4667d0d8992e610c99",
          role_name: "New Role",
        })
        .expect(400);

      expect(
        response.body.errors.some(
          (e) => e.message === "Cannot provide both network_id and group_id"
        )
      ).to.equal(true);
    });
  });

  describe("PUT /:role_id", () => {
    // roles.validators.js's `update` chain validates role_name/role_code
    // with `.not().isEmpty()` and no `.optional()`, despite the
    // .withMessage() text ("should not be provided when updating") implying
    // the opposite intent. Real, confirmed behavior (see manual
    // express-validator probe used while writing this test): the field
    // FAILS validation when omitted, and PASSES when given a non-empty
    // value -- i.e. the check is inverted from what it claims to enforce.
    // This is a pre-existing production validator bug, not something this
    // test suite fixes; every request below supplies non-empty role_name/
    // role_code purely so these two unrelated chains don't add spurious
    // errors on top of the specific thing each test means to exercise.
    const baseUpdateBody = { role_name: "Updated Role", role_code: "UPDATED_ROLE" };

    it("should update a role given a valid role_id and role_status", async () => {
      const fakeRole = { _id: roleId, role_status: "ACTIVE" };
      updateImpl = (req, res) =>
        res.status(200).json({ success: true, updated_role: fakeRole });

      const response = await request
        .put(`/${roleId}`)
        .send({ ...baseUpdateBody, role_status: "ACTIVE" })
        .expect(200);

      expect(response.body.updated_role).to.deep.equal(fakeRole);
    });

    it("should return a 400 error for an invalid role_status", async () => {
      updateImpl = (req, res) =>
        res.status(200).json({ success: true, updated_role: {} });

      const response = await request
        .put(`/${roleId}`)
        .send({ ...baseUpdateBody, role_status: "BOGUS" })
        .expect(400);

      const statusError = response.body.errors.find(
        (e) => e.param === "role_status"
      );
      expect(statusError.message).to.equal(
        "the status value is not among the expected ones which include: ACTIVE, INACTIVE"
      );
    });

    it("should return a 400 error for a malformed role_id param", async () => {
      updateImpl = (req, res) =>
        res.status(200).json({ success: true, updated_role: {} });

      const response = await request
        .put("/not-a-mongo-id")
        .send({ ...baseUpdateBody, role_status: "ACTIVE" })
        .expect(400);

      const roleIdError = response.body.errors.find(
        (e) => e.param === "role_id"
      );
      expect(roleIdError.message).to.equal("the role ID must be an object ID");
    });
  });

  describe("DELETE /:role_id", () => {
    it("should delete a role given a valid role_id", async () => {
      deleteImpl = (req, res) => res.status(200).json({ success: true });

      await request.delete(`/${roleId}`).expect(200);
    });

    it("should return a 400 error for a malformed role_id param", async () => {
      deleteImpl = (req, res) => res.status(200).json({ success: true });

      const response = await request
        .delete("/not-a-mongo-id")
        .expect(400);

      const roleIdError = response.body.errors.find(
        (e) => e.param === "role_id"
      );
      expect(roleIdError.message).to.equal("the role ID must be an object ID");
    });
  });

  describe("GET /:role_id", () => {
    it("should return a role's details for a valid role_id", async () => {
      // GET /:role_id is routed to the same controller method as GET /
      listImpl = (req, res) =>
        res.status(200).json({ success: true, roles: [{ _id: roleId }] });

      await request.get(`/${roleId}`).expect(200);
    });

    it("should return a 400 error for a malformed role_id param", async () => {
      listImpl = (req, res) =>
        res.status(200).json({ success: true, roles: [] });

      const response = await request.get("/not-a-mongo-id").expect(400);

      const roleIdError = response.body.errors.find(
        (e) => e.param === "role_id"
      );
      expect(roleIdError.message).to.equal("the role ID must be an object ID");
    });
  });

  describe("POST /:role_id/user", () => {
    it("should assign a single user to a role", async () => {
      assignUserToRoleImpl = (req, res) =>
        res.status(200).json({ success: true, user_assigned: userId });

      const response = await request
        .post(`/${roleId}/user`)
        .send({ user: userId })
        .expect(200);

      expect(response.body.user_assigned).to.equal(userId);
    });

    it("should return a 400 error when the user field is missing", async () => {
      assignUserToRoleImpl = (req, res) =>
        res.status(200).json({ success: true });

      const response = await request
        .post(`/${roleId}/user`)
        .send({})
        .expect(400);

      const userError = response.body.errors.find((e) => e.param === "user");
      expect(userError.message).to.equal(
        "the user ID is missing in the request body"
      );
    });

    it("should return a 400 error for an invalid user_type", async () => {
      assignUserToRoleImpl = (req, res) =>
        res.status(200).json({ success: true });

      const response = await request
        .post(`/${roleId}/user`)
        .send({ user: userId, user_type: "bogus" })
        .expect(400);

      const userTypeError = response.body.errors.find(
        (e) => e.param === "user_type"
      );
      expect(userTypeError.message).to.equal(
        "the user_type value is not among the expected ones"
      );
    });
  });

  describe("DELETE /:role_id/user/:user_id", () => {
    // This route (unlike most others in the file) does not run the shared
    // `validate` middleware, so the express-validator chains still attach
    // errors to `req` but nothing acts on them until the controller itself
    // checks -- see withValidation() above for why the response shape here
    // (message: "bad request errors") differs from the `validate`-gated
    // routes (message: "Validation Error") even though both ultimately go
    // through extractErrorsFromRequest()/HttpError.
    it("should unassign a user from a role given valid params", async () => {
      unAssignUserFromRoleImpl = withValidation((req, res) =>
        res.status(200).json({ success: true })
      );

      await request.delete(`/${roleId}/user/${userId}`).expect(200);
    });

    it("should return a 400 error for a malformed user_id param", async () => {
      unAssignUserFromRoleImpl = withValidation((req, res) =>
        res.status(200).json({ success: true })
      );

      const response = await request
        .delete(`/${roleId}/user/not-a-mongo-id`)
        .expect(400);

      expect(response.body.message).to.equal("bad request errors");
      const userIdError = response.body.errors.find(
        (e) => e.param === "user_id"
      );
      expect(userIdError.message).to.equal("the user ID must be an object ID");
    });
  });

  describe("POST /:role_id/permissions", () => {
    it("should assign permissions to a role", async () => {
      assignPermissionToRoleImpl = (req, res) =>
        res.status(200).json({ success: true, updated_role: { roleId } });

      await request
        .post(`/${roleId}/permissions`)
        .send({ permissions: [permissionId] })
        .expect(200);
    });

    it("should return a 400 error when permissions is missing", async () => {
      assignPermissionToRoleImpl = (req, res) =>
        res.status(200).json({ success: true });

      const response = await request
        .post(`/${roleId}/permissions`)
        .send({})
        .expect(400);

      const permissionsError = response.body.errors.find(
        (e) => e.param === "permissions"
      );
      expect(permissionsError.message).to.equal(
        "the permissions is missing in the request body"
      );
    });

    it("should return a 400 error when permissions is not an array", async () => {
      assignPermissionToRoleImpl = (req, res) =>
        res.status(200).json({ success: true });

      const response = await request
        .post(`/${roleId}/permissions`)
        .send({ permissions: "not-an-array" })
        .expect(400);

      const permissionsError = response.body.errors.find(
        (e) => e.param === "permissions"
      );
      expect(permissionsError.message).to.equal(
        "the permissions should be an array"
      );
    });
  });

  describe("DELETE /:role_id/permissions/:permission_id", () => {
    it("should unassign a single permission from a role", async () => {
      unAssignPermissionFromRoleImpl = (req, res) =>
        res.status(200).json({ success: true });

      await request
        .delete(`/${roleId}/permissions/${permissionId}`)
        .expect(200);
    });

    it("should return a 400 error for a malformed permission_id param", async () => {
      unAssignPermissionFromRoleImpl = (req, res) =>
        res.status(200).json({ success: true });

      const response = await request
        .delete(`/${roleId}/permissions/not-a-mongo-id`)
        .expect(400);

      const permissionIdError = response.body.errors.find(
        (e) => e.param === "permission_id"
      );
      expect(permissionIdError.message).to.equal(
        "the permission ID must be an object ID"
      );
    });
  });

  // Dummy test to keep Mocha from exiting prematurely
  it("Dummy test to keep Mocha from exiting prematurely", () => {
    expect(true).to.equal(true);
  });
});
