const httpStatus = require("http-status");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const { getRBACService } = require("@middleware/permissionAuth");
const groupUtil = require("@utils/group.util");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-group-controller`
);
const rolePermissionsUtil = require("@utils/role-permissions.util");
const UserModel = require("@models/User");
const AccessRequestModel = require("@models/AccessRequest");

// Helper function to handle common controller logic with RBAC
const executeGroupActionWithRBAC = async (
  req,
  res,
  next,
  utilFunction,
  requiredPermissions = []
) => {
  try {
    const { user } = req;
    const { grp_id } = req.params;
    const defaultTenant = constants.DEFAULT_TENANT || "airqo";
    const tenant = isEmpty(req.query.tenant) ? defaultTenant : req.query.tenant;

    // Get RBAC service
    const rbacService = getRBACService(tenant);

    // Check if user is a group member (basic requirement)
    if (grp_id) {
      const isGroupMember = await rbacService.isGroupMember(user._id, grp_id);
      if (!isGroupMember) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "You are not a member of this group",
          })
        );
      }
    }

    // Check specific permissions if required
    if (requiredPermissions.length > 0 && grp_id) {
      const hasPermission = await rbacService.hasPermission(
        user._id,
        requiredPermissions,
        false, // any of these permissions
        grp_id,
        "group"
      );

      if (!hasPermission) {
        const userPermissions = await rbacService.getUserPermissionsInContext(
          user._id,
          grp_id,
          "group"
        );

        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "You don't have permission to perform this action",
            required: requiredPermissions,
            userPermissions,
          })
        );
      }
    }

    // Set userGroupContext in the request for utility function
    const request = req;
    request.userGroupContext = req.userGroupContext;
    request.query.tenant = tenant;

    // For updateSettings, ensure request.body is set
    if (utilFunction === groupUtil.updateSettings) {
      request.body = req.body;
    }

    const result = await utilFunction(request, next);

    if (isEmpty(result) || res.headersSent) {
      return;
    }

    if (result.success === true) {
      const status = result.status ? result.status : httpStatus.OK;
      return res.status(status).json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } else {
      const status = result.status
        ? result.status
        : httpStatus.INTERNAL_SERVER_ERROR;
      return res.status(status).json({
        success: false,
        message: result.message,
        errors: result.errors || { message: "" },
      });
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

// Legacy helper function for backward compatibility
const executeGroupAction = async (req, res, next, utilFunction) => {
  return executeGroupActionWithRBAC(req, res, next, utilFunction, []);
};

const groupController = {
  // Dashboard with context-aware permissions
  getDashboard: async (req, res, next) => {
    try {
      const { user } = req;
      const { grp_id } = req.params;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const rbacService = getRBACService(tenant);

      // Check if user is a group member
      const isGroupMember = await rbacService.isGroupMember(user._id, grp_id);
      if (!isGroupMember) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "You are not a member of this group",
          })
        );
      }

      // Get user permissions in this group context
      const userPermissions = await rbacService.getUserPermissionsInContext(
        user._id,
        grp_id,
        "group"
      );

      // Set up request with RBAC context
      req.userPermissions = userPermissions;
      req.isGroupMember = isGroupMember;
      req.query.tenant = tenant;

      return executeGroupAction(req, res, next, groupUtil.getDashboard);
    } catch (error) {
      logger.error(`Error getting dashboard: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  // View members with permission check
  getMembers: (req, res, next) =>
    executeGroupActionWithRBAC(req, res, next, groupUtil.getMembers, [
      "MEMBER_VIEW",
    ]),

  // View settings with permission check
  getSettings: (req, res, next) =>
    executeGroupActionWithRBAC(req, res, next, groupUtil.getSettings, [
      "SETTINGS_VIEW",
    ]),

  // Update settings with permission check
  updateSettings: (req, res, next) =>
    executeGroupActionWithRBAC(req, res, next, groupUtil.updateSettings, [
      "SETTINGS_EDIT",
      "GROUP_MANAGEMENT",
    ]),

  removeUniqueConstraint: (req, res, next) =>
    executeGroupActionWithRBAC(
      req,
      res,
      next,
      groupUtil.removeUniqueConstraint,
      ["SUPER_ADMIN"]
    ),

  list: async (req, res, next) => {
    try {
      const { params } = req;
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await groupUtil.list(request, next);
      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message ? result.message : "",
          [isEmpty(params) ? "groups" : "group"]: result.data
            ? isEmpty(params)
              ? result.data
              : result.data[0]
            : [],
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message ? result.message : "",
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },

  listRolesForGroup: async (req, res, next) => {
    try {
      const { user } = req;
      const { grp_id } = req.params;
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const rbacService = getRBACService(tenant);

      // Check if user can view roles
      const canViewRoles = await rbacService.hasPermission(
        user._id,
        ["ROLE_VIEW", "USER_MANAGEMENT"],
        false,
        grp_id,
        "group"
      );

      if (!canViewRoles) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "You don't have permission to view roles",
          })
        );
      }

      const request = req;
      request.query.tenant = tenant;

      const result = await rolePermissionsUtil.listRolesForGroup(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          group_roles: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },

  create: async (req, res, next) => {
    try {
      const { user } = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const rbacService = getRBACService(tenant);

      // Check if user can create groups (system-level permission)
      const canCreateGroups = await rbacService.hasSystemPermission(user._id, [
        "GROUP_CREATE",
        "SUPER_ADMIN",
      ]);

      if (!canCreateGroups) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "You don't have permission to create groups",
          })
        );
      }

      return executeGroupAction(req, res, next, groupUtil.create);
    } catch (error) {
      logger.error(`Error creating group: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  update: (req, res, next) =>
    executeGroupActionWithRBAC(req, res, next, groupUtil.update, [
      "GROUP_EDIT",
      "GROUP_MANAGEMENT",
    ]),

  delete: async (req, res, next) => {
    try {
      const { user } = req;
      const { grp_id } = req.params;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const rbacService = getRBACService(tenant);

      // Check if user is super admin for group deletion
      const isSuperAdmin = await rbacService.isSuperAdminInContext(
        user._id,
        grp_id,
        "group"
      );

      if (!isSuperAdmin) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "Group deletion requires super admin access",
          })
        );
      }

      return executeGroupAction(req, res, next, groupUtil.delete);
    } catch (error) {
      logger.error(`Error deleting group: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  assignUsers: (req, res, next) =>
    executeGroupActionWithRBAC(req, res, next, groupUtil.assignUsersHybrid, [
      "USER_MANAGEMENT",
      "MEMBER_INVITE",
    ]),

  assignOneUser: async (req, res, next) => {
    try {
      const { user } = req;
      const { grp_id } = req.params;
      const { user_id } = req.body;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const rbacService = getRBACService(tenant);

      // Check permission to assign users
      const canAssignUsers = await rbacService.hasPermission(
        user._id,
        ["USER_MANAGEMENT", "MEMBER_INVITE"],
        false,
        grp_id,
        "group"
      );

      if (!canAssignUsers) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "You don't have permission to assign users to this group",
          })
        );
      }

      const result = await executeGroupAction(
        req,
        res,
        next,
        groupUtil.assignOneUser
      );

      // Clear cache for assigned user
      if (result && result.success && user_id) {
        rbacService.clearUserCache(user_id);
      }

      return result;
    } catch (error) {
      logger.error(`Error assigning user: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  unAssignUser: async (req, res, next) => {
    try {
      const { user } = req;
      const { grp_id, user_id } = req.params;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const rbacService = getRBACService(tenant);

      // Check permission to remove users
      const canRemoveUsers = await rbacService.hasPermission(
        user._id,
        ["USER_MANAGEMENT", "MEMBER_REMOVE"],
        false,
        grp_id,
        "group"
      );

      if (!canRemoveUsers) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message:
              "You don't have permission to remove users from this group",
          })
        );
      }

      // Prevent removing super admins unless you're also a super admin
      const targetIsSuperAdmin = await rbacService.isSuperAdminInContext(
        user_id,
        grp_id,
        "group"
      );

      const userIsSuperAdmin = await rbacService.isSuperAdminInContext(
        user._id,
        grp_id,
        "group"
      );

      if (targetIsSuperAdmin && !userIsSuperAdmin) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "Cannot remove super admin users",
          })
        );
      }

      const result = await executeGroupAction(
        req,
        res,
        next,
        groupUtil.unAssignUser
      );

      // Clear cache for unassigned user
      if (result && result.success) {
        rbacService.clearUserCache(user_id);
      }

      return result;
    } catch (error) {
      logger.error(`Error unassigning user: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  unAssignManyUsers: async (req, res, next) => {
    try {
      const { user } = req;
      const { grp_id } = req.params;
      const { user_ids } = req.body;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const rbacService = getRBACService(tenant);

      // Check bulk operation permissions
      const hasBulkPermissions = await rbacService.hasPermission(
        user._id,
        ["USER_MANAGEMENT", "BULK_OPERATIONS"],
        false,
        grp_id,
        "group"
      );

      if (!hasBulkPermissions) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "You don't have permission for bulk user operations",
          })
        );
      }

      const result = await executeGroupAction(
        req,
        res,
        next,
        groupUtil.unAssignManyUsers
      );

      // Clear cache for all unassigned users
      if (result && result.success && user_ids) {
        for (const userId of user_ids) {
          rbacService.clearUserCache(userId);
        }
      }

      return result;
    } catch (error) {
      logger.error(`Error unassigning many users: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  setManager: (req, res, next) =>
    executeGroupActionWithRBAC(req, res, next, groupUtil.setManager, [
      "ROLE_ASSIGNMENT",
      "USER_MANAGEMENT",
    ]),

  listAssignedUsers: (req, res, next) =>
    executeGroupActionWithRBAC(req, res, next, groupUtil.listAssignedUsers, [
      "MEMBER_VIEW",
    ]),

  listAvailableUsers: (req, res, next) =>
    executeGroupActionWithRBAC(req, res, next, groupUtil.listAvailableUsers, [
      "USER_MANAGEMENT",
      "MEMBER_INVITE",
    ]),

  listAllGroupUsers: (req, res, next) =>
    executeGroupActionWithRBAC(req, res, next, groupUtil.listAllGroupUsers, [
      "MEMBER_VIEW",
    ]),

  listSummary: async (req, res, next) => {
    try {
      logText("listing summary of group....");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
      request.query.category = "summary";

      const result = await groupUtil.list(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          groups: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },

  // Enhanced set manager with automatic role assignment
  enhancedSetManager: (req, res, next) => {
    logText("enhancedSetManager called");
    executeGroupActionWithRBAC(req, res, next, groupUtil.enhancedSetManager, [
      "ROLE_ASSIGNMENT",
      "USER_MANAGEMENT",
    ]);
  },

  // Enhanced manager dashboard with analytics
  getManagerDashboard: (req, res, next) =>
    executeGroupActionWithRBAC(req, res, next, groupUtil.getManagerDashboard, [
      "ANALYTICS_VIEW",
      "USER_MANAGEMENT",
    ]),

  // Bulk member management for group managers
  bulkMemberManagement: (req, res, next) =>
    executeGroupActionWithRBAC(req, res, next, groupUtil.bulkMemberManagement, [
      "USER_MANAGEMENT",
      "BULK_OPERATIONS",
    ]),

  // Get group analytics for managers
  getGroupAnalytics: (req, res, next) =>
    executeGroupActionWithRBAC(req, res, next, groupUtil.getGroupAnalytics, [
      "ANALYTICS_VIEW",
    ]),

  // Manage access requests for group managers
  manageAccessRequests: async (req, res, next) => {
    try {
      const { user } = req;
      const { grp_id } = req.params;
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const { tenant, action = "list" } = req.query;
      const { request_ids, decision, reason, default_role } = req.body;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const actualTenant = isEmpty(tenant) ? defaultTenant : tenant;

      const rbacService = getRBACService(actualTenant);

      // Check if user can manage access requests
      const canManageRequests = await rbacService.hasPermission(
        user._id,
        ["USER_MANAGEMENT", "MEMBER_INVITE"],
        false,
        grp_id,
        "group"
      );

      if (!canManageRequests) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "You don't have permission to manage access requests",
          })
        );
      }

      let result = {};

      switch (action) {
        case "list":
          const requests = await AccessRequestModel(actualTenant)
            .find({
              targetId: grp_id,
              requestType: "group",
              status: "pending",
            })
            .populate("user_id", "firstName lastName email profilePicture")
            .sort({ createdAt: -1 })
            .lean();

          result = {
            success: true,
            message: "Access requests retrieved successfully",
            data: requests,
          };
          break;

        case "bulk_decision":
          if (!request_ids || !decision) {
            return next(
              new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
                message:
                  "request_ids and decision are required for bulk decisions",
              })
            );
          }

          const updateResult = await AccessRequestModel(
            actualTenant
          ).updateMany(
            {
              _id: { $in: request_ids },
              targetId: grp_id,
              requestType: "group",
            },
            {
              status: decision,
              processedAt: new Date(),
              processorReason: reason,
              processedBy: user._id,
            }
          );

          // If approved, add users to group and clear their cache
          if (decision === "approved" && default_role) {
            const approvedRequests = await AccessRequestModel(actualTenant)
              .find({
                _id: { $in: request_ids },
                status: "approved",
              })
              .lean();

            for (const request of approvedRequests) {
              await UserModel(actualTenant).findByIdAndUpdate(request.user_id, {
                $addToSet: {
                  group_roles: {
                    group: grp_id,
                    role: default_role,
                    userType: "user",
                    createdAt: new Date(),
                  },
                },
              });

              // Clear cache for newly added user
              rbacService.clearUserCache(request.user_id);
            }
          }

          // Log the action
          logger.info(
            `User ${user.email} processed ${updateResult.nModified} access requests with decision: ${decision}`,
            { grp_id, decision, reason }
          );

          result = {
            success: true,
            message: `${updateResult.nModified} access requests ${decision}`,
            data: {
              processed_count: updateResult.nModified,
              decision,
              auto_assigned_role:
                decision === "approved" ? !!default_role : false,
            },
          };
          break;

        default:
          return next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "Invalid action specified",
            })
          );
      }

      return res.status(httpStatus.OK).json(result);
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  assignMemberRole: async (req, res, next) => {
    try {
      const { user } = req;
      const { grp_id } = req.params;
      const { user_id, role_id } = req.body;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const rbacService = getRBACService(tenant);

      // Check if user can assign roles
      const canAssignRoles = await rbacService.hasPermission(
        user._id,
        ["ROLE_ASSIGNMENT", "USER_MANAGEMENT"],
        false,
        grp_id,
        "group"
      );

      if (!canAssignRoles) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "You don't have permission to assign roles",
          })
        );
      }

      // Additional validation for target user
      const targetIsGroupMember = await rbacService.isGroupMember(
        user_id,
        grp_id
      );
      if (!targetIsGroupMember) {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message: "Target user is not a member of this group",
          })
        );
      }

      const result = await executeGroupAction(
        req,
        res,
        next,
        groupUtil.assignMemberRole
      );

      // Clear cache for user whose role was changed
      if (result && result.success && user_id) {
        rbacService.clearUserCache(user_id);
      }

      return result;
    } catch (error) {
      logger.error(`Error assigning member role: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  sendGroupInvitations: (req, res, next) =>
    executeGroupActionWithRBAC(req, res, next, groupUtil.sendGroupInvitations, [
      "MEMBER_INVITE",
      "USER_MANAGEMENT",
    ]),

  listGroupInvitations: (req, res, next) =>
    executeGroupActionWithRBAC(req, res, next, groupUtil.listGroupInvitations, [
      "MEMBER_VIEW",
      "USER_MANAGEMENT",
    ]),

  updateGroupStatus: (req, res, next) =>
    executeGroupActionWithRBAC(req, res, next, groupUtil.updateGroupStatus, [
      "GROUP_MANAGEMENT",
      "SETTINGS_EDIT",
    ]),

  getGroupActivityLog: (req, res, next) =>
    executeGroupActionWithRBAC(req, res, next, groupUtil.getGroupActivityLog, [
      "AUDIT_VIEW",
      "ANALYTICS_VIEW",
    ]),

  searchGroupMembers: (req, res, next) =>
    executeGroupActionWithRBAC(req, res, next, groupUtil.searchGroupMembers, [
      "MEMBER_VIEW",
    ]),

  exportGroupData: async (req, res, next) => {
    try {
      const { user } = req;
      const { grp_id } = req.params;
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const rbacService = getRBACService(tenant);

      // Check export permissions
      const canExportData = await rbacService.hasPermission(
        user._id,
        ["ANALYTICS_EXPORT", "MEMBER_EXPORT", "DATA_EXPORT"],
        false,
        grp_id,
        "group"
      );

      if (!canExportData) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "You don't have permission to export group data",
          })
        );
      }

      const request = req;
      request.query.tenant = tenant;

      const result = await groupUtil.exportGroupData(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;

        // Log export action
        logger.info(`User ${user.email} exported data for group ${grp_id}`, {
          format: req.query.format || "json",
        });

        // Set appropriate headers for file download
        const format = req.query.format || "json";
        const filename = `group_${grp_id}_export.${format}`;

        if (format === "json") {
          res.setHeader("Content-Type", "application/json");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
          );
          return res.status(status).json(result.data);
        } else if (format === "csv") {
          res.setHeader("Content-Type", "text/csv");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
          );
          return res.status(status).send(result.data);
        } else if (format === "xlsx") {
          res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          );
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
          );
          return res.status(status).send(result.data);
        }

        return res.status(status).json({
          success: true,
          message: result.message,
          export_data: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getGroupHealth: (req, res, next) =>
    executeGroupActionWithRBAC(req, res, next, groupUtil.getGroupHealth, [
      "ANALYTICS_VIEW",
      "GROUP_MANAGEMENT",
    ]),
};

module.exports = groupController;
