const httpStatus = require("http-status");
const { validationResult } = require("express-validator");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const controlAccessUtil = require("@utils/control-access");
const { logText, logElement, logObject, logError } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-role-controller`
);

const createRole = {
  list: async (req, res) => {
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
        request.query.tenant = constants.DEFAULT_TENANT;
      }

      const responseFromListRole = await controlAccessUtil.listRole(request);

      logObject("in controller, responseFromListRole", responseFromListRole);

      if (responseFromListRole.success === true) {
        const status = responseFromListRole.status
          ? responseFromListRole.status
          : httpStatus.OK;

        res.status(status).json({
          success: true,
          message: responseFromListRole.message,
          roles: responseFromListRole.data,
        });
      } else if (responseFromListRole.success === false) {
        const status = responseFromListRole.status
          ? responseFromListRole.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListRole.message,
          errors: responseFromListRole.errors
            ? responseFromListRole.errors
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

      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        request.query.tenant = constants.DEFAULT_TENANT;
      }
      const responseFromCreateRole = await controlAccessUtil.createRole(
        request
      );
      logObject("responseFromCreateRole", responseFromCreateRole);
      if (responseFromCreateRole.success === true) {
        const status = responseFromCreateRole.status
          ? responseFromCreateRole.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateRole.message,
          created_role: responseFromCreateRole.data,
        });
      } else if (responseFromCreateRole.success === false) {
        const status = responseFromCreateRole.status
          ? responseFromCreateRole.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateRole.message,
          errors: responseFromCreateRole.errors
            ? responseFromCreateRole.errors
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
        request.query.tenant = constants.DEFAULT_TENANT;
      }

      const responseFromUpdateRole = await controlAccessUtil.updateRole(
        request
      );
      if (responseFromUpdateRole.success === true) {
        const status = responseFromUpdateRole.status
          ? responseFromUpdateRole.status
          : httpStatus.OK;
        res.status(status).json({
          message: responseFromUpdateRole.message,
          updated_role: responseFromUpdateRole.data,
          success: true,
        });
      } else if (responseFromUpdateRole.success === false) {
        const status = responseFromUpdateRole.status
          ? responseFromUpdateRole.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          message: responseFromUpdateRole.message,
          errors: responseFromUpdateRole.errors
            ? responseFromUpdateRole.errors
            : { message: "" },
          success: false,
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

      let request = req;
      if (isEmpty(tenant)) {
        request.query.tenant = constants.DEFAULT_TENANT;
      }
      const responseFromDeleteRole = await controlAccessUtil.deleteRole(
        request
      );
      if (responseFromDeleteRole.success === true) {
        const status = responseFromDeleteRole.status
          ? responseFromDeleteRole.status
          : httpStatus.OK;

        res.status(status).json({
          message: responseFromDeleteRole.message,
          deleted_role: responseFromDeleteRole.data,
          success: true,
        });
      } else if (responseFromDeleteRole.success === false) {
        const status = responseFromDeleteRole.status
          ? responseFromDeleteRole.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        res.status(status).json({
          message: responseFromDeleteRole.message,
          success: false,
          errors: responseFromDeleteRole.errors
            ? responseFromDeleteRole.errors
            : { message: "INTERNAL SERVER ERROR" },
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

  listUsersWithRole: async (req, res) => {
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

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromListUsersWithRole =
        await controlAccessUtil.listUsersWithRole(request);

      logObject("responseFromListUsersWithRole", responseFromListUsersWithRole);

      if (responseFromListUsersWithRole.success === true) {
        const status = responseFromListUsersWithRole.status
          ? responseFromListUsersWithRole.status
          : httpStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromListUsersWithRole.message,
          users_with_role: responseFromListUsersWithRole.data,
        });
      } else if (responseFromListUsersWithRole.success === false) {
        const status = responseFromListUsersWithRole.status
          ? responseFromListUsersWithRole.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        res.status(status).json({
          success: false,
          message: responseFromListUsersWithRole.message,
          errors: responseFromListUsersWithRole.errors
            ? responseFromListUsersWithRole.errors
            : { message: "INTERNAL SERVER ERROR" },
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

  listAvailableUsersForRole: async (req, res) => {
    try {
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
      request["query"]["tenant"] = tenant;

      const responseFromGetUsers =
        await controlAccessUtil.listAvailableUsersForRole(request);

      if (responseFromGetUsers.success === true) {
        const status = responseFromGetUsers.status
          ? responseFromGetUsers.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: "successfully listed the available users",
          available_users: responseFromGetUsers.data,
        });
      } else if (responseFromGetUsers.success === false) {
        const status = responseFromGetUsers.status
          ? responseFromGetUsers.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromGetUsers.message,
          errors: responseFromGetUsers.errors
            ? responseFromGetUsers.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  assignUserToRole: async (req, res) => {
    try {
      logText("assignUserToRole...");
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
      request["query"]["tenant"] = tenant;

      const responseFromAssignUserToRole =
        await controlAccessUtil.assignUserToRole(request);

      if (responseFromAssignUserToRole.success === true) {
        const status = responseFromAssignUserToRole.status
          ? responseFromAssignUserToRole.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromAssignUserToRole.message,
          assigned_user: responseFromAssignUserToRole.data,
        });
      } else if (responseFromAssignUserToRole.success === false) {
        const status = responseFromAssignUserToRole.status
          ? responseFromAssignUserToRole.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromAssignUserToRole.message,
          errors: responseFromAssignUserToRole.errors
            ? responseFromAssignUserToRole.errors
            : { message: "INTERNAL SERVER ERROR" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  unAssignUserFromRole: async (req, res) => {
    try {
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
      /**
       * logged in user needs to have the right permission to perform this
       * action
       *
       * send error message of 400,bad request in case user was not assigned to that role
       */

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;
      const responseFromUnAssignUserFromRole =
        await controlAccessUtil.unAssignUserFromRole(request);
      logObject(
        "responseFromUnAssignUserFromRole",
        responseFromUnAssignUserFromRole
      );

      if (responseFromUnAssignUserFromRole.success === true) {
        const status = responseFromUnAssignUserFromRole.status
          ? responseFromUnAssignUserFromRole.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUnAssignUserFromRole.message,
          user_unassigned: responseFromUnAssignUserFromRole.data,
        });
      } else if (responseFromUnAssignUserFromRole.success === false) {
        const status = responseFromUnAssignUserFromRole.status
          ? responseFromUnAssignUserFromRole.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUnAssignUserFromRole.message,
          errors: responseFromUnAssignUserFromRole.errors
            ? responseFromUnAssignUserFromRole.errors
            : { message: "INTERNAL SERVER ERRORS" },
        });
      }
    } catch (error) {
      logObject("zi error", error);
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listPermissionsForRole: async (req, res) => {
    try {
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
      request["query"]["tenant"] = tenant;
      const responseFromListPermissions =
        await controlAccessUtil.listPermissionsForRole(request);

      if (responseFromListPermissions.success === true) {
        const status = responseFromListPermissions.status
          ? responseFromListPermissions.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: "successfully listed the permissions for the role",
          permissions_list: responseFromListPermissions.data,
        });
      } else if (responseFromListPermissions.success === false) {
        const status = responseFromListPermissions.status
          ? responseFromListPermissions.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromListPermissions.message,
          errors: responseFromListPermissions.errors
            ? responseFromListPermissions.errors
            : { message: "internal server error" },
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

  listAvailablePermissionsForRole: async (req, res) => {
    try {
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
      request["query"]["tenant"] = tenant;
      const responseForListOfPermissions =
        await controlAccessUtil.listAvailablePermissionsForRole(request);

      if (responseForListOfPermissions.success === true) {
        const status = responseForListOfPermissions.status
          ? responseForListOfPermissions.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseForListOfPermissions.message,
          available_permissions: responseForListOfPermissions.data,
        });
      } else if (responseForListOfPermissions.success === false) {
        const status = responseForListOfPermissions.status
          ? responseForListOfPermissions.status
          : httpStatus.OK;
        return res.status(status).json({
          success: false,
          message: responseForListOfPermissions.message,
          errors: responseForListOfPermissions.errors
            ? responseForListOfPermissions.errors
            : { message: "INTERNAL SERVER ERROR" },
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

  assignPermissionToRole: async (req, res) => {
    try {
      logText("assignPermissionToRole....");
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
        tenant = constants.DEFAULT_TENANT || "airqo";
      }
      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromUpdateRole =
        await controlAccessUtil.assignPermissionToRole(request);

      if (responseFromUpdateRole.success === true) {
        const status = responseFromUpdateRole.status
          ? responseFromUpdateRole.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateRole.message,
          updated_role: responseFromUpdateRole.data,
        });
      } else if (responseFromUpdateRole.success === false) {
        const status = responseFromUpdateRole.status
          ? responseFromUpdateRole.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateRole.message,
          errors: responseFromUpdateRole.errors
            ? responseFromUpdateRole.errors
            : { message: "INTERNAL SERVER ERROR" },
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

  unAssignPermissionFromRole: async (req, res) => {
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
      request["query"]["tenant"] = tenant;

      const responseFromUnAssignPermissionFromRole =
        await controlAccessUtil.unAssignPermissionFromRole(request);

      if (responseFromUnAssignPermissionFromRole.success === true) {
        const status = responseFromUnAssignPermissionFromRole.status
          ? responseFromUnAssignPermissionFromRole.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUnAssignPermissionFromRole.message,
          modified_role: responseFromUnAssignPermissionFromRole.data,
        });
      } else if (responseFromUnAssignPermissionFromRole.success === false) {
        const status = responseFromUnAssignPermissionFromRole.status
          ? responseFromUnAssignPermissionFromRole.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: true,
          message: responseFromUnAssignPermissionFromRole.message,
          errors: responseFromUnAssignPermissionFromRole.errors
            ? responseFromUnAssignPermissionFromRole.errors
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
};

module.exports = createRole;
