const httpStatus = require("http-status");
const { v4: uuidv4 } = require("uuid");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-collocation controller`
);
const { CollocationService } = require("@utils/create-collocation");
const {
  CollocationDefaults,
  CollocationBatchStatus,
  CollocationBatchResult,
} = require("@models/CollocationBatch");
const { HttpError } = require("@utils/errors");
const handleResponse = (response) => {
  response.res.status().json(response.result);
};

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
      const userDetails = {};

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
  deleteCollocationBatch: async (req, res, next) => {
    try {
    } catch (error) {}
  },
  resetCollocationBatch: async (req, res, next) => {
    try {
    } catch (error) {}
  },
  getCollocationBatch: async (req, res, next) => {
    try {
    } catch (error) {}
  },
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
  getCollocationBatchData: async (req, res, next) => {
    try {
    } catch (error) {}
  },
  getCollocationBatchResults: async (req, res, next) => {
    try {
    } catch (error) {}
  },
  getCollocationDataCompleteness: async (req, res, next) => {
    try {
    } catch (error) {}
  },
  getCollocationDataStatistics: async (req, res, next) => {
    try {
    } catch (error) {}
  },
  getCollocationIntraSensorCorrelation: async (req, res, next) => {
    try {
    } catch (error) {}
  },
};

module.exports = collocationController;
