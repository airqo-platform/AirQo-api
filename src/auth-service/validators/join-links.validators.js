const { query, body, param } = require("express-validator");
const constants = require("@config/constants");

const validateTenant = query("tenant")
  .optional()
  .trim()
  .toLowerCase()
  .custom((value) => {
    if (constants.TENANTS.length === 0) {
      throw new Error("Server configuration error: TENANTS are not set.");
    }
    if (!constants.TENANTS.includes(value)) {
      throw new Error(
        `Invalid tenant. Must be one of: ${constants.TENANTS.join(", ")}`,
      );
    }
    return true;
  });

const validateGroupIdParam = [
  param("grp_id")
    .exists()
    .withMessage("the group ID parameter is missing in request")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("The group ID parameter must be a valid MongoDB ObjectId."),
];

const createJoinLink = [
  validateTenant,
  validateGroupIdParam,
  [
    body("label")
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage("label must not exceed 200 characters"),
    body("expires_at")
      .optional()
      .isISO8601()
      .withMessage("expires_at must be a valid ISO8601 date")
      .toDate(),
    body("max_uses")
      .optional()
      .isInt({ min: 1 })
      .withMessage("max_uses must be a positive integer")
      .toInt(),
    body("requires_approval")
      .optional()
      .isBoolean()
      .withMessage("requires_approval must be a boolean")
      .toBoolean(),
  ],
];

const listJoinLinks = [validateTenant, validateGroupIdParam];

const revokeJoinLink = [
  validateTenant,
  validateGroupIdParam,
  [
    param("link_id")
      .exists()
      .withMessage("the link_id parameter is missing in request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("The link_id parameter must be a valid MongoDB ObjectId."),
  ],
];

const redeemJoinLink = [
  validateTenant,
  [
    param("token")
      .exists()
      .withMessage("the token parameter is missing in request")
      .bail()
      .isHexadecimal()
      .withMessage("Invalid token format")
      .isLength({ min: 64, max: 64 }),
  ],
];

module.exports = {
  createJoinLink,
  listJoinLinks,
  revokeJoinLink,
  redeemJoinLink,
};
