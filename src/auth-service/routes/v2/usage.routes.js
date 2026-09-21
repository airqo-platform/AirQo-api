// usage.routes.js
const express = require("express");
const router = express.Router();
const usageController = require("@controllers/usage.controller");
const usageValidations = require("@validators/usage.validators");
const constants = require("@config/constants");
const { enhancedJWTAuth } = require("@middleware/passport");
const { requirePermissions } = require("@middleware/permissionAuth");
const { createCustomRateLimiter } = require("@middleware/rate-limit.middleware");
const { headers } = require("@validators/common");

router.use(headers);

// Usage data is admin-only, mirroring the other audit/log readers.
const requireUsageAccess = requirePermissions([
  constants.SUPER_ADMIN,
  constants.AUDIT_VIEW,
]);

// Ingest: page-event beacon sent by the Nexus dashboard for the signed-in user.
// Limits are per client IP, so they are sized for shared office networks.
const eventsRateLimiter = createCustomRateLimiter({
  name: "usage_events",
  windowMs: 60 * 1000,
  max: 600,
  message: "Too many usage events, please slow down.",
});

router.post(
  "/events",
  usageValidations.events,
  eventsRateLimiter,
  enhancedJWTAuth,
  usageController.recordEvents,
);

// Per-user views
router.get(
  "/users/:userId/calendar",
  usageValidations.userCalendar,
  enhancedJWTAuth,
  requireUsageAccess,
  usageController.userCalendar,
);
router.get(
  "/users/:userId/summary",
  usageValidations.userSummary,
  enhancedJWTAuth,
  requireUsageAccess,
  usageController.userSummary,
);
router.get(
  "/users/:userId/breakdown",
  usageValidations.userBreakdown,
  enhancedJWTAuth,
  requireUsageAccess,
  usageController.userBreakdown,
);
router.get(
  "/users/:userId/timeline",
  usageValidations.userTimeline,
  enhancedJWTAuth,
  requireUsageAccess,
  usageController.userTimeline,
);
router.get(
  "/users/:userId/rhythm",
  usageValidations.userRhythm,
  enhancedJWTAuth,
  requireUsageAccess,
  usageController.userRhythm,
);

// Platform-wide views
router.get(
  "/overview",
  usageValidations.overview,
  enhancedJWTAuth,
  requireUsageAccess,
  usageController.overview,
);
router.get(
  "/pages",
  usageValidations.pages,
  enhancedJWTAuth,
  requireUsageAccess,
  usageController.pages,
);
router.get(
  "/users",
  usageValidations.users,
  enhancedJWTAuth,
  requireUsageAccess,
  usageController.users,
);
router.get(
  "/retention",
  usageValidations.retention,
  enhancedJWTAuth,
  requireUsageAccess,
  usageController.retention,
);

module.exports = router;
