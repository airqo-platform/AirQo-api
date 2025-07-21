const express = require("express");
const router = express.Router();
const collocationController = require("@controllers/collocation.controller");
const {
  validateCollocationBatch,
  validateCollocationParams,
  validateCollocationReset,
} = require("@validators/collocation.validators");

const { headers, pagination } = require("@validators/common");
router.use(headers);

// Export Collection Route
router.get(
  "/export-collection",
  pagination(),
  collocationController.exportCollocationData
);

// Create Collocation Batch Route
router.post(
  "/",
  validateCollocationBatch,
  collocationController.saveCollocationBatch
);

// Delete Collocation Batch Route
router.delete(
  "/",
  validateCollocationParams,
  collocationController.deleteCollocationBatch
);

// Reset Collocation Batch Route
router.patch(
  "/reset",
  validateCollocationParams,
  validateCollocationReset,
  collocationController.resetCollocationBatch
);

// Get Collocation Batch Route
router.get(
  "/",
  validateCollocationParams,
  pagination(),
  collocationController.getCollocationBatch
);

// Get Collocation Summary Route
router.get(
  "/summary",
  pagination(),
  collocationController.getCollocationSummary
);

// Get Collocation Batch Data Route
router.get(
  "/data",
  validateCollocationParams,
  pagination(),
  collocationController.getCollocationBatchData
);

// Get Collocation Batch Results Route
router.get(
  "/results",
  validateCollocationParams,
  pagination(),
  collocationController.getCollocationBatchResults
);

// Get Collocation Data Completeness Route
router.get(
  "/data-completeness",
  validateCollocationParams,
  pagination(),
  collocationController.getCollocationDataCompleteness
);

// Get Collocation Data Statistics Route
router.get(
  "/statistics",
  validateCollocationParams,
  pagination(),
  collocationController.getCollocationDataStatistics
);

// Get Collocation Intra Sensor Correlation Route
router.get(
  "/intra",
  validateCollocationParams,
  pagination(),
  collocationController.getCollocationIntraSensorCorrelation
);

module.exports = router;
