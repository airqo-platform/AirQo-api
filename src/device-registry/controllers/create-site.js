const HTTPStatus = require("http-status");
const isEmpty = require("is-empty");
const { logObject, logElement, logText } = require("@utils/log");
const { validationResult } = require("express-validator");
const errors = require("@utils/errors");
const generateFilter = require("@utils/generate-filter");
const createSiteUtil = require("@utils/create-site");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-site-controller`
);

const manageSite = {
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
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "internal server error",
        errors: { message: error.message },
      });
    }
  },
  bulkUpdate: async (req, res) => {
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
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "internal server error",
        errors: { message: error.message },
      });
    }
  },

  bulkDelete: async (req, res) => {
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
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "internal server error",
        errors: { message: error.message },
      });
    }
  },
  register: async (req, res) => {
    logText("registering site.............");
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
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      const responseFromCreateSite = await createSiteUtil.create(request);
      if (responseFromCreateSite.success === true) {
        const status = responseFromCreateSite.status
          ? responseFromCreateSite.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateSite.message,
          site: responseFromCreateSite.data,
        });
      } else if (responseFromCreateSite.success === false) {
        const status = responseFromCreateSite.status
          ? responseFromCreateSite.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateSite.message,
          errors: responseFromCreateSite.errors
            ? responseFromCreateSite.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
      };
    }
  },

  generateMetadata: async (req, res) => {
    logText("generating site metadata.............");
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

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      const responseFromGenerateMetadata = await createSiteUtil.generateMetadata(
        request
      );
      logObject(
        "responseFromGenerateMetadata in controller",
        responseFromGenerateMetadata
      );

      if (responseFromGenerateMetadata.success === true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromGenerateMetadata.message,
          metadata: responseFromGenerateMetadata.data,
        });
      } else if (responseFromGenerateMetadata.success === false) {
        return res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message: responseFromGenerateMetadata.message,
          errors: responseFromGenerateMetadata.errors
            ? responseFromGenerateMetadata.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`server side error -- ${error.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listNearestWeatherStation: async (req, res) => {
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

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      const responseFromFindNearestSite = await createSiteUtil.findNearestWeatherStation(
        request
      );
      if (responseFromFindNearestSite.success === true) {
        const status = responseFromFindNearestSite.status
          ? responseFromFindNearestSite.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: "nearest site retrieved",
          nearest_weather_station: responseFromFindNearestSite.data,
        });
      } else if (responseFromFindNearestSite.success === false) {
        const status = responseFromFindNearestSite.status
          ? responseFromFindNearestSite.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromFindNearestSite.message,
          errors: responseFromFindNearestSite.errors
            ? responseFromFindNearestSite.errors
            : { message: "" },
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

  listWeatherStations: async (req, res) => {
    try {
      const responseFromListTahmoStations = await createSiteUtil.listWeatherStations();
      if (responseFromListTahmoStations.success === true) {
        const status = responseFromListTahmoStations.status
          ? responseFromListTahmoStations.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListTahmoStations.message,
          stations: responseFromListTahmoStations.data,
        });
      } else if (responseFromListTahmoStations.success === false) {
        const status = responseFromListTahmoStations.status
          ? responseFromListTahmoStations.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListTahmoStations.message,
          errors: responseFromListTahmoStations.errors
            ? responseFromListTahmoStations.errors
            : { message: "" },
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

  findAirQlouds: async (req, res) => {
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

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      const responseFromFindAirQloud = await createSiteUtil.findAirQlouds(
        request
      );
      logObject("responseFromFindAirQloud", responseFromFindAirQloud);
      if (responseFromFindAirQloud.success === true) {
        const status = responseFromFindAirQloud.status
          ? responseFromFindAirQloud.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          airqlouds: responseFromFindAirQloud.data,
          message: responseFromFindAirQloud.message,
        });
      } else if (responseFromFindAirQloud.success === false) {
        const status = responseFromFindAirQloud.status
          ? responseFromFindAirQloud.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromFindAirQloud.message,
          errors: responseFromFindAirQloud.errors
            ? responseFromFindAirQloud.errors
            : { message: "" },
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

  delete: async (req, res) => {
    try {
      logText(".................................................");
      logText("inside delete site............");
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
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      const responseFromRemoveSite = await createSiteUtil.delete(request);
      if (responseFromRemoveSite.success === true) {
        const status = responseFromRemoveSite.status
          ? responseFromRemoveSite.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveSite.message,
          site: responseFromRemoveSite.data,
        });
      } else if (responseFromRemoveSite.success === false) {
        const status = responseFromRemoveSite.status
          ? responseFromRemoveSite.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveSite.message,
          errors: responseFromRemoveSite.errors
            ? responseFromRemoveSite.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  update: async (req, res) => {
    try {
      logText("updating site................");
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
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      const responseFromUpdateSite = await createSiteUtil.update(request);

      if (responseFromUpdateSite.success === true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromUpdateSite.message,
          site: responseFromUpdateSite.data,
        });
      } else if (responseFromUpdateSite.success === false) {
        const status = responseFromUpdateSite.status
          ? responseFromUpdateSite.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateSite.message,
          errors: responseFromUpdateSite.errors
            ? responseFromUpdateSite.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  refresh: async (req, res) => {
    try {
      logText("refreshing site details................");
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
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      const responseFromRefreshSite = await createSiteUtil.refresh(request);
      logObject("responseFromRefreshSite", responseFromRefreshSite);
      if (responseFromRefreshSite.success === true) {
        const status = responseFromRefreshSite.status
          ? responseFromRefreshSite.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRefreshSite.message,
          site: responseFromRefreshSite.data,
        });
      } else if (responseFromRefreshSite.success === false) {
        const status = responseFromRefreshSite.status
          ? responseFromRefreshSite.status
          : HTTPStatus.BAD_GATEWAY;

        return res.status(status).json({
          success: false,
          message: responseFromRefreshSite.message,
          errors: responseFromRefreshSite.errors
            ? responseFromRefreshSite.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  findNearestSite: async (req, res) => {
    try {
      logText("list all sites by coordinates...");
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
      let { tenant, latitude, longitude, radius } = req.query;

      logElement("latitude ", latitude);
      logElement("longitude ", longitude);

      if (isEmpty(tenant)) {
        tenant = "airqo";
      }

      let request = {};
      request["radius"] = radius;
      request["latitude"] = latitude;
      request["longitude"] = longitude;
      request["tenant"] = tenant;
      const responseFromFindNearestSite = await createSiteUtil.findNearestSitesByCoordinates(
        request
      );

      logObject("responseFromFindNearestSite", responseFromFindNearestSite);
      if (responseFromFindNearestSite.success === true) {
        const status = responseFromFindNearestSite.status
          ? responseFromFindNearestSite.status
          : HTTPStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromFindNearestSite.message,
          sites: responseFromFindNearestSite.data,
        });
      } else if (responseFromFindNearestSite.success === false) {
        const status = responseFromFindNearestSite.status
          ? responseFromFindNearestSite.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromFindNearestSite.message,
          errors: responseFromFindNearestSite.errors
            ? responseFromFindNearestSite.errors
            : { message: "" },
        });
      }
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      });
    }
  },

  listSummary: async (req, res) => {
    try {
      let { tenant, limit, skip } = req.query;
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

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      request.query.category = "summary";
      const responseFromListSites = await createSiteUtil.list(request);

      if (responseFromListSites.success === true) {
        const status = responseFromListSites.status
          ? responseFromListSites.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListSites.message,
          sites: responseFromListSites.data,
        });
      } else if (responseFromListSites.success === false) {
        const status = responseFromListSites.status
          ? responseFromListSites.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        res.status(status).json({
          success: false,
          message: responseFromListSites.message,
          errors: responseFromListSites.errors
            ? responseFromListSites.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
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

      const { query } = req;
      let { tenant } = query;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK || "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromListSites = await createSiteUtil.list(request);

      if (responseFromListSites.success === true) {
        const status = responseFromListSites.status
          ? responseFromListSites.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListSites.message,
          sites: responseFromListSites.data,
        });
      } else if (responseFromListSites.success === false) {
        const status = responseFromListSites.status
          ? responseFromListSites.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        res.status(status).json({
          success: false,
          message: responseFromListSites.message,
          errors: responseFromListSites.errors
            ? responseFromListSites.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  createApproximateCoordinates: (req, res) => {
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
      const {
        latitude,
        longitude,
        approximate_distance_in_km,
        bearing,
      } = req.body;

      const responseFromCreateApproximateCoordinates = createSiteUtil.createApproximateCoordinates(
        { latitude, longitude, approximate_distance_in_km, bearing }
      );

      if (responseFromCreateApproximateCoordinates.success === true) {
        const status = responseFromCreateApproximateCoordinates.status
          ? responseFromCreateApproximateCoordinates.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateApproximateCoordinates.message,
          approximate_coordinates:
            responseFromCreateApproximateCoordinates.data,
        });
      } else {
        const status = responseFromCreateApproximateCoordinates.status
          ? responseFromCreateApproximateCoordinates.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        const errors = responseFromCreateApproximateCoordinates.errors
          ? responseFromCreateApproximateCoordinates.errors
          : { message: "" };

        return res.status(status).json({
          success: false,
          message: responseFromCreateApproximateCoordinates.message,
          errors,
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: {
          message: error.message,
        },
      });
    }
  },
};

module.exports = manageSite;
