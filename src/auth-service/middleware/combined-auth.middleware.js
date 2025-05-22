// middleware/combined-auth.middleware.js
const { adminCheck } = require("@middleware/admin-access.middleware");
const { hasPermission } = require("@middleware/permission-auth.middleware");
const constants = require("@config/constants");

/**
 * Middleware that checks both admin access AND specific permission
 */
const adminWithPermission = (requiredPermission) => {
  return (req, res, next) => {
    // First check admin access
    adminCheck(req, res, (err) => {
      if (err) {
        return next(err); // If admin check fails, stop here
      }

      // Then check for the specific permission
      hasPermission(requiredPermission)(req, res, next);
    });
  };
};

/**
 * Middleware for organization request admin operations
 */
const orgRequestOperations = {
  list: adminWithPermission(constants.ORG_REQUEST_PERMISSIONS.LIST),
  approve: adminWithPermission(constants.ORG_REQUEST_PERMISSIONS.APPROVE),
  reject: adminWithPermission(constants.ORG_REQUEST_PERMISSIONS.REJECT),
  view: adminWithPermission(constants.ORG_REQUEST_PERMISSIONS.VIEW),
};

/**
 * Middleware for group management operations
 */
const groupOperations = {
  viewDashboard: adminWithPermission(
    constants.GROUP_PERMISSIONS.VIEW_DASHBOARD
  ),
  manageMembers: adminWithPermission(
    constants.GROUP_PERMISSIONS.MANAGE_MEMBERS
  ),
  manageSettings: adminWithPermission(
    constants.GROUP_PERMISSIONS.MANAGE_SETTINGS
  ),
  viewMembers: adminWithPermission(constants.GROUP_PERMISSIONS.VIEW_MEMBERS),
};

module.exports = {
  adminWithPermission,
  orgRequestOperations,
  groupOperations,
};
