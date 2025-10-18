// checklist.validators.js
const { query, body, param, oneOf } = require("express-validator");
const mongoose = require("mongoose");
const constants = require("@config/constants");
const ObjectId = mongoose.Types.ObjectId;

const validateTenant = oneOf([
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty if provided")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(constants.NETWORKS)
    .withMessage("The tenant value is not among the expected ones"),
]);

/**
 * Sanitizer to parse the 'items' field if it's a stringified JSON.
 * @param {any} value - The input value for the 'items' field.
 * @returns {any} - The parsed array or the original value if parsing fails or not a string.
 */
const parseItemsIfString = (value) => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (e) {
      return value; // Let the isArray validator handle the error
    }
  }
  return value;
};

const pagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

const upsert = [
  validateTenant,
  [
    body("user_id")
      .exists()
      .withMessage("the user_id should be provided in the request body")
      .bail()
      .notEmpty()
      .withMessage("the provided user_id should not be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the user_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("items").customSanitizer(parseItemsIfString),
    body("items")
      .exists()
      .withMessage("the items array must be provided")
      .bail()
      .isArray({ min: 1 })
      .withMessage("At least one checklist item is required")
      .bail()
      .custom((items) => {
        if (!Array.isArray(items)) {
          throw new Error("Items must be an array");
        }

        // Sanitize items to remove _id fields
        for (let i = 0; i < items.length; i++) {
          if (items[i] && typeof items[i] === "object" && "_id" in items[i]) {
            delete items[i]._id;
          }
        }

        return true;
      }),
  ],
];

const validateUserIdParam = oneOf([
  param("user_id")
    .exists()
    .withMessage(
      "the record's identifier is missing in request, consider using the user_id"
    )
    .bail()
    .notEmpty()
    .withMessage("the provided user_id should not be empty")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("user_id must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
]);

const update = [
  validateTenant,
  validateUserIdParam,
  [
    body("items").customSanitizer(parseItemsIfString),
    body("items")
      .exists()
      .withMessage("the items array must be provided")
      .bail()
      .isArray({ min: 1 })
      .withMessage("At least one checklist item is required")
      .bail()
      .custom((items) => {
        if (!Array.isArray(items)) {
          throw new Error("Items must be an array");
        }

        // Sanitize items to remove _id fields
        for (let i = 0; i < items.length; i++) {
          if (items[i] && typeof items[i] === "object" && "_id" in items[i]) {
            delete items[i]._id;
          }
        }

        return true;
      }),
  ],
];

const create = [
  validateTenant,
  [
    body("user_id")
      .exists()
      .withMessage("the user_id should be provided in the request body")
      .bail()
      .notEmpty()
      .withMessage("the provided user_id should not be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the user_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("items").customSanitizer(parseItemsIfString),
    body("items")
      .exists()
      .withMessage("the items array must be provided")
      .bail()
      .isArray({ min: 1 })
      .withMessage("At least one checklist item is required")
      .bail()
      .custom((items) => {
        if (!Array.isArray(items)) {
          throw new Error("Items must be an array");
        }

        return true;
      }),
  ],
];

const list = [
  validateTenant,
  [
    query("user_id")
      .optional()
      .notEmpty()
      .withMessage("the provided user_id should not be empty IF provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the user_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
];

const deleteChecklist = [validateTenant, validateUserIdParam];

const getChecklistByUserId = [
  validateTenant,
  [
    param("user_id")
      .exists()
      .withMessage("the user_id should be provided")
      .bail()
      .notEmpty()
      .withMessage("the provided user_id should not be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the user_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
];

module.exports = {
  tenant: validateTenant,
  pagination,
  upsert,
  update,
  create,
  list,
  deleteChecklist,
  getChecklistByUserId,
};
