const httpStatus = require("http-status");
const { logObject, logElement, logText } = require("@utils/log");
const { validationResult } = require("express-validator");
const errors = require("@utils/errors");
const createGridUtil = require("@utils/create-grid");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-grid-controller`
);
/**
 * Grids are for grouping Sites
 */

const createGrid = {
  /***************** admin levels associated with Grids ****************/
  listAdminLevels: async (req, res) => {
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
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;
    } catch (error) {
      logger.error(`internal server error -- ${errors.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
    }
  },
  updateAdminLevel: async (req, res) => {
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
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;
    } catch (error) {
      logger.error(`internal server error -- ${errors.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
    }
  },
  deleteAdminLevel: async (req, res) => {
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
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;
    } catch (error) {
      logger.error(`internal server error -- ${errors.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
    }
  },
  createAdminLevel: async (req, res) => {
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
        tenant = constants.DEFAULT_NETWORK;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;
    } catch (error) {
      logger.error(`internal server error -- ${errors.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
    }
  },
  /******************* Grids ****************/
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

      let responseFromCreateAirQloud = await createGridUtil.create(request);
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
            : { message: "" },
        });
      }
    } catch (errors) {
      logger.error(`internal server error -- ${errors.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
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

      const responseFromCalculateGeographicalCenter = await createGridUtil.calculateGeographicalCenter(
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
      const responseFromRemoveAirQloud = await createGridUtil.delete(request);

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
            : { message: "" },
        });
      }
    } catch (errors) {
      logger.error(`internal server error -- ${errors.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
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
      const responseFromRefreshAirQloud = await createGridUtil.refresh(request);
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
          : { message: "" };
        res.status(status).json({
          message: responseFromRefreshAirQloud.message,
          errors,
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
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
      let responseFromFindSites = await createGridUtil.findSites(request);
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
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
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
      let responseFromUpdateAirQloud = await createGridUtil.update(request);
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
            : { message: "" },
        });
      }
    } catch (errors) {
      logger.error(`internal server error -- ${errors.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
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
      let responseFromListAirQlouds = await createGridUtil.list(request);
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
            : { message: "" },
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
      let responseFromListAirQlouds = await createGridUtil.list(request);
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
            : { message: "" },
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
          logger.error(`internal server error -- ${e.message}`);
        }
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      request["query"] = query;
      request["query"]["dashboard"] = "yes";
      let responseFromListAirQlouds = await createGridUtil.list(request);
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
            : { message: "" },
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

  /********************* managing Grids *******************/
  findGridUsingGPSCoordinates: async (req, res) => {
    try {
      const request = Object.assign({}, req);
      const responseFromFindGridUsingGPSCoordinates = await createGridUtil.findGridUsingGPSCoordinates(
        request
      );
      if (responseFromFindGridUsingGPSCoordinates.success === false) {
        const status = responseFromFindGridUsingGPSCoordinates.status
          ? responseFromFindGridUsingGPSCoordinates.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromFindGridUsingGPSCoordinates.message,
          errors: responseFromFindGridUsingGPSCoordinates.errors
            ? responseFromFindGridUsingGPSCoordinates.errors
            : { message: "Internal Server Error" },
        });
      } else {
        const status = responseFromFindGridUsingGPSCoordinates.status
          ? responseFromFindGridUsingGPSCoordinates.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromFindGridUsingGPSCoordinates.message,
          grid: responseFromFindGridUsingGPSCoordinates.data,
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
  createGridFromShapefile: async (req, res) => {
    try {
      const request = Object.assign({}, req);
      const responseFromCreateGridFromShapefile = await createGridUtil.createGridFromShapefile(
        request
      );
      if (responseFromCreateGridFromShapefile.success === false) {
        const status = responseFromCreateGridFromShapefile.status
          ? responseFromCreateGridFromShapefile.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json(responseFromCreateGridFromShapefile);
      }
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        errors: { message: error.message },
        message: "Internal Server Error",
      });
    }
  },
  listAvailableSites: async (req, res) => {
    /**a bit similar to findSites
     * the difference: findSites returns all associated Sites
     * this one returned those valid ones which are not yet assigned to the provided Grid
     */
    try {
      logText("listing available users....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromListAvailableUsers = await createNetworkUtil.listAvailableUsers(
        request
      );

      logObject(
        "responseFromListAvailableUsers in controller",
        responseFromListAvailableUsers
      );

      if (responseFromListAvailableUsers.success === true) {
        const status = responseFromListAvailableUsers.status
          ? responseFromListAvailableUsers.status
          : httpStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromListAvailableUsers.message,
          available_users: responseFromListAvailableUsers.data,
        });
      } else if (responseFromListAvailableUsers.success === false) {
        const status = responseFromListAvailableUsers.status
          ? responseFromListAvailableUsers.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListAvailableUsers.message,
          errors: responseFromListAvailableUsers.errors
            ? responseFromListAvailableUsers.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logElement("internal server error", error.message);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  listAssignedSites: async (req, res) => {
    /**
     * just retrieve all Sites which have been assigned to the proviced Grid
     */
    try {
      logText("listing assigned users....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      let request = Object.assign({}, req);

      request.query.tenant = tenant;

      const responseFromListAssignedUsers = await createNetworkUtil.listAssignedUsers(
        request
      );

      logObject(
        "responseFromListAssignedUsers in controller",
        responseFromListAssignedUsers
      );

      if (responseFromListAssignedUsers.success === true) {
        const status = responseFromListAssignedUsers.status
          ? responseFromListAssignedUsers.status
          : httpStatus.OK;
        if (responseFromListAssignedUsers.data.length === 0) {
          return res.status(status).json({
            success: true,
            message: "no assigned users to this network",
            assigned_users: [],
          });
        }
        return res.status(status).json({
          success: true,
          message: "successfully retrieved the assigned users for this network",
          assigned_users: responseFromListAssignedUsers.data,
        });
      } else if (responseFromListAssignedUsers.success === false) {
        const status = responseFromListAssignedUsers.status
          ? responseFromListAssignedUsers.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromListAssignedUsers.message,
          errors: responseFromListAssignedUsers.errors
            ? responseFromListAssignedUsers.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logElement("internal server error", error.message);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  assignManySitesToGrid: async (req, res) => {
    /**
     * same as refresh?
     * Have some input validations
     * deal with all the corresponding edge cases appropriately
     * this is where we are also able to ensure that only Sites with Devices are added
     */
    try {
      logText("assign many users....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromAssignUsers = await createNetworkUtil.assignUsers(
        request
      );

      if (responseFromAssignUsers.success === true) {
        const status = responseFromAssignUsers.status
          ? responseFromAssignUsers.status
          : httpStatus.OK;

        return res.status(status).json({
          message: responseFromAssignUsers.message,
          updated_network: responseFromAssignUsers.data,
          success: true,
        });
      } else if (responseFromAssignUsers.success === false) {
        const status = responseFromAssignUsers.status
          ? responseFromAssignUsers.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromAssignUsers.message,
          errors: responseFromAssignUsers.errors
            ? responseFromAssignUsers.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  unAssignManySitesFromGrid: async (req, res) => {
    try {
      logText("unAssign user....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromUnassignManyUsers = await createNetworkUtil.unAssignManyUsers(
        request
      );

      logObject("responseFromUnassignManyUsers", responseFromUnassignManyUsers);

      if (responseFromUnassignManyUsers.success === true) {
        const status = responseFromUnassignManyUsers.status
          ? responseFromUnassignManyUsers.status
          : httpStatus.OK;

        return res.status(status).json({
          message: "users successully unassigned",
          updated_records: responseFromUnassignManyUsers.data,
          success: true,
        });
      } else if (responseFromUnassignManyUsers.success === false) {
        const status = responseFromUnassignManyUsers.status
          ? responseFromUnassignManyUsers.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUnassignManyUsers.message,
          errors: responseFromUnassignManyUsers.errors
            ? responseFromUnassignManyUsers.errors
            : { message: "Internal Server Errors" },
        });
      }
    } catch (error) {
      logObject("error", error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  assignOneSiteToGrid: async (req, res) => {
    /***
     *do appropriate input validations in the util
     */
    try {
      logText("assign one user....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromUpdateNetwork = await createNetworkUtil.assignOneUser(
        request
      );

      if (responseFromUpdateNetwork.success === true) {
        const status = responseFromUpdateNetwork.status
          ? responseFromUpdateNetwork.status
          : httpStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromUpdateNetwork.message,
          updated_records: responseFromUpdateNetwork.data,
        });
      } else if (responseFromUpdateNetwork.success === false) {
        const status = responseFromUpdateNetwork.status
          ? responseFromUpdateNetwork.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateNetwork.message,
          errors: responseFromUpdateNetwork.errors
            ? responseFromUpdateNetwork.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logObject("error", error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  unAssignOneSiteFromGrid: async (req, res) => {
    try {
      logText("unAssign user....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromUnassignUser = await createNetworkUtil.unAssignUser(
        request
      );

      logObject("responseFromUnassignUser", responseFromUnassignUser);

      if (responseFromUnassignUser.success === true) {
        const status = responseFromUnassignUser.status
          ? responseFromUnassignUser.status
          : httpStatus.OK;

        return res.status(status).json({
          message: "user successully unassigned",
          updated_records: responseFromUnassignUser.data,
          success: true,
        });
      } else if (responseFromUnassignUser.success === false) {
        const status = responseFromUnassignUser.status
          ? responseFromUnassignUser.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUnassignUser.message,
          errors: responseFromUnassignUser.errors
            ? responseFromUnassignUser.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logObject("error", error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createGrid;
