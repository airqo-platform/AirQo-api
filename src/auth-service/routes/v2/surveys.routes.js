// surveys.routes.js
const express = require("express");
const router = express.Router();
const createSurveyController = require("@controllers/survey.controller");
const surveyValidations = require("@validators/surveys.validators");
const { setJWTAuth, authJWT } = require("@middleware/passport");

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
  next();
};

router.use(headers);
router.use(surveyValidations.pagination);

// Get all available surveys
router.get(
  "/",
  surveyValidations.list,
  setJWTAuth,
  authJWT,
  createSurveyController.list
);

// Get specific survey by ID
router.get(
  "/:survey_id",
  surveyValidations.getSurveyById,
  setJWTAuth,
  authJWT,
  createSurveyController.getById
);

// Create new survey (admin only)
router.post(
  "/",
  surveyValidations.create,
  setJWTAuth,
  authJWT,
  createSurveyController.create
);

//  Update survey
router.put(
  "/:survey_id",
  surveyValidations.update,
  setJWTAuth,
  authJWT,
  createSurveyController.update
);

// Delete survey
router.delete(
  "/:survey_id",
  surveyValidations.deleteSurvey,
  setJWTAuth,
  authJWT,
  createSurveyController.delete
);

// Submit survey response
router.post(
  "/responses",
  surveyValidations.createResponse,
  setJWTAuth,
  authJWT,
  createSurveyController.createResponse
);

// Get user's survey responses
router.get(
  "/responses",
  surveyValidations.listResponses,
  setJWTAuth,
  authJWT,
  createSurveyController.listResponses
);

// Get survey statistics
router.get(
  "/stats/:survey_id",
  surveyValidations.getSurveyStats,
  setJWTAuth,
  authJWT,
  createSurveyController.getStats
);

module.exports = router;
