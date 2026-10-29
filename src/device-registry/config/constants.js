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

    BACKFILL_SEARCH_NAME_SCHEDULER_ENABLED: parseBool(
      process.env.BACKFILL_SEARCH_NAME_SCHEDULER_ENABLED,
      env === "production", // default on in production only
    ),

    FIND_DUPLICATE_COHORTS_SCHEDULER_ENABLED: parseBool(
      process.env.FIND_DUPLICATE_COHORTS_SCHEDULER_ENABLED,
      env !== "staging", // default off in staging only
    ),

    // Token resource binding — when true, cohort/grid read routes call the
    // auth-service verify endpoint and enforce allowed_grids / allowed_cohorts.
    // Default off so existing behaviour is completely unchanged until explicitly
    // enabled via the env var.
    ENABLE_RESOURCE_BINDING: parseBool(
      process.env.ENABLE_RESOURCE_BINDING,
      false,
    ),

    // update-raw-online-status-job's best-effort DeviceUptime sampling
    // (leaderboard/verification data). Non-critical — a failure here never
    // blocks the actual device status update. Kill-switch for turning it off
    // instantly via env var (no redeploy) if it's ever implicated in DB load
    // issues, without touching the job's core status-check logic.
    ENABLE_ONLINE_STATUS_UPTIME_SAMPLING: parseBool(
      process.env.ENABLE_ONLINE_STATUS_UPTIME_SAMPLING,
      true,
    ),

    // Cohort/device group-ownership scoping — when true, assigning a device
    // to a cohort is rejected if they don't share a network/group (the
    // "airqo" network/group is exempt). Default off: mismatches are only
    // logged as warnings so we can confirm no legitimate cross-group
    // assignment pattern exists before anything is actually blocked.
    ENFORCE_COHORT_DEVICE_GROUP_SCOPE: parseBool(
      process.env.ENFORCE_COHORT_DEVICE_GROUP_SCOPE,
      false,
    ),

    // Cohort/user group-membership scoping — when true, assigning a device
    // to a cohort is rejected if the requesting user's groups (forwarded by
    // the nginx gateway as X-Auth-User-Groups, resolved from auth-service —
    // device-registry never fetches or stores user data itself) don't
    // overlap with the cohort's groups/network. Only enforced when identity
    // headers are actually present; a request with no identity data is
    // never blocked on that basis alone. Default off: mismatches are only
    // logged as warnings until confirmed safe to enforce.
    ENFORCE_COHORT_USER_GROUP_MEMBERSHIP: parseBool(
      process.env.ENFORCE_COHORT_USER_GROUP_MEMBERSHIP,
      false,
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

    // Lookback window for ReadingModel.recent(). Kept at 1 day so a device that has
    // been offline for days doesn't still surface a stale reading as "recent" in the mobile app.
    DIAGNOSTIC_WINDOW_DAYS: (() => {
      const val = parseInt(process.env.DIAGNOSTIC_WINDOW_DAYS, 10);
      return Number.isFinite(val) && val > 0 ? val : 1;
    })(),

    // Lookback window specifically for the Nexus-facing /recent endpoint
    // (createEventUtil.readRecentWithFilter). Narrower than the shared
    // DIAGNOSTIC_WINDOW_DAYS default (used by mobile/other callers of
    // ReadingModel.recent()) to keep the sort-then-group scan small under load.
    RECENT_ENDPOINT_LOOKBACK_HOURS: (() => {
      const val = parseInt(process.env.RECENT_ENDPOINT_LOOKBACK_HOURS, 10);
      return Number.isFinite(val) && val > 0 ? val : 6;
    })(),

    // Default lookback window for ReadingModel.listForMap() when the caller
    // supplies no explicit time filter. Previously hard-coded to 48h, which
    // meant every unfiltered /map load sorted+grouped up to 48h of readings
    // across every device just to surface one latest-per-site row. 6h keeps
    // typical map usage covered while cutting the scan size dramatically.
    MAP_DEFAULT_LOOKBACK_HOURS: (() => {
      const val = parseInt(process.env.MAP_DEFAULT_LOOKBACK_HOURS, 10);
      return Number.isFinite(val) && val > 0 ? val : 6;
    })(),

    // MongoDB maxTimeMS for the device-listing aggregations in device.util.js
    // (list(), getDeviceCountSummary()) that back Vertex's /devices/summary,
    // /devices/status/*, and /devices/summary/count. These were previously
    // hard-coded to 45000ms, longer than Vertex's own 30s proxy timeout for
    // the "devices" endpoint group — meaning a slow query would outlive the
    // client's patience and keep holding a pooled connection for no benefit.
    // Same reasoning as READINGS_AGGREGATE_TIMEOUT_MS, same default.
    DEVICE_LIST_AGGREGATE_TIMEOUT_MS: (() => {
      // Number() (unlike parseInt) rejects partial parses ("25000ms") and
      // requires the whole string to be numeric; isSafeInteger rejects
      // fractional ("25000.5") and out-of-range values.
      const val = Number(process.env.DEVICE_LIST_AGGREGATE_TIMEOUT_MS);
      return Number.isSafeInteger(val) && val > 0 ? val : 25000;
    })(),

    // Default lookback window for event/measurement queries (generate-filter fetch).
    DEFAULT_QUERY_RANGE_DAYS: (() => {
      const val = parseInt(process.env.DEFAULT_QUERY_RANGE_DAYS, 10);
      return Number.isFinite(val) && val > 0 ? val : 1;
    })(),

    // How many hours without a successful event insertion before firing a Slack alert.
    EVENTS_STALENESS_THRESHOLD_HOURS: (() => {
      const val = parseInt(process.env.EVENTS_STALENESS_THRESHOLD_HOURS, 10);
      return Number.isFinite(val) && val > 0 ? val : 2;
    })(),

    // How many days of events to retain in MongoDB before purging.
    // Aligned with the ingestion guard (30-day max lookback in store-readings-job)
    // and the API query limit (1-day default window, 7-day historical threshold).
    // Override via EVENTS_RETENTION_DAYS env var.
    EVENTS_RETENTION_DAYS: (() => {
      const val = parseInt(process.env.EVENTS_RETENTION_DAYS, 10);
      return Number.isFinite(val) && val > 0 ? val : 90;
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
