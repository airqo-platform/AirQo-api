const httpStatus = require("http-status");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- event-v3-controller`
);
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const isEmpty = require("is-empty");
const createEventUtilV3 = require("@utils/event.v3.util");

// Import shared helper functions from V2
const {
  handleResponse,
  handleEnhancedErrorResponse,
  getSitesFromAirQloud,
  getSitesFromGrid,
  getDevicesFromCohort,
  getSitesFromLatitudeAndLongitude,
  processGridIds,
  processCohortIds,
  processAirQloudIds,
} = require("@controllers/event.controller");

const createEventV2 = require("@controllers/event.controller");

const createEventV3 = {
  listV3: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      delete request.query.internal;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      logText("[V3] Listing events with intelligent routing...");
      const { site_id, device_id, site, device } = {
        ...req.params,
        ...req.query,
      };

      if (!isEmpty(site_id) || !isEmpty(site)) {
        request.query.recent = "no";
        request.query.metadata = "site_id";
      }

      if (!isEmpty(device_id) || !isEmpty(device)) {
        request.query.recent = "no";
        request.query.metadata = "device_id";
      }

      request.query.brief = "yes";

      const result = await createEventUtilV3.listV3(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      logObject("[V3] Result for listing events", result);
      const status = result.status || httpStatus.OK;

      if (result.success === true) {
        res.status(status).json({
          success: true,
          isCache: result.isCache,
          message: result.message,
          meta: result.data[0].meta,
          measurements: result.data[0].data,
          version: "v3", // ✅ Version indicator
        });
      } else {
        return handleEnhancedErrorResponse(result, res);
      }
    } catch (error) {
      logger.error(`🐛🐛 [V3] Internal Server Error ${error.message}`);
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

  listRecentV3: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      delete request.query.internal;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.query.recent = "yes";
      request.query.metadata = "site_id";
      request.query.brief = "yes";
      const { cohort_id, grid_id, site_id } = { ...req.query, ...req.params };

      let locationErrors = 0;

      if (cohort_id) {
        await processCohortIds(cohort_id, request);
        if (isEmpty(request.query.device_id)) {
          locationErrors++;
        }
      } else if (grid_id) {
        await processGridIds(grid_id, request);
        if (isEmpty(request.query.site_id)) {
          locationErrors++;
        }
      } else if (!isEmpty(site_id)) {
        request.query.site_id = site_id;
      }

      if (locationErrors === 0) {
        logObject("[V3] Request query", request.query);

        const result = await createEventUtilV3.listV3(request, next);

        if (isEmpty(result) || res.headersSent) {
          return;
        }

        logObject("[V3] Result for listing events", result);
        if (result.success === true) {
          const status = result.status ? result.status : httpStatus.OK;

          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: result.data[0].data,
            version: "v3",
          });
        } else {
          return handleEnhancedErrorResponse(result, res);
        }
      } else {
        res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          errors: {
            message: `Unable to process measurements for the provided measurement IDs`,
          },
          message: "Bad Request Error",
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 [V3] Internal Server Error ${error.message}`);
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

  listHistoricalV3: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      delete request.query.internal;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
      request.query.recent = "no";
      request.query.metadata = "site_id";
      request.query.brief = "yes";
      const { cohort_id, grid_id } = { ...req.query, ...req.params };
      let locationErrors = 0;
      if (cohort_id) {
        await processCohortIds(cohort_id, request);
        if (isEmpty(request.query.device_id)) {
          locationErrors++;
        }
      } else if (grid_id) {
        await processGridIds(grid_id, request);
        if (isEmpty(request.query.site_id)) {
          locationErrors++;
        }
      }

      if (locationErrors === 0) {
        const result = await createEventUtilV3.listV3(request, next);

        if (isEmpty(result) || res.headersSent) {
          return;
        }

        logObject("[V3] Result for listing events", result);
        if (result.success === true) {
          const status = result.status ? result.status : httpStatus.OK;
          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: result.data[0].data,
            version: "v3",
          });
        } else {
          return handleEnhancedErrorResponse(result, res);
        }
      } else {
        res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          errors: {
            message: `Unable to process measurements - crosscheck if provided IDs exist`,
          },
          message: "Bad Request Error",
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 [V3] Internal Server Error ${error.message}`);
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

  listByGridV3: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      delete request.query.internal;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.query.metadata = "site_id";
      request.query.brief = "yes";
      request.query.recent = "yes";
      const { grid_id } = { ...req.query, ...req.params };

      let locationErrors = 0;

      if (grid_id) {
        await processGridIds(grid_id, request);
        if (isEmpty(request.query.site_id)) {
          locationErrors++;
        }
      }

      if (locationErrors === 0) {
        logObject("[V3] Request query for grid", request.query);
        const result = await createEventUtilV3.listV3(request, next);

        if (isEmpty(result) || res.headersSent) {
          return;
        }

        logObject("[V3] Result for grid listing", result);

        if (result.success === true) {
          const status = result.status ? result.status : httpStatus.OK;
          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: result.data[0].data,
            version: "v3",
          });
        } else {
          return handleEnhancedErrorResponse(result, res);
        }
      } else {
        res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          errors: {
            message: `Unable to process measurements for the provided Grid IDs ${grid_id}`,
          },
          message: "Bad Request Error",
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 [V3] Internal Server Error ${error.message}`);
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

  listByGridHistoricalV3: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      delete request.query.internal;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.query.metadata = "site_id";
      request.query.brief = "yes";
      request.query.recent = "no";

      const { grid_id } = { ...req.query, ...req.params };

      let locationErrors = 0;

      if (grid_id) {
        await processGridIds(grid_id, request);
        if (isEmpty(request.query.site_id)) {
          locationErrors++;
        }
      }

      if (locationErrors === 0) {
        logObject("[V3] Request query for grid historical", request.query);
        const result = await createEventUtilV3.listV3(request, next);

        if (isEmpty(result) || res.headersSent) {
          return;
        }

        logObject("[V3] Result for grid historical", result);

        if (result.success === true) {
          const status = result.status ? result.status : httpStatus.OK;
          res.status(status).json({
            success: true,
            isCache: result.isCache,
            message: result.message,
            meta: result.data[0].meta,
            measurements: result.data[0].data,
            version: "v3",
          });
        } else {
          return handleEnhancedErrorResponse(result, res);
        }
      } else {
        res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          errors: {
            message: `Unable to process measurements for the provided Grid IDs ${grid_id}`,
          },
          message: "Bad Request Error",
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 [V3] Internal Server Error ${error.message}`);
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

  listGoodV3: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      delete request.query.internal;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.query.index = "good";
      request.query.metadata = "site_id";
      request.query.brief = "yes";

      const result = await createEventUtilV3.listV3(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      logObject("[V3] Result for good events", result);
      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        res.status(status).json({
          success: true,
          isCache: result.isCache,
          message: result.message,
          meta: result.data[0].meta,
          measurements: result.data[0].data,
          version: "v3",
        });
      } else {
        return handleEnhancedErrorResponse(result, res);
      }
    } catch (error) {
      logger.error(`🐛🐛 [V3] Internal Server Error ${error.message}`);
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

  listModerateV3: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      delete request.query.internal;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.query.index = "moderate";
      request.query.metadata = "site_id";
      request.query.brief = "yes";

      const result = await createEventUtilV3.listV3(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      logObject("[V3] Result for moderate events", result);
      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        res.status(status).json({
          success: true,
          isCache: result.isCache,
          message: result.message,
          meta: result.data[0].meta,
          measurements: result.data[0].data,
          version: "v3",
        });
      } else {
        return handleEnhancedErrorResponse(result, res);
      }
    } catch (error) {
      logger.error(`🐛🐛 [V3] Internal Server Error ${error.message}`);
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

  listU4sgV3: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      delete request.query.internal;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
      request.query.index = "u4sg";
      request.query.metadata = "site_id";
      request.query.brief = "yes";

      const result = await createEventUtilV3.listV3(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      logObject("[V3] Result for u4sg events", result);
      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        res.status(status).json({
          success: true,
          isCache: result.isCache,
          message: result.message,
          meta: result.data[0].meta,
          measurements: result.data[0].data,
          version: "v3",
        });
      } else {
        return handleEnhancedErrorResponse(result, res);
      }
    } catch (error) {
      logger.error(`🐛🐛 [V3] Internal Server Error ${error.message}`);
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

  listUnhealthyV3: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      delete request.query.internal;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
      request.query.index = "unhealthy";
      request.query.metadata = "site_id";
      request.query.brief = "yes";

      const result = await createEventUtilV3.listV3(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }
      logObject("[V3] Result for unhealthy events", result);
      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        res.status(status).json({
          success: true,
          isCache: result.isCache,
          message: result.message,
          meta: result.data[0].meta,
          measurements: result.data[0].data,
          version: "v3",
        });
      } else {
        return handleEnhancedErrorResponse(result, res);
      }
    } catch (error) {
      logger.error(`🐛🐛 [V3] Internal Server Error ${error.message}`);
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

  listVeryUnhealthyV3: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      delete request.query.internal;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
      request.query.index = "very_unhealthy";
      request.query.metadata = "site_id";
      request.query.brief = "yes";

      const result = await createEventUtilV3.listV3(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }
      logObject("[V3] Result for very unhealthy events", result);
      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        res.status(status).json({
          success: true,
          isCache: result.isCache,
          message: result.message,
          meta: result.data[0].meta,
          measurements: result.data[0].data,
          version: "v3",
        });
      } else {
        return handleEnhancedErrorResponse(result, res);
      }
    } catch (error) {
      logger.error(`🐛🐛 [V3] Internal Server Error ${error.message}`);
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

  listHazardousV3: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      delete request.query.internal;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
      request.query.index = "hazardous";
      request.query.metadata = "site_id";
      request.query.brief = "yes";

      const result = await createEventUtilV3.listV3(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }
      logObject("[V3] Result for hazardous events", result);
      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        res.status(status).json({
          success: true,
          isCache: result.isCache,
          message: result.message,
          meta: result.data[0].meta,
          measurements: result.data[0].data,
          version: "v3",
        });
      } else {
        return handleEnhancedErrorResponse(result, res);
      }
    } catch (error) {
      logger.error(`🐛🐛 [V3] Internal Server Error ${error.message}`);
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

  deleteV3: async (req, res, next) => {
    logText("[V3] Delegating to V2 delete function");
    return createEventV2.delete(req, res, next);
  },

  getDeploymentStatsV3: async (req, res, next) => {
    logText("[V3] Delegating to V2 getDeploymentStats function");
    return createEventV2.getDeploymentStats(req, res, next);
  },

  validateDeviceContextV3: async (req, res, next) => {
    logText("[V3] Delegating to V2 validateDeviceContext function");
    return createEventV2.validateDeviceContext(req, res, next);
  },

  addValuesV3: async (req, res, next) => {
    logText("[V3] Delegating to V2 addValues function");
    return createEventV2.addValues(req, res, next);
  },

  transformV3: async (req, res, next) => {
    logText("[V3] Delegating to V2 transform function");
    return createEventV2.transform(req, res, next);
  },

  transmitMultipleSensorValuesV3: async (req, res, next) => {
    logText("[V3] Delegating to V2 transmitMultipleSensorValues function");
    return createEventV2.transmitMultipleSensorValues(req, res, next);
  },

  bulkTransmitMultipleSensorValuesV3: async (req, res, next) => {
    logText("[V3] Delegating to V2 bulkTransmitMultipleSensorValues function");
    return createEventV2.bulkTransmitMultipleSensorValues(req, res, next);
  },

  // ... Add similar V3 functions for:
  // - listByAirQloudV3
  // - listByAirQloudHistoricalV3
  // - listByCohortV3
  // - listByCohortHistoricalV3
  // - etc.
};

module.exports = createEventV3;
