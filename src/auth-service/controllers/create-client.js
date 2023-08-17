const { validationResult } = require("express-validator");
const controlAccessUtil = require("@utils/control-access");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const { logText, logElement, logObject, logError } = require("@utils/log");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-client-controller`
);

const createClient = {
  create: async (req, res) => {
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
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }

      const responseFromCreateClient = await controlAccessUtil.createClient(
        request
      );

      logObject("responseFromCreateClient", responseFromCreateClient);

      if (responseFromCreateClient.success === true) {
        const status = responseFromCreateClient.status
          ? responseFromCreateClient.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateClient.message
            ? responseFromCreateClient.message
            : "",
          created_client: responseFromCreateClient.data
            ? responseFromCreateClient.data
            : [],
        });
      } else if (responseFromCreateClient.success === false) {
        const status = responseFromCreateClient.status
          ? responseFromCreateClient.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateClient.message
            ? responseFromCreateClient.message
            : "",
          errors: responseFromCreateClient.errors
            ? responseFromCreateClient.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

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
      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        request.query.tenant = constants.DEFAULT_TENANT || "airqo";
      }
      const responseFromListClients = await controlAccessUtil.listClient(
        request
      );
      logObject("responseFromListClients", responseFromListClients);
      if (responseFromListClients.success === true) {
        const status = responseFromListClients.status
          ? responseFromListClients.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListClients.message
            ? responseFromListClients.message
            : "",
          clients: responseFromListClients.data
            ? responseFromListClients.data
            : [],
        });
      } else if (responseFromListClients.success === false) {
        const status = responseFromListClients.status
          ? responseFromListClients.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListClients.message
            ? responseFromListClients.message
            : "",
          errors: responseFromListClients.errors
            ? responseFromListClients.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
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
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }
      const responseFromDeleteClient = await controlAccessUtil.deleteClient(
        request
      );

      if (responseFromDeleteClient.success === true) {
        const status = responseFromDeleteClient.status
          ? responseFromDeleteClient.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeleteClient.message
            ? responseFromDeleteClient.message
            : "",
          deleted_client: responseFromDeleteClient.data
            ? responseFromDeleteClient.data
            : [],
        });
      } else if (responseFromDeleteClient.success === false) {
        const status = responseFromDeleteClient.status
          ? responseFromDeleteClient.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeleteClient.message
            ? responseFromDeleteClient.message
            : "",
          errors: responseFromDeleteClient.errors
            ? responseFromDeleteClient.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
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
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }
      const responseFromUpdateClient = await controlAccessUtil.updateClient(
        request
      );

      if (responseFromUpdateClient.success === true) {
        const status = responseFromUpdateClient.status
          ? responseFromUpdateClient.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateClient.message
            ? responseFromUpdateClient.message
            : "",
          updated_client: responseFromUpdateClient.data
            ? responseFromUpdateClient.data
            : [],
        });
      } else if (responseFromUpdateClient.success === false) {
        const status = responseFromUpdateClient.status
          ? responseFromUpdateClient.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateClient.message
            ? responseFromUpdateClient.message
            : "",
          errors: responseFromUpdateClient.errors
            ? responseFromUpdateClient.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  updateClientSecret: async (req, res) => {
    try {
      logText("I am patching....");
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

      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        request.query.tenant = constants.DEFAULT_TENANT || "airqo";
      }
      const responseFromUpdateClient =
        await controlAccessUtil.updateClientSecret(request);

      logObject("responseFromUpdateClient", responseFromUpdateClient);

      if (responseFromUpdateClient.success === true) {
        const status = responseFromUpdateClient.status
          ? responseFromUpdateClient.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateClient.message
            ? responseFromUpdateClient.message
            : "",
          updated_client_secret: responseFromUpdateClient.data
            ? responseFromUpdateClient.data
            : [],
        });
      } else if (responseFromUpdateClient.success === false) {
        const status = responseFromUpdateClient.status
          ? responseFromUpdateClient.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateClient.message
            ? responseFromUpdateClient.message
            : "",
          errors: responseFromUpdateClient.errors
            ? responseFromUpdateClient.errors
            : { message: "Internal Server Errors" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createClient;
