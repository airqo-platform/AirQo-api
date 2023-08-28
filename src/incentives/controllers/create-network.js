const httpStatus = require("http-status");
const { logObject, logElement, logText } = require("@utils/log");
const { validationResult } = require("express-validator");
const errors = require("@utils/errors");
const createNetworkUtil = require("@utils/create-network");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-network-controller`
);
const isEmpty = require("is-empty");

const createNetwork = {
  create: async (req, res) => {
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
          logger.error(`Internal Server Error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK || "airqo";
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromCreateNetwork = await createNetworkUtil.create(request);
      logObject(
        "responseFromCreateNetwork in controller",
        responseFromCreateNetwork
      );
      if (responseFromCreateNetwork.success === true) {
        const status = responseFromCreateNetwork.status
          ? responseFromCreateNetwork.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateNetwork.message,
          new_network: responseFromCreateNetwork.data,
        });
      } else if (responseFromCreateNetwork.success === false) {
        const status = responseFromCreateNetwork.status
          ? responseFromCreateNetwork.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromCreateNetwork.message,
          errors: responseFromCreateNetwork.errors
            ? responseFromCreateNetwork.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${error.message}`);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
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
        try {
          logger.error(
            `input validation errors ${JSON.stringify(
              errors.convertErrorArrayToObject(nestedErrors)
            )}`
          );
        } catch (e) {
          logger.error(`Internal Server Error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK || "airqo";
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromListNetworks = await createNetworkUtil.list(request);
      logElement(
        "has the response for listing cohorts been successful?",
        responseFromListNetworks.success
      );
      if (responseFromListNetworks.success === true) {
        const status = responseFromListNetworks.status
          ? responseFromListNetworks.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListNetworks.message,
          networks: responseFromListNetworks.data,
        });
      } else if (responseFromListNetworks.success === false) {
        const status = responseFromListNetworks.status
          ? responseFromListNetworks.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListNetworks.message,
          errors: responseFromListNetworks.errors
            ? responseFromListNetworks.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
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
          logger.error(`Internal Server Error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK || "airqo";
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromUpdateNetwork = await createNetworkUtil.update(request);
      logObject("responseFromUpdateNetwork", responseFromUpdateNetwork);
      if (responseFromUpdateNetwork.success === true) {
        const status = responseFromUpdateNetwork.status
          ? responseFromUpdateNetwork.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateNetwork.message,
          updated_network: responseFromUpdateNetwork.data,
        });
      } else if (responseFromUpdateNetwork.success === false) {
        const status = responseFromUpdateNetwork.status
          ? responseFromUpdateNetwork.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateNetwork.message,
          errors: responseFromUpdateNetwork.errors
            ? responseFromUpdateNetwork.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
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
          logger.error(`Internal Server Error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK || "airqo";
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromRemoveNetwork = await createNetworkUtil.delete(request);

      if (responseFromRemoveNetwork.success === true) {
        const status = responseFromRemoveNetwork.status
          ? responseFromRemoveNetwork.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveNetwork.message,
          deleted_network: responseFromRemoveNetwork.data,
        });
      } else if (responseFromRemoveNetwork.success === false) {
        const status = responseFromRemoveNetwork.status
          ? responseFromRemoveNetwork.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveNetwork.message,
          errors: responseFromRemoveNetwork.errors
            ? responseFromRemoveNetwork.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createNetwork;
