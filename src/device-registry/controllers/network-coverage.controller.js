// network-coverage.controller.js
const httpStatus = require("http-status");
const {
  logObject,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const networkCoverageUtil = require("@utils/network-coverage.util");
const constants = require("@config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- network-coverage-controller`
);

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

function sendResponse(res, result, key = "data") {
  if (!result || res.headersSent) return;
  const { success, status, data, message, errors, ...rest } = result;
  const responseStatus =
    status || (success ? httpStatus.OK : httpStatus.INTERNAL_SERVER_ERROR);

  if (success) {
    const body = { success: true, message: message || "Operation Successful", ...rest };
    if (data !== undefined) body[key] = data;
    return res.status(responseStatus).json(body);
  }

  return res.status(responseStatus).json({
    success: false,
    message: message || "An unexpected error occurred.",
    errors: errors || { message: "An unexpected error occurred." },
  });
}

const networkCoverageController = {
  /**
   * GET /network-coverage
   * Primary page payload – all countries and their monitor points.
   */
  list: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await networkCoverageUtil.list(request, next);

      if (!result || res.headersSent) return;
      const { success, status, data, message, errors } = result;
      const responseStatus =
        status || (success ? httpStatus.OK : httpStatus.INTERNAL_SERVER_ERROR);

      if (success && data) {
        // Flatten the data object so countries and meta are top-level keys
        return res.status(responseStatus).json({
          success: true,
          message: message || "Operation Successful",
          countries: data.countries,
          meta: data.meta,
        });
      }

      return res.status(responseStatus).json({
        success: false,
        message: message || "An unexpected error occurred.",
        errors: errors || { message: "An unexpected error occurred." },
      });
    } catch (error) {
      handleError(error, next);
    }
  },

  /**
   * GET /network-coverage/monitors/:monitorId
   * Fetch a single monitor's full detail.
   */
  getMonitor: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await networkCoverageUtil.getMonitor(request, next);
      sendResponse(res, result, "monitor");
    } catch (error) {
      handleError(error, next);
    }
  },

  /**
   * GET /network-coverage/countries/:countryId/monitors
   * All monitors for a specific country.
   */
  getCountryMonitors: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await networkCoverageUtil.getCountryMonitors(
        request,
        next
      );

      if (!result || res.headersSent) return;
      const { success, status, data, message, errors } = result;
      const responseStatus =
        status || (success ? httpStatus.OK : httpStatus.INTERNAL_SERVER_ERROR);

      if (success && data) {
        return res.status(responseStatus).json({
          success: true,
          message: message || "Operation Successful",
          countryId: data.countryId,
          country: data.country,
          iso2: data.iso2,
          monitors: data.monitors,
        });
      }

      return res.status(responseStatus).json({
        success: false,
        message: message || "An unexpected error occurred.",
        errors: errors || { message: "An unexpected error occurred." },
      });
    } catch (error) {
      handleError(error, next);
    }
  },

  /**
   * GET /network-coverage/export.csv
   * Download CSV export of (filtered) monitor list.
   */
  exportCsv: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await networkCoverageUtil.exportCsv(request, next);

      if (!result || res.headersSent) return;

      if (result.success) {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="network-coverage.csv"'
        );
        return res.status(httpStatus.OK).send(result.data);
      }

      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message || "Export failed",
        errors: result.errors || {},
      });
    } catch (error) {
      handleError(error, next);
    }
  },

  /**
   * GET /network-coverage/export.pdf
   * PDF export – not yet implemented.
   */
  exportPdf: async (req, res, next) => {
    return res.status(httpStatus.NOT_IMPLEMENTED).json({
      success: false,
      message: "PDF export is not yet implemented",
      errors: { message: "Use export.csv for data exports" },
    });
  },

  /**
   * POST /network-coverage/registry
   * Create or update extended metadata for a monitor.
   */
  upsertRegistry: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await networkCoverageUtil.upsertRegistry(request, next);
      sendResponse(res, result, "registry");
    } catch (error) {
      handleError(error, next);
    }
  },

  /**
   * DELETE /network-coverage/registry/:siteId
   * Remove a registry entry for a site.
   */
  deleteRegistry: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await networkCoverageUtil.deleteRegistry(request, next);
      sendResponse(res, result, "registry");
    } catch (error) {
      handleError(error, next);
    }
  },
};

module.exports = networkCoverageController;
