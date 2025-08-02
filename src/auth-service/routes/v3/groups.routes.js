// group.routes.js - Updated with new RBAC system
const express = require("express");
const router = express.Router();
const groupController = require("@controllers/group.controller");
const groupValidations = require("@validators/groups.validators");
const { setJWTAuth, authJWT } = require("@middleware/passport");

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
} = require("@middleware/enhancedAdminAccess");

const {
  requireGroupManagerAccess,
  requireGroupAdminAccess,
  requireGroupMemberManagementAccess,
} = require("@middleware/groupNetworkAuth");

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
router.use(groupValidations.pagination);

// Debug middleware for development
if (process.env.NODE_ENV !== "production") {
  router.use(debugPermissions());
}

router.post(
  "/populate-slugs",
  setJWTAuth,
  authJWT,
  groupValidations.populateSlugs,
  groupController.populateSlugs
);

// Update/add slug for a specific group (manual)
router.put(
  "/:grp_id/slug",
  setJWTAuth,
  authJWT,
  groupValidations.updateSlug,
  groupController.updateSlug
);

// Public/minimal access endpoints
router.get(
  "/",
  groupValidations.list,
  setJWTAuth,
  authJWT,
  // requirePermissions(["GROUP_VIEW"]),
  groupController.list
);

router.get(
  "/summary",
  groupValidations.listSummary,
  setJWTAuth,
  authJWT,
  // requirePermissions(["GROUP_VIEW"]),
  groupController.listSummary
);

// Group creation - requires system-level permissions
router.post(
  "/",
  groupValidations.create,
  setJWTAuth,
  authJWT,
  // requirePermissions(["GROUP_CREATE", "SYSTEM_ADMIN"]),
  groupController.create
);

// Group-specific endpoints requiring membership or admin access
router.get(
  "/:grp_id",
  groupValidations.getGroupById,
  setJWTAuth,
  authJWT,
  // requireGroupAccess(["GROUP_VIEW"]),
  groupController.list
);

router.get(
  "/:grp_id/summary",
  groupValidations.getGroupById,
  setJWTAuth,
  authJWT,
  // requireGroupAccess(["GROUP_VIEW"]),
  groupController.list
);

// Group update - requires admin access to the specific group
router.put(
  "/:grp_id",
  groupValidations.update,
  setJWTAuth,
  authJWT,
  // requireGroupAdmin(),
  groupController.update
);

// Group deletion - requires super admin
router.delete(
  "/:grp_id",
  groupValidations.deleteGroup,
  setJWTAuth,
  authJWT,
  // requireGroupAdmin({ requireSuperAdmin: true }),
  groupController.delete
);

// Dashboard access - group members with dashboard permissions
router.get(
  "/:groupSlug/dashboard",
  setJWTAuth,
  authJWT,
  // requireGroupPermissions(["DASHBOARD_VIEW", "GROUP_VIEW"], "groupSlug"),
  groupController.getDashboard
);

// Members management - requires member view permissions
router.get(
  "/:groupSlug/members",
  setJWTAuth,
  authJWT,
  // requireGroupPermissions(["MEMBER_VIEW", "GROUP_VIEW"], "groupSlug"),
  groupController.getMembers
);

// Settings access - group members can view, admins can modify
router.get(
  "/:groupSlug/settings",
  setJWTAuth,
  authJWT,
  // requireGroupPermissions(["SETTINGS_VIEW", "GROUP_VIEW"], "groupSlug"),
  groupController.getSettings
);

// Update group settings - requires admin access
router.put(
  "/:groupSlug/settings",
  setJWTAuth,
  authJWT,
  // requireGroupSettings("groupSlug"),
  groupController.updateSettings
);

// User assignment - requires user management permissions
router.put(
  "/:grp_id/assign-user/:user_id",
  groupValidations.assignOneUser,
  setJWTAuth,
  authJWT,
  // requireGroupUserManagement(),
  groupController.assignOneUser
);

router.post(
  "/:grp_id/assign-users",
  groupValidations.assignUsers,
  setJWTAuth,
  authJWT,
  // requireGroupUserManagement(),
  groupController.assignUsers
);

router.delete(
  "/:grp_id/unassign-user/:user_id",
  groupValidations.unAssignUser,
  setJWTAuth,
  authJWT,
  // requireGroupUserManagement(),
  groupController.unAssignUser
);

router.delete(
  "/:grp_id/unassign-many-users",
  groupValidations.unAssignManyUsers,
  setJWTAuth,
  authJWT,
  // requireGroupUserManagement(),
  groupController.unAssignManyUsers
);

// Manager assignment - requires admin access
router.put(
  "/:grp_id/set-manager/:user_id",
  groupValidations.setManager,
  setJWTAuth,
  authJWT,
  // requireGroupAdmin(),
  groupController.setManager
);

// Enhanced manager assignment with automatic role handling
router.put(
  "/:grp_id/enhanced-set-manager/:user_id",
  groupValidations.enhancedSetManager,
  setJWTAuth,
  authJWT,
  // requireGroupAdmin(),
  groupController.enhancedSetManager
);

// User listing endpoints - different permission levels
router.get(
  "/:grp_id/assigned-users",
  groupValidations.listAssignedUsers,
  setJWTAuth,
  authJWT,
  // requireGroupPermissions(["MEMBER_VIEW"], "grp_id"),
  groupController.listAssignedUsers
);

router.get(
  "/:grp_id/all-users",
  groupValidations.listAllGroupUsers,
  setJWTAuth,
  authJWT,
  // requireGroupPermissions(["MEMBER_VIEW", "USER_VIEW"], "grp_id"),
  groupController.listAllGroupUsers
);

router.get(
  "/:grp_id/available-users",
  groupValidations.listAvailableUsers,
  setJWTAuth,
  authJWT,
  // requireGroupUserManagement(),
  groupController.listAvailableUsers
);

// Role management for groups
router.get(
  "/:grp_id/roles",
  groupValidations.listRolesForGroup,
  setJWTAuth,
  authJWT,
  // requireGroupPermissions(["ROLE_VIEW"], "grp_id"),
  groupController.listRolesForGroup
);

// Manager-specific features - requires manager access
router.get(
  "/:grp_id/manager/dashboard",
  setJWTAuth,
  authJWT,
  // requireGroupManagerAccess(),
  groupController.getManagerDashboard
);

router.get(
  "/:grp_id/analytics",
  groupValidations.getGroupAnalytics,
  setJWTAuth,
  authJWT,
  // requireGroupManagerAccess(),
  groupController.getGroupAnalytics
);

// Bulk operations - requires admin access
router.post(
  "/:grp_id/bulk-member-management",
  groupValidations.bulkMemberManagement,
  setJWTAuth,
  authJWT,
  // requireGroupAdminAccess(),
  groupController.bulkMemberManagement
);

// Access request management - manager level access
router.get(
  "/:grp_id/access-requests",
  groupValidations.manageAccessRequests,
  setJWTAuth,
  authJWT,
  // requireGroupManagerAccess(),
  groupController.manageAccessRequests
);

router.post(
  "/:grp_id/access-requests/bulk-decision",
  groupValidations.manageAccessRequests,
  setJWTAuth,
  authJWT,
  // requireGroupManagerAccess(),
  groupController.manageAccessRequests
);

// Role assignment to specific members - admin access
router.put(
  "/:grp_id/members/:user_id/role",
  groupValidations.assignMemberRole,
  setJWTAuth,
  authJWT,
  // requireGroupAdminAccess(),
  groupController.assignMemberRole
);

// Invitation management - manager access
router.post(
  "/:grp_id/invitations",
  groupValidations.sendGroupInvitations,
  setJWTAuth,
  authJWT,
  // requireGroupManagerAccess(),
  groupController.sendGroupInvitations
);

router.get(
  "/:grp_id/invitations",
  setJWTAuth,
  authJWT,
  // requireGroupManagerAccess(),
  groupController.listGroupInvitations
);

// Status management - admin access
router.patch(
  "/:grp_id/status",
  groupValidations.updateGroupStatus,
  setJWTAuth,
  authJWT,
  // requireGroupAdminAccess(),
  groupController.updateGroupStatus
);

// Activity and audit logs - manager access
router.get(
  "/:grp_id/activity-log",
  groupValidations.getActivityLog,
  setJWTAuth,
  authJWT,
  // requireGroupManagerAccess(),
  groupController.getGroupActivityLog
);

// Advanced search - member access with view permissions
router.get(
  "/:grp_id/members/search",
  groupValidations.searchGroupMembers,
  setJWTAuth,
  authJWT,
  // requireGroupPermissions(["MEMBER_VIEW", "MEMBER_SEARCH"], "grp_id"),
  groupController.searchGroupMembers
);

// Data export - manager access
router.get(
  "/:grp_id/export",
  groupValidations.exportGroupData,
  setJWTAuth,
  authJWT,
  // requireGroupManagerAccess(),
  groupController.exportGroupData
);

// Health diagnostics - admin access
router.get(
  "/:grp_id/health",
  setJWTAuth,
  authJWT,
  // requireGroupAdminAccess(),
  groupController.getGroupHealth
);

// System-level operations - requires super admin
router.post(
  "/removeUniqueConstraints",
  groupValidations.removeUniqueConstraint,
  setJWTAuth,
  authJWT,
  // requirePermissions(["SYSTEM_ADMIN", "DATABASE_ADMIN"]),
  groupController.removeUniqueConstraint
);

module.exports = router;
