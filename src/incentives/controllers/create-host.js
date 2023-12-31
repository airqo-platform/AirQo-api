const httpStatus = require("http-status");
const { logObject, logElement, logText } = require("@utils/log");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const createHostUtil = require("@utils/create-host");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-host-controller`
);
const isEmpty = require("is-empty");

const createHost = {
  create: async (req, res, next) => {
    logText("registering host.............");
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromCreateHost = await createHostUtil.create(request, next);
      logObject("responseFromCreateHost in controller", responseFromCreateHost);
      if (responseFromCreateHost.success === true) {
        let status = responseFromCreateHost.status
          ? responseFromCreateHost.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateHost.message,
          created_host: responseFromCreateHost.data,
        });
      } else if (responseFromCreateHost.success === false) {
        const status = responseFromCreateHost.status
          ? responseFromCreateHost.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateHost.message,
          errors: responseFromCreateHost.errors
            ? responseFromCreateHost.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  delete: async (req, res, next) => {
    try {
      logText(".................................................");
      logText("inside delete host............");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromRemoveHost = await createHostUtil.delete(request, next);

      logObject("responseFromRemoveHost", responseFromRemoveHost);

      if (responseFromRemoveHost.success === true) {
        const status = responseFromRemoveHost.status
          ? responseFromRemoveHost.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveHost.message,
          removed_host: responseFromRemoveHost.data,
        });
      } else if (responseFromRemoveHost.success === false) {
        const status = responseFromRemoveHost.status
          ? responseFromRemoveHost.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveHost.message,
          errors: responseFromRemoveHost.errors
            ? responseFromRemoveHost.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  update: async (req, res, next) => {
    try {
      logText("updating host................");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromUpdateHost = await createHostUtil.update(request, next);
      logObject("responseFromUpdateHost", responseFromUpdateHost);
      if (responseFromUpdateHost.success === true) {
        const status = responseFromUpdateHost.status
          ? responseFromUpdateHost.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateHost.message,
          updated_host: responseFromUpdateHost.data,
        });
      } else if (responseFromUpdateHost.success === false) {
        const status = responseFromUpdateHost.status
          ? responseFromUpdateHost.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateHost.message,
          errors: responseFromUpdateHost.errors
            ? responseFromUpdateHost.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  list: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all hosts by query params provided");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromListHosts = await createHostUtil.list(request, next);
      logElement(
        "has the response for listing hosts been successful?",
        responseFromListHosts.success
      );
      if (responseFromListHosts.success === true) {
        const status = responseFromListHosts.status
          ? responseFromListHosts.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListHosts.message,
          hosts: responseFromListHosts.data,
        });
      } else if (responseFromListHosts.success === false) {
        const status = responseFromListHosts.status
          ? responseFromListHosts.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListHosts.message,
          errors: responseFromListHosts.errors
            ? responseFromListHosts.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
};

module.exports = createHost;
