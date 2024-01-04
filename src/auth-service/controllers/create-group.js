const httpStatus = require("http-status");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const createGroupUtil = require("@utils/create-group");
const { logText, logElement, logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-group-controller`
);
const controlAccessUtil = require("@utils/control-access");

const createGroup = {
  removeUniqueConstraint: async (req, res, next) => {
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

      const responseFromRemoveUniqueConstraint =
        await createGroupUtil.removeUniqueConstraint(request, next);

      if (responseFromRemoveUniqueConstraint.success === true) {
        const status = responseFromRemoveUniqueConstraint.status
          ? responseFromRemoveUniqueConstraint.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: "successfully removed all the respective unique constraints",
        });
      } else if (responseFromRemoveUniqueConstraint.success === false) {
        const status = responseFromRemoveUniqueConstraint.status
          ? responseFromRemoveUniqueConstraint.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveUniqueConstraint.message
            ? responseFromRemoveUniqueConstraint.message
            : "",
          errors: responseFromRemoveUniqueConstraint.errors
            ? responseFromRemoveUniqueConstraint.errors
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
  list: async (req, res, next) => {
    try {
      const { params } = req;
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
      const responseFromListGroup = await createGroupUtil.list(request, next);

      if (responseFromListGroup.success === true) {
        const status = responseFromListGroup.status
          ? responseFromListGroup.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListGroup.message
            ? responseFromListGroup.message
            : "",
          [isEmpty(params) ? "groups" : "group"]: responseFromListGroup.data
            ? isEmpty(params)
              ? responseFromListGroup.data
              : responseFromListGroup.data[0]
            : [],
        });
      } else if (responseFromListGroup.success === false) {
        const status = responseFromListGroup.status
          ? responseFromListGroup.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListGroup.message
            ? responseFromListGroup.message
            : "",
          errors: responseFromListGroup.errors
            ? responseFromListGroup.errors
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
  listRolesForGroup: async (req, res, next) => {
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

      const responseFromListRolesForGroup =
        await controlAccessUtil.listRolesForGroup(request, next);

      if (responseFromListRolesForGroup.success === true) {
        const status = responseFromListRolesForGroup.status
          ? responseFromListRolesForGroup.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListRolesForGroup.message,
          group_roles: responseFromListRolesForGroup.data,
        });
      } else if (responseFromListRolesForGroup.success === false) {
        const status = responseFromListRolesForGroup.status
          ? responseFromListRolesForGroup.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromListRolesForGroup.message,
          errors: responseFromListRolesForGroup.errors
            ? responseFromListRolesForGroup.errors
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
      const responseFromCreateGroup = await createGroupUtil.create(
        request,
        next
      );

      if (responseFromCreateGroup.success === true) {
        const status = responseFromCreateGroup.status
          ? responseFromCreateGroup.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateGroup.message
            ? responseFromCreateGroup.message
            : "",
          created_group: responseFromCreateGroup.data
            ? responseFromCreateGroup.data
            : [],
        });
      } else if (responseFromCreateGroup.success === false) {
        const status = responseFromCreateGroup.status
          ? responseFromCreateGroup.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateGroup.message
            ? responseFromCreateGroup.message
            : "",
          errors: responseFromCreateGroup.errors
            ? responseFromCreateGroup.errors
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
      const responseFromUpdateGroup = await createGroupUtil.update(
        request,
        next
      );
      if (responseFromUpdateGroup.success === true) {
        const status = responseFromUpdateGroup.status
          ? responseFromUpdateGroup.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateGroup.message
            ? responseFromUpdateGroup.message
            : "",
          updated_group: responseFromUpdateGroup.data
            ? responseFromUpdateGroup.data
            : [],
        });
      } else if (responseFromUpdateGroup.success === false) {
        const status = responseFromUpdateGroup.status
          ? responseFromUpdateGroup.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateGroup.message
            ? responseFromUpdateGroup.message
            : "",
          errors: responseFromUpdateGroup.errors
            ? responseFromUpdateGroup.errors
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
      const responseFromDeleteGroup = await createGroupUtil.delete(
        request,
        next
      );
      if (responseFromDeleteGroup.success === true) {
        const status = responseFromDeleteGroup.status
          ? responseFromDeleteGroup.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeleteGroup.message
            ? responseFromDeleteGroup.message
            : "",
          deleted_group: responseFromDeleteGroup.data
            ? responseFromDeleteGroup.data
            : [],
        });
      } else if (responseFromDeleteGroup.success === false) {
        const status = responseFromDeleteGroup.status
          ? responseFromDeleteGroup.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeleteGroup.message
            ? responseFromDeleteGroup.message
            : "",
          errors: responseFromDeleteGroup.errors
            ? responseFromDeleteGroup.errors
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
  assignUsers: async (req, res, next) => {
    try {
      logText("assign many users....");
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

      const responseFromAssignUsers = await createGroupUtil.assignUsersHybrid(
        request,
        next
      );

      if (responseFromAssignUsers.success === true) {
        const status = responseFromAssignUsers.status
          ? responseFromAssignUsers.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromAssignUsers.message,
          updated_records: responseFromAssignUsers.data,
        });
      } else if (responseFromAssignUsers.success === false) {
        const status = responseFromAssignUsers.status
          ? responseFromAssignUsers.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromAssignUsers.message,
          errors: responseFromAssignUsers.errors
            ? responseFromAssignUsers.errors
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
  assignOneUser: async (req, res, next) => {
    try {
      logText("assign one user....");
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

      const responseFromUpdateGroup = await createGroupUtil.assignOneUser(
        request,
        next
      );

      if (responseFromUpdateGroup.success === true) {
        const status = responseFromUpdateGroup.status
          ? responseFromUpdateGroup.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateGroup.message,
          updated_records: responseFromUpdateGroup.data,
        });
      } else if (responseFromUpdateGroup.success === false) {
        const status = responseFromUpdateGroup.status
          ? responseFromUpdateGroup.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateGroup.message,
          errors: responseFromUpdateGroup.errors
            ? responseFromUpdateGroup.errors
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
  unAssignUser: async (req, res, next) => {
    try {
      logText("unAssign user....");
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

      const responseFromUnassignUser = await createGroupUtil.unAssignUser(
        request,
        next
      );

      if (responseFromUnassignUser.success === true) {
        const status = responseFromUnassignUser.status
          ? responseFromUnassignUser.status
          : httpStatus.OK;
        return res.status(status).json({
          message: "user successully unassigned",
          updated_records: responseFromUnassignUser.data,
          success: true,
        });
      } else if (responseFromUnassignUser.success === false) {
        const status = responseFromUnassignUser.status
          ? responseFromUnassignUser.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUnassignUser.message,
          errors: responseFromUnassignUser.errors
            ? responseFromUnassignUser.errors
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
  unAssignManyUsers: async (req, res, next) => {
    try {
      logText("unAssign user....");
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

      const responseFromUnassignManyUsers =
        await createGroupUtil.unAssignManyUsers(request, next);

      if (responseFromUnassignManyUsers.success === true) {
        const status = responseFromUnassignManyUsers.status
          ? responseFromUnassignManyUsers.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUnassignManyUsers.message,
          updated_records: responseFromUnassignManyUsers.data,
        });
      } else if (responseFromUnassignManyUsers.success === false) {
        const status = responseFromUnassignManyUsers.status
          ? responseFromUnassignManyUsers.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUnassignManyUsers.message,
          errors: responseFromUnassignManyUsers.errors
            ? responseFromUnassignManyUsers.errors
            : { message: "Internal Server Errors" },
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
  listAssignedUsers: async (req, res, next) => {
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

      const responseFromListUserWithGroup =
        await createGroupUtil.listAssignedUsers(request, next);

      if (responseFromListUserWithGroup.success === true) {
        const status = responseFromListUserWithGroup.status
          ? responseFromListUserWithGroup.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListUserWithGroup.message
            ? responseFromListUserWithGroup.message
            : "",
          group_members: responseFromListUserWithGroup.data
            ? responseFromListUserWithGroup.data
            : [],
        });
      } else if (responseFromListUserWithGroup.success === false) {
        const status = responseFromListUserWithGroup.status
          ? responseFromListUserWithGroup.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListUserWithGroup.message
            ? responseFromListUserWithGroup.message
            : "",
          errors: responseFromListUserWithGroup.errors
            ? responseFromListUserWithGroup.errors
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
  listAvailableUsers: async (req, res, next) => {
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
      const responseFromListAvailableUsersForGroup =
        await createGroupUtil.listAvailableUsers(request, next);

      if (responseFromListAvailableUsersForGroup.success === true) {
        const status = responseFromListAvailableUsersForGroup.status
          ? responseFromListAvailableUsersForGroup.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListAvailableUsersForGroup.message
            ? responseFromListAvailableUsersForGroup.message
            : "",
          available_users_for_group: responseFromListAvailableUsersForGroup.data
            ? responseFromListAvailableUsersForGroup.data
            : [],
        });
      } else if (responseFromListAvailableUsersForGroup.success === false) {
        const status = responseFromListAvailableUsersForGroup.status
          ? responseFromListAvailableUsersForGroup.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListAvailableUsersForGroup.message
            ? responseFromListAvailableUsersForGroup.message
            : "",
          errors: responseFromListAvailableUsersForGroup.errors
            ? responseFromListAvailableUsersForGroup.errors
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
  listAllGroupUsers: async (req, res, next) => {
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

      const responseFromListAllGroupUsers =
        await createGroupUtil.listAllGroupUsers(request, next);

      if (responseFromListAllGroupUsers.success === true) {
        const status = responseFromListAllGroupUsers.status
          ? responseFromListAllGroupUsers.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListAllGroupUsers.message
            ? responseFromListAllGroupUsers.message
            : "",
          group_members: responseFromListAllGroupUsers.data
            ? responseFromListAllGroupUsers.data
            : [],
        });
      } else if (responseFromListAllGroupUsers.success === false) {
        const status = responseFromListAllGroupUsers.status
          ? responseFromListAllGroupUsers.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListAllGroupUsers.message
            ? responseFromListAllGroupUsers.message
            : "",
          errors: responseFromListAllGroupUsers.errors
            ? responseFromListAllGroupUsers.errors
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
  listSummary: async (req, res, next) => {
    try {
      logText("listing summary of group....");
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

      const responseFromListGroups = await createGroupUtil.list(request, next);

      if (responseFromListGroups.success === true) {
        const status = responseFromListGroups.status
          ? responseFromListGroups.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListGroups.message,
          groups: responseFromListGroups.data,
        });
      } else if (responseFromListGroups.success === false) {
        const status = responseFromListGroups.status
          ? responseFromListGroups.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromListGroups.message,
          errors: responseFromListGroups.errors
            ? responseFromListGroups.errors
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

module.exports = createGroup;
