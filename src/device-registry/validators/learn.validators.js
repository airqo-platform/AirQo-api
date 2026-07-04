const { query, body, param, validationResult } = require("express-validator");
const constants = require("@config/constants");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");

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
  .toLowerCase()
  .isIn(constants.TENANTS)
  .withMessage("the tenant value is not among the expected ones");

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
      .trim()
      .notEmpty()
      .withMessage("lesson_id must not be empty")
      .bail()
      .isMongoId()
      .withMessage("lesson_id must be a valid MongoDB ObjectId"),
    validate,
  ],

  // -------------------------------------------------------------------------
  // Option 2 — Anonymous session
  // -------------------------------------------------------------------------

  createAnonymousSession: [
    commonTenant,
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
      .trim()
      .notEmpty()
      .bail()
      .isMongoId()
      .withMessage("lesson_id must be a valid MongoDB ObjectId"),
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
      .trim()
      .notEmpty(),
    validate,
  ],

  // -------------------------------------------------------------------------
  // Option 3 — Account link
  // -------------------------------------------------------------------------

  linkGuestProgress: [
    commonTenant,
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
      .trim()
      .notEmpty()
      .withMessage("guest_id must not be empty"),
    validate,
  ],

  // -------------------------------------------------------------------------
  // Option 3 — Certificates & Leaderboard
  // -------------------------------------------------------------------------

  issueCertificate: [
    commonTenant,
    body("course_id")
      .exists()
      .withMessage("course_id is required")
      .bail()
      .trim()
      .notEmpty()
      .bail()
      .isMongoId()
      .withMessage("course_id must be a valid MongoDB ObjectId"),
    body("learner_name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("learner_name must not be empty if provided")
      .bail()
      .isLength({ max: 100 })
      .withMessage("learner_name must not exceed 100 characters"),
    validate,
  ],

  listCertificates: [commonTenant, validate],

  verifyCertificate: [
    commonTenant,
    param("verification_code")
      .exists()
      .withMessage("verification_code is required")
      .bail()
      .trim()
      .notEmpty()
      .withMessage("verification_code must not be empty")
      .bail()
      .toUpperCase()
      .matches(/^AQ-\d{4}-LEARN-[A-Z0-9]{8}$/)
      .withMessage("verification_code must match format AQ-YYYY-LEARN-XXXXXXXX"),
    validate,
  ],

  getLeaderboard: [
    commonTenant,
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("limit must be an integer between 1 and 100"),
    validate,
  ],

  getCourseProgress: [commonTenant, validate],

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
      .trim()
      .notEmpty()
      .withMessage("title must not be empty")
      .bail()
      .isLength({ max: 120 })
      .withMessage("title must not exceed 120 characters"),
    body("plain_title_key")
      .exists()
      .withMessage("plain_title_key is required")
      .bail()
      .trim()
      .notEmpty(),
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
      .trim()
      .notEmpty()
      .bail()
      .isMongoId()
      .withMessage("course_id must be a valid MongoDB ObjectId"),
    body("title")
      .exists()
      .withMessage("title is required")
      .bail()
      .trim()
      .notEmpty()
      .bail()
      .isLength({ max: 120 })
      .withMessage("title must not exceed 120 characters"),
    body("plain_title_key")
      .exists()
      .withMessage("plain_title_key is required")
      .bail()
      .trim()
      .notEmpty(),
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
      .trim()
      .notEmpty()
      .bail()
      .isMongoId()
      .withMessage("unit_id must be a valid MongoDB ObjectId"),
    body("title")
      .exists()
      .withMessage("title is required")
      .bail()
      .trim()
      .notEmpty()
      .bail()
      .isLength({ max: 120 })
      .withMessage("title must not exceed 120 characters"),
    body("plain_title_key")
      .exists()
      .withMessage("plain_title_key is required")
      .bail()
      .trim()
      .notEmpty(),
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
      .trim()
      .notEmpty()
      .bail()
      .isMongoId()
      .withMessage("lesson_id must be a valid MongoDB ObjectId"),
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

  listCourses: [commonTenant, validate],

  getCourse: [
    commonTenant,
    param("course_id")
      .exists()
      .withMessage("course_id is required")
      .bail()
      .trim()
      .notEmpty()
      .bail()
      .isMongoId()
      .withMessage("course_id must be a valid MongoDB ObjectId"),
    validate,
  ],

  deleteCourse: [
    commonTenant,
    param("course_id")
      .exists()
      .withMessage("course_id is required")
      .bail()
      .trim()
      .notEmpty()
      .bail()
      .isMongoId()
      .withMessage("course_id must be a valid MongoDB ObjectId"),
    validate,
  ],

  updateUnit: [
    commonTenant,
    param("unit_id")
      .exists()
      .withMessage("unit_id is required")
      .bail()
      .trim()
      .notEmpty()
      .bail()
      .isMongoId()
      .withMessage("unit_id must be a valid MongoDB ObjectId"),
    body("title")
      .optional()
      .trim()
      .notEmpty()
      .bail()
      .isLength({ max: 120 })
      .withMessage("title must not exceed 120 characters"),
    body("plain_title_key")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("plain_title_key must not be empty"),
    body("unit_order")
      .optional()
      .isInt({ min: 1 })
      .withMessage("unit_order must be a positive integer"),
    validate,
  ],

  deleteUnit: [
    commonTenant,
    param("unit_id")
      .exists()
      .withMessage("unit_id is required")
      .bail()
      .trim()
      .notEmpty()
      .bail()
      .isMongoId()
      .withMessage("unit_id must be a valid MongoDB ObjectId"),
    validate,
  ],

  updateLesson: [
    commonTenant,
    param("lesson_id")
      .exists()
      .withMessage("lesson_id is required")
      .bail()
      .trim()
      .notEmpty()
      .bail()
      .isMongoId()
      .withMessage("lesson_id must be a valid MongoDB ObjectId"),
    body("title")
      .optional()
      .trim()
      .notEmpty()
      .bail()
      .isLength({ max: 120 })
      .withMessage("title must not exceed 120 characters"),
    body("plain_title_key")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("plain_title_key must not be empty"),
    body("lesson_order")
      .optional()
      .isInt({ min: 1 })
      .withMessage("lesson_order must be a positive integer"),
    body("cover_image_url")
      .optional()
      .isURL({ protocols: ["https"], require_protocol: true })
      .withMessage("cover_image_url must be a valid HTTPS URL"),
    body("completion_message").optional().trim(),
    validate,
  ],

  deleteLesson: [
    commonTenant,
    param("lesson_id")
      .exists()
      .withMessage("lesson_id is required")
      .bail()
      .trim()
      .notEmpty()
      .bail()
      .isMongoId()
      .withMessage("lesson_id must be a valid MongoDB ObjectId"),
    validate,
  ],

  updateActivity: [
    commonTenant,
    param("activity_id")
      .exists()
      .withMessage("activity_id is required")
      .bail()
      .trim()
      .notEmpty()
      .bail()
      .isMongoId()
      .withMessage("activity_id must be a valid MongoDB ObjectId"),
    body("type")
      .optional()
      .isIn(["article", "video", "image", "quiz"])
      .withMessage("type must be one of: article, video, image, quiz"),
    body("order")
      .optional()
      .isInt({ min: 1 })
      .withMessage("order must be a positive integer"),
    body("payload").optional().isObject().withMessage("payload must be an object"),
    validate,
  ],

  deleteActivity: [
    commonTenant,
    param("activity_id")
      .exists()
      .withMessage("activity_id is required")
      .bail()
      .trim()
      .notEmpty()
      .bail()
      .isMongoId()
      .withMessage("activity_id must be a valid MongoDB ObjectId"),
    validate,
  ],

  updateCourse: [
    commonTenant,
    param("course_id")
      .exists()
      .withMessage("course_id is required")
      .bail()
      .trim()
      .notEmpty()
      .bail()
      .isMongoId()
      .withMessage("course_id must be a valid MongoDB ObjectId"),
    body("title")
      .optional()
      .trim()
      .notEmpty()
      .bail()
      .isLength({ max: 120 })
      .withMessage("title must not exceed 120 characters"),
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
