require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const rewire = require("rewire");
const httpStatus = require("http-status");

const rewireAdmin = rewire("@utils/admin.util");

describe("admin util", () => {
  let req, next;
  let origUserModel, origRoleModel, origPermissionModel, origGroupModel;

  beforeEach(() => {
    req = {
      body: {},
      query: { tenant: "airqo" },
      params: {},
      user: {
        _id: "user-id-123",
        email: "admin@airqo.net",
      },
    };
    next = sinon.stub();

    origUserModel = rewireAdmin.__get__("UserModel");
    origRoleModel = rewireAdmin.__get__("RoleModel");
    origPermissionModel = rewireAdmin.__get__("PermissionModel");
    origGroupModel = rewireAdmin.__get__("GroupModel");
  });

  afterEach(() => {
    rewireAdmin.__set__("UserModel", origUserModel);
    rewireAdmin.__set__("RoleModel", origRoleModel);
    rewireAdmin.__set__("PermissionModel", origPermissionModel);
    rewireAdmin.__set__("GroupModel", origGroupModel);
    sinon.restore();
  });

  describe("checkRBACHealth()", () => {
    it("should return healthy status when permissions and roles exist", async () => {
      rewireAdmin.__set__("PermissionModel", () => ({
        countDocuments: sinon.stub().resolves(10),
      }));
      const roleCountStub = sinon.stub().onFirstCall().resolves(5).onSecondCall().resolves(3);
      const sharedRoleModel = { countDocuments: roleCountStub };
      rewireAdmin.__set__("RoleModel", () => sharedRoleModel);

      const result = await rewireAdmin.checkRBACHealth(req, next);

      expect(result.success).to.equal(true);
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data.status).to.equal("healthy");
    });

    it("should return unhealthy when no permissions exist", async () => {
      rewireAdmin.__set__("PermissionModel", () => ({
        countDocuments: sinon.stub().resolves(0),
      }));
      const roleCountStub = sinon.stub().onFirstCall().resolves(5).onSecondCall().resolves(0);
      const sharedRoleModel = { countDocuments: roleCountStub };
      rewireAdmin.__set__("RoleModel", () => sharedRoleModel);

      const result = await rewireAdmin.checkRBACHealth(req, next);

      expect(result.success).to.equal(true);
      expect(result.data.status).to.equal("unhealthy");
    });

    it("should call next with HttpError on unexpected error", async () => {
      rewireAdmin.__set__("PermissionModel", () => ({
        countDocuments: sinon.stub().throws(new Error("DB failure")),
      }));

      await rewireAdmin.checkRBACHealth(req, next);

      expect(next.calledOnce).to.equal(true);
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("auditUsers()", () => {
    it("should return audit data for listed users", async () => {
      const users = [
        {
          _id: "uid1",
          email: "u@example.com",
          firstName: "U",
          lastName: "Ser",
          group_roles: [{ role: "r1" }],
          network_roles: [],
          role: null,
          privilege: null,
          organization: null,
          createdAt: new Date(),
          lastLogin: null,
        },
      ];

      rewireAdmin.__set__("UserModel", () => ({
        list: sinon.stub().resolves({ success: true, data: users }),
      }));

      const origGenerateFilter = rewireAdmin.__get__("generateFilter");
      rewireAdmin.__set__("generateFilter", {
        ...origGenerateFilter,
        admin: sinon.stub().returns({}),
      });

      const result = await rewireAdmin.auditUsers(req, next);

      expect(result.success).to.equal(true);
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.be.an("array").with.lengthOf(1);
      expect(result.data[0]).to.have.property("has_group_roles", true);

      rewireAdmin.__set__("generateFilter", origGenerateFilter);
    });

    it("should forward failure when UserModel.list fails", async () => {
      rewireAdmin.__set__("UserModel", () => ({
        list: sinon.stub().resolves({
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: "DB error",
        }),
      }));

      const origGenerateFilter = rewireAdmin.__get__("generateFilter");
      rewireAdmin.__set__("generateFilter", {
        ...origGenerateFilter,
        admin: sinon.stub().returns({}),
      });

      const result = await rewireAdmin.auditUsers(req, next);

      expect(result.success).to.equal(false);

      rewireAdmin.__set__("generateFilter", origGenerateFilter);
    });
  });

  describe("auditRoles()", () => {
    it("should return role audit data", async () => {
      const roles = [
        {
          _id: "role1",
          role_name: "AIRQO_ADMIN",
          role_code: "AIRQO_ADMIN",
          role_permissions: ["p1", "p2"],
          role_status: "ACTIVE",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      rewireAdmin.__set__("RoleModel", () => ({
        list: sinon.stub().resolves({ success: true, data: roles }),
      }));

      const origGenerateFilter = rewireAdmin.__get__("generateFilter");
      rewireAdmin.__set__("generateFilter", {
        ...origGenerateFilter,
        admin: sinon.stub().returns({}),
      });

      const result = await rewireAdmin.auditRoles(req, next);

      expect(result.success).to.equal(true);
      expect(result.data[0]).to.have.property("permissions_count", 2);

      rewireAdmin.__set__("generateFilter", origGenerateFilter);
    });
  });

  describe("auditPermissions()", () => {
    it("should return permission audit data", async () => {
      const permissions = [
        {
          _id: "perm1",
          permission: "READ_USERS",
          resource: "users",
          operation: "read",
          description: "Can read users",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      rewireAdmin.__set__("PermissionModel", () => ({
        list: sinon.stub().resolves({ success: true, data: permissions }),
      }));

      const origGenerateFilter = rewireAdmin.__get__("generateFilter");
      rewireAdmin.__set__("generateFilter", {
        ...origGenerateFilter,
        admin: sinon.stub().returns({}),
      });

      const result = await rewireAdmin.auditPermissions(req, next);

      expect(result.success).to.equal(true);
      expect(result.data[0]).to.have.property("permission", "READ_USERS");

      rewireAdmin.__set__("generateFilter", origGenerateFilter);
    });
  });

  describe("resetRBACSystem()", () => {
    it("should return forbidden when secret is invalid", async () => {
      const origSetupSecret = rewireAdmin.__get__("SETUP_SECRET");
      rewireAdmin.__set__("SETUP_SECRET", "correct-secret");

      req.body = { secret: "wrong-secret" };

      const result = await rewireAdmin.resetRBACSystem(req, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.FORBIDDEN);

      rewireAdmin.__set__("SETUP_SECRET", origSetupSecret);
    });
  });

  describe("initializeRBAC()", () => {
    it("should return forbidden when secret is invalid", async () => {
      const origSetupSecret = rewireAdmin.__get__("SETUP_SECRET");
      rewireAdmin.__set__("SETUP_SECRET", "correct-secret");

      req.body = { secret: "bad-secret" };

      const result = await rewireAdmin.initializeRBAC(req, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.FORBIDDEN);

      rewireAdmin.__set__("SETUP_SECRET", origSetupSecret);
    });

    it("should return already initialized when permissions and roles exist", async () => {
      const origSetupSecret = rewireAdmin.__get__("SETUP_SECRET");
      rewireAdmin.__set__("SETUP_SECRET", "correct-secret");

      req.body = { secret: "correct-secret", force: false };

      rewireAdmin.__set__("PermissionModel", () => ({
        countDocuments: sinon.stub().resolves(5),
      }));
      rewireAdmin.__set__("RoleModel", () => ({
        countDocuments: sinon.stub().resolves(3),
      }));

      const result = await rewireAdmin.initializeRBAC(req, next);

      expect(result.success).to.equal(true);
      expect(result.data.message).to.equal("RBAC already initialized");

      rewireAdmin.__set__("SETUP_SECRET", origSetupSecret);
    });
  });

  describe("bulkAdminOperations()", () => {
    it("should return forbidden when secret is invalid", async () => {
      const origSetupSecret = rewireAdmin.__get__("SETUP_SECRET");
      rewireAdmin.__set__("SETUP_SECRET", "correct-secret");

      req.body = { secret: "wrong", operation: "audit_users", user_ids: [] };

      const result = await rewireAdmin.bulkAdminOperations(req, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.FORBIDDEN);

      rewireAdmin.__set__("SETUP_SECRET", origSetupSecret);
    });

    it("should return bad request for unknown operation", async () => {
      const origSetupSecret = rewireAdmin.__get__("SETUP_SECRET");
      rewireAdmin.__set__("SETUP_SECRET", "correct-secret");

      req.body = { secret: "correct-secret", operation: "unknown_op", user_ids: ["uid1"] };

      const result = await rewireAdmin.bulkAdminOperations(req, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);

      rewireAdmin.__set__("SETUP_SECRET", origSetupSecret);
    });
  });

  describe("clearCache()", () => {
    it("should return forbidden when secret is invalid", async () => {
      const origSetupSecret = rewireAdmin.__get__("SETUP_SECRET");
      rewireAdmin.__set__("SETUP_SECRET", "valid-secret");

      req.body = { secret: "invalid" };

      const result = await rewireAdmin.clearCache(req, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.FORBIDDEN);

      rewireAdmin.__set__("SETUP_SECRET", origSetupSecret);
    });
  });

  describe("databaseCleanup()", () => {
    it("should return forbidden when secret is invalid", async () => {
      const origSetupSecret = rewireAdmin.__get__("SETUP_SECRET");
      rewireAdmin.__set__("SETUP_SECRET", "valid-secret");

      req.body = { secret: "bad" };

      const result = await rewireAdmin.databaseCleanup(req, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.FORBIDDEN);

      rewireAdmin.__set__("SETUP_SECRET", origSetupSecret);
    });

    it("should succeed with valid secret", async () => {
      const origSetupSecret = rewireAdmin.__get__("SETUP_SECRET");
      rewireAdmin.__set__("SETUP_SECRET", "valid-secret");

      req.body = { secret: "valid-secret" };

      const result = await rewireAdmin.databaseCleanup(req, next);

      expect(result.success).to.equal(true);

      rewireAdmin.__set__("SETUP_SECRET", origSetupSecret);
    });
  });

  describe("getCurrentConfig()", () => {
    it("should return current admin configuration", async () => {
      const result = await rewireAdmin.getCurrentConfig(req, next);

      expect(result.success).to.equal(true);
      expect(result.data).to.have.property("features");
      expect(result.data).to.have.property("safety_checks");
    });
  });

  describe("getDocs()", () => {
    it("should return admin documentation", async () => {
      const result = await rewireAdmin.getDocs(req, next);

      expect(result.success).to.equal(true);
      expect(result.data).to.have.property("endpoints");
    });
  });

  describe("dropIndex()", () => {
    it("should return forbidden when secret is invalid", async () => {
      const origSetupSecret = rewireAdmin.__get__("SETUP_SECRET");
      rewireAdmin.__set__("SETUP_SECRET", "valid-secret");

      req.body = { secret: "bad", collectionName: "users", indexName: "email_1" };

      const result = await rewireAdmin.dropIndex(req, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.FORBIDDEN);

      rewireAdmin.__set__("SETUP_SECRET", origSetupSecret);
    });

    it("should return bad request when collectionName or indexName missing", async () => {
      const origSetupSecret = rewireAdmin.__get__("SETUP_SECRET");
      rewireAdmin.__set__("SETUP_SECRET", "valid-secret");

      req.body = { secret: "valid-secret" };

      const result = await rewireAdmin.dropIndex(req, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);

      rewireAdmin.__set__("SETUP_SECRET", origSetupSecret);
    });
  });

  describe("createIndex()", () => {
    it("should return forbidden when secret is invalid", async () => {
      const origSetupSecret = rewireAdmin.__get__("SETUP_SECRET");
      rewireAdmin.__set__("SETUP_SECRET", "valid-secret");

      req.body = { secret: "bad", collectionName: "users", indexSpec: { email: 1 } };

      const result = await rewireAdmin.createIndex(req, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.FORBIDDEN);

      rewireAdmin.__set__("SETUP_SECRET", origSetupSecret);
    });

    it("should return bad request when collectionName or indexSpec missing", async () => {
      const origSetupSecret = rewireAdmin.__get__("SETUP_SECRET");
      rewireAdmin.__set__("SETUP_SECRET", "valid-secret");

      req.body = { secret: "valid-secret" };

      const result = await rewireAdmin.createIndex(req, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);

      rewireAdmin.__set__("SETUP_SECRET", origSetupSecret);
    });
  });
});
