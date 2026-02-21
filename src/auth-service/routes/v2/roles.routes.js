// roles.routes.js
const express = require("express");
const router = express.Router();
const roleController = require("@controllers/role.controller");
const roleValidations = require("@validators/roles.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

const injectCurrentUserId = (req, res, next) => {
  req.params.user_id = req.user._id;
  next();
};

router.use(headers);

router.get(
  "/",
  roleValidations.list,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.list,
);

router.get(
  "/summary",
  roleValidations.listSummary,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.listSummary,
);

router.post(
  "/",
  roleValidations.create,
  validate,
  enhancedJWTAuth,
  roleController.create,
);

router.put(
  "/:role_id",
  roleValidations.update,
  validate,
  enhancedJWTAuth,
  roleController.update,
);

router.delete(
  "/:role_id",
  roleValidations.deleteRole,
  validate,
  enhancedJWTAuth,
  roleController.delete,
);

router.get(
  "/:role_id/users",
  roleValidations.listUsersWithRole,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.listUsersWithRole,
);

router.get(
  "/:role_id/available_users",
  roleValidations.listAvailableUsersForRole,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.listAvailableUsersForRole,
);

router.post(
  "/:role_id/users",
  roleValidations.assignManyUsersToRole,
  validate,
  enhancedJWTAuth,
  roleController.assignManyUsersToRole,
);

router.post(
  "/:role_id/user",
  roleValidations.assignUserToRole,
  validate,
  enhancedJWTAuth,
  roleController.assignUserToRole,
);

router.put(
  "/:role_id/user/:user_id",
  roleValidations.assignUserToRolePut,
  validate,
  enhancedJWTAuth,
  roleController.assignUserToRole,
);

router.delete(
  "/:role_id/users",
  roleValidations.unAssignManyUsersFromRole,
  validate,
  enhancedJWTAuth,
  roleController.unAssignManyUsersFromRole,
);

router.delete(
  "/:role_id/user/:user_id",
  roleValidations.unAssignUserFromRole,
  enhancedJWTAuth,
  roleController.unAssignUserFromRole,
);

router.get(
  "/:role_id/permissions",
  roleValidations.listPermissionsForRole,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.listPermissionsForRole,
);

router.get(
  "/:role_id/available_permissions",
  roleValidations.listAvailablePermissionsForRole,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.listAvailablePermissionsForRole,
);

router.post(
  "/:role_id/permissions",
  roleValidations.assignPermissionToRole,
  validate,
  enhancedJWTAuth,
  roleController.assignPermissionToRole,
);

router.delete(
  "/:role_id/permissions",
  roleValidations.unAssignManyPermissionsFromRole,
  enhancedJWTAuth,
  roleController.unAssignManyPermissionsFromRole,
);

router.put(
  "/:role_id/permissions",
  roleValidations.updateRolePermissions,
  validate,
  enhancedJWTAuth,
  roleController.updateRolePermissions,
);

router.delete(
  "/:role_id/permissions/:permission_id",
  roleValidations.unAssignPermissionFromRole,
  validate,
  enhancedJWTAuth,
  roleController.unAssignPermissionFromRole,
);

router.post(
  "/:role_id/user/enhanced",
  roleValidations.assignUserToRole,
  validate,
  enhancedJWTAuth,
  roleController.enhancedAssignUserToRole,
);

router.put(
  "/:role_id/user/:user_id/enhanced",
  roleValidations.assignUserToRolePut,
  validate,
  enhancedJWTAuth,
  roleController.enhancedAssignUserToRole,
);

// Enhanced role unassignment with detailed feedback
router.delete(
  "/:role_id/user/:user_id/enhanced",
  roleValidations.unAssignUserFromRole,
  validate,
  enhancedJWTAuth,
  roleController.enhancedUnAssignUserFromRole,
);

// New user-centric role management endpoints
router.get(
  "/users/:user_id/network-roles",
  roleValidations.getUserRoles,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.getUserNetworkRoles,
);

router.get(
  "/users/:user_id/group-roles",
  roleValidations.getUserRoles,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.getUserGroupRoles,
);

router.get(
  "/users/:user_id/role-summary",
  roleValidations.getUserRoles,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.getUserRoleSummary,
);

router.get(
  "/admin/deprecated-field-audit",
  roleValidations.auditDeprecatedFields,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.auditDeprecatedFields,
);

router.get(
  "/users/:user_id/enhanced-details",
  roleValidations.getEnhancedUserDetails,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.getEnhancedUserDetails,
);

router.get(
  "/users/:user_id/detailed-roles-permissions",
  roleValidations.getUserRolesWithFilters,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.getUserRolesAndPermissionsDetailed,
);

router.get(
  "/users/:user_id/groups/:group_id/permissions",
  roleValidations.getUserPermissionsForGroup,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.getUserPermissionsForGroup,
);

router.get(
  "/users/:user_id/permissions/by-group",
  roleValidations.getUserPermissionsForGroup,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.getUserPermissionsForGroup,
);

router.get(
  "/me/groups/:group_id/permissions",
  enhancedJWTAuth,
  injectCurrentUserId,
  pagination(),
  roleValidations.getUserPermissionsForGroup,
  validate,
  roleController.getCurrentUserPermissionsForGroup,
);

router.get(
  "/users/:user_id/groups/:group_id/permissions/simplified",
  roleValidations.getUserPermissionsForGroup,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.getSimplifiedPermissionsForGroup,
);

router.get(
  "/me/groups/:group_id/permissions/simplified",
  enhancedJWTAuth,
  injectCurrentUserId,
  pagination(),
  roleValidations.getUserPermissionsForGroup,
  validate,
  roleController.getSimplifiedPermissionsForGroup,
);

router.post(
  "/users/:user_id/permissions/bulk-check",
  roleValidations.bulkPermissionsCheck,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.bulkPermissionsCheck,
);

router.post(
  "/me/permissions/bulk-check",
  enhancedJWTAuth,
  injectCurrentUserId,
  pagination(),
  roleValidations.bulkPermissionsCheck,
  validate,
  roleController.bulkPermissionsCheck,
);

router.post(
  "/users/:user_id/permissions/check-actions",
  roleValidations.checkUserPermissionsForActions,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.checkUserPermissionsForActions,
);

router.get(
  "/users/:user_id/roles/by-group",
  roleValidations.getUserRolesWithFilters,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.getUserRolesByGroup,
);

router.get(
  "/users/:user_id/groups/permissions-summary",
  roleValidations.getUserRoles,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.getUserGroupsWithPermissionsSummary,
);

router.get(
  "/me/groups/permissions-summary",
  enhancedJWTAuth,
  injectCurrentUserId,
  pagination(),
  roleValidations.getUserRoles,
  validate,
  roleController.getUserGroupsWithPermissionsSummary,
);

router.get(
  "/users/:user_id/rbac-analysis",
  roleValidations.getUserRoles,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.getUserRolesAndPermissionsViaRBAC,
);

router.get(
  "/users/:user_id/roles-simplified",
  roleValidations.getUserRoles,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.getUserRolesSimplified,
);

router.get(
  "/me/detailed-roles-permissions",
  enhancedJWTAuth,
  roleController.getCurrentUserRolesAndPermissions,
  // No pagination here as it's a single user's detailed info
);

router.get(
  "/me/rbac-analysis",
  enhancedJWTAuth,
  injectCurrentUserId,
  roleController.getUserRolesAndPermissionsViaRBAC,
  // No pagination here as it's a single user's detailed info
);

router.get(
  "/me/roles-simplified",
  enhancedJWTAuth,
  injectCurrentUserId,
  roleController.getUserRolesSimplified,
  // No pagination here as it's a single user's detailed info
);

router.get(
  "/system/health",
  roleValidations.getSystemHealth,
  validate,
  enhancedJWTAuth,
  roleController.getSystemRoleHealth,
  // No pagination here as it's a system health check
);

router.post(
  "/bulk-operations",
  roleValidations.bulkRoleOperations,
  validate,
  enhancedJWTAuth,
  roleController.bulkRoleOperations,
);

router.get(
  "/:role_id",
  roleValidations.getRoleById,
  validate,
  enhancedJWTAuth,
  pagination(),
  roleController.list,
);

module.exports = router;
