// group.routes.js - Updated with new RBAC system
const express = require("express");
const router = express.Router();
const groupController = require("@controllers/group.controller");
const constants = require("@config/constants");
const groupValidations = require("@validators/groups.validators");
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
  requirePermissions(["SYSTEM_ADMIN"]),
  groupValidations.populateSlugs,
  groupController.populateSlugs
);

// Update/add slug for a specific group (manual)
router.put(
  "/:grp_id/slug",
  enhancedJWTAuth,
  requirePermissions(["SYSTEM_ADMIN"]),
  groupValidations.updateSlug,
  groupController.updateSlug
);

// Public/minimal access endpoints
router.get(
  "/",
  groupValidations.list,
  enhancedJWTAuth,
  requirePermissions([constants.GROUP_VIEW]),
  groupController.list
);

router.get(
  "/summary",
  groupValidations.listSummary,
  enhancedJWTAuth,
  requirePermissions([constants.GROUP_VIEW]),
  groupController.listSummary
);

// Group creation - requires system-level permissions
router.post(
  "/",
  groupValidations.create,
  enhancedJWTAuth,
  requirePermissions([constants.GROUP_CREATE, constants.SYSTEM_ADMIN]),
  groupController.create
);

// Group-specific endpoints requiring membership or admin access
router.get(
  "/:grp_id",
  groupValidations.getGroupById,
  enhancedJWTAuth,
  requireGroupAccess([constants.GROUP_VIEW]),
  groupController.list
);

router.get(
  "/:grp_id/summary",
  groupValidations.getGroupById,
  enhancedJWTAuth,
  requireGroupAccess([constants.GROUP_VIEW]),
  groupController.list
);

// Group update - requires admin access to the specific group
router.put(
  "/:grp_id",
  groupValidations.update,
  enhancedJWTAuth,
  requireGroupAdmin(),
  groupController.update
);

// Group deletion - requires super admin
router.delete(
  "/:grp_id",
  groupValidations.deleteGroup,
  enhancedJWTAuth,
  requireGroupAdmin({ requireSuperAdmin: true }),
  groupController.delete
);

// Dashboard access - group members with dashboard permissions
router.get(
  "/:groupSlug/dashboard",
  enhancedJWTAuth,
  requireGroupAccess([constants.DASHBOARD_VIEW, constants.GROUP_VIEW]),
  groupController.getDashboard
);

// Members management - requires member view permissions
router.get(
  "/:grp_id/members",
  enhancedJWTAuth,
  requireGroupAccess([constants.MEMBER_VIEW, constants.GROUP_VIEW]),
  groupController.getMembers
);

// Settings access - group members can view, admins can modify
router.get(
  "/:groupSlug/settings",
  enhancedJWTAuth,
  requireGroupAccess([constants.SETTINGS_VIEW, constants.GROUP_VIEW]),
  groupController.getSettings
);

// Update group settings - requires admin access
router.put(
  "/:groupSlug/settings",
  enhancedJWTAuth,
  requireGroupSettings("groupSlug"),
  groupController.updateSettings
);

// User assignment - requires user management permissions
router.put(
  "/:grp_id/assign-user/:user_id",
  groupValidations.assignOneUser,
  enhancedJWTAuth,
  requireGroupUserManagement(),
  groupController.assignOneUser
);

router.post(
  "/:grp_id/assign-users",
  groupValidations.assignUsers,
  enhancedJWTAuth,
  requireGroupUserManagement(),
  groupController.assignUsers
);

router.delete(
  "/:grp_id/unassign-user/:user_id",
  groupValidations.unAssignUser,
  enhancedJWTAuth,
  requireGroupUserManagement(),
  groupController.unAssignUser
);

router.delete(
  "/:grp_id/unassign-many-users",
  groupValidations.unAssignManyUsers,
  enhancedJWTAuth,
  requireGroupUserManagement(),
  groupController.unAssignManyUsers
);

// Manager assignment - requires admin access
router.put(
  "/:grp_id/set-manager/:user_id",
  groupValidations.setManager,
  enhancedJWTAuth,
  requireGroupAdmin(),
  groupController.setManager
);

// Enhanced manager assignment with automatic role handling
router.put(
  "/:grp_id/enhanced-set-manager/:user_id",
  groupValidations.enhancedSetManager,
  enhancedJWTAuth,
  requireGroupAdmin(),
  groupController.enhancedSetManager
);

// User listing endpoints - different permission levels
router.get(
  "/:grp_id/assigned-users",
  groupValidations.listAssignedUsers,
  enhancedJWTAuth,
  requireGroupPermissions([constants.MEMBER_VIEW], "grp_id"),
  groupController.listAssignedUsers
);

router.get(
  "/:grp_id/all-users",
  groupValidations.listAllGroupUsers,
  enhancedJWTAuth,
  requireGroupPermissions(
    [constants.MEMBER_VIEW, constants.USER_VIEW],
    "grp_id"
  ),
  groupController.listAllGroupUsers
);

router.get(
  "/:grp_id/available-users",
  groupValidations.listAvailableUsers,
  enhancedJWTAuth,
  requireGroupUserManagement(),
  groupController.listAvailableUsers
);

// Role management for groups
router.get(
  "/:grp_id/roles",
  groupValidations.listRolesForGroup,
  enhancedJWTAuth,
  requireGroupPermissions([constants.ROLE_VIEW], "grp_id"),
  groupController.listRolesForGroup
);

// Manager-specific features - requires manager access
router.get(
  "/:grp_id/manager/dashboard",
  enhancedJWTAuth,
  requireGroupManagerAccess(),
  groupController.getManagerDashboard
);

router.get(
  "/:grp_id/analytics",
  groupValidations.getGroupAnalytics,
  enhancedJWTAuth,
  requireGroupManagerAccess(),
  groupController.getGroupAnalytics
);

// Bulk operations - requires admin access
router.post(
  "/:grp_id/bulk-member-management",
  groupValidations.bulkMemberManagement,
  enhancedJWTAuth,
  requireGroupAdminAccess(),
  groupController.bulkMemberManagement
);

// Access request management - manager level access
router.get(
  "/:grp_id/access-requests",
  groupValidations.manageAccessRequests,
  enhancedJWTAuth,
  requireGroupManagerAccess(),
  groupController.manageAccessRequests
);

router.post(
  "/:grp_id/access-requests/bulk-decision",
  groupValidations.manageAccessRequests,
  enhancedJWTAuth,
  requireGroupManagerAccess(),
  groupController.manageAccessRequests
);

// Role assignment to specific members - admin access
router.put(
  "/:grp_id/members/:user_id/role",
  groupValidations.assignMemberRole,
  enhancedJWTAuth,
  requireGroupAdminAccess(),
  groupController.assignMemberRole
);

// Invitation management - manager access
router.post(
  "/:grp_id/invitations",
  groupValidations.sendGroupInvitations,
  enhancedJWTAuth,
  requireGroupManagerAccess(),
  groupController.sendGroupInvitations
);

router.get(
  "/:grp_id/invitations",
  enhancedJWTAuth,
  requireGroupManagerAccess(),
  groupController.listGroupInvitations
);

// Status management - admin access
router.patch(
  "/:grp_id/status",
  groupValidations.updateGroupStatus,
  enhancedJWTAuth,
  requireGroupAdminAccess(),
  groupController.updateGroupStatus
);

// Activity and audit logs - manager access
router.get(
  "/:grp_id/activity-log",
  groupValidations.getActivityLog,
  enhancedJWTAuth,
  requireGroupManagerAccess(),
  groupController.getGroupActivityLog
);

// Advanced search - member access with view permissions
router.get(
  "/:grp_id/members/search",
  groupValidations.searchGroupMembers,
  enhancedJWTAuth,
  requireGroupPermissions(
    [constants.MEMBER_VIEW, constants.MEMBER_SEARCH],
    "grp_id"
  ),
  groupController.searchGroupMembers
);

// Data export - manager access
router.get(
  "/:grp_id/export",
  groupValidations.exportGroupData,
  enhancedJWTAuth,
  requireGroupManagerAccess(),
  groupController.exportGroupData
);

// Health diagnostics - admin access
router.get(
  "/:grp_id/health",
  enhancedJWTAuth,
  requireGroupAdminAccess(),
  groupController.getGroupHealth
);

// Cohort assignment routes
router.post(
  "/:grp_id/cohorts/assign",
  enhancedJWTAuth,
  groupValidations.assignCohortsToGroup,
  groupController.assignCohortsToGroup
);

router.delete(
  "/:grp_id/cohorts/unassign",
  enhancedJWTAuth,
  groupValidations.unassignCohortsFromGroup,
  groupController.unassignCohortsFromGroup
);

router.get(
  "/:grp_id/cohorts",
  enhancedJWTAuth,
  groupValidations.listGroupCohorts,
  groupController.listGroupCohorts
);

// System-level operations - requires super admin
router.post(
  "/removeUniqueConstraints",
  groupValidations.removeUniqueConstraint,
  enhancedJWTAuth,
  requirePermissions([constants.SYSTEM_ADMIN, constants.DATABASE_ADMIN]),
  groupController.removeUniqueConstraint
);

module.exports = router;
