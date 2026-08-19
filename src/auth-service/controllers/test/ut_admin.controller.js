require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const rewire = require("rewire");

const adminUtil = require("@utils/admin.util");
const createAdmin = rewire("@controllers/admin.controller");
const realExtractErrors = require("@utils/shared").extractErrorsFromRequest;
const mockBadRequest = () => [{ param: "tenant", message: "required" }];

describe("createAdmin controller", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      query: { tenant: "airqo" },
      body: {},
      params: {},
    };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
      headersSent: false,
    };
    next = sinon.stub();
  });

  afterEach(() => {
    sinon.restore();
    createAdmin.__set__("extractErrorsFromRequest", realExtractErrors);
  });

  describe("checkRBACHealth()", () => {
    it("should respond 200 with health data on success", async () => {
      sinon.stub(adminUtil, "checkRBACHealth").resolves({
        success: true,
        status: httpStatus.OK,
        message: "RBAC system is operational",
        data: { service: "rbac-system", status: "healthy" },
      });

      await createAdmin.checkRBACHealth(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.equal(true);
      expect(res.json.calledOnce).to.equal(true);
      const jsonArg = res.json.firstCall.args[0];
      expect(jsonArg.success).to.equal(true);
      expect(jsonArg).to.have.property("health_status");
    });

    it("should respond with error status on failure", async () => {
      sinon.stub(adminUtil, "checkRBACHealth").resolves({
        success: false,
        status: httpStatus.SERVICE_UNAVAILABLE,
        message: "RBAC needs initialization",
        errors: { message: "No roles found" },
      });

      await createAdmin.checkRBACHealth(req, res, next);

      expect(res.status.calledWith(httpStatus.SERVICE_UNAVAILABLE)).to.equal(true);
    });

    it("should call next on bad request errors", async () => {
      createAdmin.__set__("extractErrorsFromRequest", mockBadRequest);

      await createAdmin.checkRBACHealth(req, res, next);

      expect(next.calledOnce).to.equal(true);
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should call next on unexpected exception", async () => {
      sinon.stub(adminUtil, "checkRBACHealth").throws(new Error("Unexpected"));

      await createAdmin.checkRBACHealth(req, res, next);

      expect(next.calledOnce).to.equal(true);
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("resetRBACSystem()", () => {
    it("should respond 200 on successful reset", async () => {
      sinon.stub(adminUtil, "resetRBACSystem").resolves({
        success: true,
        status: httpStatus.OK,
        message: "RBAC reset completed",
        data: { reset_results: {}, dry_run: true },
      });

      await createAdmin.resetRBACSystem(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.equal(true);
      const jsonArg = res.json.firstCall.args[0];
      expect(jsonArg).to.have.property("reset_results");
    });

    it("should respond with failure status on forbidden", async () => {
      sinon.stub(adminUtil, "resetRBACSystem").resolves({
        success: false,
        status: httpStatus.FORBIDDEN,
        message: "Invalid setup secret",
        errors: { message: "Authentication failed" },
      });

      await createAdmin.resetRBACSystem(req, res, next);

      expect(res.status.calledWith(httpStatus.FORBIDDEN)).to.equal(true);
    });
  });

  describe("initializeRBAC()", () => {
    it("should respond 200 on successful initialization", async () => {
      sinon.stub(adminUtil, "initializeRBAC").resolves({
        success: true,
        status: httpStatus.OK,
        message: "RBAC initialized",
        data: { initialization_results: {} },
      });

      await createAdmin.initializeRBAC(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.equal(true);
      const jsonArg = res.json.firstCall.args[0];
      expect(jsonArg).to.have.property("initialization_status");
    });
  });

  describe("getRBACStatus()", () => {
    it("should respond 200 with RBAC status", async () => {
      sinon.stub(adminUtil, "getRBACStatus").resolves({
        success: true,
        status: httpStatus.OK,
        message: "RBAC status retrieved",
        data: { system_health: { status: "healthy" } },
      });

      await createAdmin.getRBACStatus(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.equal(true);
      const jsonArg = res.json.firstCall.args[0];
      expect(jsonArg).to.have.property("rbac_status");
    });
  });

  describe("getSystemDiagnostics()", () => {
    it("should respond 200 with diagnostics data", async () => {
      sinon.stub(adminUtil, "getSystemDiagnostics").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Diagnostics completed",
        data: { environment: "test", basic_health: {} },
      });

      await createAdmin.getSystemDiagnostics(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.equal(true);
      const jsonArg = res.json.firstCall.args[0];
      expect(jsonArg).to.have.property("diagnostics");
    });
  });

  describe("bulkAdminOperations()", () => {
    it("should respond 200 on bulk operation success", async () => {
      sinon.stub(adminUtil, "bulkAdminOperations").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Bulk operation completed",
        data: { operation: "audit_users", successful: 2, failed: 0 },
      });

      await createAdmin.bulkAdminOperations(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.equal(true);
      const jsonArg = res.json.firstCall.args[0];
      expect(jsonArg).to.have.property("bulk_operation_results");
    });

    it("should respond with forbidden status when secret is wrong", async () => {
      sinon.stub(adminUtil, "bulkAdminOperations").resolves({
        success: false,
        status: httpStatus.FORBIDDEN,
        message: "Invalid setup secret",
        errors: { message: "Authentication failed" },
      });

      await createAdmin.bulkAdminOperations(req, res, next);

      expect(res.status.calledWith(httpStatus.FORBIDDEN)).to.equal(true);
    });
  });

  describe("auditUsers()", () => {
    it("should respond 200 with audit results", async () => {
      sinon.stub(adminUtil, "auditUsers").resolves({
        success: true,
        status: httpStatus.OK,
        message: "User audit completed",
        data: [{ user_id: "uid1", email: "u@x.com" }],
      });

      await createAdmin.auditUsers(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.equal(true);
      const jsonArg = res.json.firstCall.args[0];
      expect(jsonArg).to.have.property("audit_results");
    });
  });

  describe("auditRoles()", () => {
    it("should respond 200 with audit results", async () => {
      sinon.stub(adminUtil, "auditRoles").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Role audit completed",
        data: [{ role_id: "r1", role_name: "ADMIN" }],
      });

      await createAdmin.auditRoles(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.equal(true);
      const jsonArg = res.json.firstCall.args[0];
      expect(jsonArg).to.have.property("audit_results");
    });
  });

  describe("auditPermissions()", () => {
    it("should respond 200 with audit results", async () => {
      sinon.stub(adminUtil, "auditPermissions").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Permission audit completed",
        data: [{ permission_id: "p1", permission: "READ" }],
      });

      await createAdmin.auditPermissions(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.equal(true);
      const jsonArg = res.json.firstCall.args[0];
      expect(jsonArg).to.have.property("audit_results");
    });
  });

  describe("clearCache()", () => {
    it("should respond 200 on successful cache clear", async () => {
      sinon.stub(adminUtil, "clearCache").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Cache cleared",
        data: { operation: "cache_clear" },
      });

      await createAdmin.clearCache(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.equal(true);
      const jsonArg = res.json.firstCall.args[0];
      expect(jsonArg).to.have.property("cache_clear_results");
    });
  });

  describe("databaseCleanup()", () => {
    it("should respond 200 on successful cleanup", async () => {
      sinon.stub(adminUtil, "databaseCleanup").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Database cleanup completed",
        data: { operation: "database_cleanup" },
      });

      await createAdmin.databaseCleanup(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.equal(true);
      const jsonArg = res.json.firstCall.args[0];
      expect(jsonArg).to.have.property("cleanup_results");
    });
  });

  describe("getDeprecatedFieldsStatus()", () => {
    it("should respond 200 with migration status", async () => {
      sinon.stub(adminUtil, "getDeprecatedFieldsStatus").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Deprecated fields status retrieved",
        data: { migration_needed: false },
      });

      await createAdmin.getDeprecatedFieldsStatus(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.equal(true);
      const jsonArg = res.json.firstCall.args[0];
      expect(jsonArg).to.have.property("migration_status");
    });
  });

  describe("migrateDeprecatedFields()", () => {
    it("should respond 200 on successful migration", async () => {
      sinon.stub(adminUtil, "migrateDeprecatedFields").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Migration completed",
        data: { operation: "migrate_deprecated_fields" },
      });

      await createAdmin.migrateDeprecatedFields(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.equal(true);
      const jsonArg = res.json.firstCall.args[0];
      expect(jsonArg).to.have.property("migration_results");
    });
  });

  describe("getCurrentConfig()", () => {
    it("should respond 200 with configuration", async () => {
      sinon.stub(adminUtil, "getCurrentConfig").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Configuration retrieved",
        data: { environment: "test" },
      });

      await createAdmin.getCurrentConfig(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.equal(true);
      const jsonArg = res.json.firstCall.args[0];
      expect(jsonArg).to.have.property("configuration");
    });
  });

  describe("dropIndex()", () => {
    it("should respond 200 on successful index drop", async () => {
      sinon.stub(adminUtil, "dropIndex").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Successfully dropped index",
      });

      await createAdmin.dropIndex(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.equal(true);
    });

    it("should respond with forbidden when secret is wrong", async () => {
      sinon.stub(adminUtil, "dropIndex").resolves({
        success: false,
        status: httpStatus.FORBIDDEN,
        message: "Invalid setup secret",
        errors: { message: "Authentication failed" },
      });

      await createAdmin.dropIndex(req, res, next);

      expect(res.status.calledWith(httpStatus.FORBIDDEN)).to.equal(true);
    });
  });

  describe("createIndex()", () => {
    it("should respond 200 on successful index creation", async () => {
      sinon.stub(adminUtil, "createIndex").resolves({
        success: true,
        status: httpStatus.OK,
        message: "Successfully created index",
        data: { indexName: "email_1" },
      });

      await createAdmin.createIndex(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.equal(true);
      const jsonArg = res.json.firstCall.args[0];
      expect(jsonArg).to.have.property("data");
    });
  });

  describe("getDocs()", () => {
    it("should respond 200 with documentation", async () => {
      sinon.stub(adminUtil, "getDocs").resolves({
        success: true,
        data: { endpoints: {}, service: "admin-service" },
      });

      await createAdmin.getDocs(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.equal(true);
      const jsonArg = res.json.firstCall.args[0];
      expect(jsonArg).to.have.property("documentation");
    });

    it("should call next on unexpected error", async () => {
      sinon.stub(adminUtil, "getDocs").throws(new Error("Unexpected"));

      await createAdmin.getDocs(req, res, next);

      expect(next.calledOnce).to.equal(true);
    });
  });

  describe("setupSuperAdmin()", () => {
    it("should respond 200 on successful super admin setup", async () => {
      sinon.stub(adminUtil, "setupSuperAdmin").resolves({
        success: true,
        status: httpStatus.OK,
        message: "User role updated to SUPER_ADMIN",
        data: { user_id: "uid1", role_assigned: "AIRQO_SUPER_ADMIN" },
      });

      await createAdmin.setupSuperAdmin(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.equal(true);
      const jsonArg = res.json.firstCall.args[0];
      expect(jsonArg).to.have.property("super_admin_setup");
    });

    it("should call next on bad request errors", async () => {
      createAdmin.__set__("extractErrorsFromRequest", mockBadRequest);

      await createAdmin.setupSuperAdmin(req, res, next);

      expect(next.calledOnce).to.equal(true);
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.BAD_REQUEST);
    });
  });

  describe("enhancedSetupSuperAdmin()", () => {
    it("should respond 200 on successful enhanced setup", async () => {
      sinon.stub(adminUtil, "enhancedSetupSuperAdmin").resolves({
        success: true,
        status: httpStatus.OK,
        message: "User role updated to SUPER_ADMIN",
        operation: "enhanced_super_admin_setup",
        setup_details: {},
        before_setup: {},
        after_setup: {},
      });

      await createAdmin.enhancedSetupSuperAdmin(req, res, next);

      expect(res.status.calledWith(httpStatus.OK)).to.equal(true);
      const jsonArg = res.json.firstCall.args[0];
      expect(jsonArg).to.have.property("setup_details");
    });
  });
});
