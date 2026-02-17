// research.routes.js
const express = require("express");
const router = express.Router();
const researchController = require("@controllers/research.controller");
const behavioralController = require("@controllers/behavioral.controller");
const { enhancedJWTAuth, optionalJWTAuth } = require("@middleware/passport");
const researchValidator = require("@validators/research.validators");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers);

// Consent Management
router.post(
  "/consent",
  enhancedJWTAuth,
  researchValidator.validateCreateConsent,
  researchController.createConsent,
);

// GET consent — auth optional: populates req.user if token present, but does
// not block unauthenticated requests; the util layer enforces its own access
// control checks using req.user when available
router.get(
  "/consent/:userId",
  optionalJWTAuth,
  researchValidator.validateUserIdParam,
  researchController.getConsent,
);

router.put(
  "/consent/:userId",
  enhancedJWTAuth,
  researchValidator.validateUpdateConsent,
  researchController.updateConsent,
);
router.delete(
  "/consent/:userId",
  enhancedJWTAuth,
  researchValidator.validateWithdrawal,
  researchController.withdrawFromStudy,
);

// Researcher-specific endpoints
router.get(
  "/behavioral-interventions/aggregate",
  enhancedJWTAuth,
  behavioralController.getAggregatedBehavioralData,
);

module.exports = router;
