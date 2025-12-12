const httpStatus = require("http-status");
const rolePermissionsUtil = require("@utils/role-permissions.util");
const RBACService = require("@services/rbac.service");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- role-controller`);

// Helper function for standard request validation and setup
const validateAndSetupRequest = (req, next) => {
  const errors = extractErrorsFromRequest(req);
  if (errors) {
    next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
    return null;
  }

  const request = req;
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  request.query.tenant = isEmpty(req.query.tenant)
    ? defaultTenant
    : req.query.tenant;

  return request;
};

// Helper function for standard response handling
const handleStandardResponse = (res, result, responseConfig = {}) => {
  if (isEmpty(result) || res.headersSent) {
    return;
  }

  const {
    successKey = "data",
    successMessage = result.message,
    errorMessage = result.message,
    errorKey = "errors",
  } = responseConfig;

  if (result.success === true) {
    const status = result.status ? result.status : httpStatus.OK;
    res.status(status).json({
      success: true,
      message: successMessage,
      ...(result.meta && { meta: result.meta }),
      [successKey]: result.data,
    });
  } else if (result.success === false) {
    const status = result.status
      ? result.status
      : httpStatus.INTERNAL_SERVER_ERROR;
    res.status(status).json({
      success: false,
      message: errorMessage,
      [errorKey]: result.errors ? result.errors : { message: "" },
    });
  }
};

// Helper function for standard error handling
const handleStandardError = (error, next) => {
  logger.error(`🐛🐛 Internal Server Error ${error.message}`);
  next(
    new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
      message: error.message,
    })
  );
};

// Helper function for parameter validation
const validateParameterError = (condition, message, next) => {
  if (condition) {
    next(
      new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
        message: message,
      })
    );
    return true;
  }
  return false;
};

const roleController = {
  list: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.listRole(request, next);
      handleStandardResponse(res, result, { successKey: "roles" });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  listSummary: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      request.query.category = "summary";
      const result = await rolePermissionsUtil.listRole(request, next);
      handleStandardResponse(res, result, { successKey: "roles" });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  create: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.createRole(request, next);
      handleStandardResponse(res, result, { successKey: "created_role" });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  update: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.updateRole(request, next);
      handleStandardResponse(res, result, { successKey: "updated_role" });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  delete: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.deleteRole(request, next);
      handleStandardResponse(res, result, {
        successKey: "deleted_role",
        errorKey: "errors",
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  listUsersWithRole: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.listUsersWithRole(request, next);
      handleStandardResponse(res, result, { successKey: "users_with_role" });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  listAvailableUsersForRole: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.listAvailableUsersForRole(
        request,
        next
      );
      handleStandardResponse(res, result, {
        successKey: "available_users",
        successMessage: "successfully listed the available users",
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  assignUserToRole: async (req, res, next) => {
    try {
      logText("assignUserToRole...");
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.assignUserToRole(request, next);
      handleStandardResponse(res, result, { successKey: "updated_records" });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  assignManyUsersToRole: async (req, res, next) => {
    try {
      logText("assignManyUsersToRole...");
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.assignManyUsersToRole(
        request,
        next
      );
      handleStandardResponse(res, result, { successKey: "updated_records" });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  unAssignUserFromRole: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.unAssignUserFromRole(
        request,
        next
      );
      handleStandardResponse(res, result, { successKey: "user_unassigned" });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  unAssignManyUsersFromRole: async (req, res, next) => {
    try {
      logText("assignManyUsersToRole...");
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.unAssignManyUsersFromRole(
        request,
        next
      );
      handleStandardResponse(res, result, { successKey: "updated_records" });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  listPermissionsForRole: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.listPermissionsForRole(
        request,
        next
      );
      handleStandardResponse(res, result, {
        successKey: "permissions_list",
        successMessage: "successfully listed the permissions for the role",
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  listAvailablePermissionsForRole: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.listAvailablePermissionsForRole(
        request,
        next
      );
      handleStandardResponse(res, result, {
        successKey: "available_permissions",
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  assignPermissionToRole: async (req, res, next) => {
    try {
      logText("assignPermissionToRole....");
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.assignPermissionsToRole(
        request,
        next
      );
      handleStandardResponse(res, result, { successKey: "updated_role" });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  unAssignPermissionFromRole: async (req, res, next) => {
    try {
      logText("unAssignPermissionFromRole....");
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.unAssignPermissionFromRole(
        request,
        next
      );
      handleStandardResponse(res, result, { successKey: "modified_role" });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  unAssignManyPermissionsFromRole: async (req, res, next) => {
    try {
      logText("unAssign Many Permissions From Role....");
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.unAssignManyPermissionsFromRole(
        request,
        next
      );
      handleStandardResponse(res, result, { successKey: "modified_role" });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  updateRolePermissions: async (req, res, next) => {
    try {
      logText("  updateRolePermissions....");
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.updateRolePermissions(
        request,
        next
      );
      handleStandardResponse(res, result, { successKey: "modified_role" });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  // Enhanced assign user to role with detailed feedback
  enhancedAssignUserToRole: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await rolePermissionsUtil.enhancedAssignUserToRole(
        request,
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          operation: result.operation,
          role_info: result.role_info,
          before_assignment: result.before_assignment,
          after_assignment: result.after_assignment,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors
            ? result.errors
            : { message: "INTERNAL SERVER ERROR" },
        });
      }
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  // Enhanced unassign user from role with detailed feedback
  enhancedUnAssignUserFromRole: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await rolePermissionsUtil.enhancedUnAssignUserFromRole(
        request,
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          operation: result.operation,
          role_info: result.role_info,
          before_unassignment: result.before_unassignment,
          after_unassignment: result.after_unassignment,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors
            ? result.errors
            : { message: "INTERNAL SERVER ERRORS" },
        });
      }
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  // Get user's network roles
  getUserNetworkRoles: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.getUserNetworkRoles(
        request,
        next
      );
      handleStandardResponse(res, result, { successKey: "network_roles" });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  // Get user's group roles
  getUserGroupRoles: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.getUserGroupRoles(request, next);
      handleStandardResponse(res, result, { successKey: "group_roles" });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  // Get comprehensive role summary for a user
  getUserRoleSummary: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const { user_id } = req.params;
      const { tenant } = req.query;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const actualTenant = isEmpty(tenant) ? defaultTenant : tenant;

      const summary = await rolePermissionsUtil.getUserRoleSummary(
        user_id,
        actualTenant
      );

      if (!summary) {
        return res.status(httpStatus.NOT_FOUND).json({
          success: false,
          message: `User ${user_id} not found`,
          errors: { message: "User not found" },
        });
      }

      return res.status(httpStatus.OK).json({
        success: true,
        message: "Successfully retrieved user role summary",
        user_role_summary: summary,
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  auditDeprecatedFields: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.auditDeprecatedFieldUsage(
        request,
        next
      );
      if (!result) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: "Audit failed to return results",
          errors: { message: "Internal server error during audit" },
        });
      }
      handleStandardResponse(res, result, { successKey: "audit_report" });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  // Enhanced user details with role information - REFACTORED
  getEnhancedUserDetails: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.getEnhancedUserDetails(
        request,
        next
      );
      handleStandardResponse(res, result, {
        successKey: "enhanced_user_details",
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  // System health check for role assignments - REFACTORED
  getSystemRoleHealth: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.getSystemRoleHealth(
        request,
        next
      );
      handleStandardResponse(res, result, { successKey: "system_role_health" });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  // Bulk role operations
  bulkRoleOperations: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const { operation, user_ids, role_id, group_id, tenant } = req.body;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const actualTenant = isEmpty(tenant) ? defaultTenant : tenant;

      if (!["assign", "unassign", "reassign"].includes(operation)) {
        return next(
          new HttpError("Invalid operation", httpStatus.BAD_REQUEST, {
            message: "Operation must be one of: assign, unassign, reassign",
          })
        );
      }

      const results = {
        operation,
        total_users: user_ids.length,
        successful: 0,
        failed: 0,
        errors: [],
        details: [],
      };

      for (const userId of user_ids) {
        try {
          let result;
          const request = {
            params: { role_id, user_id: userId },
            query: { tenant: actualTenant },
            body: { group_id },
          };

          switch (operation) {
            case "assign":
              result = await rolePermissionsUtil.enhancedAssignUserToRole(
                request,
                next
              );
              break;
            case "unassign":
              result = await rolePermissionsUtil.enhancedUnAssignUserFromRole(
                request,
                next
              );
              break;
            case "reassign":
              // First unassign, then assign
              await rolePermissionsUtil.enhancedUnAssignUserFromRole(
                request,
                next
              );
              result = await rolePermissionsUtil.enhancedAssignUserToRole(
                request,
                next
              );
              break;
          }

          if (result && result.success) {
            results.successful++;
            results.details.push({
              user_id: userId,
              status: "success",
              operation,
            });
          } else {
            results.failed++;
            results.errors.push({
              user_id: userId,
              error: result?.message || "Unknown error",
            });
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            user_id: userId,
            error: error.message,
          });
        }
      }

      // Clear RBAC cache for all affected users
      const rbacService = new RBACService(actualTenant);
      for (const userId of user_ids) {
        rbacService.clearUserCache(userId);
      }

      const status =
        results.failed === 0 ? httpStatus.OK : httpStatus.PARTIAL_CONTENT;

      res.status(status).json({
        success: results.failed === 0,
        message: `Bulk ${operation} operation completed`,
        bulk_operation_results: results,
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },
  getUserRolesAndPermissionsDetailed: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result =
        await rolePermissionsUtil.getUserRolesAndPermissionsDetailed(
          request,
          next
        );
      handleStandardResponse(res, result, {
        successKey: "user_roles_and_permissions",
        successMessage:
          "Successfully retrieved detailed user roles and permissions",
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  getUserPermissionsForGroup: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.getUserPermissionsForGroup(
        request,
        next
      );
      handleStandardResponse(res, result, {
        successKey: "group_permissions",
        successMessage: "Successfully retrieved user permissions for group",
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  bulkPermissionsCheck: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.bulkPermissionsCheck(
        request,
        next
      );
      handleStandardResponse(res, result, {
        successKey: "bulk_permissions_check",
        successMessage: "Successfully completed bulk permissions check",
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  getSimplifiedPermissionsForGroup: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.getSimplifiedPermissionsForGroup(
        request,
        next
      );
      handleStandardResponse(res, result, {
        successKey: "simplified_permissions",
        successMessage: "Successfully retrieved simplified permissions",
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  checkUserPermissionsForActions: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.checkUserPermissionsForActions(
        request,
        next
      );
      handleStandardResponse(res, result, {
        successKey: "permission_checks",
        successMessage: "Successfully checked user permissions for actions",
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  getUserRolesByGroup: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.getUserRolesByGroup(
        request,
        next
      );
      handleStandardResponse(res, result, {
        successKey: "filtered_user_roles",
        successMessage: "Successfully retrieved user roles for group",
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  getUserGroupsWithPermissionsSummary: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result =
        await rolePermissionsUtil.getUserGroupsWithPermissionsSummary(
          request,
          next
        );
      handleStandardResponse(res, result, {
        successKey: "groups_permissions_summary",
        successMessage:
          "Successfully retrieved groups with permissions summary",
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  // Enhanced method for current user permissions (convenience)
  getCurrentUserPermissionsForGroup: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.getUserPermissionsForGroup(
        request,
        next
      );
      handleStandardResponse(res, result, {
        successKey: "my_group_permissions",
        successMessage: "Successfully retrieved your permissions for group",
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  getUserRolesAndPermissionsViaRBAC: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result =
        await rolePermissionsUtil.getUserRolesAndPermissionsViaRBAC(
          request,
          next
        );
      handleStandardResponse(res, result, {
        successKey: "user_roles_and_permissions",
        successMessage:
          "Successfully retrieved detailed user roles and permissions via RBAC",
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  getUserRolesSimplified: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await rolePermissionsUtil.getUserRolesSimplified(
        request,
        next
      );
      handleStandardResponse(res, result, {
        successKey: "user_roles",
        successMessage: "Successfully retrieved simplified user roles",
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  getCurrentUserRolesAndPermissions: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result =
        await rolePermissionsUtil.getCurrentUserRolesAndPermissions(
          request,
          next
        );
      handleStandardResponse(res, result, {
        successKey: "my_roles_and_permissions",
        successMessage: "Successfully retrieved your roles and permissions",
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },
};

module.exports = roleController;
