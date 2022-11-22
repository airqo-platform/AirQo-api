const HTTPStatus = require("http-status");
const { validationResult } = require("express-validator");
const controlAccessUtil = require("../utils/control-access");
const { badRequest, convertErrorArrayToObject } = require("../utils/errors");
const { logText, logElement, logObject, logError } = require("../utils/log");

const createPermission = {
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

      let request = req;
      const responseFromListPermission =
        controlAccessUtil.createPermission(request);

      if (responseFromCreatePermission.success === true) {
      } else if (responseFromCreatePermission.success === false) {
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
      const responseFromListPermission =
        controlAccessUtil.listPermission(request);

      if (responseFromListPermission.success === true) {
      } else if (responseFromListPermission.success === false) {
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
      const responseFromDeletePermission =
        controlAccessUtil.deletePermission(request);

      if (responseFromDeletePermission.success === true) {
      } else if (responseFromDeletePermission.success === false) {
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
      const responseFromUpdatePermission =
        controlAccessUtil.updatePermission(request);

      if (responseFromUpdatePermission.success === true) {
      } else if (responseFromUpdatePermission.success === false) {
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

module.exports = createPermission;
