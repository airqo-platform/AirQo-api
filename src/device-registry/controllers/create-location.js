const HTTPStatus = require("http-status");
const { logObject, logElement, logText } = require("@utils/log");
const { validationResult } = require("express-validator");
const errors = require("@utils/errors");
const createLocationUtil = require("@utils/create-location");
const constants = require("@config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-location-controller`
);

const createLocation = {
  register: async (req, res) => {
    logText("registering location.............");
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
      const { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromCreateLocation = await createLocationUtil.create(
        request
      );

      if (responseFromCreateLocation.success === true) {
        const status = responseFromCreateLocation.status
          ? responseFromCreateLocation.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateLocation.message,
          location: responseFromCreateLocation.data,
        });
      } else if (responseFromCreateLocation.success === false) {
        const status = responseFromCreateLocation.status
          ? responseFromCreateLocation.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromCreateLocation.message,
          errors: responseFromCreateLocation.errors
            ? responseFromCreateLocation.errors
            : { message: "" },
        });
      }
    } catch (errors) {
      logger.error(`internal server error -- ${errors.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
    }
  },

  delete: async (req, res) => {
    try {
      logText(".................................................");
      logText("inside delete location............");
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

      const { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      const responseFromRemoveLocation = await createLocationUtil.delete(
        request
      );

      if (responseFromRemoveLocation.success === true) {
        const status = responseFromRemoveLocation.status
          ? responseFromRemoveLocation.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveLocation.message,
          location: responseFromRemoveLocation.data,
        });
      } else if (responseFromRemoveLocation.success === false) {
        const status = responseFromRemoveLocation.status
          ? responseFromRemoveLocation.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveLocation.message,
          errors: responseFromRemoveLocation.errors
            ? responseFromRemoveLocation.errors
            : { message: "" },
        });
      }
    } catch (errors) {
      logger.error(`internal server error -- ${errors.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
    }
  },

  update: async (req, res) => {
    try {
      logText("updating location................");
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
      let tenant = req.query;

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromUpdateLocation = await createLocationUtil.update(
        request
      );

      if (responseFromUpdateLocation.success === true) {
        const status = responseFromUpdateLocation.status
          ? responseFromUpdateLocation.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateLocation.message,
          location: responseFromUpdateLocation.data,
        });
      } else if (responseFromUpdateLocation.success === false) {
        const status = responseFromUpdateLocation.status
          ? responseFromUpdateLocation.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateLocation.message,
          errors: responseFromUpdateLocation.errors
            ? responseFromUpdateLocation.errors
            : { message: "" },
        });
      }
    } catch (errors) {
      logger.error(`internal server error -- ${errors.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
    }
  },

  listSummary: async (req, res) => {
    try {
      logText(".....................................");
      logText("list all locations by query params provided");
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
      let tenant = req.query;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      let request = Object.assign({}, req);
      request.query.summary = "yes";
      request.query.tenant = tenant;
      const responseFromListLocations = await createLocationUtil.list(request);

      if (responseFromListLocations.success === true) {
        const status = responseFromListLocations.status
          ? responseFromListLocations.status
          : HTTPStatus.OK;

        res.status(status).json({
          success: true,
          message: responseFromListLocations.message,
          airqlouds: responseFromListLocations.data,
        });
      } else if (responseFromListLocations.success === false) {
        const status = responseFromListLocations.status
          ? responseFromListLocations.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListLocations.message,
          errors: responseFromListLocations.errors
            ? responseFromListLocations.errors
            : { message: "" },
        });
      }
    } catch (errors) {
      logger.error(`internal server error -- ${errors.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
    }
  },

  list: async (req, res) => {
    try {
      logText(".....................................");
      logText("list all locations by query params provided");
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
      let tenant = request.query;

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromListLocations = await createLocationUtil.list(request);
      logElement(
        "has the response for listing locations been successful?",
        responseFromListLocations.success
      );
      if (responseFromListLocations.success === true) {
        const status = responseFromListLocations.status
          ? responseFromListLocations.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListLocations.message,
          locations: responseFromListLocations.data,
        });
      } else if (responseFromListLocations.success === false) {
        const status = responseFromListLocations.status
          ? responseFromListLocations.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListLocations.message,
          errors: responseFromListLocations.errors
            ? responseFromListLocations.errors
            : { message: "" },
        });
      }
    } catch (errors) {
      logger.error(`internal server error -- ${errors.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
    }
  },

  delete: async (req, res) => {
    try {
      logText(".................................................");
      logText("inside delete location............");
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
      let tenant = req.query.tenant;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      const responseFromRemoveLocation = await createLocationUtil.delete(
        request
      );

      if (responseFromRemoveLocation.success === true) {
        const status = responseFromRemoveLocation.status
          ? responseFromRemoveLocation.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveLocation.message,
          location: responseFromRemoveLocation.data,
        });
      } else if (responseFromRemoveLocation.success === false) {
        const status = responseFromRemoveLocation.status
          ? responseFromRemoveLocation.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveLocation.message,
          errors: responseFromRemoveLocation.errors
            ? responseFromRemoveLocation.errors
            : { message: "" },
        });
      }
    } catch (errors) {
      logger.error(`internal server error -- ${errors.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
    }
  },
};

module.exports = createLocation;
