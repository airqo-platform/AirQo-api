// surveys.routes.js
const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const createSurveyController = require("@controllers/survey.controller");
const surveyValidations = require("@validators/surveys.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers);

// Rate limiter for public read endpoints
const surveyListLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

// Rate limiter for public survey response submission endpoint
const surveyResponseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many survey responses submitted. Please try again later.",
  },
});

// ---- GET routes: static/explicit paths MUST come before parameterized /:survey_id ----

// Get all available surveys — public, rate limited
router.get(
  "/",
  surveyListLimiter,
  surveyValidations.list,
  pagination(),
  createSurveyController.list,
);

// Get user's survey responses — must be above /:survey_id to avoid shadowing
router.get(
  "/responses",
  surveyValidations.listResponses,
  enhancedJWTAuth,
  pagination(),
  createSurveyController.listResponses,
);

// Get survey statistics — must be above /:survey_id to avoid shadowing
router.get(
  "/stats/:survey_id",
  surveyValidations.getSurveyStats,
  enhancedJWTAuth,
  createSurveyController.getStats,
);

// Get specific survey by ID — public, rate limited
// SECURITY NOTE: Survey metadata (title, description, questions, trigger config)
// is intentionally public to allow unauthenticated users to browse available
// surveys in the mobile app before deciding to participate. No user-specific
// or sensitive data is exposed through this endpoint.
router.get(
  "/:survey_id",
  surveyListLimiter,
  surveyValidations.getSurveyById,
  createSurveyController.getById,
);

// ---- Non-GET routes ----

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

module.exports = router;
