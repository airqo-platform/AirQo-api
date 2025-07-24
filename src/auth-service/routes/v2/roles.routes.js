// roles.routes.js
const express = require("express");
const router = express.Router();
const roleController = require("@controllers/role.controller");
const roleValidations = require("@validators/roles.validators");
const { setJWTAuth, authJWT } = require("@middleware/passport");

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};
router.use(headers);
router.use(roleValidations.pagination);

const injectCurrentUserId = (req, res, next) => {
  req.params.user_id = req.user._id;
  next();
};

router.get("/", roleValidations.list, setJWTAuth, authJWT, roleController.list);

router.get(
  "/summary",
  roleValidations.listSummary,
  setJWTAuth,
  authJWT,
  roleController.listSummary
);

router.post(
  "/",
  roleValidations.create,
  setJWTAuth,
  authJWT,
  roleController.create
);

router.put(
  "/:role_id",
  roleValidations.update,
  setJWTAuth,
  authJWT,
  roleController.update
);

router.delete(
  "/:role_id",
  roleValidations.deleteRole,
  setJWTAuth,
  authJWT,
  roleController.delete
);

router.get(
  "/:role_id/users",
  roleValidations.listUsersWithRole,
  setJWTAuth,
  authJWT,
  roleController.listUsersWithRole
);

router.get(
  "/:role_id/available_users",
  roleValidations.listAvailableUsersForRole,
  setJWTAuth,
  authJWT,
  roleController.listAvailableUsersForRole
);

router.post(
  "/:role_id/users",
  roleValidations.assignManyUsersToRole,
  setJWTAuth,
  authJWT,
  roleController.assignManyUsersToRole
);

router.post(
  "/:role_id/user",
  roleValidations.assignUserToRole,
  setJWTAuth,
  authJWT,
  roleController.assignUserToRole
);

router.put(
  "/:role_id/user/:user_id",
  roleValidations.assignUserToRolePut,
  setJWTAuth,
  authJWT,
  roleController.assignUserToRole
);

router.delete(
  "/:role_id/users",
  roleValidations.unAssignManyUsersFromRole,
  setJWTAuth,
  authJWT,
  roleController.unAssignManyUsersFromRole
);

router.delete(
  "/:role_id/user/:user_id",
  roleValidations.unAssignUserFromRole,
  setJWTAuth,
  authJWT,
  roleController.unAssignUserFromRole
);

router.get(
  "/:role_id/permissions",
  roleValidations.listPermissionsForRole,
  setJWTAuth,
  authJWT,
  roleController.listPermissionsForRole
);

router.get(
  "/:role_id/available_permissions",
  roleValidations.listAvailablePermissionsForRole,
  setJWTAuth,
  authJWT,
  roleController.listAvailablePermissionsForRole
);

router.post(
  "/:role_id/permissions",
  roleValidations.assignPermissionToRole,
  setJWTAuth,
  authJWT,
  roleController.assignPermissionToRole
);

router.delete(
  "/:role_id/permissions",
  roleValidations.unAssignManyPermissionsFromRole,
  setJWTAuth,
  authJWT,
  roleController.unAssignManyPermissionsFromRole
);

router.put(
  "/:role_id/permissions",
  roleValidations.updateRolePermissions,
  setJWTAuth,
  authJWT,
  roleController.updateRolePermissions
);

router.delete(
  "/:role_id/permissions/:permission_id",
  roleValidations.unAssignPermissionFromRole,
  setJWTAuth,
  authJWT,
  roleController.unAssignPermissionFromRole
);

router.post(
  "/:role_id/user/enhanced",
  roleValidations.assignUserToRole,
  setJWTAuth,
  authJWT,
  roleController.enhancedAssignUserToRole
);

router.put(
  "/:role_id/user/:user_id/enhanced",
  roleValidations.assignUserToRolePut,
  setJWTAuth,
  authJWT,
  roleController.enhancedAssignUserToRole
);

// Enhanced role unassignment with detailed feedback
router.delete(
  "/:role_id/user/:user_id/enhanced",
  roleValidations.unAssignUserFromRole,
  setJWTAuth,
  authJWT,
  roleController.enhancedUnAssignUserFromRole
);

// New user-centric role management endpoints
router.get(
  "/users/:user_id/network-roles",
  roleValidations.getUserRoles,
  setJWTAuth,
  authJWT,
  roleController.getUserNetworkRoles
);

router.get(
  "/users/:user_id/group-roles",
  roleValidations.getUserRoles,
  setJWTAuth,
  authJWT,
  roleController.getUserGroupRoles
);

router.get(
  "/users/:user_id/role-summary",
  roleValidations.getUserRoles,
  setJWTAuth,
  authJWT,
  roleController.getUserRoleSummary
);

router.get(
  "/admin/deprecated-field-audit",
  roleValidations.auditDeprecatedFields,
  setJWTAuth,
  authJWT,
  roleController.auditDeprecatedFields
);

router.get(
  "/users/:user_id/enhanced-details",
  roleValidations.getEnhancedUserDetails,
  setJWTAuth,
  authJWT,
  roleController.getEnhancedUserDetails
);

router.get(
  "/users/:user_id/detailed-roles-permissions",
  roleValidations.getUserRolesWithFilters,
  setJWTAuth,
  authJWT,
  roleController.getUserRolesAndPermissionsDetailed
);

router.get(
  "/users/:user_id/groups/:group_id/permissions",
  roleValidations.getUserPermissionsForGroup,
  setJWTAuth,
  authJWT,
  roleController.getUserPermissionsForGroup
);

router.get(
  "/users/:user_id/permissions/by-group",
  roleValidations.getUserPermissionsForGroup,
  setJWTAuth,
  authJWT,
  roleController.getUserPermissionsForGroup
);

router.get(
  "/me/groups/:group_id/permissions",
  setJWTAuth,
  authJWT,
  injectCurrentUserId,
  roleValidations.getUserPermissionsForGroup,
  roleController.getCurrentUserPermissionsForGroup
);

router.get(
  "/users/:user_id/groups/:group_id/permissions/simplified",
  roleValidations.getUserPermissionsForGroup,
  setJWTAuth,
  authJWT,
  roleController.getSimplifiedPermissionsForGroup
);

router.get(
  "/me/groups/:group_id/permissions/simplified",
  setJWTAuth,
  authJWT,
  injectCurrentUserId,
  roleValidations.getUserPermissionsForGroup,
  roleController.getSimplifiedPermissionsForGroup
);

router.post(
  "/users/:user_id/permissions/bulk-check",
  roleValidations.bulkPermissionsCheck,
  setJWTAuth,
  authJWT,
  roleController.bulkPermissionsCheck
);

router.post(
  "/me/permissions/bulk-check",
  setJWTAuth,
  authJWT,
  injectCurrentUserId,
  roleValidations.bulkPermissionsCheck,
  roleController.bulkPermissionsCheck
);

router.post(
  "/users/:user_id/permissions/check-actions",
  roleValidations.checkUserPermissionsForActions,
  setJWTAuth,
  authJWT,
  roleController.checkUserPermissionsForActions
);

router.get(
  "/users/:user_id/roles/by-group",
  roleValidations.getUserRolesWithFilters,
  setJWTAuth,
  authJWT,
  roleController.getUserRolesByGroup
);

router.get(
  "/users/:user_id/groups/permissions-summary",
  roleValidations.getUserRoles,
  setJWTAuth,
  authJWT,
  roleController.getUserGroupsWithPermissionsSummary
);

router.get(
  "/me/groups/permissions-summary",
  setJWTAuth,
  authJWT,
  injectCurrentUserId,
  roleValidations.getUserRoles,
  roleController.getUserGroupsWithPermissionsSummary
);

router.get(
  "/users/:user_id/rbac-analysis",
  roleValidations.getUserRoles,
  setJWTAuth,
  authJWT,
  roleController.getUserRolesAndPermissionsViaRBAC
);

router.get(
  "/users/:user_id/roles-simplified",
  roleValidations.getUserRoles,
  setJWTAuth,
  authJWT,
  roleController.getUserRolesSimplified
);

router.get(
  "/me/detailed-roles-permissions",
  setJWTAuth,
  authJWT,
  roleController.getCurrentUserRolesAndPermissions
);

router.get(
  "/me/rbac-analysis",
  setJWTAuth,
  authJWT,
  injectCurrentUserId,
  roleController.getUserRolesAndPermissionsViaRBAC
);

router.get(
  "/me/roles-simplified",
  setJWTAuth,
  authJWT,
  injectCurrentUserId,
  roleController.getUserRolesSimplified
);

router.get(
  "/system/health",
  roleValidations.getSystemHealth,
  setJWTAuth,
  authJWT,
  roleController.getSystemRoleHealth
);

router.post(
  "/bulk-operations",
  roleValidations.bulkRoleOperations,
  setJWTAuth,
  authJWT,
  roleController.bulkRoleOperations
);

router.get(
  "/:role_id",
  roleValidations.getRoleById,
  setJWTAuth,
  authJWT,
  roleController.list
);

module.exports = router;
