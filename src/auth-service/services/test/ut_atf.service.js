require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const rewire = require("rewire");
const jwt = require("jsonwebtoken");
const constants = require("@config/constants");
const RBACService = require("@services/rbac.service");

const rewireAtf = rewire("@services/atf.service");

/**
 * Regression test for a real crash found while removing network-based RBAC
 * from this service: every TokenStrategy here reads `permissionData` from
 * rbac.service.js's getUserPermissionsByContext()/getUserPermissionsForLogin(),
 * both of which stopped returning `networkPermissions`/`networkMemberships`
 * keys entirely earlier in this same effort. StandardTokenStrategy's
 * generateToken() unconditionally did
 * `Object.values(permissionData.networkPermissions).flat()` with no guard —
 * since that key is now `undefined`, this threw a TypeError on every call,
 * which would have broken login for any user on the STANDARD token strategy.
 */
describe("atf.service — StandardTokenStrategy", () => {
  const StandardTokenStrategy = rewireAtf.__get__("StandardTokenStrategy");
  let strategy;

  beforeEach(() => {
    strategy = new StandardTokenStrategy();
  });

  afterEach(() => {
    sinon.restore();
  });

  it("does not throw when rbac.service's context data has no network keys, and produces a token with no network fields", async () => {
    sinon.stub(RBACService.prototype, "getUserPermissionsByContext").resolves({
      systemPermissions: ["DASHBOARD_VIEW"],
      groupPermissions: { group1: ["GROUP_VIEW"] },
      groupMemberships: [{ group: { id: "group1" } }],
      isSuperAdmin: false,
    });

    const user = {
      _id: "507f1f77bcf86cd799439011",
      userName: "tester",
      email: "tester@example.com",
      firstName: "T",
      lastName: "User",
      userType: "user",
      organization: "airqo",
    };

    const token = await strategy.generateToken(user, "airqo", {
      expiresIn: "1h",
    });

    expect(token).to.be.a("string");

    const decoded = jwt.verify(token, constants.JWT_SECRET);
    expect(decoded.allPermissions).to.include("DASHBOARD_VIEW");
    expect(decoded.allPermissions).to.include("GROUP_VIEW");
    expect(decoded).to.not.have.property("networkPermissions");
    expect(decoded).to.not.have.property("networkMemberships");
  });
});
