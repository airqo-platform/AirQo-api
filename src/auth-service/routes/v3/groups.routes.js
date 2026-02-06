// group.routes.js - Updated with new RBAC system
const express = require("express");
const router = express.Router();
const groupController = require("@controllers/group.controller");
const groupValidations = require("@validators/groups.validators");
const constants = require("@config/constants");
const { enhancedJWTAuth } = require("@middleware/passport");

// New RBAC middleware
const {
  requirePermissions,
  requireGroupPermissions,
  requireGroupMembership,
  requireGroupManager,
  debugPermissions,
} = require("@middleware/permissionAuth");

const {
  requireGroupAdmin,
  requireGroupAccess,
  requireGroupUserManagement,
  requireGroupSettings,
} = require("@middleware/adminAccess");

const {
  requireGroupManagerAccess,
  requireGroupAdminAccess,
  requireGroupMemberManagementAccess,
} = require("@middleware/groupNetworkAuth");

const { validate, headers, pagination } = require("@validators/common");

router.use(headers);
router.use(groupValidations.pagination);

// Debug middleware for development
if (process.env.NODE_ENV !== "production") {
  router.use(debugPermissions());
}

router.post(
  "/populate-slugs",
  enhancedJWTAuth,
  groupValidations.populateSlugs,
  validate,
  requirePermissions([constants.SYSTEM_ADMIN, constants.GROUP_MANAGEMENT]),
  groupController.populateSlugs,
);

// Update/add slug for a specific group (manual)
router.put(
  "/:grp_id/slug",
  enhancedJWTAuth,
  requirePermissions(["SYSTEM_ADMIN"]),
  groupValidations.updateSlug,
  validate,
  groupController.updateSlug,
);

// Public/minimal access endpoints
router.get(
  "/",
  groupValidations.list,
  validate,
  enhancedJWTAuth,
  requirePermissions([constants.GROUP_VIEW]),
  groupController.list,
);

router.get(
  "/summary",
  groupValidations.listSummary,
  validate,
  enhancedJWTAuth,
  requirePermissions([constants.GROUP_VIEW]),
  groupController.listSummary,
);

// Group creation - requires system-level permissions
router.post(
  "/",
  groupValidations.create,
  validate,
  enhancedJWTAuth,
  requirePermissions([constants.GROUP_CREATE, constants.SYSTEM_ADMIN]),
  groupController.create,
);

// Group-specific endpoints requiring membership or admin access
router.get(
  "/:grp_id",
  groupValidations.getGroupById,
  validate,
  enhancedJWTAuth,
  requireGroupAccess([constants.GROUP_VIEW]),
  groupController.list,
);

router.get(
  "/:grp_id/summary",
  groupValidations.getGroupById,
  validate,
  enhancedJWTAuth,
  requireGroupAccess([constants.GROUP_VIEW]),
  groupController.list,
);

// Group update - requires admin access to the specific group
router.put(
  "/:grp_id",
  groupValidations.update,
  validate,
  enhancedJWTAuth,
  requireGroupAdmin(),
  groupController.update,
);

// Group deletion - requires super admin
router.delete(
  "/:grp_id",
  groupValidations.deleteGroup,
  validate,
  enhancedJWTAuth,
  requireGroupAdmin({ requireSuperAdmin: true }),
  groupController.delete,
);

// Dashboard access - group members with dashboard permissions
router.get(
  "/:groupSlug/dashboard",
  enhancedJWTAuth,
  requireGroupAccess([constants.DASHBOARD_VIEW, constants.GROUP_VIEW]),
  groupController.getDashboard,
);

// Members management - requires member view permissions
router.get(
  "/:grp_id/members",
  enhancedJWTAuth,
  requireGroupAccess([constants.MEMBER_VIEW, constants.GROUP_VIEW]),
  groupController.getMembers,
);

// Settings access - group members can view, admins can modify
router.get(
  "/:groupSlug/settings",
  enhancedJWTAuth,
  requireGroupAccess([constants.SETTINGS_VIEW, constants.GROUP_VIEW]),
  groupController.getSettings,
);

// Update group settings - requires admin access
router.put(
  "/:groupSlug/settings",
  enhancedJWTAuth,
  requireGroupSettings("groupSlug"),
  groupController.updateSettings,
);

// User assignment - requires user management permissions
router.put(
  "/:grp_id/assign-user/:user_id",
  groupValidations.assignOneUser,
  validate,
  enhancedJWTAuth,
  requireGroupUserManagement(),
  groupController.assignOneUser,
);

router.post(
  "/:grp_id/assign-users",
  groupValidations.assignUsers,
  validate,
  enhancedJWTAuth,
  requireGroupUserManagement(),
  groupController.assignUsers,
);

router.delete(
  "/:grp_id/unassign-user/:user_id",
  groupValidations.unAssignUser,
  validate,
  enhancedJWTAuth,
  requireGroupUserManagement(),
  groupController.unAssignUser,
);

router.delete(
  "/:grp_id/unassign-many-users",
  groupValidations.unAssignManyUsers,
  validate,
  enhancedJWTAuth,
  requireGroupUserManagement(),
  groupController.unAssignManyUsers,
);

// User leaves a group (self-service)
router.delete(
  "/:grp_id/leave",
  groupValidations.leaveGroup,
  validate,
  enhancedJWTAuth,
  requireGroupMembership("grp_id"), // Ensures the user is a member before leaving
  groupController.leaveGroup,
);

// Manager assignment - requires admin access
router.put(
  "/:grp_id/set-manager/:user_id",
  groupValidations.setManager,
  validate,
  enhancedJWTAuth,
  requireGroupAdmin(),
  groupController.enhancedSetManager,
);

// Enhanced manager assignment with automatic role handling
router.put(
  "/:grp_id/enhanced-set-manager/:user_id",
  groupValidations.enhancedSetManager,
  validate,
  enhancedJWTAuth,
  requireGroupAdmin(),
  groupController.enhancedSetManager,
);

// User listing endpoints - different permission levels
router.get(
  "/:grp_id/assigned-users",
  groupValidations.listAssignedUsers,
  validate,
  enhancedJWTAuth,
  requireGroupPermissions([constants.MEMBER_VIEW], "grp_id"),
  groupController.listAssignedUsers,
);

router.get(
  "/:grp_id/all-users",
  groupValidations.listAllGroupUsers,
  validate,
  enhancedJWTAuth,
  requireGroupPermissions(
    [constants.MEMBER_VIEW, constants.USER_VIEW],
    "grp_id",
  ),
  groupController.listAllGroupUsers,
);

router.get(
  "/:grp_id/available-users",
  groupValidations.listAvailableUsers,
  validate,
  enhancedJWTAuth,
  requireGroupUserManagement(),
  groupController.listAvailableUsers,
);

// Role management for groups
router.get(
  "/:grp_id/roles",
  groupValidations.listRolesForGroup,
  validate,
  enhancedJWTAuth,
  requireGroupPermissions([constants.ROLE_VIEW], "grp_id"),
  groupController.listRolesForGroup,
);

// Manager-specific features - requires manager access
router.get(
  "/:grp_id/manager/dashboard",
  enhancedJWTAuth,
  requireGroupManagerAccess(),
  groupController.getManagerDashboard,
);

router.get(
  "/:grp_id/analytics",
  groupValidations.getGroupAnalytics,
  validate,
  enhancedJWTAuth,
  requireGroupManagerAccess(),
  groupController.getGroupAnalytics,
);

// Bulk operations - requires admin access
router.post(
  "/:grp_id/bulk-member-management",
  groupValidations.bulkMemberManagement,
  validate,
  enhancedJWTAuth,
  requireGroupAdminAccess(),
  groupController.bulkMemberManagement,
);

// Access request management - manager level access
router.get(
  "/:grp_id/access-requests",
  groupValidations.manageAccessRequests,
  validate,
  enhancedJWTAuth,
  requireGroupManagerAccess(),
  groupController.manageAccessRequests,
);

router.post(
  "/:grp_id/access-requests/bulk-decision",
  groupValidations.manageAccessRequests,
  validate,
  enhancedJWTAuth,
  requireGroupManagerAccess(),
  groupController.manageAccessRequests,
);

// Role assignment to specific members - admin access
router.put(
  "/:grp_id/members/:user_id/role",
  groupValidations.assignMemberRole,
  validate,
  enhancedJWTAuth,
  requireGroupAdminAccess(),
  groupController.assignMemberRole,
);

// Invitation management - manager access
router.post(
  "/:grp_id/invitations",
  groupValidations.sendGroupInvitations,
  validate,
  enhancedJWTAuth,
  requireGroupManagerAccess(),
  groupController.sendGroupInvitations,
);

router.get(
  "/:grp_id/invitations",
  enhancedJWTAuth,
  requireGroupManagerAccess(),
  groupController.listGroupInvitations,
);

// Status management - admin access
router.patch(
  "/:grp_id/status",
  groupValidations.updateGroupStatus,
  validate,
  enhancedJWTAuth,
  requireGroupAdminAccess(),
  groupController.updateGroupStatus,
);

// Activity and audit logs - manager access
router.get(
  "/:grp_id/activity-log",
  groupValidations.getActivityLog,
  validate,
  enhancedJWTAuth,
  requireGroupManagerAccess(),
  groupController.getGroupActivityLog,
);

// Advanced search - member access with view permissions
router.get(
  "/:grp_id/members/search",
  groupValidations.searchGroupMembers,
  validate,
  enhancedJWTAuth,
  requireGroupPermissions(
    [constants.MEMBER_VIEW, constants.MEMBER_SEARCH],
    "grp_id",
  ),
  groupController.searchGroupMembers,
);

// Data export - manager access
router.get(
  "/:grp_id/export",
  groupValidations.exportGroupData,
  validate,
  enhancedJWTAuth,
  requireGroupManagerAccess(),
  groupController.exportGroupData,
);

// Health diagnostics - admin access
router.get(
  "/:grp_id/health",
  enhancedJWTAuth,
  requireGroupAdminAccess(),
  groupController.getGroupHealth,
);

// Cohort assignment routes
router.post(
  "/:grp_id/cohorts/assign",
  enhancedJWTAuth,
  requireGroupAdminAccess(),
  groupValidations.assignCohortsToGroup,
  validate,
  groupController.assignCohortsToGroup,
);

router.delete(
  "/:grp_id/cohorts/unassign",
  enhancedJWTAuth,
  requireGroupAdminAccess(),
  groupValidations.unassignCohortsFromGroup,
  validate,
  groupController.unassignCohortsFromGroup,
);

router.get(
  "/:grp_id/cohorts",
  enhancedJWTAuth,
  requireGroupMembership("grp_id"),
  groupValidations.listGroupCohorts,
  validate,
  groupController.listGroupCohorts,
);

// System-level operations - requires super admin
router.post(
  "/removeUniqueConstraints",
  groupValidations.removeUniqueConstraint,
  validate,
  enhancedJWTAuth,
  requirePermissions([constants.SYSTEM_ADMIN, constants.DATABASE_ADMIN]),
  groupController.removeUniqueConstraint,
);

module.exports = router;
