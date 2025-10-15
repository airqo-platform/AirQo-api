const { body, query, param } = require("express-validator");

const validateSubmitResponse = [
  body("alertId")
    .exists()
    .withMessage("alertId is required")
    .notEmpty()
    .withMessage("alertId cannot be empty")
    .isString(),
  body("responseType")
    .exists()
    .withMessage("responseType is required")
    .isIn(["followed", "notFollowed", "dismissed"])
    .withMessage("Invalid responseType"),
  body("followedReason")
    .optional()
    .isIn([
      "stayedIndoors",
      "changedPlans",
      "woreMask",
      "reducedOutdoorActivity",
      "closedWindows",
      "other",
    ])
    .withMessage("Invalid followedReason"),
  body("notFollowedReason")
    .optional()
    .isIn([
      "hadToGoOut",
      "noAlternative",
      "tooInconvenient",
      "didntBelieveAlert",
      "alreadyIndoors",
      "lackResources",
      "other",
    ])
    .withMessage("Invalid notFollowedReason"),
  body("respondedAt")
    .exists()
    .withMessage("respondedAt is required")
    .isISO8601()
    .withMessage("respondedAt must be a valid ISO8601 date"),
];

const validateGetUserAlertResponses = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be an integer between 1 and 100"),
  query("skip")
    .optional()
    .isInt({ min: 0 })
    .withMessage("skip must be a non-negative integer"),
  query("alertId").optional().isString(),
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("startDate must be a valid ISO8601 date"),
  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("endDate must be a valid ISO8601 date"),
  query("responseType")
    .optional()
    .isIn(["followed", "notFollowed", "dismissed"])
    .withMessage("Invalid responseType"),
];

module.exports = {
  validateSubmitResponse,
  validateGetUserAlertResponses,
};
