const httpStatus = require("http-status");
const { v4: uuidv4 } = require("uuid");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- collocation controller`
);
const { CollocationService } = require("@utils/collocation.util");
const {
  CollocationDefaults,
  CollocationBatchStatus,
  CollocationBatchResult,
} = require("@models/CollocationBatch");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const moment = require("moment");

const collocationController = {
  exportCollocationData: async (req, res, next) => {
    try {
      logText("exporting collocation data....");
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

      const result = await collocationUtil.exportCollection(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        // Send file for download
        const filePath = result.data;
        const fileName = path.basename(filePath);

        return res.download(filePath, fileName, (err) => {
          if (err) {
            next(
              new HttpError(
                "Error downloading file",
                httpStatus.INTERNAL_SERVER_ERROR,
                {
                  message: err.message,
                }
              )
            );
          }
          // Optionally cleanup the temp file after sending
          // Note: this might not execute if client aborts download
          require("fs").unlink(filePath, (err) => {
            if (err) logger.error(`Error deleting temp file: ${err.message}`);
          });
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },
  saveCollocationBatch: async (req, res, next) => {
    try {
      logText("creating collocation batch...");

      // Validate request body
      const validationSchema = {
        startDate: { type: "date", required: true },
        endDate: { type: "date", required: true },
        devices: { type: "array", required: true },
        batchName: { type: "string", required: false },
        baseDevice: { type: "string", required: false },
        expectedRecordsPerHour: { type: "number", required: false },
        dataCompletenessThreshold: { type: "number", required: false },
        intraCorrelationThreshold: { type: "number", required: false },
        interCorrelationThreshold: { type: "number", required: false },
        intraCorrelationR2Threshold: { type: "number", required: false },
        interCorrelationR2Threshold: { type: "number", required: false },
        differencesThreshold: { type: "number", required: false },
        interCorrelationParameter: { type: "string", required: false },
        intraCorrelationParameter: { type: "string", required: false },
        dataCompletenessParameter: { type: "string", required: false },
        differencesParameter: { type: "string", required: false },
        interCorrelationAdditionalParameters: {
          type: "array",
          required: false,
        },
      };

      const errors = validateRequestBody(req.body, validationSchema);
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

      // Extract user token and decode
      const token = request.query.TOKEN || request.query.token || "";
      let userDetails = {};
      if (token.trim()) {
        userDetails = await decodeUserToken(token);
      }

      // Add user details to request
      request.userDetails = userDetails;

      const result = await collocationBatchUtil.saveCollocationBatch(
        request,
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          data: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },
  deleteCollocationBatch: async (req, res, next) => {
    try {
      logText("deleting collocation batch....");
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

      if (isEmpty(request.query.batchId)) {
        next(
          new HttpError("batchId is required", httpStatus.BAD_REQUEST, {
            message: "batchId parameter is missing",
          })
        );
        return;
      }

      // Parse devices from query string
      const devices = isEmpty(request.query.devices)
        ? []
        : request.query.devices
            .split(",")
            .map((d) => d.trim())
            .filter((d) => d !== "");

      const result = await collocationUtil.deleteBatch(request, devices, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      // Handle complete deletion case (no remaining batch)
      if (result.deleted) {
        return res.status(httpStatus.NO_CONTENT).json({
          success: true,
          message: "Successfully deleted collocation batch",
        });
      }

      // Handle partial deletion case (remaining devices)
      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message || "Successfully updated collocation batch",
          data: result.data,
        });
      } else {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message:
            result.message || "Failed to delete/update collocation batch",
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },
  resetCollocationBatch: async (req, res, next) => {
    try {
      logText("resetting collocation batch....");
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

      // Validate required batchId
      if (isEmpty(request.query.batchId)) {
        next(
          new HttpError("batchId is required", httpStatus.BAD_REQUEST, {
            message: "batchId is required",
          })
        );
        return;
      }

      // Get the batch and validate JSON data
      const result = await collocationUtil.resetBatch(
        request.query.batchId,
        request.body,
        request.query.tenant,
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message || "Successfully reset collocation batch",
          data: result.data,
        });
      } else {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message || "Failed to reset collocation batch",
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },
  getCollocationBatch: async (req, res, next) => {
    try {
      logText("fetching collocation batch data....");
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

      if (isEmpty(request.query.batchId)) {
        next(
          new HttpError("batchId is required", httpStatus.BAD_REQUEST, {
            message: "batchId parameter is missing",
          })
        );
        return;
      }

      const result = await collocationUtil.getBatchData(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message:
            result.message || "Successfully retrieved collocation batch data",
          data: result.data,
        });
      } else {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message:
            result.message || "Failed to retrieve collocation batch data",
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },
  getCollocationSummary: async (req, res, next) => {
    try {
      logText("fetching collocation summary....");
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

      const result = await collocationUtil.getSummary(
        request.query.tenant,
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message:
            result.message || "Successfully retrieved collocation summary",
          data: result.data,
        });
      } else {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message || "Failed to retrieve collocation summary",
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },
  getCollocationBatchData: async (req, res, next) => {
    try {
      logText("getting collocation batch data...");
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

      // Validate required batchId
      if (isEmpty(request.query.batchId)) {
        next(
          new HttpError("batchId is required", httpStatus.BAD_REQUEST, {
            message: "batchId is required",
          })
        );
        return;
      }

      // Parse devices if provided
      let devices = [];
      if (!isEmpty(request.query.devices)) {
        devices = request.query.devices
          .split(",")
          .map((device) => device.trim());
      }

      const result = await collocationUtil.getHourlyData(
        request,
        devices,
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          data: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },
  getCollocationBatchResults: async (req, res, next) => {
    try {
      logText("getting collocation batch results...");
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

      // Validate required batchId
      if (isEmpty(request.query.batchId)) {
        next(
          new HttpError("batchId is required", httpStatus.BAD_REQUEST, {
            message: "batchId is required",
          })
        );
        return;
      }

      const result = await collocationUtil.getBatchResults(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          data: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },
  getCollocationDataCompleteness: async (req, res, next) => {
    try {
      logText("getting collocation data completeness...");
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

      // Validate required batchId
      if (isEmpty(request.query.batchId)) {
        next(
          new HttpError("batchId is required", httpStatus.BAD_REQUEST, {
            message: "batchId is required",
          })
        );
        return;
      }

      // Parse devices if provided
      let devices = [];
      if (!isEmpty(request.query.devices)) {
        devices = request.query.devices
          .split(",")
          .map((device) => device.trim());
      }

      const result = await collocationUtil.getDataCompleteness(
        request,
        devices,
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          data: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },
  getCollocationDataStatistics: async (req, res, next) => {
    try {
      logText("getting collocation statistics...");
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

      // Validate required batchId
      if (isEmpty(request.query.batchId)) {
        next(
          new HttpError("batchId is required", httpStatus.BAD_REQUEST, {
            message: "batchId is required",
          })
        );
        return;
      }

      // Parse devices if provided
      let devices = [];
      if (!isEmpty(request.query.devices)) {
        devices = request.query.devices
          .split(",")
          .map((device) => device.trim());
      }

      const result = await collocationUtil.getStatistics(
        request,
        devices,
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          data: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },
  getCollocationIntraSensorCorrelation: async (req, res, next) => {
    try {
      logText("fetching collocation batch data....");
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

      // Validate required batchId
      if (isEmpty(request.query.batchId)) {
        next(
          new HttpError("batchId is required", httpStatus.BAD_REQUEST, {
            message: "batchId is required",
          })
        );
        return;
      }

      // Parse devices if provided
      const devices = isEmpty(request.query.devices)
        ? []
        : request.query.devices.split(",");

      const result = await collocationUtil.getIntraSensorCorrelation(
        request.query.batchId,
        devices,
        request.query.tenant,
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message || "Successfully retrieved collocation data",
          data: result.data,
        });
      } else {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message || "Failed to retrieve collocation data",
          errors: result.errors ? result.errors : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },
};

module.exports = collocationController;
