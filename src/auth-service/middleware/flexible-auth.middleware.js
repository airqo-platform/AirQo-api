// middleware/flexible-auth.middleware.js
const { adminCheck } = require("@middleware/admin-access.middleware");
const { hasPermission } = require("@middleware/permission-auth.middleware");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/shared");

/**
 * Middleware that grants access if user either:
 * 1. Has admin role for the group, OR
 * 2. Has the specific permission
 */
const hasPermissionOrAdmin = (requiredPermission) => {
  return (req, res, next) => {
    // Try permission check first
    hasPermission(requiredPermission)(req, res, (permissionErr) => {
      if (!permissionErr) {
        return next(); // Permission check passed, proceed
      }

      // If permission check failed, try admin check
      adminCheck(req, res, (adminErr) => {
        if (!adminErr) {
          return next(); // Admin check passed, proceed
        }

        // Both checks failed, return permission error
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: `Access denied: You need either admin privileges or the ${requiredPermission} permission`,
          })
        );
      });
    });
  };
};

module.exports = {
  hasPermissionOrAdmin,
};
