const httpStatus = require("http-status");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const gridUtil = require("@utils/grid.util");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- grid-controller`);
const isEmpty = require("is-empty");

const handleRequest = (req, next) => {
  const errors = extractErrorsFromRequest(req);
  if (errors) {
    next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
    return null;
  }
  const request = req;
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  request.query.tenant = isEmpty(req.query.tenant)
    ? defaultTenant
    : req.query.tenant;
  return request;
};

const handleError = (error, next) => {
  logger.error(`🐛🐛 Internal Server Error ${error.message}`);
  next(
    new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
      message: error.message,
    })
  );
};

function handleResponse({ res, result, key = "data" }) {
  if (!result || res.headersSent) {
    return;
  }

  const { success, status, data, message, errors, ...rest } = result;

  const responseStatus =
    status || (success ? httpStatus.OK : httpStatus.INTERNAL_SERVER_ERROR);

  if (success) {
    const responseBody = {
      success: true,
      message: message || "Operation Successful",
      ...rest,
    };
    if (data !== undefined) {
      responseBody[key] = data;
    }
    return res.status(responseStatus).json(responseBody);
  } else {
    return res.status(responseStatus).json({
      success: false,
      message: message || "An unexpected error occurred.",
      errors: errors || { message: "An unexpected error occurred." },
    });
  }
}

const createGrid = {
  /***************** admin levels associated with Grids ****************/
  listAdminLevels: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await gridUtil.listAdminLevels(request, next);
      handleResponse({ res, result, key: "admin_levels" });
    } catch (error) {
      handleError(error, next);
    }
  },
  updateAdminLevel: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await gridUtil.updateAdminLevel(request, next);
      handleResponse({ res, result, key: "updated_admin_level" });
    } catch (error) {
      handleError(error, next);
    }
  },
  deleteAdminLevel: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await gridUtil.deleteAdminLevel(request, next);
      handleResponse({ res, result, key: "admin_levels" });
    } catch (error) {
      handleError(error, next);
    }
  },
  createAdminLevel: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await gridUtil.createAdminLevel(request, next);
      handleResponse({ res, result, key: "admin_levels" });
    } catch (error) {
      handleError(error, next);
    }
  },
  /******************* Grids ************************************************/
  create: async (req, res, next) => {
    logText("registering grid.............");
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await gridUtil.create(request, next);
      handleResponse({ res, result, key: "grid" });
    } catch (error) {
      handleError(error, next);
    }
  },
  calculateGeographicalCenter: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await gridUtil.calculateGeographicalCenter(request, next);
      handleResponse({ res, result, key: "center_point" });
    } catch (error) {
      handleError(error, next);
    }
  },
  delete: async (req, res, next) => {
    try {
      logText(".................................................");
      logText("inside delete grid............");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await gridUtil.delete(request, next);
      handleResponse({ res, result, key: "grid" });
    } catch (error) {
      handleError(error, next);
    }
  },
  refresh: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await gridUtil.refresh(request, next);
      handleResponse({ res, result, key: "refreshed_grid" });
    } catch (error) {
      handleError(error, next);
    }
  },
  findSites: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await gridUtil.findSites(request, next);
      handleResponse({ res, result, key: "sites" });
    } catch (error) {
      handleError(error, next);
    }
  },
  update: async (req, res, next) => {
    try {
      logText("updating grid................");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await gridUtil.update(request, next);
      handleResponse({ res, result, key: "grid" });
    } catch (error) {
      handleError(error, next);
    }
  },
  list: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all grids by query params provided");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await gridUtil.list(request, next);
      handleResponse({ res, result, key: "grids" });
    } catch (error) {
      handleError(error, next);
    }
  },
  listSummary: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all grids by query params provided");
      const request = handleRequest(req, next);
      if (!request) return;

      request.query.detailLevel = "summary";

      const result = await gridUtil.list(request, next);
      handleResponse({ res, result, key: "grids" });
    } catch (error) {
      handleError(error, next);
    }
  },
  listDashboard: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all grids by query params provided");
      const request = handleRequest(req, next);
      if (!request) return;

      request.query.detailLevel = "full";

      const result = await gridUtil.list(request, next);
      handleResponse({ res, result, key: "grids" });
    } catch (error) {
      handleError(error, next);
    }
  },
  updateShape: async (req, res, next) => {
    try {
      logText("updating grid shape................");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await gridUtil.updateShape(request, next);
      handleResponse({ res, result, key: "grid" });
    } catch (error) {
      handleError(error, next);
    }
  },

  /********************* managing Grids ***********************************/
  findGridUsingGPSCoordinates: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("findGridUsingGPSCoordinates............");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await gridUtil.findGridUsingGPSCoordinates(request, next);
      handleResponse({ res, result, key: "grid" });
    } catch (error) {
      handleError(error, next);
    }
  },
  createGridFromShapefile: async (req, res, next) => {
    try {
      logText("uploading the shapefile.....");
      const request = handleRequest(req, next);
      if (!request) return;

      // This functionality is not yet implemented.
      return handleResponse({
        res,
        result: {
          success: false,
          message: "NOT YET IMPLEMENTED",
          status: httpStatus.NOT_IMPLEMENTED,
          errors: { message: "NOT YET IMPLEMENTED" },
        },
      });

      const result = await gridUtil.createGridFromShapefile(request, next);
      handleResponse({ res, result });
    } catch (error) {
      handleError(error, next);
    }
  },
  listAvailableSites: async (req, res, next) => {
    try {
      logText("listing available grids....");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await gridUtil.listAvailableSites(request, next);
      handleResponse({ res, result, key: "available_grids" });
    } catch (error) {
      handleError(error, next);
    }
  },
  listAssignedSites: async (req, res, next) => {
    try {
      logText("listing assigned grids....");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await gridUtil.listAssignedSites(request, next);
      handleResponse({ res, result, key: "assigned_grids" });
    } catch (error) {
      handleError(error, next);
    }
  },
  getSiteAndDeviceIds: async (req, res, next) => {
    try {
      logText("generate Sites and Devices from provided Grid ID....");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await gridUtil.getSiteAndDeviceIds(request, next);
      handleResponse({ res, result, key: "sites_and_devices" });
    } catch (error) {
      handleError(error, next);
    }
  },
  filterOutPrivateSites: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await gridUtil.filterOutPrivateSites(request, next);
      handleResponse({ res, result, key: "sites" });
    } catch (error) {
      handleError(error, next);
    }
  },
  findNearestCountry: async (req, res, next) => {
    try {
      logText("finding nearest country based on GPS coordinates...");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await gridUtil.findNearestCountry(request, next);
      handleResponse({ res, result, key: "nearest_countries" });
    } catch (error) {
      handleError(error, next);
    }
  },
};

module.exports = createGrid;
