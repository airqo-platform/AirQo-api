const QueryThrottleModel = require("@models/QueryThrottle");
const RateLimitEventModel = require("@models/RateLimitEvent");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- throttle-util`);

const ANCIENT_QUERY_TTL = 3600;
const BLOCK_LOG_TTL = 900; // matches the 15-minute BLOCK_DURATION in event.util.js, so a client gets one Slack alert per block instead of one every 30s
const RATE_LIMIT_TTL = 360;

const throttleUtil = {
  shouldLogAncientQuery: async (clientIp, tenant = "airqo") => {
    try {
      const key = `ancient-query-${clientIp}`;
      const existing = await QueryThrottleModel(tenant).getThrottle(key);

      if (existing) {
        return false;
      }

      await QueryThrottleModel(tenant).setThrottle(
        key,
        "ancient_block",
        ANCIENT_QUERY_TTL,
        { ip: clientIp }
      );

      return true;
    } catch (error) {
      logger.warn(`Throttle check failed, allowing log: ${error.message}`);
      return true;
    }
  },

  shouldLogBlockAttempt: async (clientId, tenant = "airqo") => {
    try {
      const key = `block-log-${clientId}`;
      const existing = await QueryThrottleModel(tenant).getThrottle(key);

      if (existing) {
        return false;
      }

      await QueryThrottleModel(tenant).setThrottle(
        key,
        "block_log",
        BLOCK_LOG_TTL,
        { clientId }
      );

      return true;
    } catch (error) {
      logger.warn(`Throttle check failed, allowing log: ${error.message}`);
      return true;
    }
  },

  getRateLimitTracker: async (clientId, tenant = "airqo") => {
    try {
      return await QueryThrottleModel(tenant).getRateLimitTracker(clientId);
    } catch (error) {
      logger.error(`Error getting tracker: ${error.message}`);
      return { count: 0, windowStart: Date.now(), blockedUntil: 0 };
    }
  },

  setRateLimitTracker: async (clientId, tracker, tenant = "airqo") => {
    try {
      return await QueryThrottleModel(tenant).setRateLimitTracker(
        clientId,
        tracker
      );
    } catch (error) {
      logger.error(`Error setting tracker: ${error.message}`);
      return false;
    }
  },

  // Persists a rate-limit event for the daily digest job. Fire-and-forget:
  // never throws, so a logging failure can't affect the request path.
  logRateLimitEvent: async (eventType, clientId, extra = {}, tenant = "airqo") => {
    try {
      await RateLimitEventModel(tenant).recordEvent({
        eventType,
        clientId,
        tenant,
        timestamp: new Date(),
        ...extra,
      });
    } catch (error) {
      logger.error(`Error logging rate limit event: ${error.message}`);
    }
  },

  cleanupExpired: async (tenant = "airqo") => {
    try {
      return await QueryThrottleModel(tenant).cleanupExpired();
    } catch (error) {
      logger.error(`Error cleaning up: ${error.message}`);
      return 0;
    }
  },

  getConstants: () => ({
    ANCIENT_QUERY_TTL,
    BLOCK_LOG_TTL,
    RATE_LIMIT_TTL,
  }),
};

module.exports = throttleUtil;
