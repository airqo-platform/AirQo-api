// utils/rbac-test.util.js
const RBACService = require("@services/rbac.service");
const UserModel = require("@models/User");
const RoleModel = require("@models/Role");
const PermissionModel = require("@models/Permission");
const GroupModel = require("@models/Group");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

class RBACTestUtility {
  constructor(tenant = "test") {
    this.tenant = tenant;
    this.rbacService = new RBACService(tenant);
    this.createdTestData = {
      users: [],
      groups: [],
      roles: [],
      permissions: [],
    };
  }

  /**
   * Create test permissions
   * @param {Array} permissionNames - Array of permission names to create
   * @returns {Promise<Array>} Created permissions
   */
  async createTestPermissions(permissionNames = []) {
    const defaultPermissions = [
      "GROUP_VIEW",
      "GROUP_EDIT",
      "GROUP_DELETE",
      "USER_MANAGEMENT",
      "MEMBER_VIEW",
      "MEMBER_INVITE",
      "DASHBOARD_VIEW",
      "ANALYTICS_VIEW",
      "SUPER_ADMIN",
    ];

    const permissions =
      permissionNames.length > 0 ? permissionNames : defaultPermissions;
    const createdPermissions = [];

    for (const permissionName of permissions) {
      try {
        const permission = await PermissionModel(this.tenant).create({
          permission: permissionName,
          description: `Test permission: ${permissionName}`,
        });
        createdPermissions.push(permission);
        this.createdTestData.permissions.push(permission._id);
      } catch (error) {
        // Permission might already exist, try to find it
        const existingPermission = await PermissionModel(this.tenant).findOne({
          permission: permissionName,
        });
        if (existingPermission) {
          createdPermissions.push(existingPermission);
        }
      }
    }

    return createdPermissions;
  }

  /**
   * Create test group
   * @param {Object} groupData - Group data override
   * @returns {Promise<Object>} Created group
   */
  async createTestGroup(groupData = {}) {
    const defaultGroupData = {
      grp_title: `test_group_${Date.now()}`,
      grp_description: "Test group for RBAC testing",
      grp_status: "ACTIVE",
      ...groupData,
    };

    const group = await GroupModel(this.tenant).create(defaultGroupData);
    this.createdTestData.groups.push(group._id);
    return group;
  }

  /**
   * Create test role for a group
   * @param {string} groupId - Group ID
   * @param {Object} roleData - Role data override
   * @param {Array} permissionNames - Permission names to assign to role
   * @returns {Promise<Object>} Created role
   */
  async createTestRole(groupId, roleData = {}, permissionNames = []) {
    const group = await GroupModel(this.tenant).findById(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    const organizationName = group.grp_title.toUpperCase();
    const defaultRoleData = {
      role_name: `${organizationName}_TEST_ROLE_${Date.now()}`,
      role_code: `${organizationName}_TEST_ROLE_${Date.now()}`,
      role_description: "Test role for RBAC testing",
      group_id: groupId,
      role_status: "ACTIVE",
      ...roleData,
    };

    // Get permissions if specified
    let permissionIds = [];
    if (permissionNames.length > 0) {
      const permissions = await PermissionModel(this.tenant)
        .find({ permission: { $in: permissionNames } })
        .select("_id");
      permissionIds = permissions.map((p) => p._id);
    }

    defaultRoleData.role_permissions = permissionIds;

    const role = await RoleModel(this.tenant).create(defaultRoleData);
    this.createdTestData.roles.push(role._id);
    return role;
  }

  /**
   * Create test user with group and role assignments
   * @param {Object} userData - User data override
   * @param {Array} groupRoleAssignments - Array of {groupId, roleId} objects
   * @returns {Promise<Object>} Created user
   */
  async createTestUser(userData = {}, groupRoleAssignments = []) {
    const defaultUserData = {
      firstName: "Test",
      lastName: "User",
      email: `testuser_${Date.now()}@example.com`,
      userName: `testuser_${Date.now()}`,
      password: "TestPassword123!",
      verified: true,
      isActive: true,
      ...userData,
    };

    // Prepare group roles
    const groupRoles = groupRoleAssignments.map((assignment) => ({
      group: assignment.groupId,
      role: assignment.roleId,
      userType: assignment.userType || "user",
      createdAt: new Date(),
    }));

    if (groupRoles.length > 0) {
      defaultUserData.group_roles = groupRoles;
    }

    const user = await UserModel(this.tenant).create(defaultUserData);
    this.createdTestData.users.push(user._id);
    return user;
  }

  /**
   * Create a complete test scenario with user, group, roles, and permissions
   * @param {Object} scenarioConfig - Configuration for the test scenario
   * @returns {Promise<Object>} Complete test setup
   */
  async createTestScenario(scenarioConfig = {}) {
    const {
      permissions = ["GROUP_VIEW", "MEMBER_VIEW", "DASHBOARD_VIEW"],
      adminPermissions = ["GROUP_EDIT", "USER_MANAGEMENT", "SUPER_ADMIN"],
      groupData = {},
      userData = {},
      adminUserData = {},
    } = scenarioConfig;

    // Create permissions
    const allPermissions = [...new Set([...permissions, ...adminPermissions])];
    await this.createTestPermissions(allPermissions);

    // Create group
    const group = await this.createTestGroup(groupData);

    // Create member role
    const memberRole = await this.createTestRole(
      group._id,
      { role_name: `${group.grp_title.toUpperCase()}_MEMBER` },
      permissions
    );

    // Create admin role
    const adminRole = await this.createTestRole(
      group._id,
      { role_name: `${group.grp_title.toUpperCase()}_ADMIN` },
      adminPermissions
    );

    // Create test user (member)
    const user = await this.createTestUser(userData, [
      { groupId: group._id, roleId: memberRole._id },
    ]);

    // Create admin user
    const adminUser = await this.createTestUser(
      {
        email: `admin_${Date.now()}@example.com`,
        userName: `admin_${Date.now()}`,
        ...adminUserData,
      },
      [{ groupId: group._id, roleId: adminRole._id }]
    );

    return {
      group,
      memberRole,
      adminRole,
      user,
      adminUser,
      permissions: allPermissions,
    };
  }

  /**
   * Test permission checking for a user
   * @param {string} userId - User ID to test
   * @param {Array} permissionsToTest - Permissions to test
   * @param {string} groupId - Optional group context
   * @returns {Promise<Object>} Test results
   */
  async testUserPermissions(userId, permissionsToTest, groupId = null) {
    const results = {
      userId,
      groupId,
      permissions: {},
      summary: {
        total: permissionsToTest.length,
        passed: 0,
        failed: 0,
      },
    };

    for (const permission of permissionsToTest) {
      try {
        const hasPermission = await this.rbacService.hasPermission(
          userId,
          permission,
          false, // requireAll
          groupId,
          "group"
        );

        results.permissions[permission] = {
          hasPermission,
          status: "success",
        };

        if (hasPermission) {
          results.summary.passed++;
        } else {
          results.summary.failed++;
        }
      } catch (error) {
        results.permissions[permission] = {
          hasPermission: false,
          status: "error",
          error: error.message,
        };
        results.summary.failed++;
      }
    }

    return results;
  }

  /**
   * Test role checking for a user
   * @param {string} userId - User ID to test
   * @param {Array} rolesToTest - Roles to test
   * @param {string} groupId - Optional group context
   * @returns {Promise<Object>} Test results
   */
  async testUserRoles(userId, rolesToTest, groupId = null) {
    const results = {
      userId,
      groupId,
      roles: {},
      summary: {
        total: rolesToTest.length,
        passed: 0,
        failed: 0,
      },
    };

    for (const role of rolesToTest) {
      try {
        const hasRole = await this.rbacService.hasRole(
          userId,
          role,
          groupId,
          "group"
        );

        results.roles[role] = {
          hasRole,
          status: "success",
        };

        if (hasRole) {
          results.summary.passed++;
        } else {
          results.summary.failed++;
        }
      } catch (error) {
        results.roles[role] = {
          hasRole: false,
          status: "error",
          error: error.message,
        };
        results.summary.failed++;
      }
    }

    return results;
  }

  /**
   * Test group membership
   * @param {string} userId - User ID to test
   * @param {Array} groupIds - Group IDs to test
   * @returns {Promise<Object>} Test results
   */
  async testGroupMembership(userId, groupIds) {
    const results = {
      userId,
      memberships: {},
      summary: {
        total: groupIds.length,
        member: 0,
        notMember: 0,
      },
    };

    for (const groupId of groupIds) {
      try {
        const isMember = await this.rbacService.isGroupMember(userId, groupId);
        const isManager = await this.rbacService.isGroupManager(
          userId,
          groupId
        );

        results.memberships[groupId] = {
          isMember,
          isManager,
          status: "success",
        };

        if (isMember) {
          results.summary.member++;
        } else {
          results.summary.notMember++;
        }
      } catch (error) {
        results.memberships[groupId] = {
          isMember: false,
          isManager: false,
          status: "error",
          error: error.message,
        };
        results.summary.notMember++;
      }
    }

    return results;
  }

  /**
   * Run comprehensive test suite
   * @param {Object} testConfig - Test configuration
   * @returns {Promise<Object>} Complete test results
   */
  async runTestSuite(testConfig = {}) {
    const {
      createScenario = true,
      testPermissions = true,
      testRoles = true,
      testMembership = true,
      testCaching = true,
    } = testConfig;

    const results = {
      timestamp: new Date(),
      config: testConfig,
      scenario: null,
      tests: {},
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
      },
    };

    try {
      // Create test scenario
      if (createScenario) {
        results.scenario = await this.createTestScenario();
      }

      // Test permissions
      if (testPermissions && results.scenario) {
        results.tests.permissions = {
          member: await this.testUserPermissions(
            results.scenario.user._id,
            ["GROUP_VIEW", "MEMBER_VIEW", "DASHBOARD_VIEW", "GROUP_EDIT"],
            results.scenario.group._id
          ),
          admin: await this.testUserPermissions(
            results.scenario.adminUser._id,
            ["GROUP_VIEW", "GROUP_EDIT", "USER_MANAGEMENT", "SUPER_ADMIN"],
            results.scenario.group._id
          ),
        };
      }

      // Test roles
      if (testRoles && results.scenario) {
        results.tests.roles = {
          member: await this.testUserRoles(
            results.scenario.user._id,
            ["MEMBER", "ADMIN", "SUPER_ADMIN"],
            results.scenario.group._id
          ),
          admin: await this.testUserRoles(
            results.scenario.adminUser._id,
            ["MEMBER", "ADMIN", "SUPER_ADMIN"],
            results.scenario.group._id
          ),
        };
      }

      // Test membership
      if (testMembership && results.scenario) {
        results.tests.membership = {
          member: await this.testGroupMembership(results.scenario.user._id, [
            results.scenario.group._id,
          ]),
          admin: await this.testGroupMembership(
            results.scenario.adminUser._id,
            [results.scenario.group._id]
          ),
        };
      }

      // Test caching
      if (testCaching && results.scenario) {
        results.tests.caching = await this.testCaching(results.scenario);
      }

      // Calculate summary
      this.calculateTestSummary(results);

      return results;
    } catch (error) {
      results.error = error.message;
      return results;
    }
  }

  /**
   * Test caching functionality
   * @param {Object} scenario - Test scenario
   * @returns {Promise<Object>} Caching test results
   */
  async testCaching(scenario) {
    const cachingResults = {
      cacheHits: 0,
      cacheMisses: 0,
      performanceComparison: {},
    };

    // Test cache performance
    const userId = scenario.user._id;
    const groupId = scenario.group._id;
    const permissions = ["GROUP_VIEW", "MEMBER_VIEW"];

    // Clear cache first
    this.rbacService.clearUserCache(userId);

    // First call (cache miss)
    const start1 = Date.now();
    await this.rbacService.getUserPermissionsInContext(
      userId,
      groupId,
      "group"
    );
    const duration1 = Date.now() - start1;

    // Second call (cache hit)
    const start2 = Date.now();
    await this.rbacService.getUserPermissionsInContext(
      userId,
      groupId,
      "group"
    );
    const duration2 = Date.now() - start2;

    cachingResults.performanceComparison = {
      cacheMiss: duration1,
      cacheHit: duration2,
      improvement:
        duration1 > 0
          ? (((duration1 - duration2) / duration1) * 100).toFixed(2)
          : 0,
    };

    // Test cache clearing
    this.rbacService.clearUserCache(userId);

    return cachingResults;
  }

  /**
   * Calculate test summary
   * @param {Object} results - Test results object
   */
  calculateTestSummary(results) {
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    Object.values(results.tests).forEach((testCategory) => {
      if (testCategory && typeof testCategory === "object") {
        Object.values(testCategory).forEach((test) => {
          if (test.summary) {
            totalTests += test.summary.total;
            passedTests += test.summary.passed || test.summary.member || 0;
            failedTests += test.summary.failed || test.summary.notMember || 0;
          }
        });
      }
    });

    results.summary = {
      totalTests,
      passedTests,
      failedTests,
      successRate:
        totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(2) : 0,
    };
  }

  /**
   * Assert user has specific permissions (for use in tests)
   * @param {string} userId - User ID
   * @param {Array} permissions - Permissions to check
   * @param {string} groupId - Optional group context
   * @returns {Promise<boolean>} True if all assertions pass
   */
  async assertUserHasPermissions(userId, permissions, groupId = null) {
    for (const permission of permissions) {
      const hasPermission = await this.rbacService.hasPermission(
        userId,
        permission,
        false,
        groupId,
        "group"
      );

      if (!hasPermission) {
        throw new Error(
          `Assertion failed: User ${userId} does not have permission ${permission}${
            groupId ? ` in group ${groupId}` : ""
          }`
        );
      }
    }
    return true;
  }

  /**
   * Assert user does NOT have specific permissions (for use in tests)
   * @param {string} userId - User ID
   * @param {Array} permissions - Permissions to check
   * @param {string} groupId - Optional group context
   * @returns {Promise<boolean>} True if all assertions pass
   */
  async assertUserLacksPermissions(userId, permissions, groupId = null) {
    for (const permission of permissions) {
      const hasPermission = await this.rbacService.hasPermission(
        userId,
        permission,
        false,
        groupId,
        "group"
      );

      if (hasPermission) {
        throw new Error(
          `Assertion failed: User ${userId} should not have permission ${permission}${
            groupId ? ` in group ${groupId}` : ""
          }`
        );
      }
    }
    return true;
  }

  /**
   * Clean up all test data
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      // Clean up in reverse order to avoid dependency issues
      if (this.createdTestData.users.length > 0) {
        await UserModel(this.tenant).deleteMany({
          _id: { $in: this.createdTestData.users },
        });
      }

      if (this.createdTestData.roles.length > 0) {
        await RoleModel(this.tenant).deleteMany({
          _id: { $in: this.createdTestData.roles },
        });
      }

      if (this.createdTestData.groups.length > 0) {
        await GroupModel(this.tenant).deleteMany({
          _id: { $in: this.createdTestData.groups },
        });
      }

      if (this.createdTestData.permissions.length > 0) {
        await PermissionModel(this.tenant).deleteMany({
          _id: { $in: this.createdTestData.permissions },
        });
      }

      // Clear RBAC cache
      this.rbacService.clearCache();

      // Reset created data tracking
      this.createdTestData = {
        users: [],
        groups: [],
        roles: [],
        permissions: [],
      };
    } catch (error) {
      console.error("Error during RBAC test cleanup:", error);
    }
  }

  /**
   * Generate test report
   * @param {Object} testResults - Results from runTestSuite
   * @returns {string} Formatted test report
   */
  generateTestReport(testResults) {
    let report = "\n=== RBAC Test Report ===\n";
    report += `Timestamp: ${testResults.timestamp}\n`;
    report += `Success Rate: ${testResults.summary.successRate}%\n`;
    report += `Total Tests: ${testResults.summary.totalTests}\n`;
    report += `Passed: ${testResults.summary.passedTests}\n`;
    report += `Failed: ${testResults.summary.failedTests}\n\n`;

    if (testResults.tests.permissions) {
      report += "Permission Tests:\n";
      Object.entries(testResults.tests.permissions).forEach(
        ([userType, results]) => {
          report += `  ${userType}: ${results.summary.passed}/${results.summary.total} passed\n`;
        }
      );
      report += "\n";
    }

    if (testResults.tests.roles) {
      report += "Role Tests:\n";
      Object.entries(testResults.tests.roles).forEach(([userType, results]) => {
        report += `  ${userType}: ${results.summary.passed}/${results.summary.total} passed\n`;
      });
      report += "\n";
    }

    if (testResults.tests.caching) {
      report += "Caching Performance:\n";
      report += `  Cache Miss: ${testResults.tests.caching.performanceComparison.cacheMiss}ms\n`;
      report += `  Cache Hit: ${testResults.tests.caching.performanceComparison.cacheHit}ms\n`;
      report += `  Improvement: ${testResults.tests.caching.performanceComparison.improvement}%\n\n`;
    }

    if (testResults.error) {
      report += `Error: ${testResults.error}\n`;
    }

    report += "=== End Report ===\n";
    return report;
  }
}

module.exports = RBACTestUtility;
