const { query, body, param, oneOf } = require("express-validator");
const moment = require("moment-timezone");
const constants = require("@config/constants");

const tenant = oneOf([
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

const isStrictDate = (value) => moment.utc(value, "YYYY-MM-DD", true).isValid();
const isStrictMonth = (value) => moment.utc(value, "YYYY-MM", true).isValid();

const userId = param("userId")
  .isMongoId()
  .withMessage("userId must be a valid ObjectId");

const month = query("month")
  .optional()
  .custom(isStrictMonth)
  .withMessage("month must be in YYYY-MM format");

const date = (name, { required = false } = {}) => {
  const chain = required ? query(name).exists().withMessage(`${name} is required`).bail() : query(name).optional();
  return chain.custom(isStrictDate).withMessage(`${name} must be in YYYY-MM-DD format`);
};

const tz = query("tz")
  .optional()
  .isString()
  .isLength({ max: 64 })
  .bail()
  .custom((value) => !!moment.tz.zone(value))
  .withMessage("tz must be a valid IANA timezone, e.g. Africa/Kampala");

const metric = query("metric")
  .optional()
  .isIn(["activity", "page_views", "api_calls"])
  .withMessage("metric must be one of activity, page_views, api_calls");

const kind = query("kind")
  .optional()
  .isIn(["page", "api"])
  .withMessage("kind must be either page or api");

const limit = query("limit")
  .optional()
  .isInt({ min: 1, max: 100 })
  .withMessage("limit must be between 1 and 100")
  .toInt();

const excludeInternal = query("exclude_internal")
  .optional()
  .isBoolean()
  .withMessage("exclude_internal must be true or false");

const userCalendar = [
  tenant,
  userId,
  query("year")
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage("year must be a four digit year"),
  date("from"),
  date("to"),
  metric,
  tz,
];

const userSummary = [tenant, userId, month, tz];
const userBreakdown = [tenant, userId, month, kind, limit];
const userTimeline = [tenant, userId, date("date", { required: true }), tz];
const userRhythm = [tenant, userId, date("from"), date("to"), tz, metric];
const overview = [tenant, month, excludeInternal];
const pages = [tenant, month, kind, limit, excludeInternal];
const users = [
  tenant,
  month,
  excludeInternal,
  query("sort")
    .optional()
    .isIn(["total_actions", "active_days", "page_views", "api_calls", "sessions", "last_active"])
    .withMessage("unsupported sort field"),
  query("order").optional().isIn(["asc", "desc"]).withMessage("order must be asc or desc"),
  query("search").optional().isString().trim().isLength({ max: 100 }),
  query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
  limit,
  query("format").optional().isIn(["json", "csv"]).withMessage("format must be json or csv"),
];
const retention = [
  tenant,
  excludeInternal,
  query("months").optional().isInt({ min: 1, max: 12 }).withMessage("months must be between 1 and 12"),
];

const MAX_EVENTS_PER_BATCH = 50;
const events = [
  tenant,
  body("session_id").optional().isString().isLength({ max: 64 }),
  body("events")
    .isArray({ min: 1, max: MAX_EVENTS_PER_BATCH })
    .withMessage(`events must be an array of 1-${MAX_EVENTS_PER_BATCH} items`),
  body("events.*.type").optional().isIn(["page_view"]).withMessage("type must be page_view"),
  body("events.*.path")
    .isString()
    .isLength({ min: 1, max: 300 })
    .withMessage("path must be a string of at most 300 characters")
    .bail()
    .matches(/^\//)
    .withMessage("path must start with /"),
  body("events.*.duration_sec")
    .optional()
    .isFloat({ min: 0, max: 4 * 60 * 60 })
    .withMessage("duration_sec must be between 0 and 14400"),
  body("events.*.session_start").optional().isBoolean().withMessage("session_start must be a boolean"),
];

module.exports = {
  userCalendar,
  userSummary,
  userBreakdown,
  userTimeline,
  userRhythm,
  overview,
  pages,
  users,
  retention,
  events,
  MAX_EVENTS_PER_BATCH,
};
