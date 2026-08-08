// aqi.validators.js
const { query, body } = require("express-validator");
const constants = require("@config/constants");
const { validate } = require("@validators/common");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");
const crypto = require("crypto");
const aqiUtil = require("@utils/aqi.util");

// Shared across GET/PUT/DELETE — which pollutant's ranges the request
// targets. Defaults to pm2_5 (see aqiUtil.DEFAULT_POLLUTANT) when omitted.
const pollutantQueryValidator = query("pollutant")
  .optional()
  .trim()
  .notEmpty()
  .withMessage("the pollutant cannot be empty, if provided")
  .bail()
  .toLowerCase()
  .isIn(constants.SUPPORTED_POLLUTANT_KEYS)
  .withMessage(
    `the pollutant value is not among the expected ones: ${constants.SUPPORTED_POLLUTANT_KEYS.join(", ")}`
  );

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
  pollutantQueryValidator,
  validate,
];

// Copied locally rather than centralized — matches the existing convention
// for this exact check (see validators/cohorts.validators.js,
// utils/network.util.js, validators/network-creation-request.validators.js).
// device-registry has no per-user auth; this shared-secret gate is the
// established stand-in for admin-only write access. Kept consistent with
// those other copies by still accepting the secret via body OR query — not
// narrowed to body-only here, since that would diverge from every other use
// of this exact pattern elsewhere in the codebase.
const requireAdminSecret = (req, res, next) => {
  if (!constants.ADMIN_SETUP_SECRET) {
    return next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: "Admin secret not configured on server",
      })
    );
  }
  // Coerced to a string before Buffer.from — a non-string admin_secret (a
  // number, boolean, or plain object from a malformed JSON body) would
  // otherwise make Buffer.from throw a TypeError that nothing here catches,
  // turning a routine "wrong secret" case into an unhandled 500 instead of
  // the intended 403.
  const rawSecret = req.body.admin_secret || req.query.admin_secret || "";
  const provided = Buffer.from(String(rawSecret));
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
  pollutantQueryValidator,
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
    const error = aqiUtil.validateAqiRangesArray(ranges, { hexHasPrefix: true });
    if (error) {
      throw new Error(error);
    }
    return true;
  }),
  body("updated_by")
    .optional()
    .isString()
    .withMessage("updated_by must be a string"),
  // Runs before field validation so an unauthenticated/wrong-secret caller
  // gets a terse 403 rather than the detailed per-field error messages from
  // the "ranges" validator above (which would otherwise leak the shape of
  // the validation schema to someone who never proved they're an admin).
  requireAdminSecret,
  validate,
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
  pollutantQueryValidator,
  // Optional/type-only check — requireAdminSecret (which also accepts the
  // secret via query, see its own comment) is the actual gate; this just
  // rejects an obviously-wrong body shape early with a clear message when a
  // body is provided at all.
  body("admin_secret")
    .optional()
    .isString()
    .withMessage("admin_secret must be a string"),
  requireAdminSecret,
  validate,
];

module.exports = {
  listRanges,
  updateRanges,
  deleteRanges,
};
