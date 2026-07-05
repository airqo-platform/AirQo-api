require("module-alias/register");
const ORIG_TENANTS_ENV = process.env.TENANTS;
process.env.TENANTS = "kcca,airqo,airqount";
const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const { expect } = chai;
const express = require("express");
const request = require("supertest");
const { validationResult } = require("express-validator");

chai.use(sinonChai);

const constants = require("@config/constants");

const {
  list,
  listSummary,
  create,
  update,
  deleteRole,
  listUsersWithRole,
  listAvailableUsersForRole,
  assignManyUsersToRole,
  assignUserToRole,
  assignUserToRolePut,
  unAssignManyUsersFromRole,
  unAssignUserFromRole,
  listPermissionsForRole,
  listAvailablePermissionsForRole,
  assignPermissionToRole,
  unAssignManyPermissionsFromRole,
  updateRolePermissions,
  unAssignPermissionFromRole,
  getRoleById,
  pagination,
  bulkRoleOperations,
  cleanupUserNetworkRoles,
  migrateNetworkRolesToGroup,
} = require("@validators/roles.validators");

const mongoose = require("mongoose");
const validObjectId = new mongoose.Types.ObjectId().toHexString();

function buildApp(middleware) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  const middlewareArray = Array.isArray(middleware) ? middleware.flat() : [middleware];
  app.get("/test", ...middlewareArray, (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    res.json({ success: true });
  });
  app.post("/test", ...middlewareArray, (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    res.json({ success: true });
  });
  app.put("/test/:role_id/:user_id", ...middlewareArray, (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    res.json({ success: true });
  });
  app.delete("/test/:role_id", ...middlewareArray, (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    res.json({ success: true });
  });
  return app;
}

describe("roles validators", () => {
  let origTenants;
  before(() => {
    origTenants = constants.TENANTS;
    constants.TENANTS = ["kcca", "airqo", "airqount"];
  });
  after(() => {
    constants.TENANTS = origTenants;
    process.env.TENANTS = ORIG_TENANTS_ENV;
  });

  describe("pagination middleware", () => {
    it("should set limit and skip with valid values", () => {
      const req = { query: { limit: "20", skip: "5" } };
      const res = {};
      const next = sinon.stub();

      pagination(req, res, next);

      expect(req.query.limit).to.equal(20);
      expect(req.query.skip).to.equal(5);
      expect(next.calledOnce).to.equal(true);
    });

    it("should default limit to 100 and skip to 0 for invalid values", () => {
      const req = { query: { limit: "abc", skip: "-5" } };
      const res = {};
      const next = sinon.stub();

      pagination(req, res, next);

      expect(req.query.limit).to.equal(100);
      expect(req.query.skip).to.equal(0);
      expect(next.calledOnce).to.equal(true);
    });

    it("should default when limit and skip are missing", () => {
      const req = { query: {} };
      const res = {};
      const next = sinon.stub();

      pagination(req, res, next);

      expect(req.query.limit).to.equal(100);
      expect(req.query.skip).to.equal(0);
    });
  });

  describe("list validators", () => {
    it("should pass with valid airqo tenant", async () => {
      const app = buildApp(list);
      const response = await request(app)
        .get("/test")
        .query({ tenant: "airqo" });

      expect(response.status).to.equal(200);
    });

    it("should fail with invalid tenant", async () => {
      const app = buildApp(list);
      const response = await request(app)
        .get("/test")
        .query({ tenant: "invalid_tenant" });

      expect(response.status).to.equal(422);
      const msgs = response.body.errors.map((e) => e.msg);
      expect(msgs).to.include("the tenant value is not among the expected ones");
    });

    it("should pass when tenant is omitted (optional)", async () => {
      const app = buildApp(listSummary);
      const response = await request(app).get("/test");

      expect(response.status).to.equal(200);
    });
  });

  describe("create validators", () => {
    it("should fail when neither network_id nor group_id is provided", async () => {
      const app = buildApp(create);
      const response = await request(app)
        .post("/test")
        .query({ tenant: "airqo" })
        .send({ role_name: "TEST_ROLE" });

      expect(response.status).to.equal(422);
    });

    it("should fail when role_name is missing", async () => {
      const app = buildApp(create);
      const response = await request(app)
        .post("/test")
        .query({ tenant: "airqo" })
        .send({ group_id: validObjectId });

      expect(response.status).to.equal(422);
    });

    it("should pass with valid group_id and role_name", async () => {
      const app = buildApp(create);
      const response = await request(app)
        .post("/test")
        .query({ tenant: "airqo" })
        .send({ group_id: validObjectId, role_name: "test role" });

      expect(response.status).to.equal(200);
    });

    it("should fail when both network_id and group_id are provided", async () => {
      const app = buildApp(create);
      const response = await request(app)
        .post("/test")
        .query({ tenant: "airqo" })
        .send({ group_id: validObjectId, network_id: validObjectId, role_name: "test role" });

      expect(response.status).to.equal(422);
    });
  });

  describe("update validators", () => {
    it("should fail when role_id param is missing", async () => {
      const app = express();
      app.use(express.json());
      const flat = Array.isArray(update) ? update.flat() : [update];
      app.put("/test", ...flat, (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
        res.json({ success: true });
      });

      const response = await request(app)
        .put("/test")
        .query({ tenant: "airqo" })
        .send({ role_status: "ACTIVE" });

      expect(response.status).to.equal(422);
    });

    it("should fail validation because role_name and role_code are disallowed (not().isEmpty() on absent field still fires)", async () => {
      const app = express();
      app.use(express.json());
      const flat = Array.isArray(update) ? update.flat() : [update];
      app.put("/test/:role_id", ...flat, (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
        res.json({ success: true });
      });

      const response = await request(app)
        .put(`/test/${validObjectId}`)
        .query({ tenant: "airqo" })
        .send({ role_status: "ACTIVE" });

      expect(response.status).to.equal(422);
      const msgs = response.body.errors.map((e) => e.msg);
      expect(msgs.some((m) => m.includes("role_code") || m.includes("role_name"))).to.equal(true);
    });
  });

  describe("deleteRole validators", () => {
    it("should fail when role_id param is an invalid ObjectId", async () => {
      const app = express();
      app.use(express.json());
      const flat = Array.isArray(deleteRole) ? deleteRole.flat() : [deleteRole];
      app.delete("/test/:role_id", ...flat, (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
        res.json({ success: true });
      });

      const response = await request(app)
        .delete("/test/not-an-objectid")
        .query({ tenant: "airqo" });

      expect(response.status).to.equal(422);
    });

    it("should pass with valid role_id param", async () => {
      const app = express();
      app.use(express.json());
      const flat = Array.isArray(deleteRole) ? deleteRole.flat() : [deleteRole];
      app.delete("/test/:role_id", ...flat, (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
        res.json({ success: true });
      });

      const response = await request(app)
        .delete(`/test/${validObjectId}`)
        .query({ tenant: "airqo" });

      expect(response.status).to.equal(200);
    });
  });

  describe("assignManyUsersToRole validators", () => {
    it("should fail when user_ids is not provided", async () => {
      const app = express();
      app.use(express.json());
      const flat = Array.isArray(assignManyUsersToRole) ? assignManyUsersToRole.flat() : [assignManyUsersToRole];
      app.post("/test/:role_id", ...flat, (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
        res.json({ success: true });
      });

      const response = await request(app)
        .post(`/test/${validObjectId}`)
        .query({ tenant: "airqo" })
        .send({});

      expect(response.status).to.equal(422);
    });

    it("should pass with valid user_ids array", async () => {
      const app = express();
      app.use(express.json());
      const flat = Array.isArray(assignManyUsersToRole) ? assignManyUsersToRole.flat() : [assignManyUsersToRole];
      app.post("/test/:role_id", ...flat, (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
        res.json({ success: true });
      });

      const response = await request(app)
        .post(`/test/${validObjectId}`)
        .query({ tenant: "airqo" })
        .send({ user_ids: [validObjectId] });

      expect(response.status).to.equal(200);
    });

    it("should fail when user_ids is not an array", async () => {
      const app = express();
      app.use(express.json());
      const flat = Array.isArray(assignManyUsersToRole) ? assignManyUsersToRole.flat() : [assignManyUsersToRole];
      app.post("/test/:role_id", ...flat, (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
        res.json({ success: true });
      });

      const response = await request(app)
        .post(`/test/${validObjectId}`)
        .query({ tenant: "airqo" })
        .send({ user_ids: "not-an-array" });

      expect(response.status).to.equal(422);
    });
  });

  describe("assignUserToRole validators", () => {
    it("should fail when user field is missing", async () => {
      const app = express();
      app.use(express.json());
      const flat = Array.isArray(assignUserToRole) ? assignUserToRole.flat() : [assignUserToRole];
      app.post("/test/:role_id", ...flat, (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
        res.json({ success: true });
      });

      const response = await request(app)
        .post(`/test/${validObjectId}`)
        .query({ tenant: "airqo" })
        .send({});

      expect(response.status).to.equal(422);
    });

    it("should pass with valid user ObjectId", async () => {
      const app = express();
      app.use(express.json());
      const flat = Array.isArray(assignUserToRole) ? assignUserToRole.flat() : [assignUserToRole];
      app.post("/test/:role_id", ...flat, (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
        res.json({ success: true });
      });

      const response = await request(app)
        .post(`/test/${validObjectId}`)
        .query({ tenant: "airqo" })
        .send({ user: validObjectId });

      expect(response.status).to.equal(200);
    });
  });

  describe("assignPermissionToRole validators", () => {
    it("should fail when permissions is missing", async () => {
      const app = express();
      app.use(express.json());
      const flat = Array.isArray(assignPermissionToRole) ? assignPermissionToRole.flat() : [assignPermissionToRole];
      app.post("/test/:role_id", ...flat, (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
        res.json({ success: true });
      });

      const response = await request(app)
        .post(`/test/${validObjectId}`)
        .query({ tenant: "airqo" })
        .send({});

      expect(response.status).to.equal(422);
    });

    it("should pass with valid permissions array", async () => {
      const app = express();
      app.use(express.json());
      const flat = Array.isArray(assignPermissionToRole) ? assignPermissionToRole.flat() : [assignPermissionToRole];
      app.post("/test/:role_id", ...flat, (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
        res.json({ success: true });
      });

      const response = await request(app)
        .post(`/test/${validObjectId}`)
        .query({ tenant: "airqo" })
        .send({ permissions: [validObjectId] });

      expect(response.status).to.equal(200);
    });
  });

  describe("bulkRoleOperations validators", () => {
    it("should fail when operation is invalid", async () => {
      const app = buildApp(bulkRoleOperations);
      const response = await request(app)
        .post("/test")
        .query({ tenant: "airqo" })
        .send({
          operation: "invalid_operation",
          user_ids: [validObjectId],
          role_id: validObjectId,
        });

      expect(response.status).to.equal(422);
    });

    it("should pass with valid assign operation", async () => {
      const app = buildApp(bulkRoleOperations);
      const response = await request(app)
        .post("/test")
        .query({ tenant: "airqo" })
        .send({
          operation: "assign",
          user_ids: [validObjectId],
          role_id: validObjectId,
        });

      expect(response.status).to.equal(200);
    });

    it("should fail when user_ids is missing", async () => {
      const app = buildApp(bulkRoleOperations);
      const response = await request(app)
        .post("/test")
        .query({ tenant: "airqo" })
        .send({
          operation: "assign",
          role_id: validObjectId,
        });

      expect(response.status).to.equal(422);
    });
  });

  describe("cleanupUserNetworkRoles validators", () => {
    it("should pass with valid tenant and dry_run=true", async () => {
      const app = buildApp(cleanupUserNetworkRoles);
      const response = await request(app)
        .get("/test")
        .query({ tenant: "airqo", dry_run: "true" });

      expect(response.status).to.equal(200);
    });

    it("should fail with invalid dry_run value", async () => {
      const app = buildApp(cleanupUserNetworkRoles);
      const response = await request(app)
        .get("/test")
        .query({ tenant: "airqo", dry_run: "yes" });

      expect(response.status).to.equal(422);
    });
  });

  describe("migrateNetworkRolesToGroup validators", () => {
    it("should pass with valid tenant and dry_run", async () => {
      const app = buildApp(migrateNetworkRolesToGroup);
      const response = await request(app)
        .get("/test")
        .query({ tenant: "airqo", dry_run: "false" });

      expect(response.status).to.equal(200);
    });

    it("should fail with invalid action value", async () => {
      const app = buildApp(migrateNetworkRolesToGroup);
      const response = await request(app)
        .get("/test")
        .query({ tenant: "airqo", action: "invalid_action" });

      expect(response.status).to.equal(422);
    });

    it("should pass with valid action=delete_zero_user", async () => {
      const app = buildApp(migrateNetworkRolesToGroup);
      const response = await request(app)
        .get("/test")
        .query({ tenant: "airqo", action: "delete_zero_user" });

      expect(response.status).to.equal(200);
    });
  });
});
