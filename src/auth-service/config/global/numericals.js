const mongoose = require("mongoose");

const numericals = {
  SALT_ROUNDS: 10,
  BCRYPT_SALT_ROUNDS: 12,
  TOKEN_LENGTH: 16,
  EMAIL_VERIFICATION_HOURS: 1,
  EMAIL_VERIFICATION_MIN: 0,
  EMAIL_VERIFICATION_SEC: 0,
  CLIENT_ID_LENGTH: 26,
  CLIENT_SECRET_LENGTH: 31,
  INACTIVE_THRESHOLD: 2592000000, //30 days ==> 30 (days) * 24 (hours per day) * 60 (minutes per hour) * 60 (seconds per minute) * 1000 (milliseconds per second)
  HEALTH_CHECK_RATE_LIMIT_MAX: parseInt(
    process.env.HEALTH_CHECK_RATE_LIMIT_MAX || "10",
    10
  ),
  HEALTH_CHECK_RATE_LIMIT_WINDOW_MS: parseInt(
    process.env.HEALTH_CHECK_RATE_LIMIT_WINDOW_MS || "60000",
    10
  ),
};
module.exports = numericals;
