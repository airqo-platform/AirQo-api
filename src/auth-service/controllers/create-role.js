const HTTPStatus = require("http-status");
const { validationResult } = require("express-validator");
const { badRequest, convertErrorArrayToObject } = require("../utils/errors");
const controlAccessUtil = require("../utils/control-access");
const { logText, logElement, logObject, logError } = require("../utils/log");
const httpStatus = require("http-status");
const isEmpty = require("is-empty");

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
        request.query.tenant = "airqo";
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
        const errors = responseFromListRole.errors
          ? responseFromListRole.errors
          : { message: "" };
        res.status(status).json({
          success: false,
          message: responseFromListRole.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  create: async (req, res) => {
    try {
      const { query, body } = req;
      const { tenant } = query;

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
        request.query.tenant = "airqo";
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
        });
      }
    } catch (error) {
      logObject("error", error);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  update: async (req, res) => {
    try {
      const { query } = req;
      const { tenant } = query;
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
        request.query.tenant = "airqo";
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
        const errors = responseFromUpdateRole.errors
          ? responseFromUpdateRole.errors
          : { message: "" };
        res.status(status).json({
          message: responseFromUpdateRole.message,
          errors,
          success: false,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  delete: async (req, res) => {
    try {
      const { query, body } = req;
      const { tenant } = query;
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
        request.query.tenant = "airqo";
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

        const errors = responseFromDeleteRole.errors
          ? responseFromDeleteRole.errors
          : { message: "INTERNAL SERVER ERROR" };

        res.status(status).json({
          message: responseFromDeleteRole.message,
          success: false,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listUsersWithRole: async (req, res) => {
    try {
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
      const responseFromGetUsers = {
        message: "users successfully retrieved",
        success: true,
        data: [{ firstName: "yeah one" }, { firstName: "yeah two" }],
      };

      if (responseFromGetUsers.success === true) {
        const status = responseFromGetUsers.status
          ? responseFromGetUsers.status
          : httpStatus.OK;

        return res.status(status).json({
          success: true,
          message: "successfully retrieved the users with the role",
          users_with_role: responseFromGetUsers.data,
        });
      } else if (responseFromGetUsers.success === false) {
        const status = responseFromGetUsers.status
          ? responseFromGetUsers.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromGetUsers.errors
          ? responseFromGetUsers.errors
          : { message: "INTERNAL SERVER ERROR" };

        res.status(status).json({
          success: false,
          message: responseFromGetUsers.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listAvailableUsersForRole: async (req, res) => {
    try {
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
       * list users who are not assigned that role
       * use an appropriate Mongo DB filter for this
       */

      const responseFromGetUsers = {
        success: true,
        message: "successfully listed the users",
        data: [{ firstName: "me too" }, { firstName: "me three" }],
        status: httpStatus.OK,
      };

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
        const errors = responseFromGetUsers.errors
          ? responseFromGetUsers.errors
          : { message: "" };
        return res.status(status).json({
          success: false,
          message: responseFromGetUsers.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  assignUserToRole: async (req, res) => {
    try {
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
       * just update the user's role
       * Note that the "admin" user may not be reassigned to a different role
       */

      const responseFromUpdateUser = {
        success: true,
        message: "successfully updated user",
        data: [{ firstName: "yeah" }],
      };

      if (responseFromUpdateUser.success === true) {
        const status = responseFromUpdateUser.status
          ? responseFromUpdateUser.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: "successfully assigned user to role",
          assigned_user: responseFromUpdateUser.data,
        });
      } else if (responseFromUpdateUser.success === false) {
        const status = responseFromUpdateUser.status
          ? responseFromUpdateUser.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromUpdateUser.errors
          ? responseFromUpdateUser.errors
          : { message: "INTERNAL SERVER ERROR" };
        return res.status(status).json({
          success: false,
          message: responseFromUpdateUser.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  unAssignUserFromRole: async (req, res) => {
    try {
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
       * send error message of 400 in case user was not assigned to that role
       */

      const responseFromUpdateUser = {
        success: true,
        message: "successfully updated the user",
        data: [{ firstName: "yokana" }],
      };

      if (responseFromUpdateUser.success === true) {
        const status = responseFromUpdateUser.status
          ? responseFromUpdateUser.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: "successfully unassigned user from role",
          user_unassigned: responseFromUpdateUser.data,
        });
      } else if (responseFromUpdateUser.success === false) {
        const status = responseFromUpdateUser.status
          ? responseFromUpdateUser.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromUpdateUser.errors
          ? responseFromUpdateUser.errors
          : { message: "INTERNAL SERVER ERRORS" };

        return res.status(status).json({
          success: false,
          message: responseFromUpdateUser.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listPermissionsForRole: async (req, res) => {
    try {
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
      const responseFromListPermissions = {
        success: true,
        message: "successfully listed the permissions",
        status: httpStatus.OK,
        data: [
          {
            per_uid: "00000000000000000000000000000001",
            per_code: "AIRQO_LOGIN",
            per_name: "sfsfsf",
          },
          {
            per_uid: "00000000000000000000000000000005",
            per_code: "AIRQO_CASES",
            per_name: "afasfa",
          },
        ],
      };

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

        const errors = responseFromListPermissions.errors
          ? responseFromListPermissions.errors
          : { message: "internal server error" };

        return res.status(status).json({
          success: false,
          message: responseFromListPermissions.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listAvailablePermissionsForRole: async (req, res) => {
    try {
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
       * Get a list of the available permissions,
       * which can be assigned to a specified role.
       */
      const responseForListOfPermissions = {
        success: true,
        message: "successfully listed the permissions",
        status: httpStatus.OK,
        data: [
          {
            per_uid: "00000000000000000000000000000006",
            per_code: "AIRQO_ALLCASES",
            per_name: "sfsgsgsgs",
          },
          {
            per_uid: "00000000000000000000000000000018",
            per_code: "AIRQO_CANCELCASE",
            per_name: "sfvbshs",
          },
        ],
      };

      if (responseForListOfPermissions.success === true) {
        const status = responseForListOfPermissions.status
          ? responseForListOfPermissions.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: "available permissions, which can be assigned to the role.",
          available_permissions: responseForListOfPermissions.data,
        });
      } else if (responseForListOfPermissions.success === false) {
        const status = responseForListOfPermissions.status
          ? responseForListOfPermissions.status
          : httpStatus.OK;
        const errors = responseForListOfPermissions.errors
          ? responseForListOfPermissions.errors
          : { message: "INTERNAL SERVER ERROR" };
        return res.status(status).json({
          success: false,
          message: responseForListOfPermissions.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  assignPermissionToRole: async (req, res) => {
    try {
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
      const responseFromUpdateRole = {
        success: true,
        message: "successfully updated role",
        status: httpStatus.OK,
        data: [
          {
            role_name: "",
            role_permissions: [
              {
                per_uid: "00000000000000000000000000000006",
                per_code: "AIRQO_ALLCASES",
                per_name: "sfsgsgsgs",
              },
              {
                per_uid: "00000000000000000000000000000018",
                per_code: "AIRQO_CANCELCASE",
                per_name: "sfvbshs",
              },
            ],
          },
        ],
      };

      if (responseFromUpdateRole.success === true) {
        const status = responseFromUpdateRole.status
          ? responseFromUpdateRole.status
          : httpStatus.OK;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateRole.message,
          updated_role: responseFromUpdateRole.data,
        });
      } else if (responseFromUpdateRole.success === false) {
        const status = responseFromUpdateRole.status
          ? responseFromUpdateRole.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromUpdateRole.errors
          ? responseFromUpdateRole.errors
          : { message: "INTERNAL SERVER ERROR" };

        return res.status(status).json({
          success: false,
          message: responseFromUpdateRole.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  unAssignPermissionFromRole: async (req, res) => {
    try {
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

      const responseFromUnAssignPermissionFromRole = {
        success: true,
        message: "successfully updated the role",
        status: httpStatus.OK,
        data: [
          {
            role_name: "qwfwww",
            role_code: "wfwww",
            role_permissions: [
              {
                per_uid: "00000000000000000000000000000006",
                per_code: "AIRQO_ALLCASES",
                per_name: "sfsgsgsgs",
              },
            ],
          },
        ],
      };

      if (responseFromUnAssignPermissionFromRole.success === true) {
        const status = responseFromUnAssignPermissionFromRole.status
          ? responseFromUnAssignPermissionFromRole.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: "permission has been unassigned from role",
          modified_role: responseFromUnAssignPermissionFromRole.data,
        });
      } else if (responseFromUnAssignPermissionFromRole.success === false) {
        const status = responseFromUnAssignPermissionFromRole.status
          ? responseFromUnAssignPermissionFromRole.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        const errors = responseFromUnAssignPermissionFromRole.errors
          ? responseFromUnAssignPermissionFromRole.errors
          : { message: "" };

        return res.status(status).json({
          success: true,
          message: responseFromUnAssignPermissionFromRole.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createRole;
