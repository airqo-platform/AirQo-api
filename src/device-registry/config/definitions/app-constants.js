// Merged from: strings.js, numericals.js, regex-patterns.js, static-lists.js
// Pure static values only — no process.env reads.

const appConstants = {
  // ── Strings / labels ────────────────────────────────────────────────────────
  REGION: "europe-west1",
  MQTT_BRIDGE_HOST_NAME: "mqtt.googleapis.com",
  MESSAGE_TYPE: "events",
  DEFAULT_COHORT_NAME: "airqo",
  COMPROMISED_TOKEN_COOLDOWN_DAYS: 15,
  LOG_THROTTLE_TTL_DAYS: 30,
  EXPIRING_TOKEN_REMINDER_DAYS: 7,
  ALLOWED_LOG_TYPES: [
    "unassigned-sites-check",
    "network-status-check",
    "network-status-summary",
    "METRICS",
    "ACCURACY_REPORT",
  ],

  // ── Numerics ─────────────────────────────────────────────────────────────────
  MQTT_BRIDGE_PORT: 8883,
  NUM_MESSAGES: 5,
  TOKEN_EXP_MINS: 360,
  MINIMUM_BACKOFF_TIME: 1,
  MAXIMUM_BACKOFF_TIME: 32,
  CACHE_TIMEOUT_PERIOD: 10000,
  MAX_EVENT_AGE_HOURS: 6,
  MAX_REJECTED_LOGS: 10,
  JOB_LOOKBACK_WINDOW_MS: 5 * 60 * 60 * 1000,
  STALE_ENTITY_THRESHOLD_MS: 2 * 5 * 60 * 60 * 1000,

  // ── Regex patterns ───────────────────────────────────────────────────────────
  LATITUDE_REGEX: /^(-?[1-8]?\d(?:\.\d{1,18})?|90(?:\.0{1,18})?)$/,
  LONGITUDE_REGEX: /^(-?(?:1[0-7]|[1-9])?\d(?:\.\d{1,18})?|180(?:\.0{1,18})?)$/,
  WHITE_SPACES_REGEX: /^\S*$/,

  // ── Static validation lists ──────────────────────────────────────────────────
  VALID_DEVICE_STATUSES: [
    "recalled",
    "ready",
    "deployed",
    "undeployed",
    "decommissioned",
    "assembly",
    "testing",
    "not deployed",
  ],
  DEVICE_FILTER_TYPES: ["lowcost", "gas", "bam", "static", "mobile"],
  /**
   * Fields that may only be changed through dedicated lifecycle activity
   * endpoints (deploy / recall / maintain). Guards in the controller,
   * model modify()/bulkModify(), and background jobs all reference this
   * single source of truth.
   */
  LIFECYCLE_FIELDS: [
    "mobility",
    "deployment_type",
    "site_id",
    "grid_id",
    "status",
    "deployment_date",
    "recall_date",
    "isActive",
  ],
};

// Derived from MAX_EVENT_AGE_HOURS to keep the multiplication in one place.
appConstants.MAX_EVENT_AGE_MS =
  appConstants.MAX_EVENT_AGE_HOURS * 60 * 60 * 1000;

module.exports = appConstants;
