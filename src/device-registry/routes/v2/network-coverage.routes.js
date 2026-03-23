// network-coverage.routes.js
// Mounted at /api/v2/devices/network-coverage
const express = require("express");
const router = express.Router();
const networkCoverageController = require("@controllers/network-coverage.controller");
const networkCoverageValidations = require("@validators/network-coverage.validators");
const { headers, validate } = require("@validators/common");

router.use(headers);

// ---------------------------------------------------------------------------
// Primary endpoint – coverage map + sidebar data
// GET /network-coverage
// ---------------------------------------------------------------------------
router.get(
  "/",
  networkCoverageValidations.list,
  validate,
  networkCoverageController.list
);

// ---------------------------------------------------------------------------
// Export endpoints
// GET /network-coverage/export.csv
// GET /network-coverage/export.pdf
// ---------------------------------------------------------------------------
router.get(
  "/export.csv",
  networkCoverageValidations.exportCsv,
  validate,
  networkCoverageController.exportCsv
);

router.get("/export.pdf", networkCoverageController.exportPdf);

// ---------------------------------------------------------------------------
// Single monitor detail
// GET /network-coverage/monitors/:monitorId
// ---------------------------------------------------------------------------
router.get(
  "/monitors/:monitorId",
  networkCoverageValidations.getMonitor,
  validate,
  networkCoverageController.getMonitor
);

// ---------------------------------------------------------------------------
// Country monitor list
// GET /network-coverage/countries/:countryId/monitors
// ---------------------------------------------------------------------------
router.get(
  "/countries/:countryId/monitors",
  networkCoverageValidations.getCountryMonitors,
  validate,
  networkCoverageController.getCountryMonitors
);

// ---------------------------------------------------------------------------
// Registry management (admin operations for extended metadata)
// POST   /network-coverage/registry               – upsert registry entry
// DELETE /network-coverage/registry/:registryId   – remove registry entry
// ---------------------------------------------------------------------------
router.post(
  "/registry",
  networkCoverageValidations.upsertRegistry,
  validate,
  networkCoverageController.upsertRegistry
);

router.delete(
  "/registry/:registryId",
  networkCoverageValidations.deleteRegistry,
  validate,
  networkCoverageController.deleteRegistry
);

module.exports = router;
