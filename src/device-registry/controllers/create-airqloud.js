const HTTPStatus = require("http-status");
const { logObject, logElement, logText } = require("../utils/log");
const { validationResult } = require("express-validator");
const errors = require("../utils/errors");
const createAirQloudUtil = require("../utils/create-airqloud");
const constants = require("../config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-airqloud-controller`
);
const httpStatus = require("http-status");

const createAirqloud = {
  register: async (req, res) => {
    let request = {};
    let { body } = req;
    let { query } = req;
    logText("registering airqloud.............");
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
      request["body"] = body;
      request["query"] = query;

      let responseFromCreateAirQloud = await createAirQloudUtil.create(request);
      logObject(
        "responseFromCreateAirQloud in controller",
        responseFromCreateAirQloud
      );
      if (responseFromCreateAirQloud.success === true) {
        let status = responseFromCreateAirQloud.status
          ? responseFromCreateAirQloud.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateAirQloud.message,
          airqloud: responseFromCreateAirQloud.data,
        });
      }

      if (responseFromCreateAirQloud.success === false) {
        let status = responseFromCreateAirQloud.status
          ? responseFromCreateAirQloud.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        let errors = responseFromCreateAirQloud.errors
          ? responseFromCreateAirQloud.errors
          : { message: "" };

        return res.status(status).json({
          success: false,
          message: responseFromCreateAirQloud.message,
          errors,
        });
      }
    } catch (errors) {
      logger.error(`internal server error -- ${errors.message}`);
      errors.tryCatchErrors(res, errors, "createAirqloud controller");
    }
  },

  calculateGeographicalCenter: async (req, res) => {
    try {
      const { body, query } = req;
      const { coordinates } = body;
      const { id, tenant } = query;

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

      let request = {};
      request["body"] = {};
      request["query"] = {};
      request["body"]["coordinates"] = coordinates;
      request["query"]["id"] = id;
      request["query"]["tenant"] = tenant;

      const responseFromCalculateGeographicalCenter = await createAirQloudUtil.calculateGeographicalCenter(
        request
      );

      if (responseFromCalculateGeographicalCenter.success === true) {
        const status = responseFromCalculateGeographicalCenter.status
          ? responseFromCalculateGeographicalCenter.status
          : httpStatus.OK;
        logObject(
          "responseFromCalculateGeographicalCenter",
          responseFromCalculateGeographicalCenter
        );
        return res.status(status).json({
          success: true,
          message: responseFromCalculateGeographicalCenter.message,
          center_point: responseFromCalculateGeographicalCenter.data,
        });
      } else if (responseFromCalculateGeographicalCenter.success === false) {
        const status = responseFromCalculateGeographicalCenter.status
          ? responseFromCalculateGeographicalCenter.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        const errors = responseFromCalculateGeographicalCenter.errors
          ? responseFromCalculateGeographicalCenter.errors
          : { message: "" };

        return res.status(status).json({
          success: false,
          message: responseFromCalculateGeographicalCenter.message,
          errors,
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
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
      let request = {};

      logText(".................................................");
      logText("inside delete airqloud............");
      const { tenant } = req.query;
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
      request["query"] = query;
      let responseFromRemoveAirQloud = await createAirQloudUtil.delete(request);

      if (responseFromRemoveAirQloud.success === true) {
        let status = responseFromRemoveAirQloud.status
          ? responseFromRemoveAirQloud.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveAirQloud.message,
          airqloud: responseFromRemoveAirQloud.data,
        });
      }

      if (responseFromRemoveAirQloud.success === false) {
        let errors = responseFromRemoveAirQloud.errors
          ? responseFromRemoveAirQloud.errors
          : { message: "" };
        let status = responseFromRemoveAirQloud.status
          ? responseFromRemoveAirQloud.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveAirQloud.message,
          errors,
        });
      }
    } catch (errors) {
      logger.error(`internal server error -- ${errors.message}`);
      errors.tryCatchErrors(res, errors, "createAirqloud controller");
    }
  },
  refresh: async (req, res) => {
    try {
      const { query, body } = req;
      const { id, admin_level, name, tenant } = query;

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

      let request = {};
      request["query"] = {};
      request["query"]["id"] = id;
      request["query"]["admin_level"] = admin_level;
      request["query"]["name"] = name;
      request["query"]["tenant"] = tenant;
      const responseFromRefreshAirQloud = await createAirQloudUtil.refresh(
        request
      );
      if (responseFromRefreshAirQloud.success === true) {
        const status = responseFromRefreshAirQloud.status
          ? responseFromRefreshAirQloud.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromRefreshAirQloud.message,
          refreshed_airqloud: responseFromRefreshAirQloud.data,
        });
      } else if (responseFromRefreshAirQloud.success === false) {
        const status = responseFromRefreshAirQloud.status
          ? responseFromRefreshAirQloud.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromRefreshAirQloud.errors
          ? responseFromRefreshAirQloud.errors
          : { message: "" };
        res.status(status).json({
          message: responseFromRefreshAirQloud.message,
          errors,
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

  findSites: async (req, res) => {
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
      const { query, body } = req;
      const { id, name, admin_level, tenant } = query;
      let request = {};
      request["query"] = {};
      request["query"]["id"] = id;
      request["query"]["name"] = name;
      request["query"]["admin_level"] = admin_level;
      request["query"]["tenant"] = tenant;
      logObject("request", request);
      let responseFromFindSites = await createAirQloudUtil.findSites(request);
      logObject("responseFromFindSites", responseFromFindSites);
      if (responseFromFindSites.success === true) {
        let status = responseFromFindSites.status
          ? responseFromFindSites.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          sites: responseFromFindSites.data,
          message: responseFromFindSites.message,
        });
      }
      if (responseFromFindSites.success === false) {
        let errors = responseFromFindSites.errors
          ? responseFromFindSites.errors
          : { message: "" };
        let status = responseFromFindSites.status
          ? responseFromFindSites.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromFindSites.message,
          errors,
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: {
          message: error.message,
        },
      });
    }
  },

  update: async (req, res) => {
    try {
      let request = {};
      let { body } = req;
      let { query } = req;
      logText("updating airqloud................");
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
      request["body"] = body;
      request["query"] = query;
      let responseFromUpdateAirQloud = await createAirQloudUtil.update(request);
      logObject("responseFromUpdateAirQloud", responseFromUpdateAirQloud);
      if (responseFromUpdateAirQloud.success === true) {
        let status = responseFromUpdateAirQloud.status
          ? responseFromUpdateAirQloud.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateAirQloud.message,
          airqloud: responseFromUpdateAirQloud.data,
        });
      }

      if (responseFromUpdateAirQloud.success === false) {
        let errors = responseFromUpdateAirQloud.errors
          ? responseFromUpdateAirQloud.errors
          : { message: "" };

        let status = responseFromUpdateAirQloud.status
          ? responseFromUpdateAirQloud.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateAirQloud.message,
          errors,
        });
      }
    } catch (errors) {
      logger.error(`internal server error -- ${errors.message}`);
      errors.tryCatchErrors(res, errors, "createAirqloud controller");
    }
  },

  list: async (req, res) => {
    try {
      const { query } = req;
      let request = {};
      logText(".....................................");
      logText("list all airqlouds by query params provided");
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
      request["query"] = query;
      let responseFromListAirQlouds = await createAirQloudUtil.list(request);
      logElement(
        "has the response for listing airqlouds been successful?",
        responseFromListAirQlouds.success
      );
      if (responseFromListAirQlouds.success === true) {
        let status = responseFromListAirQlouds.status
          ? responseFromListAirQlouds.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListAirQlouds.message,
          airqlouds: responseFromListAirQlouds.data,
        });
      }

      if (responseFromListAirQlouds.success === false) {
        let errors = responseFromListAirQlouds.errors
          ? responseFromListAirQlouds.errors
          : { message: "" };
        let status = responseFromListAirQlouds.status
          ? responseFromListAirQlouds.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListAirQlouds.message,
          errors,
        });
      }
    } catch (errors) {
      logger.error(`internal server error -- ${errors.message}`);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
    }
  },

  listSummary: async (req, res) => {
    try {
      const { query } = req;
      let request = {};
      logText(".....................................");
      logText("list all airqlouds by query params provided");
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
      request["query"] = query;
      request["query"]["summary"] = "yes";
      let responseFromListAirQlouds = await createAirQloudUtil.list(request);
      logElement(
        "has the response for listing airqlouds been successful?",
        responseFromListAirQlouds.success
      );
      if (responseFromListAirQlouds.success === true) {
        let status = responseFromListAirQlouds.status
          ? responseFromListAirQlouds.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListAirQlouds.message,
          airqlouds: responseFromListAirQlouds.data,
        });
      }

      if (responseFromListAirQlouds.success === false) {
        let errors = responseFromListAirQlouds.errors
          ? responseFromListAirQlouds.errors
          : { message: "" };
        let status = responseFromListAirQlouds.status
          ? responseFromListAirQlouds.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListAirQlouds.message,
          errors,
        });
      }
    } catch (errors) {
      logger.error(`internal server error -- ${errors.message}`);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
    }
  },

  delete: async (req, res) => {
    try {
      const { query } = req;
      const { body } = req;
      let request = {};
      logText(".................................................");
      logText("inside delete airqloud............");
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
      request["query"] = query;
      request["body"] = body;
      let responseFromRemoveAirQloud = await createAirQloudUtil.delete(request);

      if (responseFromRemoveAirQloud.success === true) {
        let status = responseFromRemoveAirQloud.status
          ? responseFromRemoveAirQloud.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveAirQloud.message,
          airqloud: responseFromRemoveAirQloud.data,
        });
      }

      if (responseFromRemoveAirQloud.success === false) {
        let errors = responseFromRemoveAirQloud.errors
          ? responseFromRemoveAirQloud.errors
          : { message: "" };
        let status = responseFromRemoveAirQloud.status
          ? responseFromRemoveAirQloud.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveAirQloud.message,
          errors,
        });
      }
    } catch (errors) {
      logger.error(`internal server error -- ${errors.message}`);
      errors.tryCatchErrors(res, errors, "manageAirQloud controller");
    }
  },
};

module.exports = createAirqloud;
