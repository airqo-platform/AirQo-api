const HTTPStatus = require("http-status");
const { logObject, logElement, logText } = require("@utils/log");
const { validationResult } = require("express-validator");
const errors = require("@utils/errors");
const createAirQloudUtil = require("@utils/create-airqloud");
const constants = require("@config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-airqloud-controller`
);

const createAirqloud = {
  bulkCreate: async (req, res) => {
    try {
      return res.status(HTTPStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "NOT YET IMPLEMENTED",
        errors: { message: "NOT YET IMPLEMENTED" },
      });
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
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        success: false,
        errors: { message: error.message },
      });
    }
  },

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
          logger.error(`Internal Server Error -- ${e.message}`);
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
        const status = responseFromCreateAirQloud.status
          ? responseFromCreateAirQloud.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateAirQloud.message,
          airqloud: responseFromCreateAirQloud.data,
        });
      } else if (responseFromCreateAirQloud.success === false) {
        const status = responseFromCreateAirQloud.status
          ? responseFromCreateAirQloud.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromCreateAirQloud.message,
          errors: responseFromCreateAirQloud.errors
            ? responseFromCreateAirQloud.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (errors) {
      logger.error(`Internal Server Error -- ${errors.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
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
          logger.error(`Internal Server Error -- ${e.message}`);
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
          : HTTPStatus.OK;
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
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        const errors = responseFromCalculateGeographicalCenter.errors
          ? responseFromCalculateGeographicalCenter.errors
          : { message: "Internal Server Error" };

        return res.status(status).json({
          success: false,
          message: responseFromCalculateGeographicalCenter.message,
          errors,
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
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
          logger.error(`Internal Server Error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      request["query"] = query;
      const responseFromRemoveAirQloud = await createAirQloudUtil.delete(
        request
      );

      if (responseFromRemoveAirQloud.success === true) {
        const status = responseFromRemoveAirQloud.status
          ? responseFromRemoveAirQloud.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveAirQloud.message,
          airqloud: responseFromRemoveAirQloud.data,
        });
      } else if (responseFromRemoveAirQloud.success === false) {
        const status = responseFromRemoveAirQloud.status
          ? responseFromRemoveAirQloud.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveAirQloud.message,
          errors: responseFromRemoveAirQloud.errors
            ? responseFromRemoveAirQloud.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (errors) {
      logger.error(`Internal Server Error -- ${errors.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
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
          logger.error(`Internal Server Error -- ${e.message}`);
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
          : { message: "Internal Server Error" };
        res.status(status).json({
          message: responseFromRefreshAirQloud.message,
          errors,
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
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
          logger.error(`Internal Server Error -- ${e.message}`);
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
        const status = responseFromFindSites.status
          ? responseFromFindSites.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          sites: responseFromFindSites.data,
          message: responseFromFindSites.message,
        });
      } else if (responseFromFindSites.success === false) {
        const status = responseFromFindSites.status
          ? responseFromFindSites.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromFindSites.message,
          errors: responseFromFindSites.errors
            ? responseFromFindSites.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
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
          logger.error(`Internal Server Error -- ${e.message}`);
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
        const status = responseFromUpdateAirQloud.status
          ? responseFromUpdateAirQloud.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateAirQloud.message,
          airqloud: responseFromUpdateAirQloud.data,
        });
      } else if (responseFromUpdateAirQloud.success === false) {
        const status = responseFromUpdateAirQloud.status
          ? responseFromUpdateAirQloud.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateAirQloud.message,
          errors: responseFromUpdateAirQloud.errors
            ? responseFromUpdateAirQloud.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (errors) {
      logger.error(`Internal Server Error -- ${errors.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
    }
  },

  list: async (req, res) => {
    try {
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
      request.query.tenant = tenant;

      const responseFromListAirQlouds = await createAirQloudUtil.list(request);
      logElement(
        "has the response for listing airqlouds been successful?",
        responseFromListAirQlouds.success
      );
      if (responseFromListAirQlouds.success === true) {
        const status = responseFromListAirQlouds.status
          ? responseFromListAirQlouds.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListAirQlouds.message,
          airqlouds: responseFromListAirQlouds.data,
        });
      } else if (responseFromListAirQlouds.success === false) {
        const status = responseFromListAirQlouds.status
          ? responseFromListAirQlouds.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListAirQlouds.message,
          errors: responseFromListAirQlouds.errors
            ? responseFromListAirQlouds.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (errors) {
      logger.error(`Internal Server Error -- ${errors.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
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
          logger.error(`Internal Server Error -- ${e.message}`);
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
        const status = responseFromListAirQlouds.status
          ? responseFromListAirQlouds.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListAirQlouds.message,
          airqlouds: responseFromListAirQlouds.data,
        });
      } else if (responseFromListAirQlouds.success === false) {
        const status = responseFromListAirQlouds.status
          ? responseFromListAirQlouds.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListAirQlouds.message,
          errors: responseFromListAirQlouds.errors
            ? responseFromListAirQlouds.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (errors) {
      logger.error(`Internal Server Error -- ${errors.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
    }
  },

  listDashboard: async (req, res) => {
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
          logger.error(`Internal Server Error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      request["query"] = query;
      request["query"]["dashboard"] = "yes";
      let responseFromListAirQlouds = await createAirQloudUtil.list(request);
      logElement(
        "has the response for listing airqlouds been successful?",
        responseFromListAirQlouds.success
      );
      if (responseFromListAirQlouds.success === true) {
        const status = responseFromListAirQlouds.status
          ? responseFromListAirQlouds.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListAirQlouds.message,
          airqlouds: responseFromListAirQlouds.data,
        });
      } else if (responseFromListAirQlouds.success === false) {
        const status = responseFromListAirQlouds.status
          ? responseFromListAirQlouds.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListAirQlouds.message,
          errors: responseFromListAirQlouds.errors
            ? responseFromListAirQlouds.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (errors) {
      logger.error(`Internal Server Error -- ${errors.message}`);
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
    }
  },

  listCohortsAndGrids: async (req, res) => {
    try {
      logText(".....................................");
      logText("list all Cohorts and Grids by query params provided");
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
      let request = Object.assign({}, req);
      let { tenant } = query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }

      request["query"]["dashboard"] = "yes";
      request["query"]["tenant"] = tenant;
      const responseFromListCohortsAndGrids = await createAirQloudUtil.listCohortsAndGrids(
        request
      );
      logElement(
        "has the response for listing airqlouds been successful?",
        responseFromListCohortsAndGrids.success
      );
      if (responseFromListCohortsAndGrids.success === true) {
        const status = responseFromListCohortsAndGrids.status
          ? responseFromListCohortsAndGrids.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListCohortsAndGrids.message,
          airqlouds: responseFromListCohortsAndGrids.data,
        });
      } else if (responseFromListCohortsAndGrids.success === false) {
        const status = responseFromListCohortsAndGrids.status
          ? responseFromListCohortsAndGrids.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListCohortsAndGrids.message,
          errors: responseFromListCohortsAndGrids.errors
            ? responseFromListCohortsAndGrids.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (errors) {
      logger.error(`Internal Server Error -- ${errors.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
    }
  },

  listCohortsAndGridsSummary: async (req, res) => {
    try {
      logText(".....................................");
      logText("list all Cohorts and Grids by query params provided");
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
      let request = Object.assign({}, req);
      let { tenant } = query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }

      request["query"]["dashboard"] = "yes";
      request["query"]["tenant"] = tenant;
      request["query"]["category"] = "summary";
      const responseFromListCohortsAndGrids = await createAirQloudUtil.listCohortsAndGrids(
        request
      );
      logElement(
        "has the response for listing airqlouds been successful?",
        responseFromListCohortsAndGrids.success
      );
      if (responseFromListCohortsAndGrids.success === true) {
        const status = responseFromListCohortsAndGrids.status
          ? responseFromListCohortsAndGrids.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListCohortsAndGrids.message,
          airqlouds: responseFromListCohortsAndGrids.data,
        });
      } else if (responseFromListCohortsAndGrids.success === false) {
        const status = responseFromListCohortsAndGrids.status
          ? responseFromListCohortsAndGrids.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListCohortsAndGrids.message,
          errors: responseFromListCohortsAndGrids.errors
            ? responseFromListCohortsAndGrids.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (errors) {
      logger.error(`Internal Server Error -- ${errors.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
    }
  },
};

module.exports = createAirqloud;
