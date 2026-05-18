const global = require("./definitions");
const { EnvOnlyValidator } = require("../utils/validation-reporter");

const ENV = process.env.NODE_ENV || "production";

// ── Transformation helpers ────────────────────────────────────────────────────
const parseCSV = (val) =>
  val
    ? val
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
    : [];

const parseBool = (val, defaultVal) =>
  val !== undefined && val !== null && val.trim() !== ""
    ? val.trim() !== "false" && val.trim() !== "0"
    : defaultVal;

// ── Config builder ────────────────────────────────────────────────────────────
function envConfig(env) {
  // All raw env values come from process.env, populated by config/env-loader.js
  // which reads .env.{NODE_ENV}.json (Azure Key Vault) with the flat file as fallback.
  // Keys are canonical (no environment prefix) — no alias mapping needed here.

  const transformations = {
    // Boolean: defaults to true unless the string "false" or "0" is set.
    PRECOMPUTE_ACTIVITIES_JOB_ENABLED: parseBool(
      process.env.PRECOMPUTE_ACTIVITIES_JOB_ENABLED,
      true,
    ),

    // Array: CSV string → JS array.
    KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS
      ? process.env.KAFKA_BOOTSTRAP_SERVERS
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : [],

    // Array: always includes the system "airqo" cohort.
    PROTECTED_COHORT_NAMES: [
      "airqo",
      ...parseCSV(process.env.PROTECTED_COHORT_NAMES),
    ],

    // URL: always built from REDIS_SERVER + REDIS_PORT.
    REDIS_URL: process.env.REDIS_SERVER
      ? `redis://${process.env.REDIS_SERVER}:${process.env.REDIS_PORT || 6379}`
      : undefined,

    // Label: override from env (useful in tests), otherwise derive from NODE_ENV.
    ENVIRONMENT:
      process.env.ENVIRONMENT ||
      (env === "production"
        ? "PRODUCTION ENVIRONMENT"
        : env === "staging"
          ? "STAGING ENVIRONMENT"
          : "DEVELOPMENT ENVIRONMENT"),

    // Feature flags: env var overrides the per-environment default.
    BACKFILL_SITE_METADATA_SCHEDULER_ENABLED: parseBool(
      process.env.BACKFILL_SITE_METADATA_SCHEDULER_ENABLED,
      env === "production", // default on in production only
    ),

    FIND_DUPLICATE_COHORTS_SCHEDULER_ENABLED: parseBool(
      process.env.FIND_DUPLICATE_COHORTS_SCHEDULER_ENABLED,
      env !== "staging", // default off in staging only
    ),

    // Integer (ms): maximum time the MongoDB driver waits for a response on an
    // open socket before aborting the operation.  Must be long enough to cover
    // the heaviest aggregation in the service — EventModel.fetch(recent=yes)
    // runs multi-$lookup + $facet across the full events collection.
    // Default: 600 000 ms (10 min) — matches the original pre-refactor value and
    // gives the heavy EventModel.fetch(recent=yes) aggregation full headroom.
    // Override via MONGODB_SOCKET_TIMEOUT_MS in the environment JSON.
    MONGODB_SOCKET_TIMEOUT_MS: (() => {
      const val = parseInt(process.env.MONGODB_SOCKET_TIMEOUT_MS, 10);
      return Number.isFinite(val) && val > 0 ? val : 600000;
    })(),

    // MongoDB maxTimeMS for ReadingModel.recent() aggregation.
    // Must be below the Next.js proxy timeout (30s) so MongoDB fails fast
    // before the proxy aborts the upstream connection.
    READINGS_AGGREGATE_TIMEOUT_MS: (() => {
      const val = parseInt(process.env.READINGS_AGGREGATE_TIMEOUT_MS, 10);
      return Number.isFinite(val) && val > 0 ? val : 25000;
    })(),

    // Temporary diagnostic window for ReadingModel.recent().
    // Revert to 3 once the root cause of the empty readings collection is confirmed.
    DIAGNOSTIC_WINDOW_DAYS: (() => {
      const val = parseInt(process.env.DIAGNOSTIC_WINDOW_DAYS, 10);
      return Number.isFinite(val) && val > 0 ? val : 3;
    })(),

    // Default lookback window for event/measurement queries (generate-filter fetch).
    // Temporarily raised to 7 for diagnosis — revert to 3 when data pipeline is healthy.
    DEFAULT_QUERY_RANGE_DAYS: (() => {
      const val = parseInt(process.env.DEFAULT_QUERY_RANGE_DAYS, 10);
      return Number.isFinite(val) && val > 0 ? val : 3;
    })(),

    // How many hours without a successful event insertion before firing a Slack alert.
    EVENTS_STALENESS_THRESHOLD_HOURS: (() => {
      const val = parseInt(process.env.EVENTS_STALENESS_THRESHOLD_HOURS, 10);
      return Number.isFinite(val) && val > 0 ? val : 2;
    })(),
  };

  // ── Final merge ─────────────────────────────────────────────────────────────
  // Priority (highest → lowest):
  //   1. transformations — computed/parsed values always win over raw strings
  //   2. global          — named globals with their own transforms
  //   3. process.env     — canonical values loaded from .env.{NODE_ENV}.json
  const config = { ...process.env, ...global, ...transformations };

  // Minimal validation — only surfaces problems.
  const validator = new EnvOnlyValidator(env);
  if (env === "development") {
    console.log("🔍 Environment Validation Check...");
    validator.validateMinimal(config);
  } else {
    validator.validateMinimal(config);
  }

  return config;
}

module.exports = envConfig(ENV);
