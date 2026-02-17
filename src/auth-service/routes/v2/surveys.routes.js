// surveys.routes.js
const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const createSurveyController = require("@controllers/survey.controller");
const surveyValidations = require("@validators/surveys.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers); // Keep headers global

// Rate limiter for public endpoints
const surveyListLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP (higher than responses, it's read-only)
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

// Rate limiter for the public survey response submission endpoint
const surveyResponseLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per IP
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

// Get specific survey by ID — parameterized, declared last among GETs
router.get(
  "/:survey_id",
  surveyValidations.getSurveyById,
  enhancedJWTAuth,
  createSurveyController.getById,
);

// ---- Non-GET routes (order is not affected by the shadowing issue) ----

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
