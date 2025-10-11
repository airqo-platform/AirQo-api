// surveys.routes.js
const express = require("express");
const router = express.Router();
const createSurveyController = require("@controllers/survey.controller");
const surveyValidations = require("@validators/surveys.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers);
router.use(surveyValidations.pagination);

// Get all available surveys
router.get(
  "/",
  surveyValidations.list,
  enhancedJWTAuth,
  createSurveyController.list
);

// Get specific survey by ID
router.get(
  "/:survey_id",
  surveyValidations.getSurveyById,
  enhancedJWTAuth,
  createSurveyController.getById
);

// Create new survey (admin only)
router.post(
  "/",
  surveyValidations.create,
  enhancedJWTAuth,
  createSurveyController.create
);

//  Update survey
router.put(
  "/:survey_id",
  surveyValidations.update,
  enhancedJWTAuth,
  createSurveyController.update
);

// Delete survey
router.delete(
  "/:survey_id",
  surveyValidations.deleteSurvey,
  enhancedJWTAuth,
  createSurveyController.delete
);

// Submit survey response
router.post(
  "/responses",
  surveyValidations.createResponse,
  enhancedJWTAuth,
  createSurveyController.createResponse
);

// Get user's survey responses
router.get(
  "/responses",
  surveyValidations.listResponses,
  enhancedJWTAuth,
  createSurveyController.listResponses
);

// Get survey statistics
router.get(
  "/stats/:survey_id",
  surveyValidations.getSurveyStats,
  enhancedJWTAuth,
  createSurveyController.getStats
);

module.exports = router;
