// test/ut_role-init.test.js
require("module-alias/register");
const { expect } = require("chai");
const { runRoleInitialization } = require("@bin/jobs/role-init-job");
const GroupModel = require("@models/Group");

describe("Role Initialization", () => {
  before(async () => {
    // initializeAdminRoles requires an existing "airqo" group; the app's own
    // startup bootstrap creates one, but this test shouldn't depend on
    // winning that race — ensure it exists directly (idempotent).
    await GroupModel("airqo").findOneAndUpdate(
      { grp_title: "airqo" },
      { $setOnInsert: { grp_title: "airqo" } },
      { upsert: true, new: true }
    );
  });

  it("should initialize admin roles correctly", async () => {
    const result = await runRoleInitialization();
    expect(result).to.exist;
    expect(result.role_name).to.include("SUPER_ADMIN");
  });
});
