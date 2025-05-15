// middleware/rate-limiter.js
const rateLimit = require("express-rate-limit");
const RedisStore = require("rate-limit-redis");
const redis = require("@config/redis");

const createLimiter = (options) => {
  return rateLimit({
    store: new RedisStore({
      client: redis,
      prefix: `rate_limit:${options.prefix}:`,
    }),
    ...options,
  });
};

module.exports = {
  brandedLogin: createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per windowMs
    prefix: "branded_login",
    message: "Too many login attempts, please try again later",
  }),

  registration: createLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 registrations per hour
    prefix: "registration",
    message: "Too many registration attempts, please try again later",
  }),
};
