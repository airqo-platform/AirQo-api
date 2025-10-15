const { body, param } = require("express-validator");

const validateCreateConsent = [
  body("userId")
    .exists()
    .withMessage("userId is required")
    .isMongoId()
    .withMessage("userId must be a valid Mongo ID"),
  body("consentTypes")
    .exists()
    .withMessage("consentTypes object is required")
    .isObject(),
  body("consentTypes.locationTracking")
    .optional()
    .isIn(["granted", "denied", "notProvided"]),
  body("consentTypes.surveyParticipation")
    .optional()
    .isIn(["granted", "denied", "notProvided"]),
  body("consentTypes.alertResponses")
    .optional()
    .isIn(["granted", "denied", "notProvided"]),
  body("consentTypes.dataSharing")
    .optional()
    .isIn(["granted", "denied", "notProvided"]),
  body("consentTypes.researchCommunication")
    .optional()
    .isIn(["granted", "denied", "notProvided"]),
  body("consentVersion")
    .exists()
    .withMessage("consentVersion is required")
    .notEmpty(),
  body("timestamp").exists().withMessage("timestamp is required").isISO8601(),
];

const validateUserIdParam = [
  param("userId")
    .exists()
    .withMessage("userId is required in the path")
    .isMongoId()
    .withMessage("userId must be a valid Mongo ID"),
];

const validateUpdateConsent = [
  param("userId")
    .exists()
    .withMessage("userId is required in the path")
    .isMongoId()
    .withMessage("userId must be a valid Mongo ID"),
  body("consentTypes")
    .exists()
    .withMessage("consentTypes object is required")
    .isObject(),
  body("timestamp").exists().withMessage("timestamp is required").isISO8601(),
];

const validateWithdrawal = [
  param("userId")
    .exists()
    .withMessage("userId is required in the path")
    .isMongoId()
    .withMessage("userId must be a valid Mongo ID"),
  body("withdrawalReason").exists().withMessage("withdrawalReason is required"),
  body("confirmDeletion")
    .isBoolean()
    .withMessage("confirmDeletion must be a boolean"),
];

module.exports = {
  validateCreateConsent,
  validateUserIdParam,
  validateUpdateConsent,
  validateWithdrawal,
};
