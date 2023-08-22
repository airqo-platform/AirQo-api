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

      let request = Object.assign({}, req);

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

  listSummary: async (req, res) => {
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

      let request = Object.assign({}, req);

      if (isEmpty(tenant)) {
        request.query.tenant = constants.DEFAULT_TENANT || "airqo";
      }

      request.query.category = "summary";

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
          updated_records: responseFromAssignUserToRole.data,
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
  assignManyUsersToRole: async (req, res) => {
    try {
      logText("assignManyUsersToRole...");
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

      const responseFromAssignManyUsersToRole =
        await controlAccessUtil.assignManyUsersToRole(request);

      if (responseFromAssignManyUsersToRole.success === true) {
        const status = responseFromAssignManyUsersToRole.status
          ? responseFromAssignManyUsersToRole.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromAssignManyUsersToRole.message,
          updated_records: responseFromAssignManyUsersToRole.data,
        });
      } else if (responseFromAssignManyUsersToRole.success === false) {
        const status = responseFromAssignManyUsersToRole.status
          ? responseFromAssignManyUsersToRole.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromAssignManyUsersToRole.message,
          errors: responseFromAssignManyUsersToRole.errors
            ? responseFromAssignManyUsersToRole.errors
            : { message: "Internal Server Error" },
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
       * logged in user needs to have the right permission to perform this action
       * send error message of 400,bad request in case user was not assigned to that role
       */

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
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

  unAssignManyUsersFromRole: async (req, res) => {
    try {
      logText("assignManyUsersToRole...");
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

      const responseFromUnAssignManyUsersFromRole =
        await controlAccessUtil.unAssignManyUsersFromRole(request);

      if (responseFromUnAssignManyUsersFromRole.success === true) {
        const status = responseFromUnAssignManyUsersFromRole.status
          ? responseFromUnAssignManyUsersFromRole.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUnAssignManyUsersFromRole.message,
          updated_records: responseFromUnAssignManyUsersFromRole.data,
        });
      } else if (responseFromUnAssignManyUsersFromRole.success === false) {
        const status = responseFromUnAssignManyUsersFromRole.status
          ? responseFromUnAssignManyUsersFromRole.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUnAssignManyUsersFromRole.message,
          errors: responseFromUnAssignManyUsersFromRole.errors
            ? responseFromUnAssignManyUsersFromRole.errors
            : { message: "Internal Server Error" },
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
        await controlAccessUtil.assignPermissionsToRole(request);

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
          success: false,
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

  unAssignManyPermissionsFromRole: async (req, res) => {
    try {
      logText("unAssign Many Permissions From Role....");
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

      const responseFromunAssignManyPermissionsFromRole =
        await controlAccessUtil.unAssignManyPermissionsFromRole(request);

      if (responseFromunAssignManyPermissionsFromRole.success === true) {
        const status = responseFromunAssignManyPermissionsFromRole.status
          ? responseFromunAssignManyPermissionsFromRole.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromunAssignManyPermissionsFromRole.message,
          modified_role: responseFromunAssignManyPermissionsFromRole.data,
        });
      } else if (
        responseFromunAssignManyPermissionsFromRole.success === false
      ) {
        const status = responseFromunAssignManyPermissionsFromRole.status
          ? responseFromunAssignManyPermissionsFromRole.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: true,
          message: responseFromunAssignManyPermissionsFromRole.message,
          errors: responseFromunAssignManyPermissionsFromRole.errors
            ? responseFromunAssignManyPermissionsFromRole.errors
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

  updateRolePermissions: async (req, res) => {
    try {
      logText("  updateRolePermissions....");
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

      const responseFromUpdateRolePermissions =
        await controlAccessUtil.updateRolePermissions(request);

      if (responseFromUpdateRolePermissions.success === true) {
        const status = responseFromUpdateRolePermissions.status
          ? responseFromUpdateRolePermissions.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateRolePermissions.message,
          modified_role: responseFromUpdateRolePermissions.data,
        });
      } else if (responseFromUpdateRolePermissions.success === false) {
        const status = responseFromUpdateRolePermissions.status
          ? responseFromUpdateRolePermissions.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: true,
          message: responseFromUpdateRolePermissions.message,
          errors: responseFromUpdateRolePermissions.errors
            ? responseFromUpdateRolePermissions.errors
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
