// comparisons.validators.js
const { query, body, param, oneOf } = require("express-validator");
const constants = require("@config/constants");

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

const siteIdsBody = (fieldPath = "site_ids", optional = false) => {
  const arrayCheck = body(fieldPath).isArray({ min: 1, max: 80 }).withMessage(
    `${fieldPath} must contain between 1 and 80 entries`
  );
  const entryCheck = body(`${fieldPath}.*`)
    .isString()
    .withMessage(`each entry in ${fieldPath} must be a string`)
    .trim()
    .notEmpty()
    .withMessage(`each entry in ${fieldPath} must not be empty`);

  return optional
    ? [arrayCheck.optional(), entryCheck.optional()]
    : [arrayCheck, entryCheck];
};

// Optional client-supplied display snapshot for each site (name/location/
// city/country/lat/lng) — the same row shape device-registry's
// GET /sites/picker returns. auth-service does not call device-registry to
// resolve or verify these; it stores what the client sends as-is (see
// buildSiteSnapshots in comparison.util.js) so the two services never call
// each other directly.
const sitesBody = (fieldPath = "sites") => [
  body(fieldPath)
    .optional()
    .isArray({ max: 80 })
    .withMessage(`${fieldPath} must be an array of at most 80 entries`),
  // Not .optional(): the wildcard only matches entries that actually exist,
  // so this has no effect when `sites` itself is absent — but any entry
  // that IS present must carry a non-empty id, since buildSiteSnapshots()
  // keys its lookup by id and silently drops entries without one.
  body(`${fieldPath}.*.id`)
    .isString()
    .withMessage("each site snapshot entry must include a string id")
    .trim()
    .notEmpty()
    .withMessage("site snapshot id must not be empty"),
  body(`${fieldPath}.*.name`).optional().isString().trim(),
  body(`${fieldPath}.*.location`).optional().isString().trim(),
  body(`${fieldPath}.*.city`).optional().isString().trim(),
  body(`${fieldPath}.*.country`).optional().isString().trim(),
  body(`${fieldPath}.*.latitude`)
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage("latitude must be between -90 and 90"),
  body(`${fieldPath}.*.longitude`)
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage("longitude must be between -180 and 180"),
];

const create = [
  validateTenant,
  body("group_id")
    .exists()
    .withMessage("group_id is missing in your request")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("group_id must be an object ID"),
  body("name")
    .exists()
    .withMessage("name is missing in your request")
    .bail()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage("name must be between 1 and 120 characters"),
  ...siteIdsBody("site_ids"),
  ...sitesBody("sites"),
];

const list = [
  validateTenant,
  query("group_id")
    .exists()
    .withMessage("group_id is missing in your request")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("group_id must be an object ID"),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("skip").optional().isInt({ min: 0 }).toInt(),
  query("search").optional().isString().trim(),
];

const comparisonIdParam = [
  param("comparison_id")
    .exists()
    .withMessage(
      "the comparison_id param is missing in the request path"
    )
    .bail()
    .trim()
    .isMongoId()
    .withMessage("comparison_id must be an object ID"),
];

const getById = [validateTenant, ...comparisonIdParam];

const update = [
  validateTenant,
  ...comparisonIdParam,
  (req, res, next) => {
    const body = req.body || {};
    const hasName = typeof body.name === "string" && body.name.trim().length > 0;
    const hasSiteIds = Array.isArray(body.site_ids);
    // `sites` alone (no name/site_ids) is deliberately not enough here —
    // update() only ever writes update.sites alongside update.site_ids, so
    // a sites-only body would otherwise pass this check and then silently
    // no-op against the database.
    if (!hasName && !hasSiteIds) {
      return res.status(400).json({
        success: false,
        message: "bad request errors",
        errors: { message: "request body must contain name and/or site_ids" },
      });
    }
    next();
  },
  body("name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage("name must be between 1 and 120 characters"),
  ...siteIdsBody("site_ids", true),
  ...sitesBody("sites"),
];

const deleteComparison = [validateTenant, ...comparisonIdParam];

module.exports = {
  tenant: validateTenant,
  create,
  list,
  getById,
  update,
  deleteComparison,
};
