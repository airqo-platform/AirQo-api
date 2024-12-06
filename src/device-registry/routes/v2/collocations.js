const express = require("express");
const router = express.Router();
const collocationController = require("@controllers/collocation");
const { validateToken } = require("@middleware/auth");
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
  validateToken,
  validateCollocationBatch,
  collocationController.saveCollocationBatch
);

// Delete Collocation Batch Route
router.delete(
  "",
  validateToken,
  validateCollocationParams,
  collocationController.deleteCollocationBatch
);

// Reset Collocation Batch Route
router.patch(
  "/reset",
  validateToken,
  validateCollocationParams,
  validateCollocationReset,
  collocationController.resetCollocationBatch
);

// Get Collocation Batch Route
router.get(
  "",
  validateToken,
  validateCollocationParams,
  collocationController.getCollocationBatch
);

// Get Collocation Summary Route
router.get("/summary", collocationController.getCollocationSummary);

// Get Collocation Batch Data Route
router.get(
  "/data",
  validateToken,
  validateCollocationParams,
  collocationController.getCollocationBatchData
);

// Get Collocation Batch Results Route
router.get(
  "/results",
  validateToken,
  validateCollocationParams,
  collocationController.getCollocationBatchResults
);

// Get Collocation Data Completeness Route
router.get(
  "/data-completeness",
  validateToken,
  validateCollocationParams,
  collocationController.getCollocationDataCompleteness
);

// Get Collocation Data Statistics Route
router.get(
  "/statistics",
  validateToken,
  validateCollocationParams,
  collocationController.getCollocationDataStatistics
);

// Get Collocation Intra Sensor Correlation Route
router.get(
  "/intra",
  validateToken,
  validateCollocationParams,
  collocationController.getCollocationIntraSensorCorrelation
);

module.exports = router;
