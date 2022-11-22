const { logElement, logText, logObject } = require("../utils/log");
const HTTPStatus = require("http-status");
const createNetworkUtil = require("../utils/create-network");
const { validationResult } = require("express-validator");
const { badRequest, convertErrorArrayToObject } = require("../utils/errors");

const createNetwork = {
  getNetworkFromEmail: async (req, res) => {
    try {
      let { body, query } = req;
      let request = {};
      request["body"] = body;
      let responseFromGetNetworkFromEmail =
        await createNetworkUtil.getNetworkFromEmail(request);

      logObject(
        "responseFromGetNetworkFromEmail",
        responseFromGetNetworkFromEmail
      );

      if (responseFromGetNetworkFromEmail.success === true) {
        let status = responseFromGetNetworkFromEmail.status
          ? responseFromGetNetworkFromEmail.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromGetNetworkFromEmail.message,
          network_name: responseFromGetNetworkFromEmail.data,
        });
      } else if (responseFromGetNetworkFromEmail.success === false) {
        let status = responseFromGetNetworkFromEmail.status
          ? responseFromGetNetworkFromEmail.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        let errors = responseFromGetNetworkFromEmail.errors
          ? responseFromGetNetworkFromEmail.errors
          : "";
        return res.status(status).json({
          success: false,
          message: responseFromGetNetworkFromEmail.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  create: async (req, res) => {
    try {
      logText("we are creating the network....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let { body, query, params } = req;
      let request = {};
      request["query"] = query;
      request["body"] = body;
      request["params"] = params;

      let responseFromCreateNetwork = await createNetworkUtil.create(request);

      logObject("responseFromCreateNetwork", responseFromCreateNetwork);

      if (responseFromCreateNetwork.success === true) {
        let status = responseFromCreateNetwork.status
          ? responseFromCreateNetwork.status
          : HTTPStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromCreateNetwork.message,
          created_network: responseFromCreateNetwork.data,
        });
      } else if (responseFromCreateNetwork.success === false) {
        const errors = responseFromCreateNetwork.errors
          ? responseFromCreateNetwork.errors
          : "";

        const status = responseFromCreateNetwork.status
          ? responseFromCreateNetwork.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromCreateNetwork.message,
          errors,
        });
      }
    } catch (err) {
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: err.message,
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
      let { body, query, params } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;
      request["params"] = params;

      let responseFromUpdateNetwork = await createNetworkUtil.update(request);

      if (responseFromUpdateNetwork.success === true) {
        let status = responseFromUpdateNetwork.status
          ? responseFromUpdateNetwork.status
          : HTTPStatus.OK;

        return res.status(status).json({
          message: responseFromUpdateNetwork.message,
          updated_network: responseFromUpdateNetwork.data,
          success: true,
        });
      } else if (responseFromUpdateNetwork.success === false) {
        let status = responseFromUpdateNetwork.status
          ? responseFromUpdateNetwork.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        let errors = responseFromUpdateNetwork.errors
          ? responseFromUpdateNetwork.errors
          : "";
        return res.status(status).json({
          success: false,
          message: responseFromUpdateNetwork.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: error.message,
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

      let { body, query } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;

      let responseFromDeleteNetwork = await createNetworkUtil.delete(request);

      logObject("responseFromDeleteNetwork", responseFromDeleteNetwork);

      if (responseFromDeleteNetwork.success === true) {
        let status = responseFromDeleteNetwork.status
          ? responseFromDeleteNetwork.status
          : HTTPStatus.OK;

        return res.status(status).json({
          message: responseFromDeleteNetwork.message,
          deleted_network: responseFromDeleteNetwork.data,
          success: true,
        });
      } else if (responseFromDeleteNetwork.success === false) {
        let status = responseFromDeleteNetwork.status
          ? responseFromDeleteNetwork.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        let errors = responseFromDeleteNetwork.errors
          ? responseFromDeleteNetwork.errors
          : "";

        return res.status(status).json({
          message: responseFromDeleteNetwork.message,
          errors,
          success: false,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: error.message,
        success: false,
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
      let { body, query } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;

      let responseFromListNetworks = await createNetworkUtil.list(request);

      logObject(
        "responseFromListNetworks in controller",
        responseFromListNetworks
      );

      if (responseFromListNetworks.success === true) {
        let status = responseFromListNetworks.status
          ? responseFromListNetworks.status
          : HTTPStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromListNetworks.message,
          networks: responseFromListNetworks.data,
        });
      } else if (responseFromListNetworks.success === false) {
        let status = responseFromListNetworks.status
          ? responseFromListNetworks.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        let errors = responseFromListNetworks.errors
          ? responseFromListNetworks.errors
          : "";

        return res.status(status).json({
          message: responseFromListNetworks.message,
          errors,
        });
      }
    } catch (error) {
      logElement("internal server error", error.message);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: error.message,
      });
    }
  },
};

module.exports = createNetwork;
