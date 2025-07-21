# Role-Based Access Control in AirQo API: Authorization Middleware Guide

This guide demonstrates how to implement various authorization strategies for your API routes using AirQo's custom middleware.

## Table of Contents

- [Introduction](#introduction)
- [Authorization Middleware Types](#authorization-middleware-types)
- [Example Routes](#example-routes)
- [Implementation Examples](#implementation-examples)
- [Best Practices](#best-practices)

## Introduction

Proper authorization is critical for securing your API endpoints. AirQo's authorization framework provides four different middleware approaches to handle various access control scenarios:

1. **Role-Based Access Control (RBAC)**: Checks if a user has an admin role for a specific group
2. **Permission-Based Access Control (PBAC)**: Checks if a user has a specific permission
3. **Combined Authorization**: Requires both admin role AND specific permission
4. **Flexible Authorization**: Grants access if user has either admin role OR specific permission

## Authorization Middleware Types

### 1. Role-Based Access Control

The `admin-access.middleware.js` provides middleware for checking if a user has an admin role for a specific group.

```javascript
// Import the middleware
const {
  adminCheck,
  airqoAdminCheck,
} = require("@middleware/admin-access.middleware");
```

- `adminCheck`: Checks if the user has an admin role for the group specified in the request
- `airqoAdminCheck`: Specifically checks for admin access to the AirQo group

### 2. Permission-Based Access Control

The `permission-auth.middleware.js` provides middleware for checking if a user has a specific permission.

```javascript
// Import the middleware
const { hasPermission } = require("@middleware/permission-auth.middleware");
const constants = require("@config/constants");
```

- `hasPermission(permissionName)`: Checks if the user has the specified permission

### 3. Combined Authorization

The `combined-auth.middleware.js` provides middleware that requires BOTH admin role AND specific permission.

```javascript
// Import the middleware
const {
  adminWithPermission,
  groupOperations,
} = require("@middleware/combined-auth.middleware");
```

- `adminWithPermission(permissionName)`: Checks for both admin role and permission
- `groupOperations`: Pre-configured middleware for common group operations

### 4. Flexible Authorization

The `flexible-auth.middleware.js` provides middleware that grants access if the user has EITHER admin role OR specific permission.

```javascript
// Import the middleware
const {
  hasPermissionOrAdmin,
} = require("@middleware/flexible-auth.middleware");
```

- `hasPermissionOrAdmin(permissionName)`: Allows access if user has either admin role or specific permission

## Example Routes

For this guide, we'll focus on two group-related endpoints:

1. **Get Group Settings** (`GET /:groupSlug/settings`)
2. **Update Group Settings** (`PUT /:groupSlug/settings`)

## Implementation Examples

### Approach 1: Role-Based Access Control

This approach grants access based solely on the user's role (admin) in the specified group.

```javascript
// routes/groups.routes.js
// Get group settings (admin only)
router.get(
  "/:groupSlug/settings",
  setJWTAuth,
  authJWT,
  adminCheck,
  groupController.getSettings
);

// Update group settings (admin only)
router.put(
  "/:groupSlug/settings",
  setJWTAuth,
  authJWT,
  adminCheck,
  groupController.updateSettings
);
```

**When to use**: When you only need to check if a user is an admin for a specific group, regardless of their specific permissions.

### Approach 2: Permission-Based Access Control

This approach grants access based on whether the user has specific permissions, regardless of their role.

```javascript
// routes/groups.routes.js
// Get group settings (requires VIEW_SETTINGS permission)
router.get(
  "/:groupSlug/settings",
  setJWTAuth,
  authJWT,
  hasPermission(constants.GROUP_PERMISSIONS.VIEW_SETTINGS),
  groupController.getSettings
);

// Update group settings (requires MANAGE_SETTINGS permission)
router.put(
  "/:groupSlug/settings",
  setJWTAuth,
  authJWT,
  hasPermission(constants.GROUP_PERMISSIONS.MANAGE_SETTINGS),
  groupController.updateSettings
);
```

**When to use**: When you need granular control over specific actions, and different user roles might have different subsets of permissions.

### Approach 3: Combined Authorization (Role AND Permission)

This approach requires that users have BOTH an admin role AND specific permissions, providing the strongest security.

```javascript
// routes/groups.routes.js
// Get group settings (requires BOTH admin role AND VIEW_SETTINGS permission)
router.get(
  "/:groupSlug/settings",
  setJWTAuth,
  authJWT,
  groupOperations.viewSettings,
  groupController.getSettings
);

// Update group settings (requires BOTH admin role AND MANAGE_SETTINGS permission)
router.put(
  "/:groupSlug/settings",
  setJWTAuth,
  authJWT,
  groupOperations.manageSettings,
  groupController.updateSettings
);
```

**When to use**: For critical operations where you want to ensure that users have both the appropriate role AND specific permissions.

### Approach 4: Flexible Authorization (Role OR Permission)

This approach grants access if the user has EITHER an admin role OR specific permissions, providing more flexibility.

```javascript
// routes/groups.routes.js
// Get group settings (requires EITHER admin role OR VIEW_SETTINGS permission)
router.get(
  "/:groupSlug/settings",
  setJWTAuth,
  authJWT,
  hasPermissionOrAdmin(constants.GROUP_PERMISSIONS.VIEW_SETTINGS),
  groupController.getSettings
);

// Update group settings (requires EITHER admin role OR MANAGE_SETTINGS permission)
router.put(
  "/:groupSlug/settings",
  setJWTAuth,
  authJWT,
  hasPermissionOrAdmin(constants.GROUP_PERMISSIONS.MANAGE_SETTINGS),
  groupController.updateSettings
);
```

**When to use**: When you want to allow access to either admins OR users with specific permissions, providing more flexible access control.

## Best Practices

1. **Choose the Right Approach**:

   - Use **Role-Based** for simple admin-only endpoints
   - Use **Permission-Based** for granular control over specific actions
   - Use **Combined** for critical operations requiring strong security
   - Use **Flexible** for operations that should be accessible to either admins or authorized users

2. **Define Clear Permission Constants**:

   - Update the `config/global/permissions.js` file with clearly named constants
   - Group permissions by resource or feature
   - Follow a consistent naming pattern (e.g., `RESOURCE_ACTION`)

3. **Order of Middleware**:

   - Always place `setJWTAuth` and `authJWT` before authorization middleware
   - Place validation middleware after authorization to avoid unnecessary validation

4. **Accessing User Context**:

   - When using admin middleware, access group and role info via `req.userGroupContext`
   - Use this context in controllers to customize responses based on the user's permissions

5. **Error Handling**:
   - All middleware includes proper error handling
   - Custom error messages clearly indicate why access was denied

By implementing these authorization approaches, you can create a robust and flexible access control system for your API.
