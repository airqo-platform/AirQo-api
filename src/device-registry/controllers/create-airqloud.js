const httpStatus = require("http-status");
const { logObject, logElement, logText } = require("@utils/log");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const createAirQloudUtil = require("@utils/create-airqloud");
const constants = require("@config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-airqloud-controller`
);

const createAirqloud = {
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
      logger.error(`Internal Server Error ${error.message}`);
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
    logText("registering airqloud.............");
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

      const responseFromCreateAirQloud = await createAirQloudUtil.create(
        request
      );
      logObject(
        "responseFromCreateAirQloud in controller",
        responseFromCreateAirQloud
      );
      if (responseFromCreateAirQloud.success === true) {
        const status = responseFromCreateAirQloud.status
          ? responseFromCreateAirQloud.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateAirQloud.message,
          airqloud: responseFromCreateAirQloud.data,
        });
      } else if (responseFromCreateAirQloud.success === false) {
        const status = responseFromCreateAirQloud.status
          ? responseFromCreateAirQloud.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromCreateAirQloud.message,
          errors: responseFromCreateAirQloud.errors
            ? responseFromCreateAirQloud.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (errors) {
      logger.error(`Internal Server Error ${error.message}`);
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
  calculateGeographicalCenter: async (req, res, next) => {
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
          : { message: "Internal Server Error" };

        return res.status(status).json({
          success: false,
          message: responseFromCalculateGeographicalCenter.message,
          errors,
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
      logText("inside delete airqloud............");
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

      const responseFromRemoveAirQloud = await createAirQloudUtil.delete(
        request
      );

      if (responseFromRemoveAirQloud.success === true) {
        const status = responseFromRemoveAirQloud.status
          ? responseFromRemoveAirQloud.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveAirQloud.message,
          airqloud: responseFromRemoveAirQloud.data,
        });
      } else if (responseFromRemoveAirQloud.success === false) {
        const status = responseFromRemoveAirQloud.status
          ? responseFromRemoveAirQloud.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveAirQloud.message,
          errors: responseFromRemoveAirQloud.errors
            ? responseFromRemoveAirQloud.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (errors) {
      logger.error(`Internal Server Error ${error.message}`);
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

      const responseFromRefreshAirQloud = await createAirQloudUtil.refresh(
        request
      );
      if (responseFromRefreshAirQloud.success === true) {
        const status = responseFromRefreshAirQloud.status
          ? responseFromRefreshAirQloud.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromRefreshAirQloud.message,
          refreshed_airqloud: responseFromRefreshAirQloud.data,
        });
      } else if (responseFromRefreshAirQloud.success === false) {
        const status = responseFromRefreshAirQloud.status
          ? responseFromRefreshAirQloud.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromRefreshAirQloud.errors
          ? responseFromRefreshAirQloud.errors
          : { message: "Internal Server Error" };
        res.status(status).json({
          message: responseFromRefreshAirQloud.message,
          errors,
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
  findSites: async (req, res, next) => {
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

      const responseFromFindSites = await createAirQloudUtil.findSites(request);
      logObject("responseFromFindSites", responseFromFindSites);
      if (responseFromFindSites.success === true) {
        const status = responseFromFindSites.status
          ? responseFromFindSites.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          sites: responseFromFindSites.data,
          message: responseFromFindSites.message,
        });
      } else if (responseFromFindSites.success === false) {
        const status = responseFromFindSites.status
          ? responseFromFindSites.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromFindSites.message,
          errors: responseFromFindSites.errors
            ? responseFromFindSites.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
      logText("updating airqloud................");
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

      const responseFromUpdateAirQloud = await createAirQloudUtil.update(
        request
      );
      logObject("responseFromUpdateAirQloud", responseFromUpdateAirQloud);
      if (responseFromUpdateAirQloud.success === true) {
        const status = responseFromUpdateAirQloud.status
          ? responseFromUpdateAirQloud.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateAirQloud.message,
          airqloud: responseFromUpdateAirQloud.data,
        });
      } else if (responseFromUpdateAirQloud.success === false) {
        const status = responseFromUpdateAirQloud.status
          ? responseFromUpdateAirQloud.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateAirQloud.message,
          errors: responseFromUpdateAirQloud.errors
            ? responseFromUpdateAirQloud.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (errors) {
      logger.error(`Internal Server Error ${error.message}`);
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
      logText(".....................................");
      logText("list all airqlouds by query params provided");
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

      const responseFromListAirQlouds = await createAirQloudUtil.list(request);
      logElement(
        "has the response for listing airqlouds been successful?",
        responseFromListAirQlouds.success
      );
      if (responseFromListAirQlouds.success === true) {
        const status = responseFromListAirQlouds.status
          ? responseFromListAirQlouds.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListAirQlouds.message,
          airqlouds: responseFromListAirQlouds.data,
        });
      } else if (responseFromListAirQlouds.success === false) {
        const status = responseFromListAirQlouds.status
          ? responseFromListAirQlouds.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListAirQlouds.message,
          errors: responseFromListAirQlouds.errors
            ? responseFromListAirQlouds.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (errors) {
      logger.error(`Internal Server Error ${error.message}`);
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
      logText(".....................................");
      logText("list all airqlouds by query params provided");
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

      const responseFromListAirQlouds = await createAirQloudUtil.list(request);
      logElement(
        "has the response for listing airqlouds been successful?",
        responseFromListAirQlouds.success
      );
      if (responseFromListAirQlouds.success === true) {
        const status = responseFromListAirQlouds.status
          ? responseFromListAirQlouds.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListAirQlouds.message,
          airqlouds: responseFromListAirQlouds.data,
        });
      } else if (responseFromListAirQlouds.success === false) {
        const status = responseFromListAirQlouds.status
          ? responseFromListAirQlouds.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListAirQlouds.message,
          errors: responseFromListAirQlouds.errors
            ? responseFromListAirQlouds.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (errors) {
      logger.error(`Internal Server Error ${error.message}`);
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
  listDashboard: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all airqlouds by query params provided");
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

      request.query.category = "dashboard";

      const responseFromListAirQlouds = await createAirQloudUtil.list(request);
      logElement(
        "has the response for listing airqlouds been successful?",
        responseFromListAirQlouds.success
      );
      if (responseFromListAirQlouds.success === true) {
        const status = responseFromListAirQlouds.status
          ? responseFromListAirQlouds.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListAirQlouds.message,
          airqlouds: responseFromListAirQlouds.data,
        });
      } else if (responseFromListAirQlouds.success === false) {
        const status = responseFromListAirQlouds.status
          ? responseFromListAirQlouds.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListAirQlouds.message,
          errors: responseFromListAirQlouds.errors
            ? responseFromListAirQlouds.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (errors) {
      logger.error(`Internal Server Error ${error.message}`);
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
  listCohortsAndGrids: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all Cohorts and Grids by query params provided");
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

      request.query.dashboard = "yes";

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
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListCohortsAndGrids.message,
          airqlouds: responseFromListCohortsAndGrids.data,
        });
      } else if (responseFromListCohortsAndGrids.success === false) {
        const status = responseFromListCohortsAndGrids.status
          ? responseFromListCohortsAndGrids.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListCohortsAndGrids.message,
          errors: responseFromListCohortsAndGrids.errors
            ? responseFromListCohortsAndGrids.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (errors) {
      logger.error(`Internal Server Error ${error.message}`);
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
  listCohortsAndGridsSummary: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all Cohorts and Grids by query params provided");
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

      request.query.dashboard = "yes";
      request.query.category = "summary";

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
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListCohortsAndGrids.message,
          airqlouds: responseFromListCohortsAndGrids.data,
        });
      } else if (responseFromListCohortsAndGrids.success === false) {
        const status = responseFromListCohortsAndGrids.status
          ? responseFromListCohortsAndGrids.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListCohortsAndGrids.message,
          errors: responseFromListCohortsAndGrids.errors
            ? responseFromListCohortsAndGrids.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (errors) {
      logger.error(`Internal Server Error ${error.message}`);
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

module.exports = createAirqloud;
