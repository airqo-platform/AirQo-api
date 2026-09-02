require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const mongoose = require("mongoose");

const RBACService = require("@services/rbac.service");

/**
 * Characterization tests written BEFORE removing network-related code from
 * rbac.service.js (the core, previously-untested permission-resolution engine
 * used on every authenticated request).
 *
 * These tests were first written against the OLD code to confirm a key
 * finding: `_populateUserRoleData` unconditionally hardcoded
 * `network_roles: []` regardless of what was actually in the user document,
 * and `getUserPermissionsByContext` hardcoded `networkPermissions: {}` /
 * `networkMemberships: []` as literals rather than computing them. So even a
 * user with real, non-empty `network_roles` data produced empty network
 * permissions/memberships through every code path that went through
 * `_populateUserRoleData` — those branches were confirmed dead in practice,
 * not live behavior, and have now been removed below with no functional
 * change for real users.
 *
 * `isNetworkMember`/`isNetworkManager`, and `hasRole`'s context-specific
 * network branch, are the genuinely live exception (they query raw DB data
 * directly, not through `_populateUserRoleData`) — deliberately left in
 * place because they back the still-live `requireNetworkManagerAccess`
 * middleware (access-request approval flow), pending the migration
 * precondition documented in
 * docs/access-control/NETWORK_DEPRECATION_FOLLOWUP.md.
 */
describe("RBACService — network branch characterization", () => {
  const tenant = "ut-rbac-tenant";
  let service;

  const userId = new mongoose.Types.ObjectId();
  const groupId = new mongoose.Types.ObjectId();
  const groupRoleId = new mongoose.Types.ObjectId();
  const groupPermId = new mongoose.Types.ObjectId();
  const networkId = new mongoose.Types.ObjectId();
  const networkRoleId = new mongoose.Types.ObjectId();

  const mockUser = {
    _id: userId,
    userType: "user",
    privilege: null,
    permissions: [],
    group_roles: [
      {
        group: groupId,
        role: groupRoleId,
        userType: "user",
        createdAt: new Date(),
      },
    ],
    // Real, non-empty network_roles data on the raw document — used to prove
    // that _populateUserRoleData/getUserPermissionsByContext ignore it.
    network_roles: [
      {
        network: networkId,
        role: networkRoleId,
        userType: "user",
        createdAt: new Date(),
      },
    ],
  };

  beforeEach(() => {
    service = new RBACService(tenant);

    service.getUserModel = () => ({
      findById: sinon.stub().returns({
        lean: sinon.stub().resolves({ ...mockUser }),
      }),
    });

    service.getRoleModel = () => ({
      find: sinon.stub().returns({
        lean: sinon.stub().resolves([
          {
            _id: groupRoleId,
            role_name: "TEST_GROUP_ROLE",
            role_permissions: [groupPermId],
          },
        ]),
      }),
    });

    service.getGroupModel = () => ({
      find: sinon.stub().returns({
        select: sinon.stub().returns({
          lean: sinon.stub().resolves([
            {
              _id: groupId,
              grp_title: "Test Group",
              grp_status: "ACTIVE",
              organization_slug: "test-group",
            },
          ]),
        }),
      }),
    });

    service.getPermissionModel = () => ({
      find: sinon.stub().returns({
        select: sinon.stub().returns({
          lean: sinon
            .stub()
            .resolves([{ _id: groupPermId, permission: "TEST_PERMISSION" }]),
        }),
      }),
    });
  });

  afterEach(() => {
    service.destroy();
    sinon.restore();
  });

  describe("_populateUserRoleData()", () => {
    it("no longer includes network_roles at all, regardless of the raw user document", async () => {
      const populated = await service._populateUserRoleData(mockUser);
      expect(populated).to.not.have.property("network_roles");
      // Group roles, by contrast, are genuinely populated.
      expect(populated.group_roles).to.have.lengthOf(1);
    });
  });

  describe("getUserPermissionsByContext()", () => {
    it("computes real group permissions/memberships and no longer returns any network keys", async () => {
      const result = await service.getUserPermissionsByContext(userId);

      expect(result.groupPermissions[groupId.toString()]).to.include(
        "TEST_PERMISSION",
      );
      expect(result.groupMemberships).to.have.lengthOf(1);
      expect(result.groupMemberships[0].group.id).to.equal(
        groupId.toString(),
      );

      // Regression guard: these keys must be gone, not just empty — a
      // lingering `networkPermissions: {}` would mean the removal was
      // incomplete elsewhere (e.g. debugUserPermissions still reads it).
      expect(result).to.not.have.property("networkPermissions");
      expect(result).to.not.have.property("networkMemberships");
    });
  });

  describe("getUserPermissionsForLogin()", () => {
    it("propagates real group data and no longer returns any network keys", async () => {
      const result = await service.getUserPermissionsForLogin(userId);

      expect(result.allPermissions).to.include("TEST_PERMISSION");
      expect(result).to.not.have.property("networkPermissions");
      expect(result).to.not.have.property("networkMemberships");
    });
  });

  describe("hasPermission() with contextType 'network'", () => {
    it("never grants access via network permissions — falls through to system permissions only", async () => {
      // Even though contextData.networkPermissions is always {}, this call
      // must not throw and must behave as "no network permission granted".
      const result = await service.hasPermission(
        userId,
        "TEST_PERMISSION",
        false,
        networkId.toString(),
        "network",
      );
      expect(result).to.equal(false);
    });

    it("still works normally for contextType 'group'", async () => {
      const result = await service.hasPermission(
        userId,
        "TEST_PERMISSION",
        false,
        groupId.toString(),
        "group",
      );
      expect(result).to.equal(true);
    });
  });

  describe("getUserPermissionsInContext() with contextType 'network'", () => {
    it("returns only systemPermissions — the network branch is a no-op", async () => {
      const withNetwork = await service.getUserPermissionsInContext(
        userId,
        networkId.toString(),
        "network",
      );
      const noContext = await service.getUserPermissionsByContext(userId);
      expect(withNetwork).to.deep.equal(noContext.systemPermissions);
    });
  });

  describe("getUserRolesInContext() with contextType 'network'", () => {
    it("always returns an empty array — the network branch was removed as a no-op", async () => {
      const roles = await service.getUserRolesInContext(
        userId,
        networkId.toString(),
        "network",
      );
      expect(roles).to.deep.equal([]);
    });
  });

  describe("still-live network paths (deliberately preserved)", () => {
    // These back requireNetworkManagerAccess (middleware/groupNetworkAuth.js),
    // part of the access-request approval flow that's still live pending the
    // migration precondition in NETWORK_DEPRECATION_FOLLOWUP.md. Unlike the
    // paths above, these query raw DB data directly rather than going through
    // _populateUserRoleData, so they remain functional for legacy data.

    it("hasRole() with contextType 'network' still finds a role from raw network_roles data", async () => {
      const result = await service.hasRole(
        userId,
        ["USER"],
        networkId.toString(),
        "network",
      );
      // mockUser's network_roles entry has userType "user" — case-insensitive
      // match against required role "USER".
      expect(result).to.equal(true);
    });

    it("isNetworkMember() still checks raw network_roles data", async () => {
      service.getUserModel = () => ({
        findById: sinon.stub().returns({
          lean: sinon.stub().resolves({ ...mockUser }),
        }),
      });
      const result = await service.isNetworkMember(
        userId,
        networkId.toString(),
      );
      expect(result).to.equal(true);
    });

    it("isNetworkManager() still queries the Network model directly", async () => {
      service.getNetworkModel = () => ({
        findById: sinon.stub().returns({
          lean: sinon.stub().resolves({
            _id: networkId,
            net_manager: userId,
          }),
        }),
      });
      const result = await service.isNetworkManager(
        userId,
        networkId.toString(),
      );
      expect(result).to.equal(true);
    });
  });
});
