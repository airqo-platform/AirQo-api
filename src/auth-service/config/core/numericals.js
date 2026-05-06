const mongoose = require("mongoose");

const TOKEN_STRATEGIES = Object.freeze({
  LEGACY: "legacy",
  STANDARD: "standard",
  ULTRA_COMPRESSED: "ultra_compressed",
  COMPRESSED: "compressed",
  HASH_BASED: "hash_based",
  ROLE_ONLY: "role_only",
  OPTIMIZED_HASH: "optimized_hash",
  BIT_FLAGS: "bit_flags",
  OPTIMIZED_BIT_FLAGS: "optimized_bit_flags",
  OPTIMIZED_ROLE_ONLY: "optimized_role_only",
  NO_ROLES_AND_PERMISSIONS: "no_roles_and_permissions",
});

const numericals = {
  TOKEN_STRATEGIES,
  PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#?!$%^&*,.])[A-Za-z\d@#?!$%^&*,.]{10,}$/,
  JWT_EXPIRES_IN_SECONDS: Number.isFinite(
    Number(process.env.JWT_EXPIRES_IN_SECONDS),
  )
    ? Number(process.env.JWT_EXPIRES_IN_SECONDS)
    : 24 * 60 * 60, // 24 hours
  JWT_REFRESH_WINDOW_SECONDS: Number.isFinite(
    Number(process.env.JWT_REFRESH_WINDOW_SECONDS),
  )
    ? Number(process.env.JWT_REFRESH_WINDOW_SECONDS)
    : 15 * 60, // 15 minutes
  JWT_GRACE_PERIOD_SECONDS: Number.isFinite(
    Number(process.env.JWT_GRACE_PERIOD_SECONDS),
  )
    ? Number(process.env.JWT_GRACE_PERIOD_SECONDS)
    : 5 * 60, // 5 mins
  JWT_REFRESH_MAX_AGE_SECONDS: Number.isFinite(
    Number(process.env.JWT_REFRESH_MAX_AGE_SECONDS),
  )
    ? Number(process.env.JWT_REFRESH_MAX_AGE_SECONDS)
    : 365 * 24 * 60 * 60, // 1 year — covers MAU-heavy usage; users who open the app once a month
                           // (or less) are silently refreshed without ever seeing a login prompt
  SALT_ROUNDS: 10,
  BCRYPT_SALT_ROUNDS: 12,
  SLUG_MAX_LENGTH: 60,
  TOKEN_LENGTH: 16,
  EMAIL_VERIFICATION_HOURS: 1,
  EMAIL_VERIFICATION_MIN: 0,
  EMAIL_VERIFICATION_SEC: 0,
  CLIENT_ID_LENGTH: 26,
  CLIENT_SECRET_LENGTH: 31,
  INACTIVE_THRESHOLD: 2592000000, //30 days ==> 30 (days) * 24 (hours per day) * 60 (minutes per hour) * 60 (seconds per minute) * 1000 (milliseconds per second)
  TOKEN_CLOCK_TOLERANCE: 30, // 30 seconds, Grace period for clock skew
  EMAIL_QUEUE_INTERVAL_MS: 3000, // 3 seconds
  UNKNOWN_IP_RETENTION_DAYS: 90, // Documents not updated within this window are expired/deleted
  UNKNOWN_IP_COUNTS_MAX_ENTRIES: 30, // Max daily ipCounts entries kept per document

  // ── Security / notification thresholds ────────────────────────────────────
  COMPROMISED_TOKEN_COOLDOWN_DAYS: 30,
  EXPIRING_TOKEN_REMINDER_DAYS: 7,
  MAX_BOT_ALERTS_PER_DAY: 2,

  // ── Validation regex patterns ─────────────────────────────────────────────
  LATITUDE_REGEX: /^-?([0-8]?\d(\.\d+)?|90(\.0+)?)$/,
  LONGITUDE_REGEX: /^-?((1[0-7]\d|[0-9]?\d)(\.\d+)?|180(\.0+)?)$/,
  WHITE_SPACES_REGEX: /^\S+$/,
};
module.exports = numericals;
