// middleware/roleAccessAuth.js
//
// Authorization for role mutation routes (/api/v2/users/roles/*).
//
// These routes previously only required a valid JWT, so any logged-in user
// could assign any role (including another group's manager role) to
// themselves, or edit any role's permissions. Roles are always group-scoped,
// so access is resolved against the role's group:
//   - AirQo system super admins: always allowed
//   - roles in the system admin (AirQo) group, or roles with no group:
//     system super admins only
//   - everyone else: must hold manager-level rights in the role's group
//     (same rules as requireGroupManagerAccess, plus ROLE_ASSIGNMENT, which
//     is what Nexus uses to show its "Assign Role" UI)
//
// Non-super-admins are additionally blocked from privilege escalation paths
// that would turn a group role into a system-wide one: moving a role to a
// different group, using a system admin role name/code, or granting system
// admin permissions to a role.
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const { HttpError } = require("@utils/shared");
const constants = require("@config/constants");
const RoleModel = require("@models/Role");
const PermissionModel = require("@models/Permission");
const RBACService = require("@services/rbac.service");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- role-access-auth`,
);

const getRBACService = (tenant = constants.DEFAULT_TENANT) =>
  RBACService.getInstance(tenant);

const MANAGER_LEVEL_PERMISSIONS = [
  constants.GROUP_MANAGEMENT,
  constants.USER_MANAGEMENT,
  constants.GROUP_SETTINGS,
  constants.ROLE_ASSIGNMENT,
].filter(Boolean);

const MANAGER_LEVEL_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

const forbidden = (message, extra = {}) =>
  new HttpError("Forbidden", httpStatus.FORBIDDEN, { message, ...extra });

const isSystemAdminRoleIdentifier = (value) => {
  if (!value || typeof value !== "string") return false;
  const normalized = value.trim().toUpperCase();
  return (
    constants.SYSTEM_ADMIN_ROLE_NAMES.includes(normalized) ||
    constants.SYSTEM_ADMIN_ROLE_CODES.includes(normalized)
  );
};

/**
 * True when the user holds manager-level rights in the given group.
 */
const hasGroupManagerRights = async (rbacService, userId, groupId) => {
  const [isGroupManager, hasManagerPermissions, hasManagerRole] =
    await Promise.all([
      rbacService.isGroupManager(userId, groupId),
      rbacService.hasPermission(
        userId,
        MANAGER_LEVEL_PERMISSIONS,
        false,
        groupId,
        "group",
      ),
      rbacService.hasRole(userId, MANAGER_LEVEL_ROLES, groupId, "group"),
    ]);
  return Boolean(isGroupManager || hasManagerPermissions || hasManagerRole);
};

/**
 * Returns the names of any system admin permissions among the given ids.
 */
const findSystemAdminPermissions = async (tenant, permissionIds = []) => {
  const ids = (Array.isArray(permissionIds) ? permissionIds : [permissionIds])
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => mongoose.Types.ObjectId(id));
  if (ids.length === 0) return [];
  const permissions = await PermissionModel(tenant)
    .find({ _id: { $in: ids } })
    .select("permission")
    .lean();
  return permissions
    .map((p) => p.permission)
    .filter((name) => constants.HELPERS.isSystemAdminPermission(name));
};

/**
 * @param {Object} [options]
 * @param {"role"|"create"} [options.mode="role"] - "role" resolves the role
 *   from req.params.role_id (or req.body.role_id); "create" authorizes
 *   against req.body.group_id for a role that does not exist yet.
 * @returns {Function} Express middleware
 */
const requireRoleManagementAccess = ({ mode = "role" } = {}) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const tenant = req.query.tenant || constants.DEFAULT_TENANT;

      if (!user || !user._id) {
        return next(
          new HttpError("Authentication required", httpStatus.UNAUTHORIZED, {
            message: "You must be logged in to access this resource",
          }),
        );
      }

      const rbacService = getRBACService(tenant);
      if (await rbacService.isSystemSuperAdmin(user._id)) {
        return next();
      }

      const body = req.body || {};
      let groupId;

      if (mode === "create") {
        groupId = body.group_id;
        if (!groupId) {
          // Let the validator/controller return its usual 400.
          return next();
        }
      } else {
        const roleId = req.params.role_id || body.role_id;
        if (!roleId || !mongoose.Types.ObjectId.isValid(roleId)) {
          // Let the validator/controller return its usual 400.
          return next();
        }
        const role = await RoleModel(tenant)
          .findById(roleId)
          .select("group_id role_name role_code")
          .lean();
        if (!role) {
          // Preserve the controller's existing "role not found" response.
          return next();
        }
        if (!role.group_id) {
          return next(
            forbidden(
              "Only system administrators can manage roles that are not tied to a group",
            ),
          );
        }
        if (
          isSystemAdminRoleIdentifier(role.role_name) ||
          isSystemAdminRoleIdentifier(role.role_code)
        ) {
          return next(
            forbidden("Only system administrators can manage system roles"),
          );
        }
        groupId = role.group_id.toString();

        if (body.group_id && body.group_id.toString() !== groupId) {
          return next(
            forbidden(
              "Only system administrators can move a role to a different group",
            ),
          );
        }
      }

      if (constants.HELPERS.isSystemAdminGroup(groupId)) {
        return next(
          forbidden(
            "Only system administrators can manage roles in this organization",
          ),
        );
      }

      if (
        isSystemAdminRoleIdentifier(body.role_name) ||
        isSystemAdminRoleIdentifier(body.role_code)
      ) {
        return next(
          forbidden("System administrator role names and codes are reserved"),
        );
      }

      const permissionIds = [
        ...(Array.isArray(body.permissions) ? body.permissions : []),
        ...(Array.isArray(body.permission_ids) ? body.permission_ids : []),
      ];
      if (req.method !== "DELETE" && permissionIds.length > 0) {
        const systemPermissions = await findSystemAdminPermissions(
          tenant,
          permissionIds,
        );
        if (systemPermissions.length > 0) {
          return next(
            forbidden(
              "Only system administrators can grant system administrator permissions",
              { permissions: systemPermissions },
            ),
          );
        }
      }

      const allowed = await hasGroupManagerRights(
        rbacService,
        user._id,
        groupId,
      );
      if (!allowed) {
        logger.warn(
          `Role management denied for user ${user.email} (ID: ${user._id}) on group ${groupId} [${req.method} ${req.originalUrl}]`,
        );
        return next(
          forbidden(
            "You need manager or administrator access in this organization to manage its roles",
            { groupId },
          ),
        );
      }

      return next();
    } catch (error) {
      logger.error(`Role management access check error: ${error.message}`);
      return next(
        new HttpError(
          "Role management access check failed",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  };
};

module.exports = {
  requireRoleManagementAccess,
  hasGroupManagerRights,
  isSystemAdminRoleIdentifier,
};
