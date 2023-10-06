const HTTPStatus = require("http-status");
const { logObject, logElement, logText } = require("@utils/log");
const errors = require("@utils/errors");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-health-tip-controller`
);
const { validationResult } = require("express-validator");
const createHealthTipUtil = require("@utils/create-health-tips");
const isEmpty = require("is-empty");

const createHealthTips = {
  list: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { body, query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = {};
      request["body"] = body;
      request["query"] = query;
      request["query"]["tenant"] = tenant;
      const responseFromListHealthTip = await createHealthTipUtil.list(request);
      logObject(
        "responseFromListHealthTip in controller",
        responseFromListHealthTip
      );

      if (responseFromListHealthTip.success === true) {
        const status = responseFromListHealthTip.status
          ? responseFromListHealthTip.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListHealthTip.message,
          tips: responseFromListHealthTip.data,
        });
      } else if (responseFromListHealthTip.success === false) {
        const status = responseFromListHealthTip.status
          ? responseFromListHealthTip.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListHealthTip.message,
          errors: responseFromListHealthTip.errors
            ? responseFromListHealthTip.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  create: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      logElement("hasErrors", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { body, query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = {};
      request["body"] = body;
      request["query"] = query;
      request["query"]["tenant"] = tenant;

      const responseFromCreateHealthTip = await createHealthTipUtil.create(
        request
      );
      logObject("responseFromCreateHealthTip", responseFromCreateHealthTip);
      if (responseFromCreateHealthTip.success === true) {
        const status = responseFromCreateHealthTip.status
          ? responseFromCreateHealthTip.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromCreateHealthTip.message,
          created_tip: responseFromCreateHealthTip.data
            ? responseFromCreateHealthTip.data
            : [],
        });
      } else if (responseFromCreateHealthTip.success === false) {
        const status = responseFromCreateHealthTip.status
          ? responseFromCreateHealthTip.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromCreateHealthTip.message,
          errors: responseFromCreateHealthTip.errors
            ? responseFromCreateHealthTip.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  delete: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { body, query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = {};
      request["body"] = body;
      request["query"] = query;
      request["query"]["tenant"] = tenant;
      const responseFromDeleteHealthTip = await createHealthTipUtil.delete(
        request
      );

      logObject("responseFromDeleteHealthTip", responseFromDeleteHealthTip);

      if (responseFromDeleteHealthTip.success === true) {
        const status = responseFromDeleteHealthTip.status
          ? responseFromDeleteHealthTip.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromDeleteHealthTip.message,
          deleted_tip: responseFromDeleteHealthTip.data,
        });
      } else if (responseFromDeleteHealthTip.success === false) {
        const status = responseFromDeleteHealthTip.status
          ? responseFromDeleteHealthTip.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromDeleteHealthTip.message,
          errors: responseFromDeleteHealthTip.errors
            ? responseFromDeleteHealthTip.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  update: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { body, query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = {};
      request["body"] = body;
      request["query"] = query;
      request["query"]["tenant"] = tenant;

      const responseFromUpdateHealthTip = await createHealthTipUtil.update(
        request
      );

      logObject("responseFromUpdateHealthTip", responseFromUpdateHealthTip);

      if (responseFromUpdateHealthTip.success === true) {
        const status = responseFromUpdateHealthTip.status
          ? responseFromUpdateHealthTip.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromUpdateHealthTip.message,
          updated_tip: responseFromUpdateHealthTip.data,
        });
      } else if (responseFromUpdateHealthTip.success === false) {
        const status = responseFromUpdateHealthTip.status
          ? responseFromUpdateHealthTip.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromUpdateHealthTip.message,
          errors: responseFromUpdateHealthTip.errors
            ? responseFromUpdateHealthTip.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createHealthTips;
