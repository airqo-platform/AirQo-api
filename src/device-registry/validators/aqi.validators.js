// aqi.validators.js
const { query, body } = require("express-validator");
const constants = require("@config/constants");
const { validate } = require("@validators/common");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");
const crypto = require("crypto");

const listRanges = [
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("the tenant cannot be empty, if provided")
    .bail()
    .trim()
    .toLowerCase()
    .isIn(constants.TENANTS)
    .withMessage("the tenant value is not among the expected ones"),
  validate,
];

// Copied locally rather than centralized — matches the existing convention
// for this exact check (see validators/cohorts.validators.js,
// utils/network.util.js, validators/network-creation-request.validators.js).
// device-registry has no per-user auth; this shared-secret gate is the
// established stand-in for admin-only write access.
const requireAdminSecret = (req, res, next) => {
  if (!constants.ADMIN_SETUP_SECRET) {
    return next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: "Admin secret not configured on server",
      })
    );
  }
  const provided = Buffer.from(
    req.body.admin_secret || req.query.admin_secret || ""
  );
  const expected = Buffer.from(constants.ADMIN_SETUP_SECRET);
  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    return next(
      new HttpError("Forbidden", httpStatus.FORBIDDEN, {
        message: "Invalid admin secret",
      })
    );
  }
  next();
};

const updateRanges = [
  query("tenant")
    .optional()
    .notEmpty()
    .bail()
    .trim()
    .toLowerCase()
    .isIn(constants.TENANTS)
    .withMessage("the tenant value is not among the expected ones"),
  body("admin_secret")
    .exists()
    .withMessage("admin_secret is required")
    .bail()
    .isString()
    .withMessage("admin_secret must be a string")
    .bail()
    .notEmpty()
    .withMessage("admin_secret must not be empty"),
  body("ranges")
    .exists()
    .withMessage("ranges is required")
    .bail()
    .isArray({ min: 6, max: 6 })
    .withMessage("ranges must contain exactly 6 categories"),
  // min_value is deliberately not accepted here — categoryFromConcentration
  // classifies by upper bound only, so min_value is purely cosmetic in the
  // GET response and is derived server-side from the previous category's
  // max_value rather than doubling the validation surface for it.
  body("ranges").custom((ranges) => {
    const { AQI_CATEGORY_KEYS } = constants;
    if (!Array.isArray(ranges)) {
      throw new Error("ranges must be an array");
    }
    const keys = ranges.map((range) => range && range.key);
    if (keys.join(",") !== AQI_CATEGORY_KEYS.join(",")) {
      throw new Error(
        `ranges must contain exactly these keys in order: ${AQI_CATEGORY_KEYS.join(", ")}`
      );
    }

    let prevMax = -Infinity;
    ranges.forEach((range, index) => {
      const isLast = index === ranges.length - 1;
      if (isLast) {
        if (range.max_value !== null) {
          throw new Error(`${range.key}.max_value must be null (unbounded)`);
        }
      } else {
        if (typeof range.max_value !== "number" || !(range.max_value > prevMax)) {
          throw new Error(
            `${range.key}.max_value must be a number strictly greater than the previous category's max_value`
          );
        }
        prevMax = range.max_value;
      }

      if (!/^#[0-9A-Fa-f]{6}$/.test(range.color || "")) {
        throw new Error(
          `${range.key}.color must be a 6-hex-digit code, e.g. #34C759`
        );
      }
      if (typeof range.label !== "string" || !range.label.trim()) {
        throw new Error(`${range.key}.label must be a non-empty string`);
      }
    });
    return true;
  }),
  body("updated_by")
    .optional()
    .isString()
    .withMessage("updated_by must be a string"),
  validate,
  requireAdminSecret,
];

const deleteRanges = [
  query("tenant")
    .optional()
    .notEmpty()
    .bail()
    .trim()
    .toLowerCase()
    .isIn(constants.TENANTS)
    .withMessage("the tenant value is not among the expected ones"),
  validate,
  requireAdminSecret,
];

module.exports = {
  listRanges,
  updateRanges,
  deleteRanges,
};
