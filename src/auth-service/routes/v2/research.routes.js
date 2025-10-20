const express = require("express");
const router = express.Router();
const researchController = require("@controllers/research.controller");
const behavioralController = require("@controllers/behavioral.controller");
const { enhancedJWTAuth } = require("@middleware/passport");
const researchValidator = require("@validators/research.validators");

const headers = (req, res, next) => {
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};

router.use(headers);

// Consent Management
router.post(
  "/consent",
  enhancedJWTAuth,
  researchValidator.validateCreateConsent,
  researchController.createConsent
);
router.get(
  "/consent/:userId",
  enhancedJWTAuth,
  researchValidator.validateUserIdParam,
  researchController.getConsent
);
router.put(
  "/consent/:userId",
  enhancedJWTAuth,
  researchValidator.validateUpdateConsent,
  researchController.updateConsent
);
router.delete(
  "/consent/:userId",
  enhancedJWTAuth,
  researchValidator.validateWithdrawal,
  researchController.withdrawFromStudy
);

// Researcher-specific endpoints
router.get(
  "/behavioral-interventions/aggregate",
  enhancedJWTAuth,
  behavioralController.getAggregatedBehavioralData
);

module.exports = router;
