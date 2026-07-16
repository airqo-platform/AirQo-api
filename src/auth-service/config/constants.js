// Populate process.env from .env.{NODE_ENV}.json before anything below reads
// it. Previously this only happened if a specific test bootstrap file
// (bin/test/ut_index.js) happened to load first — order that a correct,
// fully-recursive test glob no longer guarantees. Idempotent: only fills
// keys not already set, safe to call from multiple entry points.
require("./env-loader").loadEnvironment();

const coreConfig = require("./core");
const { EnvOnlyValidator } = require("../utils/validation-reporter");

const ENV = process.env.NODE_ENV || "development";

// ── Transformation helpers ────────────────────────────────────────────────────
const parseBool = (val, defaultVal) => {
  if (val === undefined || val === null || val.trim() === "") return defaultVal;
  const v = val.trim().toLowerCase();
  return v !== "false" && v !== "0";
};

const parseCSV = (val) =>
  val
    ? val
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];

// ── Config builder ────────────────────────────────────────────────────────────
function envConfig(env) {
  // All raw env values come from process.env, populated by config/env-loader.js
  // which reads .env.{NODE_ENV}.json (Azure Key Vault). Keys are canonical
  // (no environment prefix) — no alias mapping needed here.

  const analyticsBaseUrl = process.env.ANALYTICS_BASE_URL;

  const transformations = {
    // ── Boolean flags ─────────────────────────────────────────────────────────
    BYPASS_CAPTCHA: parseBool(process.env.BYPASS_CAPTCHA, false),
    BYPASS_RATE_LIMIT: parseBool(process.env.BYPASS_RATE_LIMIT, false),
    ENABLE_TOKEN_RATE_LIMITING: parseBool(
      process.env.ENABLE_TOKEN_RATE_LIMITING,
      false,
    ),
    ENABLE_DAILY_RATE_LIMITING: parseBool(
      process.env.ENABLE_DAILY_RATE_LIMITING,
      false,
    ),
    ENABLE_WEEKLY_RATE_LIMITING: parseBool(
      process.env.ENABLE_WEEKLY_RATE_LIMITING,
      false,
    ),
    ENABLE_MONTHLY_RATE_LIMITING: parseBool(
      process.env.ENABLE_MONTHLY_RATE_LIMITING,
      false,
    ),
    ENABLE_SCOPE_ENFORCEMENT: parseBool(
      process.env.ENABLE_SCOPE_ENFORCEMENT,
      false,
    ),
    ENABLE_ERROR_RATE_BREAKER: parseBool(
      process.env.ENABLE_ERROR_RATE_BREAKER,
      false,
    ),
    ERROR_RATE_THRESHOLD: (() => {
      const v = parseInt(process.env.ERROR_RATE_THRESHOLD, 10);
      return Number.isFinite(v) && v > 0 ? v : 50;
    })(),
    ANOMALY_SUSPEND_THRESHOLD: (() => {
      const v = parseInt(process.env.ANOMALY_SUSPEND_THRESHOLD, 10);
      return Number.isFinite(v) && v > 0 ? v : 10;
    })(),
    COMPROMISE_SUSPEND_THRESHOLD: (() => {
      const v = parseInt(process.env.COMPROMISE_SUSPEND_THRESHOLD, 10);
      return Number.isFinite(v) && v > 0 ? v : 50;
    })(),
    // How many days before a bypass_*_expires_at date bypass-expiry-job starts
    // sending a reminder email. Also used as the reminder email's cooldown so
    // a token only gets reminded once per expiry cycle, not once per job run.
    BYPASS_EXPIRY_REMINDER_LEAD_DAYS: (() => {
      const v = parseInt(process.env.BYPASS_EXPIRY_REMINDER_LEAD_DAYS, 10);
      return Number.isFinite(v) && v > 0 ? v : 3;
    })(),
    USE_REDIS_SESSIONS: parseBool(process.env.USE_REDIS_SESSIONS, false),
    ANALYTICS_PII_ENABLED: parseBool(process.env.ANALYTICS_PII_ENABLED, false),
    POSTHOG_ENABLED: parseBool(process.env.POSTHOG_ENABLED, false),
    POSTHOG_TRACK_API_REQUESTS: parseBool(
      process.env.POSTHOG_TRACK_API_REQUESTS,
      false,
    ),

    // ── Array values ──────────────────────────────────────────────────────────
    KAFKA_BOOTSTRAP_SERVERS: parseCSV(process.env.KAFKA_BOOTSTRAP_SERVERS),
    SELECTED_SITES: parseCSV(process.env.SELECTED_SITES),

    // ── Derived values ────────────────────────────────────────────────────────
    // AIRQO_GROUP_ID is an alias for DEFAULT_GROUP used by legacy callers.
    AIRQO_GROUP_ID: process.env.DEFAULT_GROUP,

    // Platform URLs derived from the single canonical ANALYTICS_BASE_URL.
    PWD_RESET: analyticsBaseUrl ? `${analyticsBaseUrl}/reset` : undefined,
    LOGIN_PAGE: analyticsBaseUrl
      ? `${analyticsBaseUrl}/user/login`
      : undefined,
    FORGOT_PAGE: analyticsBaseUrl ? `${analyticsBaseUrl}/forgot` : undefined,
    PLATFORM_BASE_URL: analyticsBaseUrl,

    // ── Per-environment defaults ──────────────────────────────────────────────
    ENVIRONMENT:
      process.env.ENVIRONMENT ||
      (env === "production"
        ? "PRODUCTION ENVIRONMENT"
        : env === "staging"
          ? "STAGING ENVIRONMENT"
          : "DEVELOPMENT ENVIRONMENT"),

    GROUPS_TOPIC: process.env.GROUPS_TOPIC || "groups-topic",

    ONBOARDING_BASE_URL:
      process.env.ONBOARDING_BASE_URL ||
      (env === "staging"
        ? "https://staging-analytics.airqo.net/onboarding"
        : "https://analytics.airqo.net/onboarding"),
  };

  // Priority (highest → lowest):
  //   1. transformations — computed/parsed values always win over raw strings
  //   2. coreConfig      — all named env reads and hardcoded constants
  const config = { ...coreConfig, ...transformations };

  const validator = new EnvOnlyValidator(env);
  if (env === "development") {
    console.log("🔍 Environment Validation Check...");
  }
  validator.validateMinimal(config);

  return config;
}

module.exports = envConfig(ENV);
