const express = require("express");
const router = express.Router();
const researchController = require("@controllers/research.controller");
const behavioralController = require("@controllers/behavioral.controller");
const { setJWTAuth, authJWT } = require("@middleware/passport");
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
router.use(setJWTAuth);
router.use(authJWT);

// Consent Management
router.post(
  "/consent",
  researchValidator.validateCreateConsent,
  researchController.createConsent
);
router.get(
  "/consent/:userId",
  researchValidator.validateUserIdParam,
  researchController.getConsent
);
router.put(
  "/consent/:userId",
  researchValidator.validateUpdateConsent,
  researchController.updateConsent
);
router.delete(
  "/consent/:userId",
  researchValidator.validateWithdrawal,
  researchController.withdrawFromStudy
);

// Researcher-specific endpoints
router.get(
  "/behavioral-interventions/aggregate",
  behavioralController.getAggregatedBehavioralData // Assuming this controller function will be created
);
// Other researcher endpoints like /stats/{userId}, /audit/consent-change, etc. would go here.

module.exports = router;
