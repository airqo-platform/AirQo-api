const httpStatus = require("http-status");
const { logText } = require("@utils/log");
const createChecklistUtil = require("@utils/create-checklist");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- checklists-controller`
);
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");

const checklists = {
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

      const responseFromUpdateChecklist = await createChecklistUtil.update(
        request,
        next
      );

      if (responseFromUpdateChecklist.success === true) {
        const status = responseFromUpdateChecklist.status
          ? responseFromUpdateChecklist.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromUpdateChecklist.message,
          checklist: responseFromUpdateChecklist.data,
        });
      } else if (responseFromUpdateChecklist.success === false) {
        const status = responseFromUpdateChecklist.status
          ? responseFromUpdateChecklist.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromUpdateChecklist.message,
          checklist: responseFromUpdateChecklist.data,
          errors: responseFromUpdateChecklist.errors
            ? responseFromUpdateChecklist.errors
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

      const responseFromCreateChecklist = await createChecklistUtil.create(
        request,
        next
      );

      if (responseFromCreateChecklist.success === true) {
        const status = responseFromCreateChecklist.status
          ? responseFromCreateChecklist.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromCreateChecklist.message,
          checklist: responseFromCreateChecklist.data,
        });
      } else if (responseFromCreateChecklist.success === false) {
        const status = responseFromCreateChecklist.status
          ? responseFromCreateChecklist.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromCreateChecklist.message,
          checklist: responseFromCreateChecklist.data,
          errors: responseFromCreateChecklist.errors
            ? responseFromCreateChecklist.errors
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
  upsert: async (req, res, next) => {
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

      const responseFromCreateChecklist = await createChecklistUtil.upsert(
        request,
        next
      );

      if (responseFromCreateChecklist.success === true) {
        const status = responseFromCreateChecklist.status
          ? responseFromCreateChecklist.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromCreateChecklist.message,
          checklist: responseFromCreateChecklist.data,
        });
      } else if (responseFromCreateChecklist.success === false) {
        const status = responseFromCreateChecklist.status
          ? responseFromCreateChecklist.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromCreateChecklist.message,
          checklist: responseFromCreateChecklist.data,
          errors: responseFromCreateChecklist.errors
            ? responseFromCreateChecklist.errors
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
      logText(".....................................");
      logText("list all checklists by query params provided");
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

      const responseFromListChecklists = await createChecklistUtil.list(
        request,
        next
      );

      if (responseFromListChecklists.success === true) {
        const status = responseFromListChecklists.status
          ? responseFromListChecklists.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListChecklists.message,
          checklists: responseFromListChecklists.data,
        });
      } else if (responseFromListChecklists.success === false) {
        const status = responseFromListChecklists.status
          ? responseFromListChecklists.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListChecklists.message,
          errors: responseFromListChecklists.errors
            ? responseFromListChecklists.errors
            : "",
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
      logText("deleting checklist..........");
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

      const responseFromDeleteChecklist = await createChecklistUtil.delete(
        request,
        next
      );

      if (responseFromDeleteChecklist.success === true) {
        const status = responseFromDeleteChecklist.status
          ? responseFromDeleteChecklist.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeleteChecklist.message,
          checklist: responseFromDeleteChecklist.data,
        });
      } else if (responseFromDeleteChecklist.success === false) {
        const status = responseFromDeleteChecklist.status
          ? responseFromDeleteChecklist.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeleteChecklist.message,
          checklist: responseFromDeleteChecklist.data,
          errors: responseFromDeleteChecklist.errors
            ? responseFromDeleteChecklist.errors
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

module.exports = checklists;
