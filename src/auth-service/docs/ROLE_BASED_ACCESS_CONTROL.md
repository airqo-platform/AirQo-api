# RBAC (Role-Based Access Control) System Documentation

## Overview

This RBAC system provides comprehensive role and permission management for applications with multi-tenant, multi-organization structures. It supports both Groups and Networks as organizational contexts, allowing users to have different roles and permissions in each.

## Key Features

- **Context-Aware Permissions**: Users can have different permissions in different Groups/Networks
- **Flexible Role Assignment**: Support for multiple roles across different organizational contexts
- **Caching System**: Built-in caching for performance optimization
- **Backward Compatibility**: Maintains compatibility with existing adminCheck middleware
- **Debug Support**: Comprehensive debugging tools for development

## Architecture

### Core Components

1. **RBACService** (`services/rbac.service.js`): Core service handling all RBAC operations
2. **Permission Auth Middleware** (`middleware/permissionAuth.js`): Permission-based access control
3. **Enhanced Admin Middleware** (`middleware/adminAccess.js`): Advanced admin access control
4. **Group/Network Auth** (`middleware/groupNetworkAuth.js`): Specialized middleware for group/network operations

### Data Model

```javascript
// User Model Structure
user: {
  group_roles: [
    {
      group: ObjectId, // Reference to Group
      role: ObjectId,  // Reference to Role
      userType: String, // 'user' or 'guest'
      createdAt: Date
    }
  ],
  network_roles: [
    {
      network: ObjectId, // Reference to Network
      role: ObjectId,    // Reference to Role
      userType: String,  // 'user' or 'guest'
      createdAt: Date
    }
  ]
}

// Role Model Structure
role: {
  role_name: String,
  role_code: String,
  group_id: ObjectId,    // Associated group (optional)
  network_id: ObjectId,  // Associated network (optional)
  role_permissions: [ObjectId] // References to Permissions
}
```

## Installation & Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Add the following to your environment configuration:

```bash
# Default permissions for different user types
DEFAULT_MEMBER_PERMISSIONS=GROUP_VIEW,MEMBER_VIEW,DASHBOARD_VIEW
SUPER_ADMIN_PERMISSIONS=GROUP_MANAGEMENT,USER_MANAGEMENT,ROLE_ASSIGNMENT,SYSTEM_ADMIN

# Tenant-specific super admin permissions (optional)
SUPER_ADMIN_PERMISSIONS_AIRQO=GROUP_MANAGEMENT,USER_MANAGEMENT,ANALYTICS_VIEW
SUPER_ADMIN_PERMISSIONS_KCCA=NETWORK_MANAGEMENT,GROUP_MANAGEMENT,USER_MANAGEMENT
```

### 3. Update Routes

Replace your existing routes with the new RBAC middleware:

```javascript
// Old way
router.get(
  "/groups/:grp_id/dashboard",
  setJWTAuth,
  authJWT,
  adminCheck,
  controller.getDashboard
);

// New way
router.get(
  "/groups/:grp_id/dashboard",
  setJWTAuth,
  authJWT,
  requireGroupPermissions(["DASHBOARD_VIEW"], "grp_id"),
  controller.getDashboard
);
```

## Usage Examples

### Basic Permission Checking

```javascript
const { requirePermissions } = require("@middleware/permissionAuth");

// Require any of the specified permissions globally
router.get(
  "/admin",
  requirePermissions(["ADMIN_ACCESS", "SYSTEM_VIEW"]),
  controller.adminDashboard
);

// Require ALL specified permissions
router.post(
  "/admin/users",
  requireAllPermissions(["USER_CREATE", "ADMIN_ACCESS"]),
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
