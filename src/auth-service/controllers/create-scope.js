const { validationResult } = require("express-validator");
const controlAccessUtil = require("../utils/control-access");
const { badRequest, convertErrorArrayToObject } = require("../utils/errors");
const { logText, logElement, logObject, logError } = require("../utils/log");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");

const createScope = {
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

      const responseFromCreateScope = await controlAccessUtil.createScope(
        request
      );

      if (responseFromCreateScope.success === true) {
        const status = responseFromCreateScope.status
          ? responseFromCreateScope.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateScope.message
            ? responseFromCreateScope.message
            : "",
          created_Scope: responseFromCreateScope.data
            ? responseFromCreateScope.data
            : [],
        });
      } else if (responseFromCreateScope.success === false) {
        const status = responseFromCreateScope.status
          ? responseFromCreateScope.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateScope.message
            ? responseFromCreateScope.message
            : "",
          errors: responseFromCreateScope.errors
            ? responseFromCreateScope.errors
            : { message: "" },
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
      let request = req;
      if (isEmpty(tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }
      const responseFromListScopes = await controlAccessUtil.listScope(request);

      if (responseFromListScopes.success === true) {
        const status = responseFromListScopes.status
          ? responseFromListScopes.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListScopes.message
            ? responseFromListScopes.message
            : "",
          Scopes: responseFromListScopes.data
            ? responseFromListScopes.data
            : [],
        });
      } else if (responseFromListScopes.success === false) {
        const status = responseFromListScopes.status
          ? responseFromListScopes.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListScopes.message
            ? responseFromListScopes.message
            : "",
          errors: responseFromListScopes.errors
            ? responseFromListScopes.errors
            : { message: "" },
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
      const responseFromDeleteScope = await controlAccessUtil.deleteScope(
        request
      );

      if (responseFromDeleteScope.success === true) {
        const status = responseFromDeleteScope.status
          ? responseFromDeleteScope.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeleteScope.message
            ? responseFromDeleteScope.message
            : "",
          deleted_Scope: responseFromDeleteScope.data
            ? responseFromDeleteScope.data
            : [],
        });
      } else if (responseFromDeleteScope.success === false) {
        const status = responseFromDeleteScope.status
          ? responseFromDeleteScope.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeleteScope.message
            ? responseFromDeleteScope.message
            : "",
          errors: responseFromDeleteScope.errors
            ? responseFromDeleteScope.errors
            : { message: "" },
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

  update: async (req, res) => {
    try {
      const { query } = req;
      let { tenant } = query;
      s;
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
      const responseFromUpdateScope = await controlAccessUtil.updateScope(
        request
      );

      if (responseFromUpdateScope.success === true) {
        const status = responseFromUpdateScope.status
          ? responseFromUpdateScope.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateScope.message
            ? responseFromUpdateScope.message
            : "",
          updated_Scope: responseFromUpdateScope.data
            ? responseFromUpdateScope.data
            : [],
        });
      } else if (responseFromUpdateScope.success === false) {
        const status = responseFromUpdateScope.status
          ? responseFromUpdateScope.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateScope.message
            ? responseFromUpdateScope.message
            : "",
          errors: responseFromUpdateScope.errors
            ? responseFromUpdateScope.errors
            : { message: "" },
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
};

module.exports = createScope;
