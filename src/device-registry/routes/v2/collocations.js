const express = require("express");
const router = express.Router();
const collocationController = require("@controllers/create-collocation");
const {
  validateCollocationBatch,
  validateCollocationParams,
  validateCollocationReset,
} = require("@validators/collocation.validators");

// Export Collection Route
router.get("/export-collection", collocationController.exportCollocationData);

// Create Collocation Batch Route
router.post(
  "",
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
  "",
  validateCollocationParams,
  collocationController.getCollocationBatch
);

// Get Collocation Summary Route
router.get("/summary", collocationController.getCollocationSummary);

// Get Collocation Batch Data Route
router.get(
  "/data",
  validateCollocationParams,
  collocationController.getCollocationBatchData
);

// Get Collocation Batch Results Route
router.get(
  "/results",
  validateCollocationParams,
  collocationController.getCollocationBatchResults
);

// Get Collocation Data Completeness Route
router.get(
  "/data-completeness",
  validateCollocationParams,
  collocationController.getCollocationDataCompleteness
);

// Get Collocation Data Statistics Route
router.get(
  "/statistics",
  validateCollocationParams,
  collocationController.getCollocationDataStatistics
);

// Get Collocation Intra Sensor Correlation Route
router.get(
  "/intra",
  validateCollocationParams,
  collocationController.getCollocationIntraSensorCorrelation
);

module.exports = router;
