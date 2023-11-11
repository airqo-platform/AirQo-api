const httpStatus = require("http-status");
const { validationResult } = require("express-validator");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const controlAccessUtil = require("@utils/control-access");
const { logText, logElement, logObject, logError } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-user-type-controller`
);

const createUserType = {
  listUsersWithUserType: async (req, res) => {
    try {
      const { query } = req;
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
      if (isEmpty(query.tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT || "airqo";
      }

      const responseFromListUsersWithUserType =
        await controlAccessUtil.listUsersWithUserType(request);

      logObject(
        "responseFromListUsersWithUserType",
        responseFromListUsersWithUserType
      );

      if (responseFromListUsersWithUserType.success === true) {
        const status = responseFromListUsersWithUserType.status
          ? responseFromListUsersWithUserType.status
          : httpStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromListUsersWithUserType.message,
          users_with_role: responseFromListUsersWithUserType.data,
        });
      } else if (responseFromListUsersWithUserType.success === false) {
        const status = responseFromListUsersWithUserType.status
          ? responseFromListUsersWithUserType.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        res.status(status).json({
          success: false,
          message: responseFromListUsersWithUserType.message,
          errors: responseFromListUsersWithUserType.errors
            ? responseFromListUsersWithUserType.errors
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
  listAvailableUsersForUserType: async (req, res) => {
    try {
      const { query, body } = req;
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

      if (isEmpty(query.tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT || "airqo";
      }

      const responseFromListAvailableUsersForUserType =
        await controlAccessUtil.listAvailableUsersForUserType(request);

      if (responseFromListAvailableUsersForUserType.success === true) {
        const status = responseFromListAvailableUsersForUserType.status
          ? responseFromListAvailableUsersForUserType.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: "successfully listed the available users",
          available_users: responseFromListAvailableUsersForUserType.data,
        });
      } else if (responseFromListAvailableUsersForUserType.success === false) {
        const status = responseFromListAvailableUsersForUserType.status
          ? responseFromListAvailableUsersForUserType.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListAvailableUsersForUserType.message,
          errors: responseFromListAvailableUsersForUserType.errors
            ? responseFromListAvailableUsersForUserType.errors
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
  assignUserType: async (req, res) => {
    try {
      logText("assignUserToRole...");
      const { query, body } = req;
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
      if (isEmpty(query.tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT || "airqo";
      }

      const responseFromAssignUserToUserType =
        await controlAccessUtil.assignUserType(request);

      if (responseFromAssignUserToUserType.success === true) {
        const status = responseFromAssignUserToUserType.status
          ? responseFromAssignUserToUserType.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          updated_records: responseFromAssignUserToUserType.data,
        });
      } else if (responseFromAssignUserToUserType.success === false) {
        const status = responseFromAssignUserToUserType.status
          ? responseFromAssignUserToUserType.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromAssignUserToUserType.message,
          errors: responseFromAssignUserToUserType.errors
            ? responseFromAssignUserToUserType.errors
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
  assignManyUsersToUserType: async (req, res) => {
    try {
      logText("assignManyUsersToRole...");
      const { query, body } = req;
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
      if (isEmpty(query.tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT || "airqo";
      }

      const responseFromAssignManyUsersToUserType =
        await controlAccessUtil.assignManyUsersToUserType(request);

      if (responseFromAssignManyUsersToUserType.success === true) {
        const status = responseFromAssignManyUsersToUserType.status
          ? responseFromAssignManyUsersToUserType.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromAssignManyUsersToUserType.message,
          updated_records: responseFromAssignManyUsersToUserType.data,
        });
      } else if (responseFromAssignManyUsersToUserType.success === false) {
        const status = responseFromAssignManyUsersToUserType.status
          ? responseFromAssignManyUsersToUserType.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromAssignManyUsersToUserType.message,
          errors: responseFromAssignManyUsersToUserType.errors
            ? responseFromAssignManyUsersToUserType.errors
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
};

module.exports = createUserType;
