const mongoose = require("mongoose");

const numericals = {
  JWT_EXPIRES_IN_SECONDS:
    parseInt(process.env.JWT_EXPIRES_IN_SECONDS, 10) || 24 * 60 * 60, // 24 hours
  JWT_REFRESH_WINDOW_SECONDS:
    parseInt(process.env.JWT_REFRESH_WINDOW_SECONDS, 10) || 15 * 60, // 15 minutes
  JWT_GRACE_PERIOD_SECONDS:
    parseInt(process.env.JWT_GRACE_PERIOD_SECONDS, 10) || 5 * 60, // 5 minutes
  SALT_ROUNDS: 10,
  BCRYPT_SALT_ROUNDS: 12,
  SLUG_MAX_LENGTH: 20,
  TOKEN_LENGTH: 16,
  EMAIL_VERIFICATION_HOURS: 1,
  EMAIL_VERIFICATION_MIN: 0,
  EMAIL_VERIFICATION_SEC: 0,
  CLIENT_ID_LENGTH: 26,
  CLIENT_SECRET_LENGTH: 31,
  INACTIVE_THRESHOLD: 2592000000, //30 days ==> 30 (days) * 24 (hours per day) * 60 (minutes per hour) * 60 (seconds per minute) * 1000 (milliseconds per second)
  TOKEN_CLOCK_TOLERANCE: 30, // 30 seconds, Grace period for clock skew
};
module.exports = numericals;
