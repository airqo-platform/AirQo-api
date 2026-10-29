const { query, body, param, oneOf } = require("express-validator");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const constants = require("@config/constants");
const {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
} = require("@models/Notification");

const MAX_DIRECT_RECIPIENTS = 1000;

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
  query("tenant")
    .exists()
    .withMessage("the tenant value is missing in the request query")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(constants.TENANTS)
    .withMessage("the tenant value is not among the expected ones"),
]);

const mongoIdParam = (name) =>
  param(name)
    .exists()
    .withMessage(`the ${name} param is missing in the request`)
    .bail()
    .notEmpty()
    .withMessage(`the ${name} cannot be empty`)
    .bail()
    .trim()
    .isMongoId()
    .withMessage(`${name} must be an object ID`)
    .bail()
    .customSanitizer((value) => ObjectId(value));

// Shared by both admin send endpoints.
const notificationContent = [
  body("title")
    .exists()
    .withMessage("the title is missing in the request body")
    .bail()
    .isString()
    .withMessage("title must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("title cannot be empty")
    .bail()
    .isLength({ max: 200 })
    .withMessage("title cannot exceed 200 characters"),
  body("message")
    .exists()
    .withMessage("the message is missing in the request body")
    .bail()
    .isString()
    .withMessage("message must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("message cannot be empty")
    .bail()
    .isLength({ max: 2000 })
    .withMessage("message cannot exceed 2000 characters"),
  body("category")
    .optional()
    .trim()
    .isIn(NOTIFICATION_CATEGORIES)
    .withMessage(
      `category must be one of: ${NOTIFICATION_CATEGORIES.join(", ")}`,
    ),
  body("priority")
    .optional()
    .trim()
    .isIn(NOTIFICATION_PRIORITIES)
    .withMessage(
      `priority must be one of: ${NOTIFICATION_PRIORITIES.join(", ")}`,
    ),
  body("event")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("event cannot exceed 100 characters"),
  body("link")
    .optional()
    .trim()
    .isLength({ max: 2048 })
    .withMessage("link cannot exceed 2048 characters")
    .bail()
    // "//host" is protocol-relative, i.e. an external link in disguise.
    .custom(
      (value) =>
        (value.startsWith("/") && !value.startsWith("//")) ||
        /^https:\/\//i.test(value),
    )
    .withMessage("link must be an https:// URL or an app path starting with /"),
  body("metadata")
    .optional()
    .custom(
      (value) =>
        value !== null && typeof value === "object" && !Array.isArray(value),
    )
    .withMessage("metadata must be an object"),
  body("expires_at")
    .optional()
    .isISO8601()
    .withMessage("expires_at must be a valid ISO 8601 date")
    .bail()
    .custom((value) => new Date(value) > new Date())
    .withMessage("expires_at must be in the future")
    .toDate(),
];

const list = [
  validateTenant,
  query("read")
    .optional()
    .trim()
    .isIn(["true", "false"])
    .withMessage("read must be true or false"),
  query("category")
    .optional()
    .trim()
    .isIn(NOTIFICATION_CATEGORIES)
    .withMessage(
      `category must be one of: ${NOTIFICATION_CATEGORIES.join(", ")}`,
    ),
];

const unreadCount = [validateTenant];

const markRead = [validateTenant, mongoIdParam("notification_id")];

const markAllRead = [validateTenant];

const deleteNotification = [validateTenant, mongoIdParam("notification_id")];

const sendToGroup = [
  validateTenant,
  mongoIdParam("grp_id"),
  ...notificationContent,
];

const broadcast = [
  validateTenant,
  ...notificationContent,
  body("audience")
    .exists()
    .withMessage("the audience is missing in the request body")
    .bail()
    .trim()
    .isIn(["all", "users"])
    .withMessage("audience must be either 'all' or 'users'"),
  body("user_ids")
    .if(body("audience").equals("users"))
    .exists()
    .withMessage("user_ids is required when audience is 'users'")
    .bail()
    .isArray({ min: 1, max: MAX_DIRECT_RECIPIENTS })
    .withMessage(
      `user_ids must be a non-empty array of at most ${MAX_DIRECT_RECIPIENTS} IDs`,
    ),
  body("user_ids.*")
    .if(body("audience").equals("users"))
    .isMongoId()
    .withMessage("every user_id must be a valid object ID"),
];

module.exports = {
  list,
  unreadCount,
  markRead,
  markAllRead,
  delete: deleteNotification,
  sendToGroup,
  broadcast,
};
