const httpStatus = require("http-status");
const { v4: uuidv4 } = require("uuid");
const logger = require("@utils/logger");
const { CollocationService } = require("@services/collocation");
const { decodeUserToken } = require("@utils/auth");
const {
  CollocationDefaults,
  CollocationBatchStatus,
  CollocationBatchResult,
} = require("@models/collocation");
const { HttpError } = require("@utils/errors");
const { handleResponse } = require("@utils/response");
const moment = require("moment");

const collocationController = {
  exportCollocationData: async (req, res, next) => {
    try {
      const collocationService = new CollocationService();
      const filePath = await collocationService.exportCollection();

      return res.download(filePath);
    } catch (error) {
      logger.error(`Export Collocation Data Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  saveCollocationBatch: async (req, res, next) => {
    try {
      const {
        devices = [],
        baseDevice = null,
        startDate,
        endDate,
        batchName = uuidv4()
          .replace(/-/g, "")
          .slice(0, 8)
          .toUpperCase(),
        expectedRecordsPerHour = CollocationDefaults.ExpectedRecordsPerHour,
        dataCompletenessThreshold = CollocationDefaults.DataCompletenessThreshold,
        // ... other parameters similar to Python version
      } = req.body;

      const userToken = req.headers.authorization?.split(" ")[1] || "";
      const userDetails = userToken ? decodeUserToken(userToken) : {};

      const batch = {
        batchId: "", // will be set by service
        batchName,
        devices: [...new Set(devices)],
        baseDevice,
        startDate: moment(startDate).toDate(),
        endDate: moment(endDate).toDate(),
        dateCreated: new Date(),
        expectedHourlyRecords: expectedRecordsPerHour,
        // ... map other parameters similar to Python version
        createdBy: userDetails,
        status: CollocationBatchStatus.SCHEDULED,
        results: CollocationBatchResult.emptyResults(),
        errors: [],
      };

      const collocationService = new CollocationService();
      const savedBatch = await collocationService.saveBatch(batch);

      handleResponse({
        res,
        result: {
          success: true,
          data: savedBatch.toApiOutput(),
        },
      });
    } catch (error) {
      logger.error(`Save Collocation Batch Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // Other methods following similar patterns for:
  // - deleteCollocationBatch
  // - resetCollocationBatch
  // - getCollocationBatch
  // - getCollocationSummary
  // - getCollocationBatchData
  // - getCollocationBatchResults
  // - getCollocationDataCompleteness
  // - getCollocationDataStatistics
  // - getCollocationIntraSensorCorrelation

  // Example of one more method to illustrate:
  getCollocationSummary: async (req, res, next) => {
    try {
      const collocationService = new CollocationService();
      const summary = await collocationService.getSummary();

      handleResponse({
        res,
        result: {
          success: true,
          data: summary,
        },
      });
    } catch (error) {
      logger.error(`Get Collocation Summary Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = collocationController;
