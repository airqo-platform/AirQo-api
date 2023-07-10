const httpStatus = require("http-status");
const { validationResult } = require("express-validator");
const controlAccessUtil = require("../utils/control-access");
const { badRequest, convertErrorArrayToObject } = require("../utils/errors");
const { logText, logElement, logObject, logError } = require("../utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");

const createAccessToken = {
  create: async (req, res) => {
    try {
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

      let { tenant, id } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      let request = req;
      request["query"]["tenant"] = tenant;
      const responseFromCreateAccessToken =
        await controlAccessUtil.createAccessToken(request);

      if (responseFromCreateAccessToken.success === true) {
        const status = responseFromCreateAccessToken.status
          ? responseFromCreateAccessToken.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromCreateAccessToken.message
            ? responseFromCreateAccessToken.message
            : "",
          created_token: responseFromCreateAccessToken.data
            ? responseFromCreateAccessToken.data
            : [],
        });
      } else if (responseFromCreateAccessToken.success === false) {
        const status = responseFromCreateAccessToken.status
          ? responseFromCreateAccessToken.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromCreateAccessToken.message
            ? responseFromCreateAccessToken.message
            : "",
          errors: responseFromCreateAccessToken.errors
            ? responseFromCreateAccessToken.errors
            : { message: "" },
        });
      }
    } catch (error) {
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
      logObject("hasErrors", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      logText("we are in baby");
      let { tenant, id } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      logElement("tenant", tenant);
      let request = req;
      request["query"]["tenant"] = tenant;
      const responseFromListAccessToken =
        await controlAccessUtil.listAccessToken(request);

      logObject("responseFromListAccessToken", responseFromListAccessToken);

      if (responseFromListAccessToken.success === true) {
        const status = responseFromListAccessToken.status
          ? responseFromListAccessToken.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromListAccessToken.message
            ? responseFromListAccessToken.message
            : "",
          tokens: responseFromListAccessToken.data
            ? responseFromListAccessToken.data
            : [],
        });
      } else if (responseFromListAccessToken.success === false) {
        const status = responseFromListAccessToken.status
          ? responseFromListAccessToken.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromListAccessToken.message,
          errors: responseFromListAccessToken.errors
            ? responseFromListAccessToken.errors
            : { message: "" },
        });
      }
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  verify: async (req, res) => {
    try {
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
      logText("we are in baby");
      let { tenant, id } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      logElement("tenant", tenant);
      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;
      request["headers"] = req.headers;
      const responseFromListAccessToken = await controlAccessUtil.verifyToken(
        request
      );

      if (responseFromListAccessToken.success === true) {
        const status = responseFromListAccessToken.status
          ? responseFromListAccessToken.status
          : httpStatus.OK;
        return res
          .status(status)
          .send(
            responseFromListAccessToken.message
              ? responseFromListAccessToken.message
              : ""
          );
      } else if (responseFromListAccessToken.success === false) {
        const status = responseFromListAccessToken.status
          ? responseFromListAccessToken.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromListAccessToken.message,
          errors: responseFromListAccessToken.errors
            ? responseFromListAccessToken.errors
            : { message: "" },
        });
      }
    } catch (error) {
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
      logObject("hasErrors", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant, id } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      let request = req;
      request["query"]["tenant"] = tenant;
      const responseFromDeleteAccessToken =
        await controlAccessUtil.deleteAccessToken(request);

      if (responseFromDeleteAccessToken.success === true) {
        const status = responseFromDeleteAccessToken.status
          ? responseFromDeleteAccessToken.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromDeleteAccessToken.message
            ? responseFromDeleteAccessToken.message
            : "",
          deleted_token: responseFromDeleteAccessToken.data
            ? responseFromDeleteAccessToken.data
            : {},
        });
      } else if (responseFromDeleteAccessToken.success === false) {
        const status = responseFromDeleteAccessToken.status
          ? responseFromDeleteAccessToken.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromDeleteAccessToken.message
            ? responseFromDeleteAccessToken.message
            : "",
          errors: responseFromDeleteAccessToken.errors
            ? responseFromDeleteAccessToken.errors
            : { message: "" },
        });
      }
    } catch (error) {
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
      logObject("hasErrors", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant, id } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      let request = req;
      request["query"]["tenant"] = tenant;
      const responseFromUpdateAccessToken =
        await controlAccessUtil.updateAccessToken(request);

      if (responseFromUpdateAccessToken.success === true) {
        const status = responseFromUpdateAccessToken.status
          ? responseFromUpdateAccessToken.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromUpdateAccessToken.message
            ? responseFromUpdateAccessToken.message
            : "",
          updated_token: responseFromUpdateAccessToken.data
            ? responseFromUpdateAccessToken.data
            : [],
        });
      } else if (responseFromUpdateAccessToken.success === false) {
        const status = responseFromUpdateAccessToken.status
          ? responseFromUpdateAccessToken.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromUpdateAccessToken.message
            ? responseFromUpdateAccessToken.message
            : "",
          errors: responseFromUpdateAccessToken.errors
            ? responseFromUpdateAccessToken.errors
            : { message: "" },
        });
      }
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createAccessToken;
