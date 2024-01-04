const httpStatus = require("http-status");
const isEmpty = require("is-empty");
const { logText } = require("@utils/log");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const createSiteUtil = require("@utils/create-site");
const constants = require("@config/constants");
const log4js = require("log4js");
const { logObject } = require("../utils/log");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-site-controller`
);

const manageSite = {
  bulkCreate: async (req, res, next) => {
    try {
      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "NOT YET IMPLEMENTED",
        errors: { message: "NOT YET IMPLEMENTED" },
      });
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  bulkUpdate: async (req, res, next) => {
    try {
      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "NOT YET IMPLEMENTED",
        errors: { message: "NOT YET IMPLEMENTED" },
      });
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  bulkDelete: async (req, res, next) => {
    try {
      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "NOT YET IMPLEMENTED",
        errors: { message: "NOT YET IMPLEMENTED" },
      });
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  register: async (req, res, next) => {
    logText("registering site.............");
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromCreateSite = await createSiteUtil.create(request, next);
      if (responseFromCreateSite.success === true) {
        const status = responseFromCreateSite.status
          ? responseFromCreateSite.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateSite.message,
          site: responseFromCreateSite.data,
        });
      } else if (responseFromCreateSite.success === false) {
        const status = responseFromCreateSite.status
          ? responseFromCreateSite.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateSite.message,
          errors: responseFromCreateSite.errors
            ? responseFromCreateSite.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  generateMetadata: async (req, res, next) => {
    logText("generating site metadata.............");
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromGenerateMetadata = await createSiteUtil.generateMetadata(
        request,
        next
      );

      if (responseFromGenerateMetadata.success === true) {
        return res.status(httpStatus.OK).json({
          success: true,
          message: responseFromGenerateMetadata.message,
          metadata: responseFromGenerateMetadata.data,
        });
      } else if (responseFromGenerateMetadata.success === false) {
        return res.status(httpStatus.BAD_GATEWAY).json({
          success: false,
          message: responseFromGenerateMetadata.message,
          errors: responseFromGenerateMetadata.errors
            ? responseFromGenerateMetadata.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  listNearestWeatherStation: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromFindNearestSite = await createSiteUtil.findNearestWeatherStation(
        request,
        next
      );
      if (responseFromFindNearestSite.success === true) {
        const status = responseFromFindNearestSite.status
          ? responseFromFindNearestSite.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: "nearest site retrieved",
          nearest_weather_station: responseFromFindNearestSite.data,
        });
      } else if (responseFromFindNearestSite.success === false) {
        const status = responseFromFindNearestSite.status
          ? responseFromFindNearestSite.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromFindNearestSite.message,
          errors: responseFromFindNearestSite.errors
            ? responseFromFindNearestSite.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  listWeatherStations: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromListTahmoStations = await createSiteUtil.listWeatherStations(
        next
      );
      if (responseFromListTahmoStations.success === true) {
        const status = responseFromListTahmoStations.status
          ? responseFromListTahmoStations.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListTahmoStations.message,
          stations: responseFromListTahmoStations.data,
        });
      } else if (responseFromListTahmoStations.success === false) {
        const status = responseFromListTahmoStations.status
          ? responseFromListTahmoStations.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListTahmoStations.message,
          errors: responseFromListTahmoStations.errors
            ? responseFromListTahmoStations.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  findAirQlouds: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromFindAirQloud = await createSiteUtil.findAirQlouds(
        request,
        next
      );

      if (responseFromFindAirQloud.success === true) {
        const status = responseFromFindAirQloud.status
          ? responseFromFindAirQloud.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          airqlouds: responseFromFindAirQloud.data,
          message: responseFromFindAirQloud.message,
        });
      } else if (responseFromFindAirQloud.success === false) {
        const status = responseFromFindAirQloud.status
          ? responseFromFindAirQloud.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromFindAirQloud.message,
          errors: responseFromFindAirQloud.errors
            ? responseFromFindAirQloud.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  delete: async (req, res, next) => {
    try {
      logText(".................................................");
      logText("inside delete site............");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromRemoveSite = await createSiteUtil.delete(request, next);
      if (responseFromRemoveSite.success === true) {
        const status = responseFromRemoveSite.status
          ? responseFromRemoveSite.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveSite.message,
          site: responseFromRemoveSite.data,
        });
      } else if (responseFromRemoveSite.success === false) {
        const status = responseFromRemoveSite.status
          ? responseFromRemoveSite.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveSite.message,
          errors: responseFromRemoveSite.errors
            ? responseFromRemoveSite.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  update: async (req, res, next) => {
    try {
      logText("updating site................");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromUpdateSite = await createSiteUtil.update(request, next);

      if (responseFromUpdateSite.success === true) {
        return res.status(httpStatus.OK).json({
          success: true,
          message: responseFromUpdateSite.message,
          site: responseFromUpdateSite.data,
        });
      } else if (responseFromUpdateSite.success === false) {
        const status = responseFromUpdateSite.status
          ? responseFromUpdateSite.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateSite.message,
          errors: responseFromUpdateSite.errors
            ? responseFromUpdateSite.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  refresh: async (req, res, next) => {
    try {
      logText("refreshing site details................");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromRefreshSite = await createSiteUtil.refresh(
        request,
        next
      );

      if (responseFromRefreshSite.success === true) {
        const status = responseFromRefreshSite.status
          ? responseFromRefreshSite.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRefreshSite.message,
          site: responseFromRefreshSite.data,
        });
      } else if (responseFromRefreshSite.success === false) {
        const status = responseFromRefreshSite.status
          ? responseFromRefreshSite.status
          : httpStatus.BAD_GATEWAY;

        return res.status(status).json({
          success: false,
          message: responseFromRefreshSite.message,
          errors: responseFromRefreshSite.errors
            ? responseFromRefreshSite.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  findNearestSite: async (req, res, next) => {
    try {
      logText("list all sites by coordinates...");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromFindNearestSite = await createSiteUtil.findNearestSitesByCoordinates(
        request,
        next
      );

      if (responseFromFindNearestSite.success === true) {
        const status = responseFromFindNearestSite.status
          ? responseFromFindNearestSite.status
          : httpStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromFindNearestSite.message,
          sites: responseFromFindNearestSite.data,
        });
      } else if (responseFromFindNearestSite.success === false) {
        const status = responseFromFindNearestSite.status
          ? responseFromFindNearestSite.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromFindNearestSite.message,
          errors: responseFromFindNearestSite.errors
            ? responseFromFindNearestSite.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  listSummary: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
      request.query.category = "summary";

      const responseFromListSites = await createSiteUtil.list(request, next);

      if (responseFromListSites.success === true) {
        const status = responseFromListSites.status
          ? responseFromListSites.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListSites.message,
          sites: responseFromListSites.data,
        });
      } else if (responseFromListSites.success === false) {
        const status = responseFromListSites.status
          ? responseFromListSites.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        res.status(status).json({
          success: false,
          message: responseFromListSites.message,
          errors: responseFromListSites.errors
            ? responseFromListSites.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  list: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromListSites = await createSiteUtil.list(request, next);

      if (responseFromListSites.success === true) {
        const status = responseFromListSites.status
          ? responseFromListSites.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListSites.message,
          sites: responseFromListSites.data,
        });
      } else if (responseFromListSites.success === false) {
        const status = responseFromListSites.status
          ? responseFromListSites.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        const errors = responseFromListSites.errors
          ? responseFromListSites.errors
          : { message: "" };

        // next(new HttpError(responseFromListSites.message, status, errors));

        res.status(status).json({
          success: false,
          message: responseFromListSites.message,
          errors: responseFromListSites.errors
            ? responseFromListSites.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  createApproximateCoordinates: (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const {
        latitude,
        longitude,
        approximate_distance_in_km,
        bearing,
      } = req.body;

      const responseFromCreateApproximateCoordinates = createSiteUtil.createApproximateCoordinates(
        { latitude, longitude, approximate_distance_in_km, bearing },
        next
      );

      if (responseFromCreateApproximateCoordinates.success === true) {
        const status = responseFromCreateApproximateCoordinates.status
          ? responseFromCreateApproximateCoordinates.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateApproximateCoordinates.message,
          approximate_coordinates:
            responseFromCreateApproximateCoordinates.data,
        });
      } else {
        const status = responseFromCreateApproximateCoordinates.status
          ? responseFromCreateApproximateCoordinates.status
          : httpStatus.INTERNAL_SERVER_ERROR;

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
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
};

module.exports = manageSite;
