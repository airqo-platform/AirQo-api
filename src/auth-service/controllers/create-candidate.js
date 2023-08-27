const httpStatus = require("http-status");
const requestAccessUtil = require("@utils/create-candidate");
const generateFilter = require("@utils/generate-filter");
const { validationResult } = require("express-validator");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-candidate-controller`
);
const { logText, logObject, logElement } = require("@utils/log");

const requestAccess = {
  create: async (req, res) => {
    try {
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
      let request = Object.assign({}, req.body);
      request["tenant"] = tenant.toLowerCase();

      await requestAccessUtil
        .create(request, (value) => {
          if (value.success === true) {
            const status = value.status ? value.status : httpStatus.OK;
            return res.status(status).json({
              success: true,
              message: value.message,
              candidate: value.data,
            });
          } else if (value.success === false) {
            const status = value.status
              ? value.status
              : httpStatus.INTERNAL_SERVER_ERROR;
            const errors = value.errors ? value.errors : { message: "" };
            return res.status(status).json({
              success: false,
              message: value.message,
              errors,
            });
          }
        })
        .catch((error) => {
          logger.error(`Internal Server Error ${JSON.stringify(error)}`);
          res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal Server Error",
            errors: { message: error },
          });
        });
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  list: async (req, res) => {
    try {
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

      const responseFromListCandidate = await requestAccessUtil.list(request);
      logObject("responseFromListCandidate", responseFromListCandidate);
      if (responseFromListCandidate.success === true) {
        const status = responseFromListCandidate.status
          ? responseFromListCandidate.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListCandidate.message,
          candidates: responseFromListCandidate.data,
        });
      } else if (responseFromListCandidate.success === false) {
        const status = responseFromListCandidate.status
          ? responseFromListCandidate.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromListCandidate.message,
          error: responseFromListCandidate.error
            ? responseFromListCandidate.error
            : "",
          errors: responseFromListCandidate.errors
            ? responseFromListCandidate.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (e) {
      logger.error(`Internal Server Error ${e.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
      });
    }
  },
  confirm: async (req, res) => {
    logText("inside the confirm candidate......");
    try {
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
      const responseFromFilter = generateFilter.candidates(req);
      logObject("responseFromFilter", responseFromFilter);

      if (responseFromFilter.success === false) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: responseFromFilter.message,
          error: responseFromFilter.error ? responseFromFilter.error : "",
          errors: responseFromFilter.errors
            ? responseFromFilter.errors
            : { message: "Internal Server Error" },
        });
      }

      const filter = responseFromFilter.data;
      logObject("the filter in controller", filter);
      let request = Object.assign({}, req.body);
      request["tenant"] = tenant.toLowerCase();
      request["filter"] = filter;
      const responseFromConfirmCandidate = await requestAccessUtil.confirm(
        request
      );

      logObject("responseFromConfirmCandidate", responseFromConfirmCandidate);
      if (responseFromConfirmCandidate.success === true) {
        const status = responseFromConfirmCandidate.status
          ? responseFromConfirmCandidate.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromConfirmCandidate.message,
          user: responseFromConfirmCandidate.data,
        });
      } else if (responseFromConfirmCandidate.success === false) {
        const status = responseFromConfirmCandidate.status
          ? responseFromConfirmCandidate.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromConfirmCandidate.message,
          error: responseFromConfirmCandidate.error
            ? responseFromConfirmCandidate.error
            : "",
          errors: responseFromConfirmCandidate.errors
            ? responseFromConfirmCandidate.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (e) {
      logger.error(`Internal Server Error ${e.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
      });
    }
  },
  delete: async (req, res) => {
    try {
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
      const request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromDeleteCandidate = await requestAccessUtil.delete(
        request
      );

      if (responseFromDeleteCandidate.success === true) {
        const status = responseFromDeleteCandidate.status
          ? responseFromDeleteCandidate.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeleteCandidate.message,
          candidate: responseFromDeleteCandidate.data,
        });
      } else if (responseFromDeleteCandidate.success === false) {
        const status = responseFromDeleteCandidate.status
          ? responseFromDeleteCandidate.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeleteCandidate.message,
          candidate: responseFromDeleteCandidate.data,
          error: responseFromDeleteCandidate.error
            ? responseFromDeleteCandidate.error
            : "",
          errors: responseFromDeleteCandidate.errors
            ? responseFromDeleteCandidate.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        error: error.message,
        errors: { message: error.message },
      });
    }
  },
  update: async (req, res) => {
    try {
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

      const responseFromUpdateCandidate = await requestAccessUtil.update(
        request
      );

      logObject("responseFromUpdateCandidate", responseFromUpdateCandidate);
      if (responseFromUpdateCandidate.success === true) {
        return res.status(httpStatus.OK).json({
          success: true,
          message: responseFromUpdateCandidate.message,
          candidate: responseFromUpdateCandidate.data,
        });
      } else if (responseFromUpdateCandidate.success === false) {
        const status = responseFromUpdateCandidate.status
          ? responseFromUpdateCandidate.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateCandidate.message,
          candidate: responseFromUpdateCandidate.data,
          error: responseFromUpdateCandidate.error
            ? responseFromUpdateCandidate.error
            : "",
          errors: responseFromUpdateCandidate.errors
            ? responseFromUpdateCandidate.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        error: error.message,
        errors: { message: error.message },
      });
    }
  },
};

module.exports = requestAccess;
