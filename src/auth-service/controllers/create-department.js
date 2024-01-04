const httpStatus = require("http-status");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const controlAccessUtil = require("@utils/control-access");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- department-controller`
);

const createDepartment = {
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

      const responseFromListDepartment = await controlAccessUtil.listDepartment(
        request,
        next
      );

      if (responseFromListDepartment.success === true) {
        const status = responseFromListDepartment.status
          ? responseFromListDepartment.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListDepartment.message
            ? responseFromListDepartment.message
            : "",
          departments: responseFromListDepartment.data,
        });
      } else if (responseFromListDepartment.success === false) {
        const status = responseFromListDepartment.status
          ? responseFromListDepartment.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListDepartment.message
            ? responseFromListDepartment.message
            : "",
          errors: responseFromListDepartment.errors
            ? responseFromListDepartment.errors
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

      const responseFromCreateDepartment =
        await controlAccessUtil.createDepartment(request, next);

      if (responseFromCreateDepartment.success === true) {
        const status = responseFromCreateDepartment.status
          ? responseFromCreateDepartment.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateDepartment.message
            ? responseFromCreateDepartment.message
            : "",
          created_department: responseFromCreateDepartment.data
            ? responseFromCreateDepartment.data
            : [],
        });
      } else if (responseFromCreateDepartment.success === false) {
        const status = responseFromCreateDepartment.status
          ? responseFromCreateDepartment.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateDepartment.message
            ? responseFromCreateDepartment.message
            : "",
          errors: responseFromCreateDepartment.errors
            ? responseFromCreateDepartment.errors
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

      const responseFromUpdateDepartment =
        await controlAccessUtil.updateDepartment(request, next);
      if (responseFromUpdateDepartment.success === true) {
        const status = responseFromUpdateDepartment.status
          ? responseFromUpdateDepartment.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateDepartment.message
            ? responseFromUpdateDepartment.message
            : "",
          updated_department: responseFromUpdateDepartment.data
            ? responseFromUpdateDepartment.data
            : [],
        });
      } else if (responseFromUpdateDepartment.success === false) {
        const status = responseFromUpdateDepartment.status
          ? responseFromUpdateDepartment.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateDepartment.message
            ? responseFromUpdateDepartment.message
            : "",
          errors: responseFromUpdateDepartment.errors
            ? responseFromUpdateDepartment.errors
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

      const responseFromDeleteDepartment =
        await controlAccessUtil.deleteDepartment(request, next);
      if (responseFromDeleteDepartment.success === true) {
        const status = responseFromDeleteDepartment.status
          ? responseFromDeleteDepartment.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeleteDepartment.message
            ? responseFromDeleteDepartment.message
            : "",
          deleted_department: responseFromDeleteDepartment.data
            ? responseFromDeleteDepartment.data
            : [],
        });
      } else if (responseFromDeleteDepartment.success === false) {
        const status = responseFromDeleteDepartment.status
          ? responseFromDeleteDepartment.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeleteDepartment.message
            ? responseFromDeleteDepartment.message
            : "",
          errors: responseFromDeleteDepartment.errors
            ? responseFromDeleteDepartment.errors
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
  listUsersWithDepartment: async (req, res, next) => {
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

      const responseFromListUsersWithDepartment =
        await controlAccessUtil.listUsersWithDepartment(request, next);

      if (responseFromListUsersWithDepartment.success === true) {
        const status = responseFromListUsersWithDepartment.status
          ? responseFromListUsersWithDepartment.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListUsersWithDepartment.message
            ? responseFromListUsersWithDepartment.message
            : "",
          users_with_department: responseFromListUsersWithDepartment.data
            ? responseFromListUsersWithDepartment.data
            : [],
        });
      } else if (responseFromListUsersWithDepartment.success === false) {
        const status = responseFromListUsersWithDepartment.status
          ? responseFromListUsersWithDepartment.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListUsersWithDepartment.message
            ? responseFromListUsersWithDepartment.message
            : "",
          errors: responseFromListUsersWithDepartment.errors
            ? responseFromListUsersWithDepartment.errors
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
  listAvailableUsersForDepartment: async (req, res, next) => {
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

      const responseFromListAvailableUsersForDepartment =
        await controlAccessUtil.listAvailableUsersForDepartment(request, next);

      if (responseFromListAvailableUsersForDepartment.success === true) {
        const status = responseFromListAvailableUsersForDepartment.status
          ? responseFromListAvailableUsersForDepartment.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListAvailableUsersForDepartment.message
            ? responseFromListAvailableUsersForDepartment.message
            : "",
          available_department_users:
            responseFromListAvailableUsersForDepartment.data
              ? responseFromListAvailableUsersForDepartment.data
              : [],
        });
      } else if (
        responseFromListAvailableUsersForDepartment.success === false
      ) {
        const status = responseFromListAvailableUsersForDepartment.status
          ? responseFromListAvailableUsersForDepartment.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListAvailableUsersForDepartment.message
            ? responseFromListAvailableUsersForDepartment.message
            : "",
          errors: responseFromListAvailableUsersForDepartment.errors
            ? responseFromListAvailableUsersForDepartment.errors
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
  assignUserToDepartment: async (req, res, next) => {
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

      const responseFromAssignUserToDepartment =
        await controlAccessUtil.assignUserToDepartment(request, next);
      if (responseFromAssignUserToDepartment.success === true) {
        const status = responseFromAssignUserToDepartment.status
          ? responseFromAssignUserToDepartment.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromAssignUserToDepartment.message
            ? responseFromAssignUserToDepartment.message
            : "",
          assigned_department_user: responseFromAssignUserToDepartment.data
            ? responseFromAssignUserToDepartment.data
            : [],
        });
      } else if (responseFromAssignUserToDepartment.success === false) {
        const status = responseFromAssignUserToDepartment.status
          ? responseFromAssignUserToDepartment.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromAssignUserToDepartment.message
            ? responseFromAssignUserToDepartment.message
            : "",
          errors: responseFromAssignUserToDepartment.errors
            ? responseFromAssignUserToDepartment.errors
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
  unAssignUserFromDepartment: async (req, res, next) => {
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

      const responseFromUnAssignUserFromDepartment =
        await controlAccessUtil.unAssignUserFromDepartment(request, next);
      if (responseFromUnAssignUserFromDepartment.success === true) {
        const status = responseFromUnAssignUserFromDepartment.status
          ? responseFromUnAssignUserFromDepartment.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUnAssignUserFromDepartment.message
            ? responseFromUnAssignUserFromDepartment.message
            : "",
          unassigned_department_user:
            responseFromUnAssignUserFromDepartment.data
              ? responseFromUnAssignUserFromDepartment.data
              : [],
        });
      } else if (responseFromUnAssignUserFromDepartment.success === false) {
        const status = responseFromUnAssignUserFromDepartment.status
          ? responseFromUnAssignUserFromDepartment.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUnAssignUserFromDepartment.message
            ? responseFromUnAssignUserFromDepartment.message
            : "",
          errors: responseFromUnAssignUserFromDepartment.errors
            ? responseFromUnAssignUserFromDepartment.errors
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

module.exports = createDepartment;
