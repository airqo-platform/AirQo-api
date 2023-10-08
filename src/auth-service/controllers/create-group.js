const httpStatus = require("http-status");
const { validationResult } = require("express-validator");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const createGroupUtil = require("@utils/create-group");
const { logText, logElement, logObject, logError } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-group-controller`
);

const controlAccessUtil = require("@utils/control-access");

const createGroup = {
  list: async (req, res) => {
    try {
      const { query, params } = req;
      let { tenant } = query;
      const hasErrors = !validationResult(req).isEmpty();
      logObject("hasErrors", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = req;
      if (isEmpty(tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }

      const responseFromListGroup = await createGroupUtil.list(request);

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
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listRolesForGroup: async (req, res) => {
    try {
      logText("unAssignPermissionFromRole....");
      const { query, body } = req;
      let { tenant } = query;
      const hasErrors = !validationResult(req).isEmpty();
      logObject("hasErrors", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromListRolesForGroup =
        await controlAccessUtil.listRolesForGroup(request);

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
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  create: async (req, res) => {
    try {
      const { query } = req;
      let { tenant } = query;
      const hasErrors = !validationResult(req).isEmpty();
      logObject("hasErrors", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = req;
      if (isEmpty(tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }
      const responseFromCreateGroup = await createGroupUtil.create(request);

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
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  update: async (req, res) => {
    try {
      const { query } = req;
      let { tenant } = query;
      const hasErrors = !validationResult(req).isEmpty();
      logObject("hasErrors", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = req;
      if (isEmpty(tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }
      const responseFromUpdateGroup = await createGroupUtil.update(request);
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
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  delete: async (req, res) => {
    try {
      const { query } = req;
      let { tenant } = query;
      const hasErrors = !validationResult(req).isEmpty();
      logObject("hasErrors", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let request = req;
      if (isEmpty(tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }
      const responseFromDeleteGroup = await createGroupUtil.delete(request);
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
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  assignUsers: async (req, res) => {
    try {
      logText("assign many users....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromAssignUsers = await createGroupUtil.assignUsers(
        request
      );

      if (responseFromAssignUsers.success === true) {
        const status = responseFromAssignUsers.status
          ? responseFromAssignUsers.status
          : httpStatus.OK;

        return res.status(status).json({
          message: responseFromAssignUsers.message,
          updated_group: responseFromAssignUsers.data,
          success: true,
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
      logObject("error", error);
      logger.error(`Internal Server Error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  assignOneUser: async (req, res) => {
    try {
      logText("assign one user....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromUpdateGroup = await createGroupUtil.assignOneUser(
        request
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
      logObject("error", error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  unAssignUser: async (req, res) => {
    try {
      logText("unAssign user....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromUnassignUser = await createGroupUtil.unAssignUser(
        request
      );

      logObject("responseFromUnassignUser", responseFromUnassignUser);

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
      logObject("error", error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  unAssignManyUsers: async (req, res) => {
    try {
      logText("unAssign user....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromUnassignManyUsers =
        await createGroupUtil.unAssignManyUsers(request);

      logObject("responseFromUnassignManyUsers", responseFromUnassignManyUsers);

      if (responseFromUnassignManyUsers.success === true) {
        const status = responseFromUnassignManyUsers.status
          ? responseFromUnassignManyUsers.status
          : httpStatus.OK;

        return res.status(status).json({
          message: "users successully unassigned",
          updated_records: responseFromUnassignManyUsers.data,
          success: true,
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
      logObject("error", error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listAssignedUsers: async (req, res) => {
    try {
      const { query } = req;
      let { tenant } = query;
      const hasErrors = !validationResult(req).isEmpty();
      logObject("hasErrors", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = req;
      if (isEmpty(tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }

      const responseFromListUserWithGroup =
        await createGroupUtil.listAssignedUsers(request);

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
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listAvailableUsers: async (req, res) => {
    try {
      const { query } = req;
      let { tenant } = query;
      const hasErrors = !validationResult(req).isEmpty();
      logObject("hasErrors", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let request = req;
      if (isEmpty(tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }
      const responseFromListAvailableUsersForGroup =
        await createGroupUtil.listAvailableUsersForGroup(request);

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
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listSummary: async (req, res) => {
    try {
      logText("listing summary of group....");

      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      logElement("tenant", tenant);
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      request.query.category = "summary";

      const responseFromListGroups = await createGroupUtil.list(request);

      logObject("responseFromListGroups in controller", responseFromListGroups);

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
      logElement("internal server error", error.message);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createGroup;
