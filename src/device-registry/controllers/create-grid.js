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
const isEmpty = require("is-empty");

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

      let responseFromListAdminLevels = await createGridUtil.listAdminLevels(
        request
      );
      logObject(
        "responseFromListAdminLevels in controller",
        responseFromListAdminLevels
      );
      if (responseFromListAdminLevels.success === true) {
        const status = responseFromListAdminLevels.status
          ? responseFromListAdminLevels.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListAdminLevels.message,
          admin_levels: responseFromListAdminLevels.data,
        });
      } else if (responseFromListAdminLevels.success === false) {
        const status = responseFromListAdminLevels.status
          ? responseFromListAdminLevels.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromListAdminLevels.message,
          errors: responseFromListAdminLevels.errors
            ? responseFromListAdminLevels.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
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

      const responseFromUpdateAdminLevel = await createGridUtil.updateAdminLevel(
        request
      );
      logObject(
        "responseFromUpdateAdminLevel in controller",
        responseFromUpdateAdminLevel
      );
      if (responseFromUpdateAdminLevel.success === true) {
        const status = responseFromUpdateAdminLevel.status
          ? responseFromUpdateAdminLevel.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateAdminLevel.message,
          admin_levels: responseFromUpdateAdminLevel.data,
        });
      } else if (responseFromUpdateAdminLevel.success === false) {
        const status = responseFromUpdateAdminLevel.status
          ? responseFromUpdateAdminLevel.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateAdminLevel.message,
          errors: responseFromUpdateAdminLevel.errors
            ? responseFromUpdateAdminLevel.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
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

      const responseFromDeleteAdminLevel = await createGridUtil.deleteAdminLevel(
        request
      );
      logObject(
        "responseFromDeleteAdminLevel in controller",
        responseFromDeleteAdminLevel
      );
      if (responseFromDeleteAdminLevel.success === true) {
        const status = responseFromDeleteAdminLevel.status
          ? responseFromDeleteAdminLevel.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeleteAdminLevel.message,
          admin_levels: responseFromDeleteAdminLevel.data,
        });
      } else if (responseFromDeleteAdminLevel.success === false) {
        const status = responseFromDeleteAdminLevel.status
          ? responseFromDeleteAdminLevel.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromDeleteAdminLevel.message,
          errors: responseFromDeleteAdminLevel.errors
            ? responseFromDeleteAdminLevel.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
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

      const responseFromCreateAdminLevel = await createGridUtil.createAdminLevel(
        request
      );
      logObject(
        "responseFromCreateAdminLevel in controller",
        responseFromCreateAdminLevel
      );
      if (responseFromCreateAdminLevel.success === true) {
        const status = responseFromCreateAdminLevel.status
          ? responseFromCreateAdminLevel.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateAdminLevel.message,
          admin_levels: responseFromCreateAdminLevel.data,
        });
      } else if (responseFromCreateAdminLevel.success === false) {
        const status = responseFromCreateAdminLevel.status
          ? responseFromCreateAdminLevel.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromCreateAdminLevel.message,
          errors: responseFromCreateAdminLevel.errors
            ? responseFromCreateAdminLevel.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: errors.message },
      });
    }
  },
  /******************* Grids ************************************************/
  create: async (req, res) => {
    logText("registering grid.............");
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

      let responseFromCreateGrid = await createGridUtil.create(request);
      // logObject("responseFromCreateGrid in controller", responseFromCreateGrid);
      if (responseFromCreateGrid.success === true) {
        const status = responseFromCreateGrid.status
          ? responseFromCreateGrid.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateGrid.message,
          grid: responseFromCreateGrid.data,
        });
      } else if (responseFromCreateGrid.success === false) {
        const status = responseFromCreateGrid.status
          ? responseFromCreateGrid.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromCreateGrid.message,
          errors: responseFromCreateGrid.errors
            ? responseFromCreateGrid.errors
            : { message: "Internal Server Error" },
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
          : { message: "Internal Server Error" };

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
      logText(".................................................");
      logText("inside delete grid............");
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

      const responseFromRemoveGrid = await createGridUtil.delete(request);

      if (responseFromRemoveGrid.success === true) {
        const status = responseFromRemoveGrid.status
          ? responseFromRemoveGrid.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveGrid.message,
          grid: responseFromRemoveGrid.data,
        });
      } else if (responseFromRemoveGrid.success === false) {
        const status = responseFromRemoveGrid.status
          ? responseFromRemoveGrid.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveGrid.message,
          errors: responseFromRemoveGrid.errors
            ? responseFromRemoveGrid.errors
            : { message: "Internal Server Error" },
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

      const responseFromRefreshGrid = await createGridUtil.refresh(request);
      if (responseFromRefreshGrid.success === true) {
        const status = responseFromRefreshGrid.status
          ? responseFromRefreshGrid.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRefreshGrid.message,
          refreshed_grid: responseFromRefreshGrid.data,
        });
      } else if (responseFromRefreshGrid.success === false) {
        const status = responseFromRefreshGrid.status
          ? responseFromRefreshGrid.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromRefreshGrid.errors
          ? responseFromRefreshGrid.errors
          : { message: "Internal Server Error" };
        return res.status(status).json({
          message: responseFromRefreshGrid.message,
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
      const { query } = req;
      let { tenant } = query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }
      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;
      let responseFromFindSites = await createGridUtil.findSites(request);
      logObject("responseFromFindSites", responseFromFindSites);
      if (responseFromFindSites.success === true) {
        const status = responseFromFindSites.status
          ? responseFromFindSites.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          sites: responseFromFindSites.data,
          message: responseFromFindSites.message,
        });
      } else if (responseFromFindSites.success === false) {
        const status = responseFromFindSites.status
          ? responseFromFindSites.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromFindSites.message,
          errors: responseFromFindSites.errors
            ? responseFromFindSites.errors
            : { message: "Internal Server Error" },
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
  update: async (req, res) => {
    try {
      logText("updating grid................");
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
      let responseFromUpdateGrid = await createGridUtil.update(request);
      logObject("responseFromUpdateGrid", responseFromUpdateGrid);
      if (responseFromUpdateGrid.success === true) {
        const status = responseFromUpdateGrid.status
          ? responseFromUpdateGrid.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateGrid.message,
          grid: responseFromUpdateGrid.data,
        });
      } else if (responseFromUpdateGrid.success === false) {
        const status = responseFromUpdateGrid.status
          ? responseFromUpdateGrid.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateGrid.message,
          errors: responseFromUpdateGrid.errors
            ? responseFromUpdateGrid.errors
            : { message: "Internal Server Error" },
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
      logText(".....................................");
      logText("list all grids by query params provided");
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

      const responseFromListGrids = await createGridUtil.list(request);
      logElement(
        "has the response for listing grids been successful?",
        responseFromListGrids.success
      );
      if (responseFromListGrids.success === true) {
        const status = responseFromListGrids.status
          ? responseFromListGrids.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListGrids.message,
          grids: responseFromListGrids.data,
        });
      } else if (responseFromListGrids.success === false) {
        const status = responseFromListGrids.status
          ? responseFromListGrids.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListGrids.message,
          errors: responseFromListGrids.errors
            ? responseFromListGrids.errors
            : { message: "Internal Server Error" },
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
  listSummary: async (req, res) => {
    try {
      logText(".....................................");
      logText("list all grids by query params provided");
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
      request["query"]["summary"] = "yes";
      let responseFromListGrids = await createGridUtil.list(request);
      logElement(
        "has the response for listing grids been successful?",
        responseFromListGrids.success
      );
      if (responseFromListGrids.success === true) {
        const status = responseFromListGrids.status
          ? responseFromListGrids.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListGrids.message,
          grids: responseFromListGrids.data,
        });
      } else if (responseFromListGrids.success === false) {
        const status = responseFromListGrids.status
          ? responseFromListGrids.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListGrids.message,
          errors: responseFromListGrids.errors
            ? responseFromListGrids.errors
            : { message: "Internal Server Error" },
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
  listDashboard: async (req, res) => {
    try {
      logText(".....................................");
      logText("list all grids by query params provided");
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
      request["query"]["dashboard"] = "yes";

      const responseFromListGrids = await createGridUtil.list(request);
      logElement(
        "has the response for listing grids been successful?",
        responseFromListGrids.success
      );
      if (responseFromListGrids.success === true) {
        const status = responseFromListGrids.status
          ? responseFromListGrids.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListGrids.message,
          grids: responseFromListGrids.data,
        });
      } else if (responseFromListGrids.success === false) {
        const status = responseFromListGrids.status
          ? responseFromListGrids.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListGrids.message,
          errors: responseFromListGrids.errors
            ? responseFromListGrids.errors
            : { message: "Internal Server Error" },
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

  /********************* managing Grids ***********************************/
  findGridUsingGPSCoordinates: async (req, res) => {
    try {
      const { query } = req;
      let { tenant } = query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }
      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;
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
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  createGridFromShapefile: async (req, res) => {
    try {
      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "Not Yet Implemented",
        errors: { message: "Not Yet Implemented" },
      });
      logText("uploading the shapefile.....");
      const { query } = req;
      let { tenant } = query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_NETWORK;
      }
      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;
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
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
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
      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "Not Yet Implemented",
        errors: { message: "Not Yet Implemented" },
      });
      logText("listing available grids....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
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

      const responseFromListAvailableSites = await createGridUtil.listAvailableSites(
        request
      );

      logObject(
        "responseFromListAvailableSites in controller",
        responseFromListAvailableSites
      );

      if (responseFromListAvailableSites.success === true) {
        const status = responseFromListAvailableSites.status
          ? responseFromListAvailableSites.status
          : httpStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromListAvailableSites.message,
          available_grids: responseFromListAvailableSites.data,
        });
      } else if (responseFromListAvailableSites.success === false) {
        const status = responseFromListAvailableSites.status
          ? responseFromListAvailableSites.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListAvailableSites.message,
          errors: responseFromListAvailableSites.errors
            ? responseFromListAvailableSites.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logElement("internal server error", error.message);
      logger.error(`internal server error -- ${error.message}`);
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
      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "Not Yet Implemented",
        errors: { message: "Not Yet Implemented" },
      });
      logText("listing assigned grids....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
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

      const responseFromListAssignedSites = await createGridUtil.listAssignedSites(
        request
      );

      logObject(
        "responseFromListAssignedSites in controller",
        responseFromListAssignedSites
      );

      if (responseFromListAssignedSites.success === true) {
        const status = responseFromListAssignedSites.status
          ? responseFromListAssignedSites.status
          : httpStatus.OK;
        if (responseFromListAssignedSites.data.length === 0) {
          return res.status(status).json({
            success: true,
            message: "no assigned grids to this grid",
            assigned_grids: [],
          });
        }
        return res.status(status).json({
          success: true,
          message: "successfully retrieved the assigned grids for this grid",
          assigned_grids: responseFromListAssignedSites.data,
        });
      } else if (responseFromListAssignedSites.success === false) {
        const status = responseFromListAssignedSites.status
          ? responseFromListAssignedSites.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromListAssignedSites.message,
          errors: responseFromListAssignedSites.errors
            ? responseFromListAssignedSites.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logElement("internal server error", error.message);
      logger.error(`internal server error -- ${error.message}`);
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
      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "Not Yet Implemented",
        errors: { message: "Not Yet Implemented" },
      });
      logText("assign many grids....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
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

      const responseFromAssignSites = await createGridUtil.assignManySitesToGrid(
        request
      );

      if (responseFromAssignSites.success === true) {
        const status = responseFromAssignSites.status
          ? responseFromAssignSites.status
          : httpStatus.OK;

        return res.status(status).json({
          message: responseFromAssignSites.message,
          updated_grid: responseFromAssignSites.data,
          success: true,
        });
      } else if (responseFromAssignSites.success === false) {
        const status = responseFromAssignSites.status
          ? responseFromAssignSites.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromAssignSites.message,
          errors: responseFromAssignSites.errors
            ? responseFromAssignSites.errors
            : { message: "Internal Server Error" },
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
      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "Not Yet Implemented",
        errors: { message: "Not Yet Implemented" },
      });
      logText("unAssign grid....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
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

      const responseFromUnassignManySites = await createGridUtil.unAssignManySitesFromGrid(
        request
      );

      logObject("responseFromUnassignManySites", responseFromUnassignManySites);

      if (responseFromUnassignManySites.success === true) {
        const status = responseFromUnassignManySites.status
          ? responseFromUnassignManySites.status
          : httpStatus.OK;

        return res.status(status).json({
          message: "grids successully unassigned",
          updated_records: responseFromUnassignManySites.data,
          success: true,
        });
      } else if (responseFromUnassignManySites.success === false) {
        const status = responseFromUnassignManySites.status
          ? responseFromUnassignManySites.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUnassignManySites.message,
          errors: responseFromUnassignManySites.errors
            ? responseFromUnassignManySites.errors
            : { message: "Internal Server Errors" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  assignOneSiteToGrid: async (req, res) => {
    try {
      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "Not Yet Implemented",
        errors: { message: "Not Yet Implemented" },
      });
      logText("assign one grid....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
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

      const responseFromUpdateNetwork = await createGridUtil.assignOneSiteToGrid(
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
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  unAssignOneSiteFromGrid: async (req, res) => {
    try {
      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "Not Yet Implemented",
        errors: { message: "Not Yet Implemented" },
      });
      logText("unAssign grid....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return errors.badRequest(
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

      const responseFromUnassignSite = await createGridUtil.unAssignOneSiteFromGrid(
        request
      );

      logObject("responseFromUnassignSite", responseFromUnassignSite);

      if (responseFromUnassignSite.success === true) {
        const status = responseFromUnassignSite.status
          ? responseFromUnassignSite.status
          : httpStatus.OK;

        return res.status(status).json({
          message: "grid successully unassigned",
          updated_records: responseFromUnassignSite.data,
          success: true,
        });
      } else if (responseFromUnassignSite.success === false) {
        const status = responseFromUnassignSite.status
          ? responseFromUnassignSite.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUnassignSite.message,
          errors: responseFromUnassignSite.errors
            ? responseFromUnassignSite.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createGrid;
