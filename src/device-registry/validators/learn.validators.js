const { query, body, param, validationResult } = require("express-validator");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");
const isEmpty = require("is-empty");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const extractedErrors = {};
  errors.array().forEach((err) => {
    extractedErrors[err.path || err.param] = err.msg;
  });
  return next(
    new HttpError(
      "validation errors for some of the provided fields",
      httpStatus.BAD_REQUEST,
      extractedErrors
    )
  );
};

const commonTenant = query("tenant")
  .optional()
  .notEmpty()
  .withMessage("tenant cannot be empty if provided")
  .bail()
  .trim()
  .toLowerCase();

const learnValidations = {
  // -------------------------------------------------------------------------
  // Option 1 — Catalog
  // -------------------------------------------------------------------------

  getCatalog: [
    commonTenant,
    query("catalog_version").optional().trim(),
    validate,
  ],

  getLesson: [
    commonTenant,
    param("lesson_id")
      .exists()
      .withMessage("lesson_id is required")
      .bail()
      .notEmpty()
      .withMessage("lesson_id must not be empty")
      .trim(),
    validate,
  ],

  // -------------------------------------------------------------------------
  // Option 2 — Anonymous session
  // -------------------------------------------------------------------------

  createAnonymousSession: [
    body("device_id")
      .exists()
      .withMessage("device_id is required")
      .bail()
      .notEmpty()
      .withMessage("device_id must not be empty")
      .bail()
      .isUUID(4)
      .withMessage("device_id must be a valid UUID"),
    body("app_version").optional().trim(),
    body("platform")
      .optional()
      .isIn(["android", "ios"])
      .withMessage("platform must be android or ios"),
    validate,
  ],

  // -------------------------------------------------------------------------
  // Option 2 — Progress
  // -------------------------------------------------------------------------

  getProgress: [commonTenant, validate],

  updateLessonProgress: [
    commonTenant,
    param("lesson_id")
      .exists()
      .withMessage("lesson_id is required")
      .bail()
      .notEmpty()
      .trim(),
    body("furthest_activity_index")
      .optional()
      .isInt({ min: 0 })
      .withMessage("furthest_activity_index must be a non-negative integer"),
    body("completed")
      .optional()
      .isBoolean()
      .withMessage("completed must be a boolean"),
    body("quiz_attempts")
      .optional()
      .isArray()
      .withMessage("quiz_attempts must be an array"),
    body("quiz_attempts.*.activity_id")
      .optional()
      .notEmpty()
      .withMessage("quiz_attempts[].activity_id must not be empty"),
    body("quiz_attempts.*.format")
      .optional()
      .isIn(["single_choice", "multi_choice", "ranking", "free_text"])
      .withMessage("quiz_attempts[].format must be a valid quiz format"),
    validate,
  ],

  syncProgress: [
    commonTenant,
    body("device_id")
      .exists()
      .withMessage("device_id is required")
      .bail()
      .notEmpty()
      .isUUID(4)
      .withMessage("device_id must be a valid UUID"),
    body("updates")
      .exists()
      .withMessage("updates is required")
      .bail()
      .isArray({ min: 1 })
      .withMessage("updates array cannot be empty"),
    body("updates.*.lesson_id")
      .exists()
      .withMessage("each update must include lesson_id")
      .bail()
      .notEmpty()
      .trim(),
    validate,
  ],

  // -------------------------------------------------------------------------
  // Option 3 — Account link
  // -------------------------------------------------------------------------

  linkGuestProgress: [
    body("device_id")
      .exists()
      .withMessage("device_id is required")
      .bail()
      .notEmpty()
      .isUUID(4)
      .withMessage("device_id must be a valid UUID"),
    body("guest_id")
      .exists()
      .withMessage("guest_id is required")
      .bail()
      .notEmpty()
      .withMessage("guest_id must not be empty")
      .trim(),
    validate,
  ],

  // -------------------------------------------------------------------------
  // Admin — Course authoring
  // -------------------------------------------------------------------------

  createCourse: [
    commonTenant,
    body("course_number")
      .exists()
      .withMessage("course_number is required")
      .bail()
      .isInt({ min: 1 })
      .withMessage("course_number must be a positive integer"),
    body("title")
      .exists()
      .withMessage("title is required")
      .bail()
      .notEmpty()
      .withMessage("title must not be empty")
      .bail()
      .isLength({ max: 120 })
      .withMessage("title must not exceed 120 characters")
      .trim(),
    body("plain_title_key")
      .exists()
      .withMessage("plain_title_key is required")
      .bail()
      .notEmpty()
      .trim(),
    body("cover_image_url")
      .optional()
      .isURL({ protocols: ["https"], require_protocol: true })
      .withMessage("cover_image_url must be a valid HTTPS URL"),
    body("published")
      .optional()
      .isBoolean()
      .withMessage("published must be a boolean"),
    validate,
  ],

  addUnit: [
    commonTenant,
    param("course_id")
      .exists()
      .withMessage("course_id is required")
      .bail()
      .notEmpty()
      .trim(),
    body("title")
      .exists()
      .withMessage("title is required")
      .bail()
      .notEmpty()
      .bail()
      .isLength({ max: 120 })
      .withMessage("title must not exceed 120 characters")
      .trim(),
    body("plain_title_key")
      .exists()
      .withMessage("plain_title_key is required")
      .bail()
      .notEmpty()
      .trim(),
    body("unit_order")
      .exists()
      .withMessage("unit_order is required")
      .bail()
      .isInt({ min: 1 })
      .withMessage("unit_order must be a positive integer"),
    validate,
  ],

  addLesson: [
    commonTenant,
    param("unit_id")
      .exists()
      .withMessage("unit_id is required")
      .bail()
      .notEmpty()
      .trim(),
    body("title")
      .exists()
      .withMessage("title is required")
      .bail()
      .notEmpty()
      .bail()
      .isLength({ max: 120 })
      .withMessage("title must not exceed 120 characters")
      .trim(),
    body("plain_title_key")
      .exists()
      .withMessage("plain_title_key is required")
      .bail()
      .notEmpty()
      .trim(),
    body("lesson_order")
      .exists()
      .withMessage("lesson_order is required")
      .bail()
      .isInt({ min: 1 })
      .withMessage("lesson_order must be a positive integer"),
    body("cover_image_url")
      .optional()
      .isURL({ protocols: ["https"], require_protocol: true })
      .withMessage("cover_image_url must be a valid HTTPS URL"),
    body("completion_message").optional().trim(),
    validate,
  ],

  addActivity: [
    commonTenant,
    param("lesson_id")
      .exists()
      .withMessage("lesson_id is required")
      .bail()
      .notEmpty()
      .trim(),
    body("type")
      .exists()
      .withMessage("type is required")
      .bail()
      .isIn(["article", "video", "image", "quiz"])
      .withMessage("type must be one of: article, video, image, quiz"),
    body("order")
      .exists()
      .withMessage("order is required")
      .bail()
      .isInt({ min: 1 })
      .withMessage("order must be a positive integer"),
    body("payload")
      .exists()
      .withMessage("payload is required")
      .bail()
      .isObject()
      .withMessage("payload must be an object"),
    validate,
  ],

  updateCourse: [
    commonTenant,
    param("course_id")
      .exists()
      .withMessage("course_id is required")
      .bail()
      .notEmpty()
      .trim(),
    body("title")
      .optional()
      .notEmpty()
      .bail()
      .isLength({ max: 120 })
      .withMessage("title must not exceed 120 characters")
      .trim(),
    body("cover_image_url")
      .optional()
      .isURL({ protocols: ["https"], require_protocol: true })
      .withMessage("cover_image_url must be a valid HTTPS URL"),
    body("published")
      .optional()
      .isBoolean()
      .withMessage("published must be a boolean"),
    validate,
  ],
};

module.exports = learnValidations;
