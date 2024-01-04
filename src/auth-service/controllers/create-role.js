const httpStatus = require("http-status");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const controlAccessUtil = require("@utils/control-access");
const { logText, logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-role-controller`
);

const createRole = {
  list: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const rolesResponse = await controlAccessUtil.listRole(request, next);

      if (rolesResponse.success === true) {
        const status = rolesResponse.status
          ? rolesResponse.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: rolesResponse.message,
          roles: rolesResponse.data,
        });
      } else if (rolesResponse.success === false) {
        const status = rolesResponse.status
          ? rolesResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: rolesResponse.message,
          errors: rolesResponse.errors ? rolesResponse.errors : { message: "" },
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
    }
  },
  listSummary: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
      request.query.category = "summary";

      const summaryRolesResponse = await controlAccessUtil.listRole(
        request,
        next
      );

      if (summaryRolesResponse.success === true) {
        const status = summaryRolesResponse.status
          ? summaryRolesResponse.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: summaryRolesResponse.message,
          roles: summaryRolesResponse.data,
        });
      } else if (summaryRolesResponse.success === false) {
        const status = summaryRolesResponse.status
          ? summaryRolesResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: summaryRolesResponse.message,
          errors: summaryRolesResponse.errors
            ? summaryRolesResponse.errors
            : { message: "" },
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
    }
  },
  create: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const createRoleResponse = await controlAccessUtil.createRole(
        request,
        next
      );

      if (createRoleResponse.success === true) {
        const status = createRoleResponse.status
          ? createRoleResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: createRoleResponse.message,
          created_role: createRoleResponse.data,
        });
      } else if (createRoleResponse.success === false) {
        const status = createRoleResponse.status
          ? createRoleResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: createRoleResponse.message,
          errors: createRoleResponse.errors
            ? createRoleResponse.errors
            : { message: "" },
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
    }
  },
  update: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const updateRoleResponse = await controlAccessUtil.updateRole(
        request,
        next
      );
      if (updateRoleResponse.success === true) {
        const status = updateRoleResponse.status
          ? updateRoleResponse.status
          : httpStatus.OK;
        res.status(status).json({
          message: updateRoleResponse.message,
          updated_role: updateRoleResponse.data,
          success: true,
        });
      } else if (updateRoleResponse.success === false) {
        const status = updateRoleResponse.status
          ? updateRoleResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          message: updateRoleResponse.message,
          errors: updateRoleResponse.errors
            ? updateRoleResponse.errors
            : { message: "" },
          success: false,
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
    }
  },
  delete: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const deleteRoleResponse = await controlAccessUtil.deleteRole(
        request,
        next
      );
      if (deleteRoleResponse.success === true) {
        const status = deleteRoleResponse.status
          ? deleteRoleResponse.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: deleteRoleResponse.message,
          deleted_role: deleteRoleResponse.data,
        });
      } else if (deleteRoleResponse.success === false) {
        const status = deleteRoleResponse.status
          ? deleteRoleResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: deleteRoleResponse.message,
          errors: deleteRoleResponse.errors
            ? deleteRoleResponse.errors
            : { message: "INTERNAL SERVER ERROR" },
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
    }
  },
  listUsersWithRole: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const usersWithRoleResponse = await controlAccessUtil.listUsersWithRole(
        request,
        next
      );

      if (usersWithRoleResponse.success === true) {
        const status = usersWithRoleResponse.status
          ? usersWithRoleResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: usersWithRoleResponse.message,
          users_with_role: usersWithRoleResponse.data,
        });
      } else if (usersWithRoleResponse.success === false) {
        const status = usersWithRoleResponse.status
          ? usersWithRoleResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: usersWithRoleResponse.message,
          errors: usersWithRoleResponse.errors
            ? usersWithRoleResponse.errors
            : { message: "INTERNAL SERVER ERROR" },
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
    }
  },
  listAvailableUsersForRole: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const availableUsersResponse =
        await controlAccessUtil.listAvailableUsersForRole(request, next);

      if (availableUsersResponse.success === true) {
        const status = availableUsersResponse.status
          ? availableUsersResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: "successfully listed the available users",
          available_users: availableUsersResponse.data,
        });
      } else if (availableUsersResponse.success === false) {
        const status = availableUsersResponse.status
          ? availableUsersResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: availableUsersResponse.message,
          errors: availableUsersResponse.errors
            ? availableUsersResponse.errors
            : { message: "" },
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
    }
  },
  assignUserToRole: async (req, res, next) => {
    try {
      logText("assignUserToRole...");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const assignUserResponse = await controlAccessUtil.assignUserToRole(
        request,
        next
      );

      if (assignUserResponse.success === true) {
        const status = assignUserResponse.status
          ? assignUserResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          updated_records: assignUserResponse.data,
        });
      } else if (assignUserResponse.success === false) {
        const status = assignUserResponse.status
          ? assignUserResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: assignUserResponse.message,
          errors: assignUserResponse.errors
            ? assignUserResponse.errors
            : { message: "INTERNAL SERVER ERROR" },
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
    }
  },
  assignManyUsersToRole: async (req, res, next) => {
    try {
      logText("assignManyUsersToRole...");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const assignManyUsersResponse =
        await controlAccessUtil.assignManyUsersToRole(request, next);

      if (assignManyUsersResponse.success === true) {
        const status = assignManyUsersResponse.status
          ? assignManyUsersResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: assignManyUsersResponse.message,
          updated_records: assignManyUsersResponse.data,
        });
      } else if (assignManyUsersResponse.success === false) {
        const status = assignManyUsersResponse.status
          ? assignManyUsersResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: assignManyUsersResponse.message,
          errors: assignManyUsersResponse.errors
            ? assignManyUsersResponse.errors
            : { message: "Internal Server Error" },
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
    }
  },
  unAssignUserFromRole: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const unAssignUserResponse = await controlAccessUtil.unAssignUserFromRole(
        request,
        next
      );

      if (unAssignUserResponse.success === true) {
        const status = unAssignUserResponse.status
          ? unAssignUserResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: unAssignUserResponse.message,
          user_unassigned: unAssignUserResponse.data,
        });
      } else if (unAssignUserResponse.success === false) {
        const status = unAssignUserResponse.status
          ? unAssignUserResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: unAssignUserResponse.message,
          errors: unAssignUserResponse.errors
            ? unAssignUserResponse.errors
            : { message: "INTERNAL SERVER ERRORS" },
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
    }
  },
  unAssignManyUsersFromRole: async (req, res, next) => {
    try {
      logText("assignManyUsersToRole...");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const unAssignManyUsersResponse =
        await controlAccessUtil.unAssignManyUsersFromRole(request, next);

      if (unAssignManyUsersResponse.success === true) {
        const status = unAssignManyUsersResponse.status
          ? unAssignManyUsersResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: unAssignManyUsersResponse.message,
          updated_records: unAssignManyUsersResponse.data,
        });
      } else if (unAssignManyUsersResponse.success === false) {
        const status = unAssignManyUsersResponse.status
          ? unAssignManyUsersResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: unAssignManyUsersResponse.message,
          errors: unAssignManyUsersResponse.errors
            ? unAssignManyUsersResponse.errors
            : { message: "Internal Server Error" },
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
    }
  },
  listPermissionsForRole: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const permissionsForRoleResponse =
        await controlAccessUtil.listPermissionsForRole(request, next);

      if (permissionsForRoleResponse.success === true) {
        const status = permissionsForRoleResponse.status
          ? permissionsForRoleResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: "successfully listed the permissions for the role",
          permissions_list: permissionsForRoleResponse.data,
        });
      } else if (permissionsForRoleResponse.success === false) {
        const status = permissionsForRoleResponse.status
          ? permissionsForRoleResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: permissionsForRoleResponse.message,
          errors: permissionsForRoleResponse.errors
            ? permissionsForRoleResponse.errors
            : { message: "internal server error" },
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
    }
  },
  listAvailablePermissionsForRole: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const availablePermissionsResponse =
        await controlAccessUtil.listAvailablePermissionsForRole(request, next);

      if (availablePermissionsResponse.success === true) {
        const status = availablePermissionsResponse.status
          ? availablePermissionsResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: availablePermissionsResponse.message,
          available_permissions: availablePermissionsResponse.data,
        });
      } else if (availablePermissionsResponse.success === false) {
        const status = availablePermissionsResponse.status
          ? availablePermissionsResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: false,
          message: availablePermissionsResponse.message,
          errors: availablePermissionsResponse.errors
            ? availablePermissionsResponse.errors
            : { message: "INTERNAL SERVER ERROR" },
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
    }
  },
  assignPermissionToRole: async (req, res, next) => {
    try {
      logText("assignPermissionToRole....");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const assignPermissionsResponse =
        await controlAccessUtil.assignPermissionsToRole(request, next);

      if (assignPermissionsResponse.success === true) {
        const status = assignPermissionsResponse.status
          ? assignPermissionsResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: assignPermissionsResponse.message,
          updated_role: assignPermissionsResponse.data,
        });
      } else if (assignPermissionsResponse.success === false) {
        const status = assignPermissionsResponse.status
          ? assignPermissionsResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: assignPermissionsResponse.message,
          errors: assignPermissionsResponse.errors
            ? assignPermissionsResponse.errors
            : { message: "INTERNAL SERVER ERROR" },
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
    }
  },
  unAssignPermissionFromRole: async (req, res, next) => {
    try {
      logText("unAssignPermissionFromRole....");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const unAssignPermissionResponse =
        await controlAccessUtil.unAssignPermissionFromRole(request, next);

      if (unAssignPermissionResponse.success === true) {
        const status = unAssignPermissionResponse.status
          ? unAssignPermissionResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: unAssignPermissionResponse.message,
          modified_role: unAssignPermissionResponse.data,
        });
      } else if (unAssignPermissionResponse.success === false) {
        const status = unAssignPermissionResponse.status
          ? unAssignPermissionResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: unAssignPermissionResponse.message,
          errors: unAssignPermissionResponse.errors
            ? unAssignPermissionResponse.errors
            : { message: "" },
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
    }
  },
  unAssignManyPermissionsFromRole: async (req, res, next) => {
    try {
      logText("unAssign Many Permissions From Role....");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const unAssignManyPermissionsResponse =
        await controlAccessUtil.unAssignManyPermissionsFromRole(request, next);

      if (unAssignManyPermissionsResponse.success === true) {
        const status = unAssignManyPermissionsResponse.status
          ? unAssignManyPermissionsResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: unAssignManyPermissionsResponse.message,
          modified_role: unAssignManyPermissionsResponse.data,
        });
      } else if (unAssignManyPermissionsResponse.success === false) {
        const status = unAssignManyPermissionsResponse.status
          ? unAssignManyPermissionsResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: true,
          message: unAssignManyPermissionsResponse.message,
          errors: unAssignManyPermissionsResponse.errors
            ? unAssignManyPermissionsResponse.errors
            : { message: "" },
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
    }
  },
  updateRolePermissions: async (req, res, next) => {
    try {
      logText("  updateRolePermissions....");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const updateRolePermissionsResponse =
        await controlAccessUtil.updateRolePermissions(request, next);

      if (updateRolePermissionsResponse.success === true) {
        const status = updateRolePermissionsResponse.status
          ? updateRolePermissionsResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: updateRolePermissionsResponse.message,
          modified_role: updateRolePermissionsResponse.data,
        });
      } else if (updateRolePermissionsResponse.success === false) {
        const status = updateRolePermissionsResponse.status
          ? updateRolePermissionsResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: true,
          message: updateRolePermissionsResponse.message,
          errors: updateRolePermissionsResponse.errors
            ? updateRolePermissionsResponse.errors
            : { message: "" },
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
    }
  },
};

module.exports = createRole;
