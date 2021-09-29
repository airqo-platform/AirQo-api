const HTTPStatus = require("http-status");
const { logObject, logElement, logText } = require("../utils/log");
const { validationResult } = require("express-validator");
const { tryCatchErrors, badRequest } = require("../utils/errors");
const createHostUtil = require("../utils/create-host");
const log4js = require("log4js");
const logger = log4js.getLogger("create-host-util");
const transformDataUtil = require("../utils/transform-data");

const createHost = {
  register: async (req, res) => {
    let request = {};
    let { body } = req;
    let { query } = req;
    logText("registering host.............");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          transformDataUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { tenant } = req.query;
      request["body"] = body;
      request["query"] = query;

      let responseFromCreateHost = await createHostUtil.create(request);
      logObject("responseFromCreateHost in controller", responseFromCreateHost);
      if (responseFromCreateHost.success === true) {
        let status = responseFromCreateHost.status
          ? responseFromCreateHost.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateHost.message,
          created_host: responseFromCreateHost.data,
        });
      }

      if (responseFromCreateHost.success === false) {
        let status = responseFromCreateHost.status
          ? responseFromCreateHost.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        let errors = responseFromCreateHost.errors
          ? responseFromCreateHost.errors
          : "";

        return res.status(status).json({
          success: false,
          message: responseFromCreateHost.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  delete: async (req, res) => {
    try {
      const { query } = req;
      let request = {};

      logText(".................................................");
      logText("inside delete host............");
      const { tenant } = req.query;
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          transformDataUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      request["query"] = query;
      let responseFromRemoveHost = await createHostUtil.delete(request);

      if (responseFromRemoveHost.success === true) {
        let status = responseFromRemoveHost.status
          ? responseFromRemoveHost.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveHost.message,
          host: responseFromRemoveHost.data,
        });
      }

      if (responseFromRemoveHost.success === false) {
        let errors = responseFromRemoveHost.errors
          ? responseFromRemoveHost.errors
          : "";
        let status = responseFromRemoveHost.status
          ? responseFromRemoveHost.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveHost.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  update: async (req, res) => {
    try {
      let request = {};
      let { body } = req;
      let { query } = req;
      logText("updating host................");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          transformDataUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      request["body"] = body;
      request["query"] = query;
      let responseFromUpdateHost = await createHostUtil.update(request);
      logObject("responseFromUpdateHost", responseFromUpdateHost);
      if (responseFromUpdateHost.success === true) {
        let status = responseFromUpdateHost.status
          ? responseFromUpdateHost.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateHost.message,
          host: responseFromUpdateHost.data,
        });
      }

      if (responseFromUpdateHost.success === false) {
        let errors = responseFromUpdateHost.errors
          ? responseFromUpdateHost.errors
          : "";

        let status = responseFromUpdateHost.status
          ? responseFromUpdateHost.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateHost.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  list: async (req, res) => {
    try {
      const { query } = req;
      let request = {};
      logText(".....................................");
      logText("list all hosts by query params provided");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          transformDataUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      request["query"] = query;
      let responseFromListHosts = await createHostUtil.list(request);
      logElement(
        "has the response for listing hosts been successful?",
        responseFromListHosts.success
      );
      if (responseFromListHosts.success === true) {
        let status = responseFromListHosts.status
          ? responseFromListHosts.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListHosts.message,
          hosts: responseFromListHosts.data,
        });
      }

      if (responseFromListHosts.success === false) {
        let errors = responseFromListHosts.errors
          ? responseFromListHosts.errors
          : "";
        let status = responseFromListHosts.status
          ? responseFromListHosts.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListHosts.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  delete: async (req, res) => {
    try {
      const { query } = req;
      const { body } = req;
      let request = {};
      logText(".................................................");
      logText("inside delete host............");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          transformDataUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      request["query"] = query;
      request["body"] = body;
      let responseFromRemoveHost = await createHostUtil.delete(request);

      if (responseFromRemoveHost.success === true) {
        let status = responseFromRemoveHost.status
          ? responseFromRemoveHost.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveHost.message,
          host: responseFromRemoveHost.data,
        });
      }

      if (responseFromRemoveHost.success === false) {
        let errors = responseFromRemoveHost.errors
          ? responseFromRemoveHost.errors
          : "";
        let status = responseFromRemoveHost.status
          ? responseFromRemoveHost.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveHost.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createHost;
