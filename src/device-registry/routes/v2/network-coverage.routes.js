// network-coverage.routes.js
// Mounted at /api/v2/devices/network-coverage
const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const networkCoverageController = require("@controllers/network-coverage.controller");
const networkCoverageValidations = require("@validators/network-coverage.validators");
const { headers, validate } = require("@validators/common");
const { verifyCaptcha } = require("@middleware/captcha.middleware");

// Rate limiter for public registry write endpoints.
// 20 requests per hour per IP — generous for a form, strict enough to deter
// automated spam. Adjust windowMs / limit before high-traffic launch.
const registryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests — please try again later.",
    errors: { message: "Rate limit exceeded. Max 20 submissions per hour." },
  },
});

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

router.get(
  "/export.pdf",
  networkCoverageValidations.exportCsv,
  validate,
  networkCoverageController.exportPdf
);

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
// Registry management – intentionally unauthenticated (public submission form)
// POST   /network-coverage/registry               – upsert registry entry
// DELETE /network-coverage/registry/:registryId   – remove registry entry
//
// THREAT MODEL / ACCEPTED RISKS:
// These routes are deliberately public (no token required) to support a
// Google-Form-style public submission flow on the Network Coverage map page,
// where external contributors can add or update monitor metadata without an
// AirQo account.
//
// Accepted risks:
//   - Any anonymous caller can create or overwrite a registry entry.
//   - Any anonymous caller can delete a registry entry by its _id.
//
// Mitigations in place:
//   - Registry writes never touch the Sites or Devices collections; the worst
//     outcome is junk data in the network_coverage_registry collection.
//   - Input is validated by networkCoverageValidations before the controller.
//   - The nginx bypass is method-scoped to POST and DELETE only, so GET/PUT
//     on /registry still require a valid token.
//   - IP-based rate limiting: 20 requests per hour per IP (registryLimiter).
//   - CAPTCHA: verifyCaptcha middleware is wired in; enforced once
//     HCAPTCHA_SECRET_KEY is set in the environment (currently a no-op).
//     See src/device-registry/middleware/captcha.middleware.js for setup steps.
// ---------------------------------------------------------------------------
router.post(
  "/registry",
  registryLimiter,
  verifyCaptcha,
  networkCoverageValidations.upsertRegistry,
  validate,
  networkCoverageController.upsertRegistry
);

router.delete(
  "/registry/:registryId",
  registryLimiter,
  verifyCaptcha,
  networkCoverageValidations.deleteRegistry,
  validate,
  networkCoverageController.deleteRegistry
);

module.exports = router;
