const httpStatus = require("http-status");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const controlAccessUtil = require("@utils/control-access");
const { logText } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-user-type-controller`
);

const createUserType = {
  listUsersWithUserType: async (req, res, next) => {
    try {
      logText("we are listing users with type....");
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

      const responseFromListUsersWithUserType =
        await controlAccessUtil.listUsersWithUserType(request, next);

      if (responseFromListUsersWithUserType.success === true) {
        const status = responseFromListUsersWithUserType.status
          ? responseFromListUsersWithUserType.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListUsersWithUserType.message,
          users_with_user_type: responseFromListUsersWithUserType.data,
        });
      } else if (responseFromListUsersWithUserType.success === false) {
        const status = responseFromListUsersWithUserType.status
          ? responseFromListUsersWithUserType.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListUsersWithUserType.message,
          errors: responseFromListUsersWithUserType.errors
            ? responseFromListUsersWithUserType.errors
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
  listAvailableUsersForUserType: async (req, res, next) => {
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

      const responseFromListAvailableUsersForUserType =
        await controlAccessUtil.listAvailableUsersForUserType(request, next);

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
  assignUserType: async (req, res, next) => {
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

      const responseFromAssignUserToUserType =
        await controlAccessUtil.assignUserType(request, next);

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
  assignManyUsersToUserType: async (req, res, next) => {
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

      const responseFromAssignManyUsersToUserType =
        await controlAccessUtil.assignManyUsersToUserType(request, next);

      if (responseFromAssignManyUsersToUserType.success === true) {
        const status = responseFromAssignManyUsersToUserType.status
          ? responseFromAssignManyUsersToUserType.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromAssignManyUsersToUserType.message,
          user_type_assignments: responseFromAssignManyUsersToUserType.data,
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

module.exports = createUserType;
