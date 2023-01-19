const httpStatus = require("http-status");
const { validationResult } = require("express-validator");
const { badRequest, convertErrorArrayToObject } = require("../utils/errors");
const controlAccessUtil = require("../utils/control-access");
const { logText, logElement, logObject, logError } = require("../utils/log");

const createGroup = {
  list: async (req, res) => {
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
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }

      const responseFromListGroup = await controlAccessUtil.listGroup(request);

      if (responseFromListGroup.success === true) {
        const status = responseFromListGroup.status
          ? responseFromListGroup.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListGroup.message
            ? responseFromListGroup.message
            : "",
          groups: responseFromListGroup.data ? responseFromListGroup.data : [],
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
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }
      const responseFromCreateGroup = await controlAccessUtil.createGroup(
        request
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
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }
      const responseFromUpdateGroup = await controlAccessUtil.updateGroup(
        request
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
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }
      const responseFromDeleteGroup = await controlAccessUtil.deleteGroup(
        request
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
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listUsersWithGroup: async (req, res) => {
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
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }

      const responseFromListUserWithGroup =
        await controlAccessUtil.listUsersWithGroup(request);

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
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listAvailableUsersForGroup: async (req, res) => {
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
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }
      const responseFromListAvailableUsersForGroup =
        await controlAccessUtil.listAvailableUsersForGroup(request);

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
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  assignUserToGroup: async (req, res) => {
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
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }

      const responseFromAssignUserToGroup =
        await controlAccessUtil.assignUserToGroup(request);

      if (responseFromAssignUserToGroup.success === true) {
        const status = responseFromAssignUserToGroup.status
          ? responseFromAssignUserToGroup.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromAssignUserToGroup.message
            ? responseFromAssignUserToGroup.message
            : "",
          assigned_user_to_group: responseFromAssignUserToGroup.data
            ? responseFromAssignUserToGroup.data
            : [],
        });
      } else if (responseFromAssignUserToGroup.success === false) {
        const status = responseFromAssignUserToGroup.status
          ? responseFromAssignUserToGroup.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromAssignUserToGroup.message
            ? responseFromAssignUserToGroup.message
            : "",
          errors: responseFromAssignUserToGroup.errors
            ? responseFromAssignUserToGroup.errors
            : { message: "" },
        });
      }
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  unAssignUserFromGroup: async (req, res) => {
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
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }
      const responseFromUnAssignUserFromGroup =
        await controlAccessUtil.unAssignUserFromGroup(request);

      if (responseFromUnAssignUserFromGroup.success === true) {
        const status = responseFromUnAssignUserFromGroup.status
          ? responseFromUnAssignUserFromGroup.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUnAssignUserFromGroup.message
            ? responseFromUnAssignUserFromGroup.message
            : "",
          unassigned_user_from_group: responseFromUnAssignUserFromGroup.data
            ? responseFromUnAssignUserFromGroup.data
            : [],
        });
      } else if (responseFromUnAssignUserFromGroup.success === false) {
        const status = responseFromUnAssignUserFromGroup.status
          ? responseFromUnAssignUserFromGroup.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUnAssignUserFromGroup.message
            ? responseFromUnAssignUserFromGroup.message
            : "",
          errors: responseFromUnAssignUserFromGroup.errors
            ? responseFromUnAssignUserFromGroup.errors
            : { message: "" },
        });
      }
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  batchAssignUsersToGroup: async (req, res) => {
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
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }
      const responseFromBatchAssignUsersToGroup =
        await controlAccessUtil.batchAssignUsersToGroup(request);

      if (responseFromBatchAssignUsersToGroup.success === true) {
        const status = responseFromBatchAssignUsersToGroup.status
          ? responseFromBatchAssignUsersToGroup.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromBatchAssignUsersToGroup.message
            ? responseFromBatchAssignUsersToGroup.message
            : "",
          unassigned_user_from_group: responseFromBatchAssignUsersToGroup.data
            ? responseFromBatchAssignUsersToGroup.data
            : [],
        });
      } else if (responseFromBatchAssignUsersToGroup.success === false) {
        const status = responseFromBatchAssignUsersToGroup.status
          ? responseFromBatchAssignUsersToGroup.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromBatchAssignUsersToGroup.message
            ? responseFromBatchAssignUsersToGroup.message
            : "",
          errors: responseFromBatchAssignUsersToGroup.errors
            ? responseFromBatchAssignUsersToGroup.errors
            : { message: "" },
        });
      }
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createGroup;
