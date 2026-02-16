const httpStatus = require("http-status");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const groupUtil = require("@utils/group.util");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-group-controller`,
);
const rolePermissionsUtil = require("@utils/role-permissions.util");
const UserModel = require("@models/User");
const AccessRequestModel = require("@models/AccessRequest");

// Helper function to handle common controller logic without RBAC
const executeGroupAction = async (req, res, next, utilFunction) => {
  try {
    const errors = extractErrorsFromRequest(req);
    if (errors) {
      next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      return;
    }

    const defaultTenant = constants.DEFAULT_TENANT || "airqo";
    const tenant = isEmpty(req.query.tenant) ? defaultTenant : req.query.tenant;

    // Set up request with tenant
    const request = req;
    request.query.tenant = tenant;
    logObject("req.user", req.user);
    logObject("request.user", request.user);

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
      }),
    );
  }
};

const handleRequest = (req, next) => {
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

const handleError = (error, next, defaultMessage) => {
  logger.error(`🐛🐛 Internal Server Error ${error.message}`);
  next(
    new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
      message: defaultMessage || error.message,
    }),
  );
};

function handleResponse({ res, result, key = "data" }) {
  if (!result || res.headersSent) {
    return;
  }

  const { success, status, data, message, errors, ...rest } = result;

  const responseStatus =
    status || (success ? httpStatus.OK : httpStatus.INTERNAL_SERVER_ERROR);

  if (success) {
    const responseBody = {
      success: true,
      message: message || "Operation Successful",
      ...rest,
    };
    if (data !== undefined) {
      responseBody[key] = data;
    }
    return res.status(responseStatus).json(responseBody);
  } else {
    return res.status(responseStatus).json({
      success: false,
      message: message || "An unexpected error occurred.",
      errors: errors || { message: "An unexpected error occurred." },
    });
  }
}

const groupController = {
  // Dashboard
  getDashboard: async (req, res, next) => {
    try {
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      // Set up request
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
          },
        ),
      );
    }
  },

  // View members
  getMembers: (req, res, next) =>
    executeGroupAction(req, res, next, groupUtil.getMembers),

  // View settings
  getSettings: (req, res, next) =>
    executeGroupAction(req, res, next, groupUtil.getSettings),

  // Update settings
  updateSettings: (req, res, next) =>
    executeGroupAction(req, res, next, groupUtil.updateSettings),

  removeUniqueConstraint: (req, res, next) =>
    executeGroupAction(req, res, next, groupUtil.removeUniqueConstraint),

  list: async (req, res, next) => {
    try {
      const { params } = req;
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors),
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
          { message: error.message },
        ),
      );
      return;
    }
  },

  listRolesForGroup: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors),
        );
        return;
      }

      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

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
          { message: error.message },
        ),
      );
      return;
    }
  },

  create: async (req, res, next) => {
    try {
      return executeGroupAction(req, res, next, groupUtil.create);
    } catch (error) {
      logger.error(`Error creating group: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
      return;
    }
  },

  populateSlugs: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors),
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await groupUtil.populateSlugs(request, next);
      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message ? result.message : "",
          data: result.data ? result.data : {},
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
          { message: error.message },
        ),
      );
      return;
    }
  },

  updateSlug: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors),
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await groupUtil.updateSlug(request, next);
      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message ? result.message : "",
          updated_group: result.data ? result.data : {},
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
          { message: error.message },
        ),
      );
      return;
    }
  },

  update: (req, res, next) =>
    executeGroupAction(req, res, next, groupUtil.update),

  delete: async (req, res, next) => {
    try {
      return executeGroupAction(req, res, next, groupUtil.delete);
    } catch (error) {
      logger.error(`Error deleting group: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
    }
  },

  assignUsers: (req, res, next) =>
    executeGroupAction(req, res, next, groupUtil.assignUsersHybrid),

  assignOneUser: async (req, res, next) => {
    try {
      return executeGroupAction(req, res, next, groupUtil.assignOneUser);
    } catch (error) {
      logger.error(`Error assigning user: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
    }
  },

  unAssignUser: async (req, res, next) => {
    try {
      return executeGroupAction(req, res, next, groupUtil.unAssignUser);
    } catch (error) {
      logger.error(`Error unassigning user: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
    }
  },

  unAssignManyUsers: async (req, res, next) => {
    try {
      return executeGroupAction(req, res, next, groupUtil.unAssignManyUsers);
    } catch (error) {
      logger.error(`Error unassigning many users: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
    }
  },

  listAssignedUsers: (req, res, next) =>
    executeGroupAction(req, res, next, groupUtil.listAssignedUsers),

  listAvailableUsers: (req, res, next) =>
    executeGroupAction(req, res, next, groupUtil.listAvailableUsers),

  listAllGroupUsers: (req, res, next) =>
    executeGroupAction(req, res, next, groupUtil.listAllGroupUsers),

  listSummary: async (req, res, next) => {
    try {
      logText("listing summary of group....");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors),
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
          { message: error.message },
        ),
      );
      return;
    }
  },

  // Enhanced set manager with automatic role assignment
  enhancedSetManager: (req, res, next) => {
    logText("enhancedSetManager called");
    executeGroupAction(req, res, next, groupUtil.enhancedSetManager);
  },

  // Enhanced manager dashboard with analytics
  getManagerDashboard: (req, res, next) =>
    executeGroupAction(req, res, next, groupUtil.getManagerDashboard),

  // Bulk member management for group managers
  bulkMemberManagement: (req, res, next) =>
    executeGroupAction(req, res, next, groupUtil.bulkMemberManagement),

  // Get group analytics for managers
  getGroupAnalytics: (req, res, next) =>
    executeGroupAction(req, res, next, groupUtil.getGroupAnalytics),

  // Manage access requests for group managers
  manageAccessRequests: async (req, res, next) => {
    try {
      const { user } = req;
      const { grp_id } = req.params;
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors),
        );
      }

      const { tenant, action = "list" } = req.query;
      const { request_ids, decision, reason, default_role } = req.body;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const actualTenant = isEmpty(tenant) ? defaultTenant : tenant;

      let result = {};

      switch (action) {
        case "list":
          const requests = await AccessRequestModel(actualTenant).aggregate([
            {
              $match: {
                targetId: grp_id,
                requestType: "group",
                status: "pending",
              },
            },
            {
              $lookup: {
                from: "users", // Collection name for the user model
                localField: "user_id",
                foreignField: "_id",
                as: "user_details",
                pipeline: [
                  {
                    $project: {
                      firstName: 1,
                      lastName: 1,
                      email: 1,
                      profilePicture: 1,
                    },
                  },
                ],
              },
            },
            {
              $addFields: {
                user_id: {
                  $cond: {
                    if: { $gt: [{ $size: "$user_details" }, 0] },
                    then: { $arrayElemAt: ["$user_details", 0] },
                    else: null,
                  },
                },
              },
            },
            {
              $project: {
                user_details: 0, // Remove the temporary field
              },
            },
            { $sort: { createdAt: -1 } },
          ]);

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
              }),
            );
          }

          const updateResult = await AccessRequestModel(
            actualTenant,
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
            },
          );

          // If approved, add users to group
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
            }
          }

          // Log the action
          logger.info(
            `User ${user.email} processed ${updateResult.nModified} access requests with decision: ${decision}`,
            { grp_id, decision, reason },
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
            }),
          );
      }

      return res.status(httpStatus.OK).json(result);
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  assignMemberRole: async (req, res, next) => {
    try {
      const { user_id, role_id } = req.body;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      return executeGroupAction(req, res, next, groupUtil.assignMemberRole);
    } catch (error) {
      logger.error(`Error assigning member role: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          },
        ),
      );
    }
  },

  sendGroupInvitations: (req, res, next) =>
    executeGroupAction(req, res, next, groupUtil.sendGroupInvitations),

  listGroupInvitations: (req, res, next) =>
    executeGroupAction(req, res, next, groupUtil.listGroupInvitations),

  updateGroupStatus: (req, res, next) =>
    executeGroupAction(req, res, next, groupUtil.updateGroupStatus),

  getGroupActivityLog: (req, res, next) =>
    executeGroupAction(req, res, next, groupUtil.getGroupActivityLog),

  searchGroupMembers: (req, res, next) =>
    executeGroupAction(req, res, next, groupUtil.searchGroupMembers),

  exportGroupData: async (req, res, next) => {
    try {
      const { user } = req;
      const { grp_id } = req.params;
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors),
        );
      }

      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

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
            `attachment; filename="${filename}"`,
          );
          return res.status(status).json(result.data);
        } else if (format === "csv") {
          res.setHeader("Content-Type", "text/csv");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`,
          );
          return res.status(status).send(result.data);
        } else if (format === "xlsx") {
          res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          );
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`,
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
          { message: error.message },
        ),
      );
    }
  },

  getGroupHealth: (req, res, next) =>
    executeGroupAction(req, res, next, groupUtil.getGroupHealth),

  assignCohortsToGroup: (req, res, next) =>
    executeGroupAction(req, res, next, groupUtil.assignCohortsToGroup),

  unassignCohortsFromGroup: (req, res, next) =>
    executeGroupAction(req, res, next, groupUtil.unassignCohortsFromGroup),

  listGroupCohorts: (req, res, next) =>
    executeGroupAction(req, res, next, groupUtil.listGroupCohorts),

  leaveGroup: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await groupUtil.leaveGroup(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      handleResponse({
        res,
        result: {
          ...result,
          message: "You have successfully left the group.",
        },
        key: "left_group",
      });
    } catch (error) {
      handleError(
        error,
        next,
        "An error occurred while trying to leave the group.",
      );
    }
  },
};

module.exports = groupController;
