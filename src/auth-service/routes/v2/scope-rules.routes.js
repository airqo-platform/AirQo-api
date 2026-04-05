const express = require("express");
const router = express.Router();
const scopeRuleController = require("@controllers/scope-rule.controller");
const { enhancedJWTAuth } = require("@middleware/passport");
const { headers, pagination } = require("@validators/common");
const { query, body, param, oneOf } = require("express-validator");
const { validate } = require("@validators/common");
const constants = require("@config/constants");

router.use(headers);

const validateTenant = oneOf([
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty if provided")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(constants.TENANTS)
    .withMessage("the tenant value is not among the expected ones"),
]);

const validateRuleId = [
  param("rule_id")
    .exists()
    .withMessage("rule_id param is missing")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("rule_id must be a valid MongoDB ObjectId"),
];

const validateCreate = [
  validateTenant,
  [
    body("pattern")
      .exists().withMessage("pattern is required")
      .bail().notEmpty().withMessage("pattern must not be empty")
      .bail().trim(),
    body("scope")
      .exists().withMessage("scope is required")
      .bail().notEmpty().withMessage("scope must not be empty")
      .bail().trim(),
    body("priority")
      .optional()
      .isInt({ min: 0 }).withMessage("priority must be a non-negative integer"),
    body("active")
      .optional()
      .isBoolean().withMessage("active must be a boolean"),
    body("description")
      .optional()
      .trim(),
  ],
];

const validateUpdate = [
  (req, res, next) => {
    if (!Object.keys(req.body).length) {
      return res.status(400).json({ errors: "request body is empty" });
    }
    next();
  },
  validateTenant,
  validateRuleId,
  [
    body("pattern").optional().notEmpty().withMessage("pattern must not be empty if provided").trim(),
    body("scope").optional().notEmpty().withMessage("scope must not be empty if provided").trim(),
    body("priority").optional().isInt({ min: 0 }).withMessage("priority must be a non-negative integer"),
    body("active").optional().isBoolean().withMessage("active must be a boolean"),
    body("description").optional().trim(),
  ],
];

// Seed defaults — before /:rule_id to avoid collision
router.post(
  "/seed-defaults",
  validateTenant,
  enhancedJWTAuth,
  scopeRuleController.seedDefaults
);

router.get(
  "/",
  validateTenant,
  enhancedJWTAuth,
  pagination(),
  scopeRuleController.list
);

router.post(
  "/",
  validateCreate,
  validate,
  enhancedJWTAuth,
  scopeRuleController.create
);

router.put(
  "/:rule_id",
  validateUpdate,
  validate,
  enhancedJWTAuth,
  scopeRuleController.update
);

router.delete(
  "/:rule_id",
  [validateTenant, validateRuleId],
  validate,
  enhancedJWTAuth,
  scopeRuleController.delete
);

module.exports = router;
