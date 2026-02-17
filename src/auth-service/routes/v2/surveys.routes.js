// surveys.routes.js
const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const createSurveyController = require("@controllers/survey.controller");
const surveyValidations = require("@validators/surveys.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers); // Keep headers global

// Rate limiter for the public survey response submission endpoint
const surveyResponseLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per IP
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* legacy headers
  message: {
    success: false,
    message: "Too many survey responses submitted. Please try again later.",
  },
});

// Get all available surveys — public, no auth required
router.get(
  "/",
  surveyValidations.list,
  pagination(),
  createSurveyController.list,
);

// Get specific survey by ID
router.get(
  "/:survey_id",
  surveyValidations.getSurveyById,
  enhancedJWTAuth,
  createSurveyController.getById,
);

// Create new survey (admin only)
router.post(
  "/",
  surveyValidations.create,
  enhancedJWTAuth,
  createSurveyController.create,
);

// Update survey
router.put(
  "/:survey_id",
  surveyValidations.update,
  enhancedJWTAuth,
  createSurveyController.update,
);

// Delete survey
router.delete(
  "/:survey_id",
  surveyValidations.deleteSurvey,
  enhancedJWTAuth,
  createSurveyController.delete,
);

// Submit survey response — public, rate limited to prevent abuse
router.post(
  "/responses",
  surveyResponseLimiter,
  surveyValidations.createResponse,
  createSurveyController.createResponse,
);

// Get user's survey responses
router.get(
  "/responses",
  surveyValidations.listResponses,
  enhancedJWTAuth,
  pagination(),
  createSurveyController.listResponses,
);

// Get survey statistics
router.get(
  "/stats/:survey_id",
  surveyValidations.getSurveyStats,
  enhancedJWTAuth,
  createSurveyController.getStats,
);

module.exports = router;
