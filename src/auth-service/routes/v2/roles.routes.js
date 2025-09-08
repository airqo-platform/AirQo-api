// roles.routes.js
const express = require("express");
const router = express.Router();
const roleController = require("@controllers/role.controller");
const roleValidations = require("@validators/roles.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers);
router.use(roleValidations.pagination);

const injectCurrentUserId = (req, res, next) => {
  req.params.user_id = req.user._id;
  next();
};

router.get("/", roleValidations.list, enhancedJWTAuth, roleController.list);

router.get(
  "/summary",
  roleValidations.listSummary,
  enhancedJWTAuth,
  roleController.listSummary
);

router.post(
  "/",
  roleValidations.create,
  enhancedJWTAuth,
  roleController.create
);

router.put(
  "/:role_id",
  roleValidations.update,
  enhancedJWTAuth,
  roleController.update
);

router.delete(
  "/:role_id",
  roleValidations.deleteRole,
  enhancedJWTAuth,
  roleController.delete
);

router.get(
  "/:role_id/users",
  roleValidations.listUsersWithRole,
  enhancedJWTAuth,
  roleController.listUsersWithRole
);

router.get(
  "/:role_id/available_users",
  roleValidations.listAvailableUsersForRole,
  enhancedJWTAuth,
  roleController.listAvailableUsersForRole
);

router.post(
  "/:role_id/users",
  roleValidations.assignManyUsersToRole,
  enhancedJWTAuth,
  roleController.assignManyUsersToRole
);

router.post(
  "/:role_id/user",
  roleValidations.assignUserToRole,
  enhancedJWTAuth,
  roleController.assignUserToRole
);

router.put(
  "/:role_id/user/:user_id",
  roleValidations.assignUserToRolePut,
  enhancedJWTAuth,
  roleController.assignUserToRole
);

router.delete(
  "/:role_id/users",
  roleValidations.unAssignManyUsersFromRole,
  enhancedJWTAuth,
  roleController.unAssignManyUsersFromRole
);

router.delete(
  "/:role_id/user/:user_id",
  roleValidations.unAssignUserFromRole,
  enhancedJWTAuth,
  roleController.unAssignUserFromRole
);

router.get(
  "/:role_id/permissions",
  roleValidations.listPermissionsForRole,
  enhancedJWTAuth,
  roleController.listPermissionsForRole
);

router.get(
  "/:role_id/available_permissions",
  roleValidations.listAvailablePermissionsForRole,
  enhancedJWTAuth,
  roleController.listAvailablePermissionsForRole
);

router.post(
  "/:role_id/permissions",
  roleValidations.assignPermissionToRole,
  enhancedJWTAuth,
  roleController.assignPermissionToRole
);

router.delete(
  "/:role_id/permissions",
  roleValidations.unAssignManyPermissionsFromRole,
  enhancedJWTAuth,
  roleController.unAssignManyPermissionsFromRole
);

router.put(
  "/:role_id/permissions",
  roleValidations.updateRolePermissions,
  enhancedJWTAuth,
  roleController.updateRolePermissions
);

router.delete(
  "/:role_id/permissions/:permission_id",
  roleValidations.unAssignPermissionFromRole,
  enhancedJWTAuth,
  roleController.unAssignPermissionFromRole
);

router.post(
  "/:role_id/user/enhanced",
  roleValidations.assignUserToRole,
  enhancedJWTAuth,
  roleController.enhancedAssignUserToRole
);

router.put(
  "/:role_id/user/:user_id/enhanced",
  roleValidations.assignUserToRolePut,
  enhancedJWTAuth,
  roleController.enhancedAssignUserToRole
);

// Enhanced role unassignment with detailed feedback
router.delete(
  "/:role_id/user/:user_id/enhanced",
  roleValidations.unAssignUserFromRole,
  enhancedJWTAuth,
  roleController.enhancedUnAssignUserFromRole
);

// New user-centric role management endpoints
router.get(
  "/users/:user_id/network-roles",
  roleValidations.getUserRoles,
  enhancedJWTAuth,
  roleController.getUserNetworkRoles
);

router.get(
  "/users/:user_id/group-roles",
  roleValidations.getUserRoles,
  enhancedJWTAuth,
  roleController.getUserGroupRoles
);

router.get(
  "/users/:user_id/role-summary",
  roleValidations.getUserRoles,
  enhancedJWTAuth,
  roleController.getUserRoleSummary
);

router.get(
  "/admin/deprecated-field-audit",
  roleValidations.auditDeprecatedFields,
  enhancedJWTAuth,
  roleController.auditDeprecatedFields
);

router.get(
  "/users/:user_id/enhanced-details",
  roleValidations.getEnhancedUserDetails,
  enhancedJWTAuth,
  roleController.getEnhancedUserDetails
);

router.get(
  "/users/:user_id/detailed-roles-permissions",
  roleValidations.getUserRolesWithFilters,
  enhancedJWTAuth,
  roleController.getUserRolesAndPermissionsDetailed
);

router.get(
  "/users/:user_id/groups/:group_id/permissions",
  roleValidations.getUserPermissionsForGroup,
  enhancedJWTAuth,
  roleController.getUserPermissionsForGroup
);

router.get(
  "/users/:user_id/permissions/by-group",
  roleValidations.getUserPermissionsForGroup,
  enhancedJWTAuth,
  roleController.getUserPermissionsForGroup
);

router.get(
  "/me/groups/:group_id/permissions",
  enhancedJWTAuth,
  injectCurrentUserId,
  roleValidations.getUserPermissionsForGroup,
  roleController.getCurrentUserPermissionsForGroup
);

router.get(
  "/users/:user_id/groups/:group_id/permissions/simplified",
  roleValidations.getUserPermissionsForGroup,
  enhancedJWTAuth,
  roleController.getSimplifiedPermissionsForGroup
);

router.get(
  "/me/groups/:group_id/permissions/simplified",
  enhancedJWTAuth,
  injectCurrentUserId,
  roleValidations.getUserPermissionsForGroup,
  roleController.getSimplifiedPermissionsForGroup
);

router.post(
  "/users/:user_id/permissions/bulk-check",
  roleValidations.bulkPermissionsCheck,
  enhancedJWTAuth,
  roleController.bulkPermissionsCheck
);

router.post(
  "/me/permissions/bulk-check",
  enhancedJWTAuth,
  injectCurrentUserId,
  roleValidations.bulkPermissionsCheck,
  roleController.bulkPermissionsCheck
);

router.post(
  "/users/:user_id/permissions/check-actions",
  roleValidations.checkUserPermissionsForActions,
  enhancedJWTAuth,
  roleController.checkUserPermissionsForActions
);

router.get(
  "/users/:user_id/roles/by-group",
  roleValidations.getUserRolesWithFilters,
  enhancedJWTAuth,
  roleController.getUserRolesByGroup
);

router.get(
  "/users/:user_id/groups/permissions-summary",
  roleValidations.getUserRoles,
  enhancedJWTAuth,
  roleController.getUserGroupsWithPermissionsSummary
);

router.get(
  "/me/groups/permissions-summary",
  enhancedJWTAuth,
  injectCurrentUserId,
  roleValidations.getUserRoles,
  roleController.getUserGroupsWithPermissionsSummary
);

router.get(
  "/users/:user_id/rbac-analysis",
  roleValidations.getUserRoles,
  enhancedJWTAuth,
  roleController.getUserRolesAndPermissionsViaRBAC
);

router.get(
  "/users/:user_id/roles-simplified",
  roleValidations.getUserRoles,
  enhancedJWTAuth,
  roleController.getUserRolesSimplified
);

router.get(
  "/me/detailed-roles-permissions",
  enhancedJWTAuth,
  roleController.getCurrentUserRolesAndPermissions
);

router.get(
  "/me/rbac-analysis",
  enhancedJWTAuth,
  injectCurrentUserId,
  roleController.getUserRolesAndPermissionsViaRBAC
);

router.get(
  "/me/roles-simplified",
  enhancedJWTAuth,
  injectCurrentUserId,
  roleController.getUserRolesSimplified
);

router.get(
  "/system/health",
  roleValidations.getSystemHealth,
  enhancedJWTAuth,
  roleController.getSystemRoleHealth
);

router.post(
  "/bulk-operations",
  roleValidations.bulkRoleOperations,
  enhancedJWTAuth,
  roleController.bulkRoleOperations
);

router.get(
  "/:role_id",
  roleValidations.getRoleById,
  enhancedJWTAuth,
  roleController.list
);

module.exports = router;
