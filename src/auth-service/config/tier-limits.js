// Canonical subscription tier constants shared across transaction.util.js,
// token.util.js, and rate-limit.middleware.js.
// Edit here; consumers import — never duplicate these values.

const TIER_SCOPE_MAP = {
  Free: [
    "read:recent_measurements",
    "read:devices",
    "read:sites",
    "read:cohorts",
    "read:grids",
  ],
  Standard: [
    "read:recent_measurements",
    "read:devices",
    "read:sites",
    "read:cohorts",
    "read:grids",
    "read:historical_measurements",
  ],
  Premium: [
    "read:recent_measurements",
    "read:devices",
    "read:sites",
    "read:cohorts",
    "read:grids",
    "read:historical_measurements",
    "read:forecasts",
    "read:insights",
  ],
};

const TIER_RATE_LIMITS = {
  Free:     { hourlyLimit: 100,  dailyLimit: 1000,  weeklyLimit: 7000,   monthlyLimit: 10000 },
  Standard: { hourlyLimit: 500,  dailyLimit: 5000,  weeklyLimit: 35000,  monthlyLimit: 50000 },
  Premium:  { hourlyLimit: 2000, dailyLimit: 20000, weeklyLimit: 140000, monthlyLimit: 200000 },
};

module.exports = { TIER_SCOPE_MAP, TIER_RATE_LIMITS };
