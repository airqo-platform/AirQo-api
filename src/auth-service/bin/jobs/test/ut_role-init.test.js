// test/ut_role-init.test.js
require("module-alias/register");
const { expect } = require("chai");
const {
  runRoleInitialization,
  getStatus,
} = require("@bin/jobs/role-init-job");
const GroupModel = require("@models/Group");

describe("Role Initialization", () => {
  before(async () => {
    // initializeAdminRoles requires an existing "airqo" group; the app's own
    // startup bootstrap creates one, but this test shouldn't depend on
    // winning that race — ensure it exists directly (idempotent).
    // grp_description is a required schema field, so the upsert must supply
    // it too or the insert fails validation.
    await GroupModel("airqo").findOneAndUpdate(
      { grp_title: "airqo" },
      {
        $setOnInsert: {
          grp_title: "airqo",
          grp_description: "AirQo air quality monitoring group",
        },
      },
      { upsert: true, new: true }
    );
  });

  it("should initialize admin roles correctly", async () => {
    const result = await runRoleInitialization();
    expect(result, `runRoleInitialization failed: ${getStatus().error}`).to
      .exist;
    expect(result.role_name).to.include("SUPER_ADMIN");
  });
});
