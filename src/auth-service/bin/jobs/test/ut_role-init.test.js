// test/ut_role-init.test.js
require("module-alias/register");
const { runRoleInitialization } = require("@bin/jobs/role-init-job");

describe("Role Initialization", () => {
  it("should initialize admin roles correctly", async () => {
    const result = await runRoleInitialization(true); // true for verbose output
    expect(result).toBeDefined();
    expect(result.role_name).toContain("SUPER_ADMIN");
  });
});
