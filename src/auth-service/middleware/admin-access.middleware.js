// middleware/admin-access.middleware.js
const httpStatus = require("http-status");
const RoleModel = require("@models/Role");
const GroupModel = require("@models/Group");
const { HttpError } = require("@utils/shared");
const constants = require("@config/constants");
const isEmpty = require("is-empty");

/**
 * Core function to check if a user has admin access to a specific group
 * @param {string} groupIdentifier - The group slug or ID
 * @param {boolean} useGroupTitle - Whether to use grp_title instead of organization_slug for lookup
 */
const checkGroupAdminAccess = (groupIdentifier, useGroupTitle = true) => {
  return async (req, res, next) => {
    try {
      const { user } = req;
      const tenant = req.query.tenant || constants.DEFAULT_TENANT || "airqo";

      if (!user) {
        return next(
          new HttpError("Unauthorized", httpStatus.UNAUTHORIZED, {
            message: "Authentication required",
          })
        );
      }

      // Find the specified group
      const targetGroupIdentifier = groupIdentifier || "airqo";

      // Allow lookup by either organization_slug or grp_title
      const lookupField = useGroupTitle ? "grp_title" : "organization_slug";
      const lookupQuery = { [lookupField]: targetGroupIdentifier };

      const group = await GroupModel(tenant).findOne(lookupQuery);

      if (!group) {
        return next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: `Group ${targetGroupIdentifier} not found`,
          })
        );
      }

      // Check if user has a role in this group
      const userGroupRole = user.group_roles.find(
        (role) => role.group && role.group.toString() === group._id.toString()
      );

      if (!userGroupRole || !userGroupRole.role) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: `You do not have access to the ${group.grp_title} group`,
          })
        );
      }

      // Get the role details
      const role = await RoleModel(tenant).findById(userGroupRole.role);

      if (!role) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "Your role assignment is invalid",
          })
        );
      }

      // Check if the role is a SUPER_ADMIN role
      const isSuperAdmin = role.role_name.endsWith("SUPER_ADMIN");

      if (!isSuperAdmin) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "This action requires administrator privileges",
          })
        );
      }

      // Store the user's group and role for use in controllers
      req.userGroupContext = {
        group,
        role,
      };

      next();
    } catch (error) {
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  };
};

/**
 * Specialized middleware for AirQo admin access
 */
const airqoAdminCheck = checkGroupAdminAccess("airqo");

/**
 * Flexible middleware to check admin access for any group
 * Gets group identifier from params, query, or body
 */
const adminCheck = async (req, res, next) => {
  try {
    // For AirQo-specific admin endpoints
    if (
      req.path.includes("/organization-requests") ||
      req.originalUrl.includes("/organization-requests")
    ) {
      return airqoAdminCheck(req, res, next);
    }

    // Get the group slug from URL params, query params, or request body
    const groupSlug =
      req.params.groupSlug ||
      req.params.grp_slug ||
      req.query.group ||
      req.body.group ||
      (req.params.grp_id ? req.params.grp_id : null);

    if (!groupSlug) {
      return next(
        new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Group identifier required",
        })
      );
    }

    // Determine if we should use grp_title or organization_slug for lookup
    // This handles both cases elegantly
    const useGroupTitle =
      req.query.useGroupTitle === "true" || req.body.useGroupTitle === true;

    // Use the checkGroupAdminAccess function with the identified group
    return checkGroupAdminAccess(groupSlug, useGroupTitle)(req, res, next);
  } catch (error) {
    return next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

module.exports = {
  adminCheck,
  airqoAdminCheck,
  checkGroupAdminAccess,
};
