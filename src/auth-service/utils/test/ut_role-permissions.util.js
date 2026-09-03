require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const rewire = require("rewire");
const httpStatus = require("http-status");

const rewireRPU = rewire("@utils/role-permissions.util");

describe("role-permissions util", () => {
  let req, next;
  let origRoleModel, origPermissionModel, origUserModel, origGroupModel, origGenerateFilter;

  beforeEach(() => {
    req = {
      body: {},
      query: { tenant: "airqo", limit: 10, skip: 0 },
      params: {},
    };
    next = sinon.stub();

    origRoleModel = rewireRPU.__get__("RoleModel");
    origPermissionModel = rewireRPU.__get__("PermissionModel");
    origUserModel = rewireRPU.__get__("UserModel");
    origGroupModel = rewireRPU.__get__("GroupModel");
    origGenerateFilter = rewireRPU.__get__("generateFilter");
  });

  afterEach(() => {
    rewireRPU.__set__("RoleModel", origRoleModel);
    rewireRPU.__set__("PermissionModel", origPermissionModel);
    rewireRPU.__set__("UserModel", origUserModel);
    rewireRPU.__set__("GroupModel", origGroupModel);
    rewireRPU.__set__("generateFilter", origGenerateFilter);
    sinon.restore();
  });

  describe("listRole()", () => {
    it("should return roles on success", async () => {
      rewireRPU.__set__("generateFilter", {
        ...origGenerateFilter,
        roles: sinon.stub().returns({}),
      });
      rewireRPU.__set__("RoleModel", () => ({
        list: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          data: [{ role_name: "AIRQO_ADMIN" }],
        }),
      }));

      const result = await rewireRPU.listRole(req, next);

      expect(result.success).to.equal(true);
      expect(result.data).to.be.an("array");
    });

    it("should call next on error", async () => {
      rewireRPU.__set__("generateFilter", {
        ...origGenerateFilter,
        roles: sinon.stub().returns({}),
      });
      rewireRPU.__set__("RoleModel", () => ({
        list: sinon.stub().throws(new Error("DB failure")),
      }));

      await rewireRPU.listRole(req, next);

      expect(next.calledOnce).to.equal(true);
      expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("createRole()", () => {
    it("should call next when group is not found", async () => {
      req.body = { role_name: "TEST_ROLE", group_id: "grpid" };

      rewireRPU.__set__("RoleModel", () => ({
        findOne: sinon.stub().returns({ lean: sinon.stub().resolves(null) }),
        register: sinon.stub().resolves({ success: true }),
      }));
      rewireRPU.__set__("GroupModel", () => ({
        findById: sinon.stub().resolves(null),
      }));

      await rewireRPU.createRole(req, next);

      expect(next.calledOnce).to.equal(true);
    });
  });

  describe("deleteRole()", () => {
    it("should call next when UserModel.updateMany throws", async () => {
      req.params = { role_id: "roleid" };

      rewireRPU.__set__("generateFilter", {
        ...origGenerateFilter,
        roles: sinon.stub().returns({ _id: "roleid" }),
      });
      rewireRPU.__set__("UserModel", () => ({
        updateMany: sinon.stub().throws(new Error("DB failure")),
      }));

      await rewireRPU.deleteRole(req, next);

      expect(next.calledOnce).to.equal(true);
    });
  });

  describe("listPermissionsForRole()", () => {
    it("should return permissions for a role when list is successful", async () => {
      req.params = { role_id: "roleid" };
      req.query = { tenant: "airqo", role_id: "roleid", limit: 10, skip: 0 };

      rewireRPU.__set__("generateFilter", {
        ...origGenerateFilter,
        roles: sinon.stub().returns({ _id: "roleid" }),
      });
      rewireRPU.__set__("RoleModel", () => ({
        list: sinon.stub().resolves({
          success: true,
          data: [{ _id: "roleid", role_permissions: [] }],
        }),
      }));
      rewireRPU.__set__("PermissionModel", () => ({
        list: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          data: [],
        }),
      }));

      const result = await rewireRPU.listPermissionsForRole(req, next);

      expect(next.called).to.equal(false);
      expect(result).to.not.equal(undefined);
      expect(result.success).to.equal(true);
    });

    it("should return failure when role list fails", async () => {
      req.params = { role_id: "nonexistent" };
      req.query = { tenant: "airqo", role_id: "nonexistent", limit: 10, skip: 0 };

      rewireRPU.__set__("generateFilter", {
        ...origGenerateFilter,
        roles: sinon.stub().returns({ _id: "nonexistent" }),
      });
      rewireRPU.__set__("RoleModel", () => ({
        list: sinon.stub().resolves({
          success: false,
          status: httpStatus.NOT_FOUND,
          message: "role not found",
        }),
      }));

      const result = await rewireRPU.listPermissionsForRole(req, next);

      expect(next.called).to.equal(false);
      expect(result).to.not.equal(undefined);
      expect(result.success).to.equal(false);
    });
  });

  describe("listPermission()", () => {
    it("should return permissions list", async () => {
      rewireRPU.__set__("generateFilter", {
        ...origGenerateFilter,
        permissions: sinon.stub().returns({}),
      });
      rewireRPU.__set__("PermissionModel", () => ({
        list: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          data: [{ permission: "READ" }],
        }),
      }));

      const result = await rewireRPU.listPermission(req, next);

      expect(result.success).to.equal(true);
    });

    it("should call next on list error", async () => {
      rewireRPU.__set__("generateFilter", {
        ...origGenerateFilter,
        permissions: sinon.stub().returns({}),
      });
      rewireRPU.__set__("PermissionModel", () => ({
        list: sinon.stub().throws(new Error("DB failure")),
      }));

      await rewireRPU.listPermission(req, next);

      expect(next.calledOnce).to.equal(true);
    });
  });

  describe("createPermission()", () => {
    it("should create a permission and return success", async () => {
      req.body = { permission: "NEW_PERMISSION" };

      rewireRPU.__set__("PermissionModel", () => ({
        register: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          data: { permission: "NEW_PERMISSION" },
        }),
      }));

      const result = await rewireRPU.createPermission(req, next);

      expect(result.success).to.equal(true);
    });

    it("should call next on register error", async () => {
      req.body = { permission: "FAIL" };
      rewireRPU.__set__("PermissionModel", () => ({
        register: sinon.stub().throws(new Error("DB failure")),
      }));

      await rewireRPU.createPermission(req, next);

      expect(next.calledOnce).to.equal(true);
    });
  });

  describe("deletePermission()", () => {
    it("should delete a permission", async () => {
      rewireRPU.__set__("generateFilter", {
        ...origGenerateFilter,
        permissions: sinon.stub().returns({}),
      });
      rewireRPU.__set__("PermissionModel", () => ({
        remove: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          data: {},
        }),
      }));

      const result = await rewireRPU.deletePermission(req, next);

      expect(result.success).to.equal(true);
    });
  });

  describe("updatePermission()", () => {
    it("should update a permission and return success", async () => {
      req.body = { permission: "UPDATED" };
      rewireRPU.__set__("generateFilter", {
        ...origGenerateFilter,
        permissions: sinon.stub().returns({}),
      });
      rewireRPU.__set__("PermissionModel", () => ({
        modify: sinon.stub().resolves({
          success: true,
          status: httpStatus.OK,
          data: { permission: "UPDATED" },
        }),
      }));

      const result = await rewireRPU.updatePermission(req, next);

      expect(result.success).to.equal(true);
    });
  });

  describe("ensureSuperAdminRole()", () => {
    it("should return existing super admin role when found", async () => {
      rewireRPU.__set__("RoleModel", () => ({
        findOne: sinon.stub().returns({
          lean: sinon.stub().resolves({
            _id: "role-id",
            role_name: "AIRQO_SUPER_ADMIN",
            role_code: "AIRQO_SUPER_ADMIN",
          }),
        }),
      }));

      const result = await rewireRPU.ensureSuperAdminRole("airqo");

      expect(result).to.be.an("object");
      expect(result).to.have.property("role_name", "AIRQO_SUPER_ADMIN");
    });
  });

  describe("generateRoleCode()", () => {
    it("should generate a role code from name and group", () => {
      const code = rewireRPU.generateRoleCode("Admin User", "AirQo");
      expect(code).to.be.a("string");
      expect(code.length).to.be.greaterThan(0);
    });
  });

  describe("createOrUpdateRoleWithPermissionSync()", () => {
    const createOrUpdateRoleWithPermissionSync = rewireRPU.__get__(
      "createOrUpdateRoleWithPermissionSync",
    );

    it("should backfill group_id on an existing role that is missing it, even when permissions are already synced", async () => {
      const findByIdAndUpdateStub = sinon.stub().resolves({
        _id: "r1",
        role_name: "AIRQO_SUPER_ADMIN",
        group_id: "g1",
      });

      rewireRPU.__set__("RoleModel", () => ({
        findOne: sinon.stub().returns({
          lean: sinon.stub().resolves({
            _id: "r1",
            role_name: "AIRQO_SUPER_ADMIN",
            role_code: "AIRQO_SUPER_ADMIN",
            role_permissions: ["p1"],
            // legacy role created before the group-based RBAC model
            group_id: undefined,
          }),
        }),
        findByIdAndUpdate: findByIdAndUpdateStub,
      }));

      rewireRPU.__set__("PermissionModel", () => ({
        find: sinon.stub().returns({
          select: sinon.stub().returns({
            lean: sinon.stub().resolves([{ _id: "p1", permission: "SUPER_ADMIN" }]),
          }),
        }),
      }));

      const result = await createOrUpdateRoleWithPermissionSync("airqo", {
        role_name: "AIRQO_SUPER_ADMIN",
        role_code: "AIRQO_SUPER_ADMIN",
        role_description: "desc",
        permissions: ["SUPER_ADMIN"],
        group_id: "g1", // resolved upstream via grp_title lookup, not hardcoded
      });

      expect(findByIdAndUpdateStub.calledOnce).to.equal(true);
      const updateOps = findByIdAndUpdateStub.firstCall.args[1];
      expect(updateOps.$set).to.have.property("group_id", "g1");
      // A group_id-only backfill must not force role_status/permissions —
      // those are only touched when they're actually out of sync.
      expect(updateOps.$set).to.not.have.property("role_status");
      expect(result.action).to.equal("updated");
      expect(result.group_id_backfilled).to.equal(true);
      expect(result.message).to.equal(
        "Role AIRQO_SUPER_ADMIN group_id backfilled",
      );
    });

    it("should unset the legacy network_id when backfilling group_id, since networks are deprecated", async () => {
      const findByIdAndUpdateStub = sinon.stub().resolves({
        _id: "r1",
        role_name: "AIRQO_SUPER_ADMIN",
        group_id: "g1",
      });

      rewireRPU.__set__("RoleModel", () => ({
        findOne: sinon.stub().returns({
          lean: sinon.stub().resolves({
            _id: "r1",
            role_name: "AIRQO_SUPER_ADMIN",
            role_code: "AIRQO_SUPER_ADMIN",
            role_permissions: ["p1"],
            group_id: undefined,
            // legacy network association predating group-based RBAC
            network_id: "legacy-network-id",
          }),
        }),
        findByIdAndUpdate: findByIdAndUpdateStub,
      }));

      rewireRPU.__set__("PermissionModel", () => ({
        find: sinon.stub().returns({
          select: sinon.stub().returns({
            lean: sinon.stub().resolves([{ _id: "p1", permission: "SUPER_ADMIN" }]),
          }),
        }),
      }));

      await createOrUpdateRoleWithPermissionSync("airqo", {
        role_name: "AIRQO_SUPER_ADMIN",
        role_code: "AIRQO_SUPER_ADMIN",
        role_description: "desc",
        permissions: ["SUPER_ADMIN"],
        group_id: "g1",
      });

      const updateOps = findByIdAndUpdateStub.firstCall.args[1];
      expect(updateOps.$set).to.have.property("group_id", "g1");
      expect(updateOps.$unset).to.have.property("network_id", "");
    });

    it("should preserve an existing role's role_status when only backfilling group_id (not force ACTIVE)", async () => {
      const findByIdAndUpdateStub = sinon.stub().callsFake((id, updateOps) =>
        Promise.resolve({
          _id: "r1",
          role_name: "AIRQO_SUPER_ADMIN",
          role_status: "INACTIVE", // untouched by the update object
          group_id: updateOps.$set.group_id,
        }),
      );

      rewireRPU.__set__("RoleModel", () => ({
        findOne: sinon.stub().returns({
          lean: sinon.stub().resolves({
            _id: "r1",
            role_name: "AIRQO_SUPER_ADMIN",
            role_code: "AIRQO_SUPER_ADMIN",
            role_permissions: ["p1"],
            role_status: "INACTIVE",
            group_id: undefined,
          }),
        }),
        findByIdAndUpdate: findByIdAndUpdateStub,
      }));

      rewireRPU.__set__("PermissionModel", () => ({
        find: sinon.stub().returns({
          select: sinon.stub().returns({
            lean: sinon.stub().resolves([{ _id: "p1", permission: "SUPER_ADMIN" }]),
          }),
        }),
      }));

      const result = await createOrUpdateRoleWithPermissionSync("airqo", {
        role_name: "AIRQO_SUPER_ADMIN",
        role_code: "AIRQO_SUPER_ADMIN",
        role_description: "desc",
        permissions: ["SUPER_ADMIN"],
        group_id: "g1",
      });

      expect(
        findByIdAndUpdateStub.firstCall.args[1].$set,
      ).to.not.have.property("role_status");
      expect(result.data.role_status).to.equal("INACTIVE");
    });

    it("should not overwrite an existing group_id when only permissions are out of sync", async () => {
      const findByIdAndUpdateStub = sinon.stub().resolves({
        _id: "r1",
        role_name: "AIRQO_SUPER_ADMIN",
        group_id: "already-set-group-id",
      });

      rewireRPU.__set__("RoleModel", () => ({
        findOne: sinon.stub().returns({
          lean: sinon.stub().resolves({
            _id: "r1",
            role_name: "AIRQO_SUPER_ADMIN",
            role_code: "AIRQO_SUPER_ADMIN",
            role_permissions: [], // out of sync vs. expected ["p1"]
            group_id: "already-set-group-id",
          }),
        }),
        findByIdAndUpdate: findByIdAndUpdateStub,
      }));

      rewireRPU.__set__("PermissionModel", () => ({
        find: sinon.stub().returns({
          select: sinon.stub().returns({
            lean: sinon.stub().resolves([{ _id: "p1", permission: "SUPER_ADMIN" }]),
          }),
        }),
      }));

      const result = await createOrUpdateRoleWithPermissionSync("airqo", {
        role_name: "AIRQO_SUPER_ADMIN",
        role_code: "AIRQO_SUPER_ADMIN",
        role_description: "desc",
        permissions: ["SUPER_ADMIN"],
        group_id: "g1", // must NOT be applied — existingRole already has one
      });

      expect(findByIdAndUpdateStub.calledOnce).to.equal(true);
      expect(
        findByIdAndUpdateStub.firstCall.args[1].$set,
      ).to.not.have.property("group_id");
      expect(result.message).to.equal(
        "Role AIRQO_SUPER_ADMIN permissions synchronized",
      );
    });

    it("should remain unchanged when group_id and permissions are already correct", async () => {
      const findByIdAndUpdateStub = sinon.stub();

      rewireRPU.__set__("RoleModel", () => ({
        findOne: sinon.stub().returns({
          lean: sinon.stub().resolves({
            _id: "r1",
            role_name: "AIRQO_SUPER_ADMIN",
            role_code: "AIRQO_SUPER_ADMIN",
            role_permissions: ["p1"],
            group_id: "already-set-group-id",
          }),
        }),
        findByIdAndUpdate: findByIdAndUpdateStub,
      }));

      rewireRPU.__set__("PermissionModel", () => ({
        find: sinon.stub().returns({
          select: sinon.stub().returns({
            lean: sinon.stub().resolves([{ _id: "p1", permission: "SUPER_ADMIN" }]),
          }),
        }),
      }));

      const result = await createOrUpdateRoleWithPermissionSync("airqo", {
        role_name: "AIRQO_SUPER_ADMIN",
        role_code: "AIRQO_SUPER_ADMIN",
        role_description: "desc",
        permissions: ["SUPER_ADMIN"],
        group_id: "g1",
      });

      expect(findByIdAndUpdateStub.called).to.equal(false);
      expect(result.action).to.equal("unchanged");
    });

    it("should clean up a stale network_id even when group_id is already set and permissions are already synced", async () => {
      // Regression: cleanup was previously gated behind needsGroupIdBackfill,
      // so a role that already had group_id set (not needing backfill) but
      // still carried a leftover network_id from before the group migration
      // was never cleaned up.
      const findByIdAndUpdateStub = sinon.stub().resolves({
        _id: "r1",
        role_name: "AIRQO_SUPER_ADMIN",
        group_id: "already-set-group-id",
      });

      rewireRPU.__set__("RoleModel", () => ({
        findOne: sinon.stub().returns({
          lean: sinon.stub().resolves({
            _id: "r1",
            role_name: "AIRQO_SUPER_ADMIN",
            role_code: "AIRQO_SUPER_ADMIN",
            role_permissions: ["p1"],
            group_id: "already-set-group-id",
            network_id: "stale-legacy-network-id",
          }),
        }),
        findByIdAndUpdate: findByIdAndUpdateStub,
      }));

      rewireRPU.__set__("PermissionModel", () => ({
        find: sinon.stub().returns({
          select: sinon.stub().returns({
            lean: sinon.stub().resolves([{ _id: "p1", permission: "SUPER_ADMIN" }]),
          }),
        }),
      }));

      const result = await createOrUpdateRoleWithPermissionSync("airqo", {
        role_name: "AIRQO_SUPER_ADMIN",
        role_code: "AIRQO_SUPER_ADMIN",
        role_description: "desc",
        permissions: ["SUPER_ADMIN"],
        group_id: "g1",
      });

      expect(findByIdAndUpdateStub.calledOnce).to.equal(true);
      const updateOps = findByIdAndUpdateStub.firstCall.args[1];
      expect(updateOps.$unset).to.have.property("network_id", "");
      // group_id must not be touched — it was already correct.
      expect(updateOps.$set).to.not.have.property("group_id");
      expect(result.action).to.equal("updated");
      expect(result.network_id_removed).to.equal(true);
      expect(result.group_id_backfilled).to.equal(false);
      expect(result.message).to.equal(
        "Role AIRQO_SUPER_ADMIN stale network_id removed",
      );
    });
  });

  describe("isGroupRoleOrNetworkRole()", () => {
    const isGroupRoleOrNetworkRole = rewireRPU.__get__(
      "isGroupRoleOrNetworkRole",
    );

    it('should return "group" when only group_id is set', () => {
      expect(isGroupRoleOrNetworkRole({ group_id: "g1" })).to.equal("group");
    });

    it('should return "none" when neither is set', () => {
      expect(isGroupRoleOrNetworkRole({})).to.equal("none");
    });

    it('should return "none" for a network-only legacy role — network-scoped roles are no longer supported', () => {
      // Networks are fully removed from role assignment: a role with only
      // network_id (never migrated to group_id) is no longer assignable.
      // See docs/access-control/NETWORK_DEPRECATION_FOLLOWUP.md — this is
      // why the migration tooling must run before this ships.
      expect(isGroupRoleOrNetworkRole({ network_id: "n1" })).to.equal("none");
    });

    it('should return "group" when both group_id and network_id are set (a stale, unmigrated network_id must not block assignment)', () => {
      expect(
        isGroupRoleOrNetworkRole({ group_id: "g1", network_id: "n1" }),
      ).to.equal("group");
    });
  });

  describe("setupDefaultPermissions()", () => {
    it("should resolve without throwing when models are stubbed", async () => {
      rewireRPU.__set__("RoleModel", () => ({
        findOneAndUpdate: sinon.stub().returns({
          lean: sinon.stub().resolves({
            _id: "r1",
            role_name: "AIRQO_SUPER_ADMIN",
            role_code: "AIRQO_SUPER_ADMIN",
            role_permissions: [],
          }),
        }),
        findOne: sinon.stub().resolves({ _id: "r1", role_name: "AIRQO_SUPER_ADMIN" }),
        updateMany: sinon.stub().resolves({}),
      }));

      rewireRPU.__set__("PermissionModel", () => ({
        findOne: sinon.stub().resolves(null),
        create: sinon.stub().resolves({ _id: "p1", permission: "TEST" }),
        findByIdAndUpdate: sinon.stub().resolves({}),
        updateMany: sinon.stub().resolves({}),
        countDocuments: sinon.stub().resolves(0),
      }));

      rewireRPU.__set__("GroupModel", () => ({
        findOneAndUpdate: sinon.stub().returns({
          lean: sinon.stub().resolves({ _id: "g1", grp_title: "airqo" }),
        }),
      }));

      let threw = false;
      try {
        await rewireRPU.setupDefaultPermissions("airqo");
      } catch {
        threw = true;
      }

      expect(threw).to.equal(false);
    });
  });
});
