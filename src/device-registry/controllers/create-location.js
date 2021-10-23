const HTTPStatus = require("http-status");
const { logObject, logElement, logText } = require("../utils/log");
const { validationResult } = require("express-validator");
const { tryCatchErrors, badRequest } = require("../utils/errors");
const createLocationUtil = require("../utils/create-location");
const log4js = require("log4js");
const logger = log4js.getLogger("create-location-controller");
const manipulateArraysUtil = require("../utils/manipulate-arrays");

const createLocation = {
  register: async (req, res) => {
    let request = {};
    let { body } = req;
    let { query } = req;
    logText("registering location.............");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { tenant } = req.query;
      request["body"] = body;
      request["query"] = query;

      let responseFromCreateLocation = await createLocationUtil.create(request);
      logObject(
        "responseFromCreateLocation in controller",
        responseFromCreateLocation
      );
      if (responseFromCreateLocation.success === true) {
        let status = responseFromCreateLocation.status
          ? responseFromCreateLocation.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateLocation.message,
          location: responseFromCreateLocation.data,
        });
      }

      if (responseFromCreateLocation.success === false) {
        let status = responseFromCreateLocation.status
          ? responseFromCreateLocation.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        let errors = responseFromCreateLocation.errors
          ? responseFromCreateLocation.errors
          : "";

        return res.status(status).json({
          success: false,
          message: responseFromCreateLocation.message,
          errors,
        });
      }
    } catch (errors) {
      tryCatchErrors(res, errors, "createLocation controller");
    }
  },

  delete: async (req, res) => {
    try {
      const { query } = req;
      let request = {};

      logText(".................................................");
      logText("inside delete location............");
      const { tenant } = req.query;
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      request["query"] = query;
      let responseFromRemoveLocation = await createLocationUtil.delete(request);

      if (responseFromRemoveLocation.success === true) {
        let status = responseFromRemoveLocation.status
          ? responseFromRemoveLocation.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveLocation.message,
          location: responseFromRemoveLocation.data,
        });
      }

      if (responseFromRemoveLocation.success === false) {
        let errors = responseFromRemoveLocation.errors
          ? responseFromRemoveLocation.errors
          : "";
        let status = responseFromRemoveLocation.status
          ? responseFromRemoveLocation.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveLocation.message,
          errors,
        });
      }
    } catch (errors) {
      tryCatchErrors(res, errors, "createLocation controller");
    }
  },

  update: async (req, res) => {
    try {
      let request = {};
      let { body } = req;
      let { query } = req;
      logText("updating location................");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      request["body"] = body;
      request["query"] = query;
      let responseFromUpdateLocation = await createLocationUtil.update(request);
      logObject("responseFromUpdateLocation", responseFromUpdateLocation);
      if (responseFromUpdateLocation.success === true) {
        let status = responseFromUpdateLocation.status
          ? responseFromUpdateLocation.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateLocation.message,
          location: responseFromUpdateLocation.data,
        });
      }

      if (responseFromUpdateLocation.success === false) {
        let errors = responseFromUpdateLocation.errors
          ? responseFromUpdateLocation.errors
          : "";

        let status = responseFromUpdateLocation.status
          ? responseFromUpdateLocation.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateLocation.message,
          errors,
        });
      }
    } catch (errors) {
      tryCatchErrors(res, errors, "createLocation controller");
    }
  },

  list: async (req, res) => {
    try {
      const { query } = req;
      let request = {};
      logText(".....................................");
      logText("list all locations by query params provided");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      request["query"] = query;
      let responseFromListLocations = await createLocationUtil.list(request);
      logElement(
        "has the response for listing locations been successful?",
        responseFromListLocations.success
      );
      if (responseFromListLocations.success === true) {
        let status = responseFromListLocations.status
          ? responseFromListLocations.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListLocations.message,
          locations: responseFromListLocations.data,
        });
      }

      if (responseFromListLocations.success === false) {
        let errors = responseFromListLocations.errors
          ? responseFromListLocations.errors
          : "";
        let status = responseFromListLocations.status
          ? responseFromListLocations.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListLocations.message,
          errors,
        });
      }
    } catch (errors) {
      tryCatchErrors(res, errors, "create location controller");
    }
  },

  delete: async (req, res) => {
    try {
      const { query } = req;
      const { body } = req;
      let request = {};
      logText(".................................................");
      logText("inside delete location............");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      request["query"] = query;
      request["body"] = body;
      let responseFromRemoveLocation = await createLocationUtil.delete(request);

      if (responseFromRemoveLocation.success === true) {
        let status = responseFromRemoveLocation.status
          ? responseFromRemoveLocation.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveLocation.message,
          location: responseFromRemoveLocation.data,
        });
      }

      if (responseFromRemoveLocation.success === false) {
        let errors = responseFromRemoveLocation.errors
          ? responseFromRemoveLocation.errors
          : "";
        let status = responseFromRemoveLocation.status
          ? responseFromRemoveLocation.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveLocation.message,
          errors,
        });
      }
    } catch (errors) {
      tryCatchErrors(res, errors, "manageLocation controller");
    }
  },
};

module.exports = createLocation;
