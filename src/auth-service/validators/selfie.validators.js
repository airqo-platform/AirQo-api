const { query, body, param, oneOf } = require("express-validator");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const constants = require("@config/constants");

function isTrustedCloudinarySelfieUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      url.pathname.includes("/clean_air_forum_selfies/")
    );
  } catch (error) {
    return false;
  }
}

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

const validateIdParam = oneOf([
  param("id")
    .exists()
    .withMessage("the id param is missing in the request")
    .bail()
    .notEmpty()
    .withMessage("this id cannot be empty")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("id must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
]);

const create = [
  validateTenant,
  body("eventId")
    .exists()
    .withMessage("the eventId is missing in the request")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("eventId cannot be empty"),
  body("imageUrl")
    .exists()
    .withMessage("the imageUrl is missing in the request")
    .bail()
    .trim()
    .isURL({ require_protocol: true })
    .withMessage("imageUrl must be a valid URL")
    .bail()
    .custom(isTrustedCloudinarySelfieUrl)
    .withMessage(
      "imageUrl must be an https://res.cloudinary.com/.../clean_air_forum_selfies/... URL"
    ),
  body("locationName")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("locationName cannot exceed 200 characters"),
  body("pm25Value")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("pm25Value must be a non-negative number"),
  body("aqiCategory")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("aqiCategory cannot exceed 50 characters"),
  body("displayName")
    .optional()
    .trim()
    .isLength({ max: 40 })
    .withMessage("displayName cannot exceed 40 characters"),
  body("avatarIcon")
    .optional()
    .trim()
    .isLength({ max: 8 })
    .withMessage("avatarIcon cannot exceed 8 characters"),
  body("guest_id").optional().trim(),
];

const list = [
  validateTenant,
  query("eventId")
    .exists()
    .withMessage("the eventId is missing in the request query")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("eventId cannot be empty"),
];

const hide = [validateTenant, validateIdParam];

const deleteSelfie = [validateTenant, validateIdParam];

module.exports = {
  create,
  list,
  hide,
  delete: deleteSelfie,
};
