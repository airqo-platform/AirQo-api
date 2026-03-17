// validators/organization-requests.validators.js
const { body, param, query, validationResult } = require("express-validator");
const isEmpty = require("is-empty");
const constants = require("@config/constants");

const pagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

module.exports = {
  pagination,

  checkSlugAvailability: [
    param("slug")
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Slug must be between 2 and 100 characters")
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .withMessage("Slug must be lowercase alphanumeric with hyphens only"),
  ],

  create: [
    body("organization_name").optional().trim(),
    body("organization_slug")
      .optional()
      .bail()
      .trim()
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .withMessage("Slug must be lowercase alphanumeric with hyphens only"),

    // city, project_name, and funder_partner are required only when
    // organization_name is absent or blank. Both snake_case and camelCase
    // are accepted during transition; snake_case is preferred going forward.
    body("city")
      .if((value, { req }) => {
        const orgName = req.body.organization_name;
        return !orgName || !orgName.trim();
      })
      .custom((value, { req }) => {
        const city = req.body.city;
        if (!city || !city.trim()) {
          throw new Error(
            "City is required when organization_name is not provided",
          );
        }
        return true;
      }),

    body(["project_name", "projectName"])
      .if((value, { req }) => {
        const orgName = req.body.organization_name;
        return !orgName || !orgName.trim();
      })
      .custom((value, { req }) => {
        const projectName = req.body.project_name || req.body.projectName;
        if (!projectName || !projectName.trim()) {
          throw new Error(
            "Project name is required when organization_name is not provided",
          );
        }
        return true;
      }),

    body(["funder_partner", "funderPartner"]).optional().trim(),

    body("contact_email")
      .trim()
      .notEmpty()
      .withMessage("Contact email is required")
      .isEmail()
      .withMessage("Must be a valid email"),
    body("contact_name")
      .trim()
      .notEmpty()
      .withMessage("Contact name is required"),
    body("use_case").trim().notEmpty().withMessage("Use case is required"),
    body("country").trim().notEmpty().withMessage("Country is required"),
    body("organization_type")
      .trim()
      .notEmpty()
      .withMessage("Organization type is required")
      .bail()
      .isIn(constants.VALID_ORGANIZATION_TYPES)
      .withMessage(
        `Invalid organization type. Valid types are: ${constants.VALID_ORGANIZATION_TYPES.join(", ")}`,
      ),
  ],

  list: [
    query("status")
      .optional()
      .isIn(["pending", "approved", "rejected"])
      .withMessage("Invalid status"),
  ],

  validateOnboardingToken: [
    param("token")
      .exists()
      .withMessage("Token is required")
      .bail()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Token should not be empty")
      .bail()
      .isJWT()
      .withMessage("Token must be a valid JWT"),
  ],

  completeOnboarding: [
    body("token")
      .exists()
      .withMessage("Onboarding token is missing")
      .bail()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Onboarding token should not be empty")
      .bail()
      .isJWT()
      .withMessage("Onboarding token must be a valid JWT"),

    body("password")
      .exists()
      .withMessage("Password is missing")
      .bail()
      .trim()
      .isLength({ min: 6 })
      .withMessage("Password should be at least 6 characters")
      .bail()
      .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
      .withMessage("Password must contain at least one letter and one number")
      .bail()
      .isLength({ max: 128 })
      .withMessage("Password should not exceed 128 characters"),
  ],

  approve: [
    param("request_id").isMongoId().withMessage("Invalid request ID"),
    body("useOnboardingFlow")
      .optional()
      .isBoolean()
      .withMessage("useOnboardingFlow must be a boolean"),
    body("onboardingOptions.tokenExpiryDays")
      .optional()
      .isInt({ min: 1, max: 30 })
      .withMessage("Token expiry days must be between 1 and 30"),
    body("onboardingOptions.sendWelcomeEmail")
      .optional()
      .isBoolean()
      .withMessage("sendWelcomeEmail must be a boolean"),
  ],

  reject: [
    param("request_id").isMongoId().withMessage("Invalid request ID"),
    body("rejection_reason")
      .trim()
      .notEmpty()
      .withMessage("Rejection reason is required"),
  ],

  getById: [param("request_id").isMongoId().withMessage("Invalid request ID")],
};
