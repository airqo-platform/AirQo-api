// routes/organization-requests.routes.js
const express = require("express");
const router = express.Router();
const organizationRequestController = require("@controllers/organization-request.controller");
const organizationRequestValidations = require("@validators/organization-requests.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { requireSystemAdmin } = require("@middleware/adminAccess");
const rateLimit = require("express-rate-limit");
const onboardingLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const { validate, headers, pagination } = require("@validators/common");

router.use(headers);
router.use(organizationRequestValidations.pagination);

// Create organization request (public endpoint)
router.post(
  "/",
  organizationRequestValidations.create,
  validate,
  organizationRequestController.create
);

// Get all organization requests (AirQo Admin only)
router.get(
  "/",
  enhancedJWTAuth,
  requireSystemAdmin(),
  organizationRequestValidations.list,
  validate,
  organizationRequestController.list
);

// Approve organization request (AirQo Admin only)
router.patch(
  "/:request_id/approve",
  enhancedJWTAuth,
  requireSystemAdmin(),
  organizationRequestValidations.approve,
  validate,
  organizationRequestController.approve
);

router.get(
  "/slug-availability/:slug",
  organizationRequestValidations.checkSlugAvailability,
  validate,
  organizationRequestController.checkSlugAvailability
);

// Validate onboarding token
router.get(
  "/onboarding/validate/:token",
  onboardingLimiter,
  organizationRequestValidations.validateOnboardingToken,
  validate,
  organizationRequestController.validateOnboardingToken
);

// Complete onboarding setup
router.post(
  "/onboarding/complete",
  onboardingLimiter,
  organizationRequestValidations.completeOnboarding,
  validate,
  organizationRequestController.completeOnboarding
);

// Reject organization request (AirQo Admin only)
router.patch(
  "/:request_id/reject",
  enhancedJWTAuth,
  requireSystemAdmin(),
  organizationRequestValidations.reject,
  validate,
  organizationRequestController.reject
);

// Get organization request by ID (AirQo Admin only)
router.get(
  "/:request_id",
  enhancedJWTAuth,
  requireSystemAdmin(),
  organizationRequestValidations.getById,
  validate,
  organizationRequestController.getById
);

module.exports = router;
