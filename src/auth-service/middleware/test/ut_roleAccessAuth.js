require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();
const constants = require("@config/constants");

const GROUP_ID = "60d21b4667d0d8992e610c92";
const ROLE_ID = "60d21b4667d0d8992e610c85";
const PERMISSION_ID = "60d21b4667d0d8992e610c91";
const USER = { _id: "60d21b4667d0d8992e610c90", email: "user@example.com" };

const leanChain = (value) => ({
  select: () => ({ lean: async () => value }),
});

describe("Middleware: requireRoleManagementAccess", () => {
  let rbac, role, permissions, requireRoleManagementAccess;

  beforeEach(() => {
    role = {
      _id: ROLE_ID,
      group_id: GROUP_ID,
      role_name: "NAIROBI_GROUP_MANAGER",
    };
    permissions = [];
    rbac = {
      isSystemSuperAdmin: sinon.stub().resolves(false),
      isGroupManager: sinon.stub().resolves(false),
      hasPermission: sinon.stub().resolves(false),
      hasRole: sinon.stub().resolves(false),
    };
    ({ requireRoleManagementAccess } = proxyquire(
      "@middleware/roleAccessAuth",
      {
        "@models/Role": () => ({ findById: () => leanChain(role) }),
        "@models/Permission": () => ({ find: () => leanChain(permissions) }),
        "@services/rbac.service": { getInstance: () => rbac },
      },
    ));
  });

  afterEach(() => sinon.restore());

  const run = async (reqOverrides = {}, options) => {
    const req = {
      user: USER,
      query: {},
      params: { role_id: ROLE_ID },
      body: {},
      method: "POST",
      originalUrl: `/api/v2/users/roles/${ROLE_ID}/users`,
      ...reqOverrides,
    };
    const next = sinon.stub();
    await requireRoleManagementAccess(options)(req, {}, next);
    expect(next.calledOnce).to.equal(true);
    return next.firstCall.args[0];
  };

  it("rejects unauthenticated requests", async () => {
    const error = await run({ user: undefined });
    expect(error.statusCode).to.equal(401);
  });

  it("lets AirQo system super admins through", async () => {
    rbac.isSystemSuperAdmin.resolves(true);
    const error = await run();
    expect(error).to.equal(undefined);
  });

  it("rejects a plain member of the role's group", async () => {
    const error = await run({ body: { user_ids: [USER._id] } });
    expect(error.statusCode).to.equal(403);
  });

  it("allows a member with ROLE_ASSIGNMENT in the role's group", async () => {
    rbac.hasPermission.callsFake(async (userId, perms, all, groupId) => {
      return perms.includes(constants.ROLE_ASSIGNMENT) && groupId === GROUP_ID;
    });
    const error = await run();
    expect(error).to.equal(undefined);
  });

  it("allows the group's manager", async () => {
    rbac.isGroupManager.resolves(true);
    const error = await run();
    expect(error).to.equal(undefined);
  });

  it("passes through when the role does not exist so the controller can 404", async () => {
    role = null;
    const error = await run();
    expect(error).to.equal(undefined);
  });

  it("only lets system super admins manage roles without a group", async () => {
    role = { _id: ROLE_ID, role_name: "ORPHAN" };
    rbac.isGroupManager.resolves(true);
    const error = await run();
    expect(error.statusCode).to.equal(403);
  });

  it("only lets system super admins manage system roles", async () => {
    role.role_name = "AIRQO_SUPER_ADMIN";
    rbac.isGroupManager.resolves(true);
    const error = await run();
    expect(error.statusCode).to.equal(403);
  });

  it("blocks moving a role to another group", async () => {
    rbac.isGroupManager.resolves(true);
    const error = await run({
      method: "PUT",
      body: { group_id: "60d21b4667d0d8992e610c99" },
    });
    expect(error.statusCode).to.equal(403);
  });

  it("blocks granting system admin permissions", async () => {
    rbac.isGroupManager.resolves(true);
    permissions = [{ permission: constants.SUPER_ADMIN }];
    const error = await run({ body: { permissions: [PERMISSION_ID] } });
    expect(error.statusCode).to.equal(403);
    expect(error.errors.permissions).to.deep.equal([constants.SUPER_ADMIN]);
  });

  it("allows granting ordinary permissions", async () => {
    rbac.isGroupManager.resolves(true);
    permissions = [{ permission: constants.MEMBER_VIEW }];
    const error = await run({ body: { permission_ids: [PERMISSION_ID] } });
    expect(error).to.equal(undefined);
  });

  describe("create mode", () => {
    it("authorizes against body.group_id", async () => {
      rbac.isGroupManager.callsFake(async (userId, groupId) => {
        return groupId === GROUP_ID;
      });
      const error = await run(
        { params: {}, body: { group_id: GROUP_ID, role_name: "VIEWER" } },
        { mode: "create" },
      );
      expect(error).to.equal(undefined);
    });

    it("rejects reserved system role codes", async () => {
      rbac.isGroupManager.resolves(true);
      const error = await run(
        {
          params: {},
          body: {
            group_id: GROUP_ID,
            role_name: "x",
            role_code: "super_admin",
          },
        },
        { mode: "create" },
      );
      expect(error.statusCode).to.equal(403);
    });

    it("rejects non-managers of the target group", async () => {
      const error = await run(
        { params: {}, body: { group_id: GROUP_ID, role_name: "VIEWER" } },
        { mode: "create" },
      );
      expect(error.statusCode).to.equal(403);
    });
  });
});
