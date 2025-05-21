// middleware/permission-auth.middleware.js
const httpStatus = require("http-status");
const RoleModel = require("@models/Role");
const { HttpError } = require("@utils/shared");
const constants = require("@config/constants");

const hasPermission = (requiredPermission) => {
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

      // Get all user's roles
      const userRoles = [
        ...user.group_roles.filter((r) => r.role).map((r) => r.role),
        ...user.network_roles.filter((r) => r.role).map((r) => r.role),
      ];

      // Get all permissions from these roles
      const rolePermissions = await RoleModel(tenant).aggregate([
        { $match: { _id: { $in: userRoles } } },
        { $unwind: "$role_permissions" },
        {
          $lookup: {
            from: "permissions",
            localField: "role_permissions",
            foreignField: "_id",
            as: "permission_details",
          },
        },
        { $unwind: "$permission_details" },
        {
          $group: {
            _id: null,
            permissions: { $addToSet: "$permission_details.permission" },
          },
        },
      ]);

      const userPermissions =
        rolePermissions.length > 0 ? rolePermissions[0].permissions : [];

      if (!userPermissions.includes(requiredPermission)) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: `You do not have the required permission: ${requiredPermission}`,
          })
        );
      }

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

module.exports = {
  hasPermission,
};
