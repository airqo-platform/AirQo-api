const httpStatus = require("http-status");
const { logObject, logText } = require("@utils/log");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const createGridUtil = require("@utils/create-grid");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-grid-controller`
);
const isEmpty = require("is-empty");

const createGrid = {
  /***************** admin levels associated with Grids ****************/
  listAdminLevels: async (req, res, next) => {
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

      const responseFromListAdminLevels = await createGridUtil.listAdminLevels(
        request,
        next
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
  updateAdminLevel: async (req, res, next) => {
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

      const responseFromUpdateAdminLevel = await createGridUtil.updateAdminLevel(
        request,
        next
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
          updated_admin_level: responseFromUpdateAdminLevel.data,
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
  deleteAdminLevel: async (req, res, next) => {
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

      const responseFromDeleteAdminLevel = await createGridUtil.deleteAdminLevel(
        request,
        next
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
  createAdminLevel: async (req, res, next) => {
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

      const responseFromCreateAdminLevel = await createGridUtil.createAdminLevel(
        request,
        next
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
  /******************* Grids ************************************************/
  create: async (req, res, next) => {
    logText("registering grid.............");
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

      const responseFromCreateGrid = await createGridUtil.create(request, next);
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

      const responseFromCalculateGeographicalCenter = await createGridUtil.calculateGeographicalCenter(
        request,
        next
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
      logText("inside delete grid............");
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

      const responseFromRemoveGrid = await createGridUtil.delete(request, next);

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

      const responseFromRefreshGrid = await createGridUtil.refresh(
        request,
        next
      );

      if (isEmpty(responseFromRefreshGrid)) {
        return;
      }
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
        return res.status(status).json({
          message: responseFromRefreshGrid.message,
          errors: responseFromRefreshGrid.errors
            ? responseFromRefreshGrid.errors
            : { message: "Internal Server Error" },
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

      const responseFromFindSites = await createGridUtil.findSites(
        request,
        next
      );

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
      logText("updating grid................");
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

      const responseFromUpdateGrid = await createGridUtil.update(request, next);

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
      logText(".....................................");
      logText("list all grids by query params provided");
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

      const responseFromListGrids = await createGridUtil.list(request, next);

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
      logText(".....................................");
      logText("list all grids by query params provided");
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

      const responseFromListGrids = await createGridUtil.list(request, next);

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
  listDashboard: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all grids by query params provided");
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

      const responseFromListGrids = await createGridUtil.list(request, next);

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

  /********************* managing Grids ***********************************/
  findGridUsingGPSCoordinates: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("findGridUsingGPSCoordinates............");
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

      const responseFromFindGridUsingGPSCoordinates = await createGridUtil.findGridUsingGPSCoordinates(
        request,
        next
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
  createGridFromShapefile: async (req, res, next) => {
    try {
      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "Not Yet Implemented",
        errors: { message: "Not Yet Implemented" },
      });
      logText("uploading the shapefile.....");

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

      const responseFromCreateGridFromShapefile = await createGridUtil.createGridFromShapefile(
        request,
        next
      );
      if (responseFromCreateGridFromShapefile.success === false) {
        const status = responseFromCreateGridFromShapefile.status
          ? responseFromCreateGridFromShapefile.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json(responseFromCreateGridFromShapefile);
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
  listAvailableSites: async (req, res, next) => {
    try {
      logText("listing available grids....");
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

      const responseFromListAvailableSites = await createGridUtil.listAvailableSites(
        request,
        next
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
  listAssignedSites: async (req, res, next) => {
    try {
      logText("listing assigned grids....");
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

      const responseFromListAssignedSites = await createGridUtil.listAssignedSites(
        request,
        next
      );

      if (responseFromListAssignedSites.success === true) {
        const status = responseFromListAssignedSites.status
          ? responseFromListAssignedSites.status
          : httpStatus.OK;
        if (responseFromListAssignedSites.data.length === 0) {
          return res.status(status).json({
            success: true,
            message: `no assigned sites to this grid ${req.params.grid_id}`,
            assigned_grids: [],
          });
        }
        return res.status(status).json({
          success: true,
          message: responseFromListAssignedSites.message,
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
  getSiteAndDeviceIds: async (req, res, next) => {
    try {
      logText("generate Sites and Devices from provided Grid ID....");
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

      const responseFromGetSiteAndDeviceIds = await createGridUtil.getSiteAndDeviceIds(
        request,
        next
      );

      if (responseFromGetSiteAndDeviceIds.success === true) {
        const status = responseFromGetSiteAndDeviceIds.status
          ? responseFromGetSiteAndDeviceIds.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromGetSiteAndDeviceIds.message,
          sites_and_devices: responseFromGetSiteAndDeviceIds.data,
        });
      } else if (responseFromGetSiteAndDeviceIds.success === false) {
        const status = responseFromGetSiteAndDeviceIds.status
          ? responseFromGetSiteAndDeviceIds.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromGetSiteAndDeviceIds.message,
          errors: responseFromGetSiteAndDeviceIds.errors
            ? responseFromGetSiteAndDeviceIds.errors
            : { message: "Internal Server Error" },
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
  filterOutPrivateSites: async (req, res, next) => {
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

      const filterResponse = await createGridUtil.filterOutPrivateSites(
        request,
        next
      );
      const status =
        filterResponse.status ||
        (filterResponse.success
          ? httpStatus.OK
          : httpStatus.INTERNAL_SERVER_ERROR);

      res.status(status).json({
        success: filterResponse.success,
        message: filterResponse.message,
        ...(filterResponse.success
          ? { sites: filterResponse.data }
          : {
              errors: filterResponse.errors || {
                message: "Internal Server Error",
              },
            }),
      });
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

module.exports = createGrid;
