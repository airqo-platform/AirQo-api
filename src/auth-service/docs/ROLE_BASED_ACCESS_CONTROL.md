# RBAC (Role-Based Access Control) System Documentation

## Overview

This RBAC system provides comprehensive role and permission management for applications with multi-tenant, multi-organization structures. It supports both Groups and Networks as organizational contexts, allowing users to have different roles and permissions in each.

### Core Components

1. **RBACService** (`services/rbac.service.js`): Core service handling all RBAC operations
2. **Permission Auth Middleware** (`middleware/permissionAuth.js`): Permission-based access control
3. **Admin Access Middleware** (`middleware/adminAccess.js`): Provides higher-level access checks like `requireGroupAdmin` and `requireGroupAccess`.
4. **Group/Network Auth Middleware** (`middleware/groupNetworkAuth.js`): Provides specialized middleware for common group/network operations like `requireGroupManagerAccess` and `requireGroupAdminAccess`.

## Usage Examples

### Basic Permission Checking (Global)

Use `requirePermissions` for actions not tied to a specific group or network.

```javascript
const { requirePermissions } = require("@middleware/permissionAuth");

// Require any of the specified permissions globally
router.get(
  "/admin/dashboard",
  requirePermissions(["SYSTEM_ADMIN", "SYSTEM_MONITOR"]),
  controller.adminDashboard
);

// Require ALL specified permissions
router.post(
  "/admin/users",
  requireAllPermissions(["USER_CREATE", "SYSTEM_ADMIN"]), // requireAllPermissions is a convenience wrapper
  controller.createUser
);
```

### Group-Specific Permissions

```javascript
const { requireGroupPermissions } = require("@middleware/permissionAuth");

// Check permissions within a specific group context
router.get(
  "/groups/:grp_id/settings",
  requireGroupPermissions(["SETTINGS_VIEW"], "grp_id"),
  controller.getSettings
);

// With custom options
router.put(
  "/groups/:grp_id/settings",
  requireGroupPermissions(["SETTINGS_EDIT"], "grp_id", { requireAll: true }),
  controller.updateSettings
);
```

### Admin Access Control

```javascript
const {
  requireGroupAdmin,
  requireGroupAccess,
} = require("@middleware/adminAccess");

// Require group admin access (super admin role)
router.delete("/groups/:grp_id", requireGroupAdmin(), controller.deleteGroup);

// Flexible group access with custom permissions
router.get(
  "/groups/:grp_id/analytics",
  requireGroupAccess(["ANALYTICS_VIEW", "DASHBOARD_VIEW"]),
  controller.getAnalytics
);
```

### Group Management

```javascript
const {
  requireGroupManagerAccess,
  requireGroupMemberManagementAccess,
} = require("@middleware/groupNetworkAuth");

// Require group manager access
router.get(
  "/groups/:grp_id/manager-dashboard",
  requireGroupManagerAccess(),
  controller.getManagerDashboard
);

// Require member management permissions
router.post(
  "/groups/:grp_id/assign-users",
  requireGroupMemberManagementAccess(),
  controller.assignUsers
);
```

### Using RBAC Service Directly

```javascript
const { getRBACService } = require("@middleware/permissionAuth");

// In your controller
const rbacService = getRBACService(tenant);

// Check permissions programmatically
const hasPermission = await rbacService.hasPermission(
  userId,
  ["GROUP_EDIT"],
  false, // requireAll
  groupId,
  "group"
);

// Get user's permissions in context
const permissions = await rbacService.getUserPermissionsInContext(
  userId,
  groupId,
  "group"
);

// Check membership
const isGroupMember = await rbacService.isGroupMember(userId, groupId);
const isGroupManager = await rbacService.isGroupManager(userId, groupId);
```

## Migration Guide

### Step 1: Update Dependencies

Ensure all new files are in place:

- `services/rbac.service.js`
- `middleware/permissionAuth.js`
- `middleware/adminAccess.js`
- `middleware/groupNetworkAuth.js`

### Step 2: Replace adminCheck Middleware

```javascript
// Old
const { adminCheck } = require("@middleware/admin-access.middleware");
router.put(
  "/:grp_id/enhanced-set-manager/:user_id",
  adminCheck,
  controller.enhancedSetManager
);

// New - Option 1: Drop-in replacement
const { adminCheck } = require("@middleware/adminAccess"); // Uses legacy compatibility
router.put(
  "/:grp_id/enhanced-set-manager/:user_id",
  adminCheck,
  controller.enhancedSetManager
);

// New - Option 2: Use specific middleware (recommended)
const { requireGroupAdmin } = require("@middleware/adminAccess");
router.put(
  "/:grp_id/enhanced-set-manager/:user_id",
  requireGroupAdmin(),
  controller.enhancedSetManager
);
```

### Step 3: Update Route Definitions

Gradually replace your routes with the new middleware patterns. See the updated group routes example above.

### Step 4: Test and Validate

1. Test existing functionality to ensure backward compatibility
2. Verify that permissions are properly enforced
3. Check that caching is working correctly
4. Test with different user roles and permission combinations

## Permission Naming Conventions

### Role Naming

Roles are automatically prefixed with a normalized version of the organization's name. This ensures that roles are unique to each organization. The format is:

**`ORGANIZATIONNAME_ROLETYPE`**

For example:

- An "Admin" role in the "AirQo" organization becomes `AIRQO_ADMIN`.
- A "Manager" role in the "KCCA" organization becomes `KCCA_MANAGER`.
- A "Super Admin" role in the "My New Org" organization becomes `MY_NEW_ORG_SUPER_ADMIN`.

When using middleware like `requireGroupAdminAccess`, you only need to specify the base role type (e.g., `ADMIN`), and the system will automatically check for the correctly prefixed role within the group's context.

### Permission Naming

Follow these conventions for consistent permission naming:

```javascript
// Format: [SCOPE]_[ACTION]
"GROUP_VIEW"; // View group information
"GROUP_EDIT"; // Edit group settings
"GROUP_DELETE"; // Delete group
"GROUP_MANAGEMENT"; // Full group management
"MEMBER_VIEW"; // View group members
"MEMBER_INVITE"; // Invite new members
"MEMBER_REMOVE"; // Remove members
"USER_MANAGEMENT"; // Manage users
"ROLE_ASSIGNMENT"; // Assign roles
"DEVICE_CLAIM"; // Claim and unclaim devices
"DEVICE_DEPLOY"; // Deploy devices
"ANALYTICS_VIEW"; // View analytics
"SETTINGS_EDIT"; // Edit settings
"SYSTEM_ADMIN"; // System administration
```

## Debugging and Troubleshooting

### Enable Debug Mode

```javascript
// Add debug middleware to routes (development only)
const { debugPermissions } = require("@middleware/permissionAuth");
router.use(debugPermissions());

// Or add to specific routes
router.get(
  "/groups/:grp_id",
  debugPermissions(),
  requireGroupAccess(["GROUP_VIEW"]),
  controller.getGroup
);

// Check debug info in requests
// GET /groups/123?debug=true
// Will add debug headers to response
```

### Debug User Permissions

```javascript
const rbacService = getRBACService(tenant);
const debugInfo = await rbacService.debugUserPermissions(userId);
console.log(debugInfo);
// Returns comprehensive permission and role information
```

### Cache Management

```javascript
const rbacService = getRBACService(tenant);

// Clear cache for specific user
rbacService.clearUserCache(userId);

// Clear cache for all users in a group
await rbacService.clearGroupCache(groupId);

// Clear all cache
rbacService.clearCache();
```

## Performance Considerations

1. **Caching**: The system automatically caches permissions for 10 minutes
2. **Batch Operations**: Use bulk operations when possible
3. **Context-Specific Checks**: Use context-specific permission checks when you know the group/network ID
4. **Database Optimization**: Ensure proper indexes on user group_roles and network_roles fields

## Security Best Practices

1. **Principle of Least Privilege**: Grant minimum necessary permissions
2. **Regular Audits**: Periodically review user permissions and roles
3. **Context Isolation**: Always check permissions within the appropriate context
4. **Super Admin Restrictions**: Limit super admin role assignments
5. **Permission Validation**: Always validate permissions on both frontend and backend

## API Examples

### Check User Permissions in Controller

```javascript
// In your controller
const groupController = {
  async updateSettings(req, res, next) {
    try {
      const { grp_id } = req.params;
      const { user } = req;
      const tenant = req.query.tenant;

      // The middleware already checked permissions, but you can do additional checks
      const rbacService = getRBACService(tenant);

      // Additional business logic permission check
      if (req.body.criticalSetting) {
        const hasAdvancedAccess = await rbacService.hasPermission(
          user._id,
          ["ADVANCED_SETTINGS"],
          true,
          grp_id,
          "group"
        );

        if (!hasAdvancedAccess) {
          return res.status(403).json({
            success: false,
            message: "Advanced settings require special permissions",
          });
        }
      }

      // Continue with update logic...
    } catch (error) {
      next(error);
    }
  },
};
```

## Conclusion

This RBAC system provides a robust, scalable solution for managing access control in multi-tenant, multi-organizational applications. It maintains backward compatibility while offering enhanced flexibility and performance through caching and context-aware permission checking.

For additional support or questions, refer to the source code comments or create an issue in the project repository.
