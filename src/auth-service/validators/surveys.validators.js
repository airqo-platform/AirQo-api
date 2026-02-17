//src/auth-service/validators/surveys.validators.js
const { query, body, param, oneOf } = require("express-validator");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const constants = require("@config/constants");

const validateTenant = oneOf([
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty if provided")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(["kcca", "airqo", "airqount"])
    .withMessage("the tenant value is not among the expected ones"),
]);

const pagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

const validateSurveyIdParam = oneOf([
  param("survey_id")
    .exists()
    .withMessage("the survey_id param is missing in the request")
    .bail()
    .notEmpty()
    .withMessage("this survey_id cannot be empty")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("survey_id must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
]);

const validateQuestionSchema = (question) => {
  if (!question.id) {
    throw new Error("Question id is required");
  }
  if (!question.question || question.question.trim() === "") {
    throw new Error("Question text is required");
  }
  if (!question.type) {
    throw new Error("Question type is required");
  }

  const validTypes = ["multipleChoice", "rating", "text", "yesNo", "scale"];
  if (!validTypes.includes(question.type)) {
    throw new Error(`Question type must be one of: ${validTypes.join(", ")}`);
  }

  // Validate type-specific fields
  if (question.type === "multipleChoice") {
    if (
      !question.options ||
      !Array.isArray(question.options) ||
      question.options.length === 0
    ) {
      throw new Error("Multiple choice questions must have options array");
    }
  }

  if (question.type === "rating" || question.type === "scale") {
    if (question.maxValue === undefined || question.maxValue < 1) {
      throw new Error("Rating/scale questions must have maxValue >= 1");
    }
    if (
      question.minValue !== undefined &&
      question.minValue >= question.maxValue
    ) {
      throw new Error("minValue must be less than maxValue");
    }
  }

  return true;
};

const validateTriggerSchema = (trigger) => {
  if (!trigger.type) {
    throw new Error("Trigger type is required");
  }

  const validTriggerTypes = [
    "locationBased",
    "timeBased",
    "airQualityThreshold",
    "manual",
    "postExposure",
  ];

  if (!validTriggerTypes.includes(trigger.type)) {
    throw new Error(
      `Trigger type must be one of: ${validTriggerTypes.join(", ")}`,
    );
  }

  if (!trigger.conditions || typeof trigger.conditions !== "object") {
    throw new Error("Trigger conditions object is required");
  }

  // Validate type-specific conditions
  if (trigger.type === "locationBased") {
    const { latitude, longitude, radius } = trigger.conditions;
    if (
      latitude === undefined ||
      longitude === undefined ||
      radius === undefined
    ) {
      throw new Error(
        "Location-based triggers require latitude, longitude, and radius",
      );
    }
  }

  if (trigger.type === "airQualityThreshold") {
    const { threshold } = trigger.conditions;
    if (threshold === undefined || threshold < 0) {
      throw new Error(
        "Air quality threshold triggers require a valid threshold value",
      );
    }
  }

  return true;
};

const validateAnswerSchema = (answer) => {
  if (!answer.questionId) {
    throw new Error("Answer questionId is required");
  }
  if (answer.answer === undefined || answer.answer === null) {
    throw new Error("Answer value is required");
  }
  return true;
};

const list = [validateTenant];

const create = [
  validateTenant,
  [
    body("title")
      .exists()
      .withMessage("the title is missing in the request")
      .bail()
      .notEmpty()
      .withMessage("the title cannot be empty")
      .bail()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage("title must be between 1 and 200 characters"),

    body("description")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("description cannot exceed 1000 characters"),

    body("questions")
      .exists()
      .withMessage("questions array is required")
      .bail()
      .isArray({ min: 1 })
      .withMessage("questions must be a non-empty array")
      .bail()
      .custom((questions) => {
        questions.forEach((question) => validateQuestionSchema(question));
        return true;
      }),

    body("trigger")
      .exists()
      .withMessage("trigger object is required")
      .bail()
      .isObject()
      .withMessage("trigger must be an object")
      .bail()
      .custom((trigger) => validateTriggerSchema(trigger)),

    body("timeToComplete")
      .optional()
      .isInt({ min: 1 })
      .withMessage("timeToComplete must be a positive integer (seconds)"),

    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean value"),

    body("expiresAt")
      .optional()
      .isISO8601()
      .withMessage("expiresAt must be a valid ISO 8601 date")
      .custom((value) => {
        const date = new Date(value);
        if (date <= new Date()) {
          throw new Error("expiresAt must be a future date");
        }
        return true;
      }),
  ],
];

const update = [
  validateTenant,
  validateSurveyIdParam,
  [
    body("title")
      .optional()
      .notEmpty()
      .withMessage("title should not be empty if provided")
      .bail()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage("title must be between 1 and 200 characters"),

    body("description")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("description cannot exceed 1000 characters"),

    body("questions")
      .optional()
      .isArray({ min: 1 })
      .withMessage("questions must be a non-empty array if provided")
      .bail()
      .custom((questions) => {
        if (questions) {
          questions.forEach((question) => validateQuestionSchema(question));
        }
        return true;
      }),

    body("trigger")
      .optional()
      .isObject()
      .withMessage("trigger must be an object if provided")
      .bail()
      .custom((trigger) => {
        if (trigger) {
          return validateTriggerSchema(trigger);
        }
        return true;
      }),

    body("timeToComplete")
      .optional()
      .isInt({ min: 1 })
      .withMessage("timeToComplete must be a positive integer (seconds)"),

    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean value"),

    body("expiresAt")
      .optional()
      .isISO8601()
      .withMessage("expiresAt must be a valid ISO 8601 date")
      .custom((value) => {
        if (value) {
          const date = new Date(value);
          if (date <= new Date()) {
            throw new Error("expiresAt must be a future date");
          }
        }
        return true;
      }),
  ],
];

const deleteSurvey = [validateTenant, validateSurveyIdParam];

const getSurveyById = [validateTenant, validateSurveyIdParam];

const getSurveyStats = [validateTenant, validateSurveyIdParam];

const createResponse = [
  validateTenant,
  [
    body("surveyId")
      .exists()
      .withMessage("surveyId is required")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("surveyId must be a valid ObjectId")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),

    body("userId")
      .exists()
      .withMessage("userId is required")
      .bail()
      .trim()
      .custom((value) => {
        if (value === "guest") return true;
        if (mongoose.Types.ObjectId.isValid(value)) return true;
        throw new Error("userId must be a valid ObjectId or 'guest'");
      })
      .customSanitizer((value) => {
        // Leave 'guest' as-is; convert valid ObjectId strings
        return value === "guest" ? value : ObjectId(value);
      }),

    body("answers")
      .exists()
      .withMessage("answers array is required")
      .bail()
      .isArray({ min: 1 })
      .withMessage("answers must be a non-empty array")
      .bail()
      .custom((answers) => {
        answers.forEach((answer) => validateAnswerSchema(answer));
        return true;
      }),

    body("status")
      .optional()
      .isIn(["completed", "skipped", "partial"])
      .withMessage("status must be one of: completed, skipped, partial"),

    body("startedAt")
      .optional()
      .isISO8601()
      .withMessage("startedAt must be a valid ISO 8601 date"),

    body("completedAt")
      .optional()
      .isISO8601()
      .withMessage("completedAt must be a valid ISO 8601 date"),

    body("contextData")
      .optional()
      .isObject()
      .withMessage("contextData must be an object"),

    body("contextData.currentLocation")
      .optional()
      .isObject()
      .withMessage("currentLocation must be an object"),

    body("contextData.currentLocation.latitude")
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage("latitude must be between -90 and 90"),

    body("contextData.currentLocation.longitude")
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage("longitude must be between -180 and 180"),

    body("contextData.currentAirQuality")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("currentAirQuality must be a positive number"),

    body("timeToComplete")
      .optional()
      .isInt({ min: 0 })
      .withMessage("timeToComplete must be a non-negative integer"),
  ],
];

const listResponses = [
  validateTenant,
  [
    query("surveyId")
      .optional()
      .trim()
      .isMongoId()
      .withMessage("surveyId must be a valid ObjectId")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),

    query("userId")
      .optional()
      .trim()
      .isMongoId()
      .withMessage("userId must be a valid ObjectId")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
];

module.exports = {
  tenant: validateTenant,
  pagination,
  list,
  create,
  update,
  deleteSurvey,
  getSurveyById,
  getSurveyStats,
  createResponse,
  listResponses,
};
