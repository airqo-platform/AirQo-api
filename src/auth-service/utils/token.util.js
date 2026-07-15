const ApiUsageCounterModel = require("@models/ApiUsageCounter");
const BlacklistedIPModel = require("@models/BlacklistedIP");
const BlacklistedIPPrefixModel = require("@models/BlacklistedIPPrefix");
const IPPrefixModel = require("@models/IPPrefix");
const UnknownIPModel = require("@models/UnknownIP");
const WhitelistedIPModel = require("@models/WhitelistedIP");
const IPRequestLogModel = require("@models/IPRequestLog");
const BlacklistedIPRangeModel = require("@models/BlacklistedIPRange");
const ClientModel = require("@models/Client");
const AccessTokenModel = require("@models/AccessToken");
const CompromisedTokenLogModel = require("@models/CompromisedTokenLog");
const VerifyTokenModel = require("@models/VerifyToken");
const UserModel = require("@models/User");
const EmailLogModel = require("@models/EmailLog");
const BlockedDomainModel = require("@models/BlockedDomain");
const BlockedASNModel = require("@models/BlockedASN");
const FlaggedTokenModel = require("@models/FlaggedToken");
const {
  redisGetAsync,
  redisSetAsync,
  redisIncrAsync,
  redisExpireAsync,
  redisDelAsync,
  redisMgetAsync,
} = require("@config/redis");
const { TIER_SCOPE_MAP, TIER_RATE_LIMITS } = require("@config/tier-limits");
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const crypto = require("crypto");
const accessCodeGenerator = require("generate-password");
const { logObject, logText, HttpError } = require("@utils/shared");
const {
  mailer,
  stringify,
  generateFilter,
  winstonLogger,
} = require("@utils/common");

const isEmpty = require("is-empty");
const constants = require("@config/constants");
const moment = require("moment-timezone");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- token-util`);
const securityAuditLogger = log4js.getLogger("token-security-audit");

const async = require("async");
const { Kafka } = require("kafkajs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

// Cache key and TTL for the IP-prefix blacklist.
// The prefix list changes rarely; 10 minutes is the right trade-off between
// freshness and eliminating the unbounded BlacklistedIPPrefixModel.find() that
// was previously running on every single authenticated request.
const IP_PREFIX_CACHE_KEY = "ip_prefix_blacklist_cache";
const IP_PREFIX_CACHE_TTL_SECONDS = 10 * 60; // 10 minutes

// Cache key and TTL for blocked ASN CIDR ranges.
const BLOCKED_ASN_CACHE_KEY = "blocked_asn_cidr_cache";
const BLOCKED_ASN_CACHE_TTL_SECONDS = 10 * 60; // 10 minutes

// Strict IPv4 pattern — four decimal octets, each 0-255.
const _IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

const _isValidIPv4 = (addr) => {
  const m = _IPV4_RE.exec(addr);
  if (!m) return false;
  return [m[1], m[2], m[3], m[4]].every((o) => {
    const n = parseInt(o, 10);
    return n >= 0 && n <= 255;
  });
};

/**
 * Check whether an IPv4 address falls within an IPv4 CIDR block.
 * e.g. _isIpInCidr("192.168.1.50", "192.168.1.0/24") → true
 *
 * Returns false (allow through) for any non-IPv4 input (IPv6, hostnames,
 * malformed strings) so unexpected formats never accidentally block traffic.
 */
const _isIpInCidr = (ip, cidr) => {
  try {
    const [range, bits] = cidr.split("/");
    if (!range || bits === undefined) return false;
    // Reject immediately for non-IPv4 addresses (e.g. ::1, fe80::, hostnames).
    if (!_isValidIPv4(ip) || !_isValidIPv4(range)) return false;
    const prefixLen = parseInt(bits, 10);
    if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return false;
    const ipToInt = (addr) =>
      addr
        .split(".")
        .reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
    const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
    return (ipToInt(ip) & mask) === (ipToInt(range) & mask);
  } catch (_) {
    return false;
  }
};

/**
 * Load active blocked-ASN CIDR ranges from Redis (10-min cache) or MongoDB.
 * Accepts an optional tenant so each tenant has its own isolated cache entry.
 * Returns a flat array of CIDR strings.  Never throws.
 */
const _loadBlockedAsnCidrs = async (tenant) => {
  const dbTenant = tenant || constants.DEFAULT_TENANT || "airqo";
  const cacheKey = `${BLOCKED_ASN_CACHE_KEY}:${dbTenant}`;
  try {
    const cached = await redisGetAsync(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
        return parsed;
      }
    }
  } catch (_) {}
  try {
    const docs = await BlockedASNModel(dbTenant)
      .find({ active: true })
      .select("cidr_ranges -_id")
      .lean();
    const cidrs = docs.flatMap((d) => d.cidr_ranges || []);
    try {
      await redisSetAsync(cacheKey, JSON.stringify(cidrs), BLOCKED_ASN_CACHE_TTL_SECONDS);
    } catch (_) {}
    return cidrs;
  } catch (_) {
    return [];
  }
};

/**
 * Invalidate the blocked-ASN Redis cache for a tenant so the next verify call
 * reloads it.  Call after adding/removing a BlockedASN document.
 */
const invalidateBlockedAsnCache = async (tenant) => {
  const dbTenant = tenant || constants.DEFAULT_TENANT || "airqo";
  try {
    await redisDelAsync(`${BLOCKED_ASN_CACHE_KEY}:${dbTenant}`);
  } catch (_) {}
};

const getDay = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const API_TOKEN_TTL_MS = 5110 * 3600 * 1000; // 7 months (matches AccessToken model)

const createUnauthorizedResponse = () => {
  return {
    success: false,
    message: "Unauthorized",
    status: httpStatus.UNAUTHORIZED,
    errors: { message: "Unauthorized" },
  };
};
const createValidTokenResponse = (data = {}) => {
  return {
    success: true,
    message: "The token is valid",
    status: httpStatus.OK,
    data,
  };
};

const createForbiddenResponse = (message) => ({
  success: false,
  message,
  status: httpStatus.FORBIDDEN,
  errors: { message },
});
const createRateLimitResponse = (tier, period = "Hourly") => {
  return {
    success: false,
    message: `${period} request limit reached for ${tier} tier`,
    status: httpStatus.TOO_MANY_REQUESTS,
    errors: {
      message:
        tier === "Free"
          ? "Upgrade to Standard or Premium for higher API limits"
          : `You have exceeded your ${period.toLowerCase()} request limit`,
    },
  };
};

// In-memory fallback store when Redis is unavailable
// { key: { count: number, expiry: number } }
const _rlMemoryStore = new Map();

// Prune expired entries every 5 minutes so the Map doesn't grow significantly
// during high-traffic windows where Redis stays unavailable.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of _rlMemoryStore) {
    if (entry.expiry < now) _rlMemoryStore.delete(key);
  }
}, 300000).unref();

/**
 * Generic slot-based rate-limit counter backed by Redis with in-memory fallback.
 * Uses atomic INCR+EXPIRE so two concurrent requests never observe the same
 * pre-increment value (eliminates the race in the old GET→check→SET pattern).
 * Never throws — fails open to avoid blocking legitimate requests.
 * @param {string} key    - Redis key (must encode user ID + time slot)
 * @param {number} limit  - Maximum count allowed within this slot
 * @param {number} ttlSec - Redis key TTL in seconds
 * @param {number} ttlMs  - In-memory expiry window in milliseconds
 * @returns {Promise<boolean>} true = within limit, false = limit exceeded
 */
const _checkRlCounter = async (key, limit, ttlSec, ttlMs) => {
  try {
    try {
      const count = await redisIncrAsync(key);
      if (count === null) throw new Error("Redis unavailable");
      // First increment creates the key — set TTL once so it auto-expires.
      if (count === 1) await redisExpireAsync(key, ttlSec);
      return count <= limit;
    } catch (_redisErr) {
      // Redis unavailable — fall through to memory store
    }

    const now = Date.now();
    const entry = _rlMemoryStore.get(key);
    if (!entry || entry.expiry < now) {
      _rlMemoryStore.set(key, { count: 1, expiry: now + ttlMs });
      return true;
    }
    entry.count++;
    return entry.count <= limit;
  } catch (err) {
    logger.error(`Non-critical: rate limit counter failed for key=${key}: ${err.message}`);
    return true; // Fail open
  }
};

/**
 * Atomically increment the MongoDB-backed API usage counters for a user.
 * Writes hourly, daily, and monthly documents in parallel via upsert + $inc.
 * Fire-and-forget — never throws; errors are logged and swallowed.
 */
const _incrementUsageCounters = (userId) => {
  const now = new Date();
  const year  = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day   = String(now.getUTCDate()).padStart(2, "0");
  const hour  = String(now.getUTCHours()).padStart(2, "0");

  const hourKey  = `${year}${month}${day}${hour}`;
  const dayKey   = `${year}${month}${day}`;
  const monthKey = `${year}${month}`;

  // expires_at = end of current window + 2-unit buffer.
  // +1 advances to the next window boundary; +2 adds the post-reset buffer.
  const hourExpiry  = new Date(Date.UTC(year, now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() + 3));
  const dayExpiry   = new Date(Date.UTC(year, now.getUTCMonth(), now.getUTCDate() + 3));
  const monthExpiry = new Date(Date.UTC(year, now.getUTCMonth() + 3, 1));

  const Model = ApiUsageCounterModel("airqo");
  const uid   = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(String(userId))
    : userId;

  const upsert = async (period, window_key, expires_at) => {
    try {
      await Model.findOneAndUpdate(
        { user_id: uid, period, window_key },
        { $inc: { count: 1 }, $setOnInsert: { expires_at } },
        { upsert: true, new: false }
      );
    } catch (err) {
      if (err.code === 11000) {
        // Concurrent insert race — document now exists; retry increment without upsert
        await Model.findOneAndUpdate(
          { user_id: uid, period, window_key },
          { $inc: { count: 1 } }
        ).catch((retryErr) =>
          logger.error(`Non-critical: usage counter retry failed (${period}): ${retryErr.message}`)
        );
      } else {
        logger.error(`Non-critical: usage counter upsert failed (${period}): ${err.message}`);
      }
    }
  };

  Promise.all([
    upsert("hourly",  hourKey,  hourExpiry),
    upsert("daily",   dayKey,   dayExpiry),
    upsert("monthly", monthKey, monthExpiry),
  ]).catch(() => {});
};

/**
 * Check and increment the hourly rate limit counter for a user.
 * Controlled by ENABLE_TOKEN_RATE_LIMITING (default: false).
 */
const checkTokenVerifyRateLimit = async (userId, tier) => {
  const limit = (TIER_RATE_LIMITS[tier] || TIER_RATE_LIMITS.Free).hourlyLimit;
  const slot  = Math.floor(Date.now() / 3600000);
  // Key format preserved from original (`rl:tv:`) to avoid resetting existing Redis counters
  // in environments that already run with ENABLE_TOKEN_RATE_LIMITING=true.
  return _checkRlCounter(`rl:tv:${userId}:${slot}`, limit, 3601, 3600000);
};

/**
 * Check and increment the daily rate limit counter for a user.
 * Controlled by ENABLE_DAILY_RATE_LIMITING (default: false).
 */
const checkDailyRateLimit = async (userId, tier) => {
  const limit = (TIER_RATE_LIMITS[tier] || TIER_RATE_LIMITS.Free).dailyLimit;
  const slot  = Math.floor(Date.now() / 86400000); // UTC day since epoch
  return _checkRlCounter(`rl:tv:d:${userId}:${slot}`, limit, 86401, 86400000);
};

/**
 * Check and increment the weekly rate limit counter for a user.
 * Controlled by ENABLE_WEEKLY_RATE_LIMITING (default: false).
 * Slot is Monday-aligned: subtracting 4 days shifts the Thursday-origin epoch
 * so slot boundaries fall on Mondays (00:00 UTC).
 */
const checkWeeklyRateLimit = async (userId, tier) => {
  const limit   = (TIER_RATE_LIMITS[tier] || TIER_RATE_LIMITS.Free).weeklyLimit;
  const slot    = Math.floor((Date.now() - 4 * 86400000) / 604800000);
  const ttlSec  = 604801;
  const ttlMs   = 604800000;
  return _checkRlCounter(`rl:tv:w:${userId}:${slot}`, limit, ttlSec, ttlMs);
};

/**
 * Check and increment the monthly rate limit counter for a user.
 * Controlled by ENABLE_MONTHLY_RATE_LIMITING (default: false).
 * Slot key is YYYYMM so it resets on calendar month boundaries.
 */
const checkMonthlyRateLimit = async (userId, tier) => {
  const limit  = (TIER_RATE_LIMITS[tier] || TIER_RATE_LIMITS.Free).monthlyLimit;
  const now    = new Date();
  const slot   = now.getUTCFullYear() * 100 + (now.getUTCMonth() + 1);
  const ttlSec = 32 * 86400; // 32 days — covers any calendar month
  const ttlMs  = 32 * 86400000;
  return _checkRlCounter(`rl:tv:m:${userId}:${slot}`, limit, ttlSec, ttlMs);
};

const ScopeRuleModel = require("@models/ScopeRule");

/**
 * Hardcoded fallback rules — used ONLY when the DB is unreachable
 * or has no active rules yet (first boot / before seed-defaults is called).
 * These mirror the defaults seeded by ScopeRuleModel.seedDefaults().
 */
const _FALLBACK_SCOPE_RULES = [
  { pattern: "/devices/forecasts",    scope: "read:forecasts",               priority: 10 },
  { pattern: "/forecasts",            scope: "read:forecasts",               priority: 11 },
  { pattern: "/insights",             scope: "read:insights",                priority: 12 },
  { pattern: "/devices/measurements", scope: "read:historical_measurements", priority: 20 },
  { pattern: "/devices/events",       scope: "read:recent_measurements",     priority: 30 },
  { pattern: "/devices/readings",     scope: "read:recent_measurements",     priority: 31 },
  { pattern: "/devices/feeds",        scope: "read:recent_measurements",     priority: 32 },
  { pattern: "/devices/sites",        scope: "read:sites",                   priority: 40 },
  { pattern: "/devices/cohorts",      scope: "read:cohorts",                 priority: 41 },
  { pattern: "/devices/grids",        scope: "read:grids",                   priority: 42 },
  { pattern: "/devices",              scope: "read:devices",                 priority: 50 },
];

/**
 * In-memory rule cache — refreshed from DB every SCOPE_RULE_CACHE_TTL_MS.
 * This means rule changes made via the API take effect within one cache cycle
 * without any code deployment or restart.
 */
const SCOPE_RULE_CACHE_TTL_MS = 60 * 1000; // 60 seconds
let _scopeRuleCache = null;     // { rules: Array, loadedAt: number }
let _scopeRuleFetchPending = false;

/**
 * Load active scope rules from DB (Redis-cached at the app level).
 * Falls back to hardcoded defaults if DB is unreachable.
 * Never throws.
 */
const _loadScopeRules = async () => {
  if (_scopeRuleFetchPending) return; // avoid concurrent fetches
  _scopeRuleFetchPending = true;
  try {
    const tenant = constants.DEFAULT_TENANT || "airqo";
    const response = await ScopeRuleModel(tenant).loadActive();
    if (response.success && response.data && response.data.length > 0) {
      _scopeRuleCache = { rules: response.data, loadedAt: Date.now() };
    } else {
      // DB returned empty — keep existing cache or fall back to hardcoded
      if (!_scopeRuleCache) {
        _scopeRuleCache = { rules: _FALLBACK_SCOPE_RULES, loadedAt: Date.now() };
      }
    }
  } catch (err) {
    logger.error(`Non-critical: failed to load scope rules from DB: ${err.message}`);
    if (!_scopeRuleCache) {
      _scopeRuleCache = { rules: _FALLBACK_SCOPE_RULES, loadedAt: Date.now() };
    }
  } finally {
    _scopeRuleFetchPending = false;
  }
};

/**
 * Get active scope rules, refreshing the cache if stale.
 * Returns synchronously from cache; triggers async refresh in background.
 */
const _getScopeRules = () => {
  const now = Date.now();
  if (!_scopeRuleCache || (now - _scopeRuleCache.loadedAt) > SCOPE_RULE_CACHE_TTL_MS) {
    _loadScopeRules(); // fire-and-forget refresh
  }
  return _scopeRuleCache ? _scopeRuleCache.rules : _FALLBACK_SCOPE_RULES;
};


/**
 * Check whether the given URI requires a scope and whether the token grants it.
 * Returns { required: true/false, granted: true/false, scope: string|null }.
 * Never throws.
 */
const checkUriScope = (uri, effectiveScopes) => {
  if (!uri) return { required: false, granted: true, scope: null };
  try {
    const rules = _getScopeRules();
    for (const rule of rules) {
      const pattern = rule.pattern;
      const matches =
        pattern instanceof RegExp
          ? pattern.test(uri)
          : (() => {
              const u = uri.toLowerCase();
              const p = pattern.toLowerCase();
              return u === p || u.startsWith(p + "/") || u.startsWith(p + "?");
            })();
      if (matches) {
        return {
          required: true,
          granted: effectiveScopes.includes(rule.scope),
          scope: rule.scope,
        };
      }
    }
  } catch (err) {
    logger.error(`Non-critical: scope check failed for uri=${uri}: ${err.message}`);
  }
  // No matching rule — allow through (non-data endpoint)
  return { required: false, granted: true, scope: null };
};

const createInsufficientScopeResponse = (requiredScope, tier) => ({
  success: false,
  message: "Insufficient scope for this resource",
  status: httpStatus.FORBIDDEN,
  errors: {
    message:
      tier === "Free"
        ? `This resource requires the '${requiredScope}' scope. Upgrade your subscription to access it.`
        : `Your subscription does not include the '${requiredScope}' scope.`,
  },
});

const trampoline = (fn) => {
  while (typeof fn === "function") {
    fn = fn();
  }
  return fn;
};

let blacklistQueue = async.queue(async (task, callback) => {
  let { ip } = task;
  logText("we are in the IP range checker.....");
  // If the IP falls within the range, publish it to the "ip-address" topic
  try {
    const kafkaProducer = kafka.producer({
      groupId: constants.UNIQUE_PRODUCER_GROUP,
    });
    await kafkaProducer.connect();
    try {
      await kafkaProducer.send({
        topic: "ip-address",
        messages: [{ value: stringify({ ip }) }],
      });
      logObject(`🤩🤩 Published IP ${ip} to the "ip-address" topic.`);
    } catch (sendError) {
      logObject("kafka producer send error", sendError);
    } finally {
      await kafkaProducer.disconnect().catch((error) => {
        logObject("kafka producer disconnect error", error);
      });
    }
  } catch (error) {
    logObject("error", error);
  } finally {
    if (typeof callback === "function") callback();
  }
}, 1); // Limit the number of concurrent tasks to 1

let unknownIPQueue = async.queue(async (task, callback) => {
  let { ip, token, name, client_id, endpoint, day } = task;
  await UnknownIPModel("airqo")
    .findOne({
      ip,
      "ipCounts.day": day,
    })
    .then(async (checkDoc) => {
      if (checkDoc) {
        const update = {
          $addToSet: {
            client_ids: client_id,
            tokens: token,
            token_names: name,
            endpoints: endpoint,
          },
          $inc: {
            "ipCounts.$[elem].count": 1,
          },
        };
        const options = {
          arrayFilters: [{ "elem.day": day }],
          upsert: true,
          new: true,
          runValidators: true,
        };

        await UnknownIPModel("airqo")
          .findOneAndUpdate({ ip }, update, options)
          .then(async () => {
            // Trim ipCounts to the last N entries in a separate update.
            // $push+$slice cannot be combined with $inc on the same array path
            // in a single update document — MongoDB raises ConflictingUpdateOperators.
            await UnknownIPModel("airqo").updateOne(
              { ip },
              {
                $push: {
                  ipCounts: {
                    $each: [],
                    $slice: -constants.UNKNOWN_IP_COUNTS_MAX_ENTRIES,
                  },
                },
              }
            );
            logText(`stored the unknown IP ${ip} which had a day field`);
            callback();
          });
      } else {
        await UnknownIPModel("airqo")
          .create({
            ip,
            tokens: [token],
            token_names: [name],
            endpoints: [endpoint],
            client_ids: [client_id],
            ipCounts: [{ day, count: 1 }],
          })
          .then(() => {
            logText(`stored the unknown IP ${ip} which had NO day field`);
            callback();
          });
      }
    });
}, 1); // Limit the number of concurrent tasks to 1

let ipPrefixQueue = async.queue(async (task, callback) => {
  let { prefix, day } = task;
  await IPPrefixModel("airqo")
    .findOne({ prefix, "prefixCounts.day": day })
    .then(async (checkDoc) => {
      if (checkDoc) {
        const update = {
          $inc: {
            "prefixCounts.$[elem].count": 1,
          },
        };
        const options = {
          arrayFilters: [{ "elem.day": day }],
          upsert: true,
          new: true,
          runValidators: true,
        };

        await IPPrefixModel("airqo")
          .findOneAndUpdate({ prefix }, update, options)
          .then(() => {
            logText(`incremented the count of IP prefix ${prefix}`);
            callback();
          });
      } else {
        await IPPrefixModel("airqo")
          .create({
            prefix,
            prefixCounts: [{ day, count: 1 }],
          })
          .then(() => {
            logText(`stored the new IP prefix ${prefix}`);
            callback();
          });
      }
    });
}, 1); // Limit the number of concurrent tasks to 1

function generatePrefix(ipAddress) {
  return ipAddress.split(".")[0];
}

const postProcessing = async ({
  ip,
  token,
  name,
  client_id,
  endpoint = "unknown",
  day,
}) => {
  const prefix = generatePrefix(ip);
  blacklistQueue.push({ ip });
  unknownIPQueue.push({
    ip,
    token,
    name,
    client_id,
    endpoint,
    day,
  });
  ipPrefixQueue.push({ prefix, day });
};

const isIPBlacklistedHelper = async (
  { request, next } = {},
  retries = 1,
  delay = 1000,
) => {
  try {
    const day = getDay();
    const ip =
      request.headers["x-client-ip"] || request.headers["x-client-original-ip"];
    const endpoint = request.headers["x-original-uri"];
    let accessTokenFilter = generateFilter.tokens(request, next);
    const timeZone = moment.tz.guess();
    accessTokenFilter.expires = {
      $gt: moment().tz(timeZone).toDate(),
    };
    const { expires, ...filteredAccessToken } = accessTokenFilter;

    const [
      blacklistedIP,
      whitelistedIP,
      accessToken,
      blacklistedIpPrefixesData,
    ] = await Promise.all([
      BlacklistedIPModel("airqo").findOne({ ip }),
      WhitelistedIPModel("airqo").findOne({ ip }),
      AccessTokenModel("airqo")
        .findOne(accessTokenFilter)
        .select("name token client_id expiredEmailSent bypass_ip_blacklist bypass_ip_blacklist_expires_at"),
      // Redis-first cache for the prefix list — avoids a full-collection scan
      // on every authenticated request. Falls through to MongoDB on cache miss
      // or Redis unavailability; both failure paths are non-fatal.
      (async () => {
        try {
          const cached = await redisGetAsync(IP_PREFIX_CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            // Validate shape before trusting the cached value. A corrupted or
            // unexpected payload (null, object, array of strings) would cause
            // blacklistedIpPrefixesData.map(item => item.prefix) to throw and
            // the outer catch to treat the request as blacklisted. Fall through
            // to the DB if the shape is wrong.
            if (
              Array.isArray(parsed) &&
              parsed.every(
                (item) =>
                  item !== null &&
                  typeof item === "object" &&
                  typeof item.prefix === "string",
              )
            ) {
              return parsed;
            }
          }
        } catch (_) {
          // Redis unavailable or JSON.parse failure — fall through to DB
        }
        const prefixes = await BlacklistedIPPrefixModel("airqo")
          .find()
          .select("prefix -_id")
          .lean();
        try {
          await redisSetAsync(
            IP_PREFIX_CACHE_KEY,
            JSON.stringify(prefixes),
            IP_PREFIX_CACHE_TTL_SECONDS
          );
        } catch (_) {
          // Cache write failure is non-fatal
        }
        return prefixes;
      })(),
    ]);

    const {
      token = "",
      name = "",
      client_id = "",
      bypass_ip_blacklist = false,
      bypass_ip_blacklist_expires_at = null,
    } = (accessToken && accessToken._doc) || {};

    // Load CIDR-based ASN block list (Redis-cached, 10 min TTL, tenant-scoped).
    const reqTenant = (request.query && request.query.tenant) || (constants.DEFAULT_TENANT || "airqo");
    const blockedAsnCidrs = await _loadBlockedAsnCidrs(reqTenant);

    // Backwards-compatibility safety net: when the BlockedASN collection is
    // empty (i.e. no admin has populated it yet), fall back to the original
    // hardcoded first-octet list so no previously-blocked IPs slip through
    // on first deploy.  Once an admin adds at least one BlockedASN document,
    // this fallback is bypassed entirely — the new CIDR system takes over.
    const LEGACY_BLOCKED_OCTETS =
      "65,66,52,3,43,54,18,57,23,40,13,46,51,17,146,142".split(",");
    const ipPrefix = ip.split(".")[0];
    const isBlockedByLegacyFallback =
      blockedAsnCidrs.length === 0 && LEGACY_BLOCKED_OCTETS.includes(ipPrefix);

    const isBlockedByCidr =
      blockedAsnCidrs.some((cidr) => _isIpInCidr(ip, cidr)) ||
      isBlockedByLegacyFallback;

    // Legacy first-octet DB-backed prefix list (kept for backward compatibility
    // with existing admin-managed entries in BlacklistedIPPrefix collection).
    const blacklistedIpPrefixes = blacklistedIpPrefixesData.map(
      (item) => item.prefix,
    );

    if (!accessToken) {
      try {
        const filter = filteredAccessToken;
        const listTokenReponse = await AccessTokenModel("airqo").list(
          { filter },
          next,
        );

        if (listTokenReponse.success === false) {
          logger.error(
            `🐛🐛 Internal Server Error -- unable to retrieve the expired token's details -- ${stringify(
              listTokenReponse,
            )}`,
          );
        } else {
          const tokenDetails = listTokenReponse.data[0];
          const tokenResponseLength = listTokenReponse.data.length;
          if (isEmpty(tokenDetails) || tokenResponseLength > 1) {
            logger.error(
              `🐛🐛 Internal Server Error -- unable to find the expired token's user details -- TOKEN_DETAILS: ${stringify(
                tokenDetails,
              )} -- CLIENT_IP: ${ip}`,
            );
          } else {
            const {
              user: { email, firstName, lastName },
              token,
              name,
              expires,
              expiredEmailSent,
            } = tokenDetails;

            if (!expiredEmailSent) {
              logger.info(
                `🚨🚨 An AirQo API Access Token is expired -- TOKEN: ${token} -- TOKEN_DESCRIPTION: ${name} -- EMAIL: ${email} -- FIRST_NAME: ${firstName} -- LAST_NAME: ${lastName}`,
              );
              const emailResponse = await mailer.expiredToken(
                {
                  email,
                  firstName,
                  lastName,
                  token,
                  tokenName: name,
                  expires,
                },
                next,
              );

              if (emailResponse && emailResponse.success === false) {
                logger.error(
                  `🐛🐛 Internal Server Error -- ${stringify(emailResponse)}`,
                );
              } else {
                // Update the expiredEmailSent field to true after sending the email
                await AccessTokenModel("airqo").updateOne(
                  { token },
                  { $set: { expiredEmailSent: true } },
                );
              }
            }
          }
        }
      } catch (error) {
        logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      }
      return true;
    } else if (whitelistedIP) {
      return false;
    } else if (isBlockedByCidr) {
      // Matched an admin-managed ASN/CIDR block (data-center, VPN, Tor range).
      logger.info(
        `🚫 Request blocked by ASN/CIDR rule — IP: ${ip} TOKEN: ${token}`
      );
      return true;
    } else if (blacklistedIpPrefixes.includes(ipPrefix)) {
      return true;
    } else if (blacklistedIP && _isBypassActive(bypass_ip_blacklist, bypass_ip_blacklist_expires_at)) {
      // Token is admin-exempted from the IP-blacklist block itself (not just
      // suspension) — e.g. serverless/dynamic-egress integrations that
      // legitimately rotate through IP ranges that have been flagged.
      // Skip blocking and skip logging this hit as a compromise event, since
      // that log feeds the daily compromise-summary email this exemption is
      // meant to silence. Admin-managed CIDR/ASN and prefix blocks (checked
      // above) are unaffected.
      logger.info(
        `IP-blacklist block bypassed via bypass_ip_blacklist -- TOKEN_SUFFIX: ...${(token || "").slice(-4)} -- TOKEN_DESCRIPTION: ${name} -- CLIENT_IP: ${ip}`,
      );
      Promise.resolve().then(() =>
        postProcessing({ ip, token, name, client_id, endpoint, day }),
      );
      return false;
    } else if (blacklistedIP) {
      logger.info(
        `🚨🚨 An AirQo API Access Token is compromised -- TOKEN: ${token} -- TOKEN_DESCRIPTION: ${name} -- CLIENT_IP: ${ip} `,
      );

      try {
        const filter = { token };
        const listTokenResponse = await AccessTokenModel("airqo").list(
          { filter },
          next,
        );

        if (listTokenResponse.success && listTokenResponse.data.length === 1) {
          const {
            user: { email, firstName, lastName },
          } = listTokenResponse.data[0];

          // Log the compromise event for daily summary
          const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");
          await CompromisedTokenLogModel("airqo").logCompromise({
            email,
            tokenHash,
            tokenSuffix: token.slice(-4),
            ip,
          });

          logger.info(
            `Logged compromised token for daily summary. User: ${email}, IP: ${ip}`,
          );

          // Auto-suspend if this token has exceeded the high-compromise threshold.
          // Uses MongoDB countDocuments — no Redis dependency. Fire-and-forget; never
          // blocks the IP verdict returned to the current request.
          //
          // Repeat offenders (tokens reinstated after a prior auto-suspension) get a
          // progressively lower threshold so chronic abuse triggers re-suspension even
          // at lower unique-IP volumes. The floor is 20 unique IPs per 24 hours.
          Promise.resolve().then(async () => {
            try {
              // Fetch the exemption flag + tracking fields directly — the
              // curated list() projection above (TOKENS_INCLUSION_PROJECTION)
              // does not include request_pattern or bypass_compromise_detection.
              const tokenFlags = await AccessTokenModel("airqo")
                .findOne({ token })
                .select("bypass_compromise_detection bypass_compromise_detection_expires_at request_pattern")
                .lean();

              if (
                tokenFlags &&
                _isBypassActive(
                  tokenFlags.bypass_compromise_detection,
                  tokenFlags.bypass_compromise_detection_expires_at
                )
              ) {
                logger.info(
                  `Compromise auto-suspension skipped — token exempted via bypass_compromise_detection (suffix=...${token.slice(-4)})`
                );
                return;
              }

              const baseThreshold = constants.COMPROMISE_SUSPEND_THRESHOLD;
              const requestPattern = (tokenFlags && tokenFlags.request_pattern) || {};

              // suspension_count is incremented on high-compromise auto-suspension. For tokens
              // suspended before this field was added, fall back to checking whether
              // suspended_at is set (meaning the token has been suspended at least once).
              const trackedCount = requestPattern.suspension_count ?? 0;
              const priorSuspensions =
                trackedCount > 0
                  ? trackedCount
                  : requestPattern.suspended_at
                  ? 1
                  : 0;

              // Halve the threshold for each prior suspension, floored at
              // min(20, baseThreshold) so a configured baseThreshold below 20
              // is never accidentally raised by the floor.
              // e.g. base=50: priorSuspensions=0→50, =1→25, =2→20, =3+→20
              //      base=10: priorSuspensions=0→10, =1→10, =2+→10
              const floor = Math.min(20, baseThreshold);
              const effectiveThreshold = Math.max(
                floor,
                Math.floor(baseThreshold / Math.pow(2, priorSuspensions))
              );

              const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
              // Aggregation stops at effectiveThreshold unique IPs — avoids
              // materialising the full distinct-IP set for high-volume tokens.
              const [countResult] = await CompromisedTokenLogModel("airqo").aggregate([
                { $match: { tokenHash, timestamp: { $gte: since } } },
                { $group: { _id: "$ip" } },
                { $limit: effectiveThreshold },
                { $count: "n" },
              ]);
              const recentCount = countResult?.n ?? 0;
              if (recentCount < effectiveThreshold) return;

              const suspensionReason =
                priorSuspensions > 0
                  ? `Repeat compromise activity: ${recentCount} unique IP events in 24 hours (reduced threshold of ${effectiveThreshold} applies — token has ${priorSuspensions} prior suspension(s))`
                  : `High compromise activity: ${recentCount} unique IP events in 24 hours — token likely exposed in a public-facing application`;
              const suspendedAt = new Date();

              // Atomic update filtered on auto_suspended: {$ne: true} ensures exactly
              // one suspension + email even under concurrent requests — the DB write
              // itself acts as the dedup gate with no Redis or separate TTL document.
              // The bypass_compromise_detection clause re-checks the exemption inside
              // the same atomic write — closing the gap between the early bypass
              // check above and this write, during which an admin could have granted
              // the exemption (the fire-and-forget threshold computation in between
              // awaits the aggregation above).
              const prevDoc = await AccessTokenModel("airqo").findOneAndUpdate(
                {
                  token,
                  "request_pattern.auto_suspended": { $ne: true },
                  $or: [
                    { bypass_compromise_detection: { $ne: true } },
                    { bypass_compromise_detection_expires_at: { $lte: new Date() } },
                  ],
                },
                {
                  $set: {
                    "request_pattern.auto_suspended": true,
                    "request_pattern.suspension_reason": suspensionReason,
                    "request_pattern.suspended_at": suspendedAt,
                  },
                  $inc: { "request_pattern.suspension_count": 1 },
                },
                { lean: true }
              );
              if (!prevDoc) return; // already suspended — no duplicate email

              await mailer
                .autoSuspendedToken({
                  email,
                  firstName: firstName || "",
                  lastName: lastName || "",
                  token,
                  tokenName: listTokenResponse.data[0].name || "",
                  suspensionReason,
                  suspendedAt,
                })
                .catch((e) =>
                  logger.error(
                    `Non-critical: high-compromise suspension email failed: ${e.message}`
                  )
                );

              logger.warn(
                `🚨 Token auto-suspended (high compromise activity) — suffix=...${token.slice(-4)} events=${recentCount} threshold=${effectiveThreshold} priorSuspensions=${priorSuspensions}`
              );
            } catch (e) {
              logger.error(
                `Non-critical: high-compromise suspension check failed: ${e.message}`
              );
            }
          });
        }
      } catch (error) {
        logger.error(
          `🐛🐛 Internal Server Error while processing compromised token alert for token ${token} and IP ${ip}: ${error.message}`,
        );
      }

      return true;
    } else {
      Promise.resolve().then(() =>
        postProcessing({ ip, token, name, client_id, endpoint, day }),
      );
      logText("I am now exiting the isIPBlacklistedHelper() function");
      return false;
    }
  } catch (error) {
    logObject("the error", error);
    if (
      retries > 0 &&
      [
        "NetworkError",
        "TimeoutError",
        "MongooseServerSelectionError",
        "MongoTimeoutError",
        "serverSelectionTimeoutMS",
        "SocketTimeoutError",
      ].includes(error.name)
    ) {
      logger.error(
        `🐛🐛 Transient errors or network issues when handling the DB operations during verification of this IP address: ${ip}.`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return isIPBlacklisted({ request, next }, retries - 1, delay);
    } else if (error.name === "MongoError") {
      const jsonErrorString = stringify(error);
      switch (error.code) {
        case 11000:
          logger.error(
            `🐛🐛 Duplicate key error: IP address ${ip} already exists in the database.`,
          );
          break;
        default:
          logger.error(`🐛🐛 Unknown MongoDB error: ${jsonErrorString}`);
      }
    } else {
      const jsonErrorString = stringify(error);
      logger.error(`🐛🐛 Internal Server Error --- ${jsonErrorString}`);
      return true;
    }
  }
};

const isIPBlacklisted = (...args) =>
  trampoline(() => isIPBlacklistedHelper(...args));

/**
 * Fire-and-forget behavioural anomaly tracker.
 * Called after every successful token verification. Updates last_user_agent
 * and checks for patterns that indicate credential theft or token sharing:
 *   - User-Agent change mid-session
 *   - Hourly request rate spike (> 5× the 7-day rolling average)
 * When an anomaly is detected the token's request_pattern.anomaly_score is
 * incremented.  Auto-suspension is triggered at ANOMALY_SUSPEND_THRESHOLD
 * (default: 10) to give legitimate callers a chance to recover from transient
 * network changes without being immediately blocked.
 * Never throws — all errors are logged and swallowed.
 */
const _trackBehaviouralAnomaly = async ({ accessToken, token: rawToken, ip, userAgent }) => {
  // Service-account tokens opt out of behavioural scoring entirely.
  // Honeypot traps, IP blocks, and manual suspension still apply.
  if (_isBypassActive(accessToken.bypass_anomaly_detection, accessToken.bypass_anomaly_detection_expires_at)) {
    return;
  }
  const ANOMALY_SUSPEND_THRESHOLD = constants.ANOMALY_SUSPEND_THRESHOLD || 10;
  try {
    const tokenId = accessToken._id || accessToken.client_id;
    const updates = {};
    let anomalyDelta = 0;
    let suspensionReason = null;

    // User-Agent change detection — a sudden UA change is a strong signal of
    // token sharing.  Exempt empty UAs (some legitimate API clients omit the header).
    const prevUA = accessToken.last_user_agent || "";
    if (userAgent && prevUA && prevUA !== userAgent) {
      anomalyDelta += 2;
      logger.info(
        `Behavioural anomaly: UA change detected — client=${accessToken.client_id} ` +
        `prev="${prevUA.slice(0, 60)}" new="${userAgent.slice(0, 60)}"`
      );
      suspensionReason = suspensionReason || "User-Agent change detected";
    }
    if (userAgent) {
      updates["last_user_agent"] = userAgent;
    }

    // Hourly rate tracking — compare current hour's count to avg from last 7 days.
    const nowSlot = Math.floor(Date.now() / 3600000);
    const hourKey = `beh:hr:${tokenId}:${nowSlot}`;
    const curCount = await redisIncrAsync(hourKey).catch(() => null);
    if (curCount === 1) {
      await redisExpireAsync(hourKey, 3601).catch(() => {});
    }

    if (curCount !== null && curCount > 5) {
      // Build 7-day rolling average from Redis counters.
      // A single MGET replaces 168 sequential GETs, cutting round trips from
      // O(n) to O(1) at the cost of a slightly larger payload.
      const pastKeys = Array.from(
        { length: 168 },
        (_, i) => `beh:hr:${tokenId}:${nowSlot - i - 1}`
      );
      const rawValues = await redisMgetAsync(pastKeys).catch(() => []);
      const pastCounts = rawValues
        .filter((v) => v !== null && v !== undefined)
        .map((v) => parseInt(v, 10))
        .filter((n) => !isNaN(n));
      if (pastCounts.length >= 3) {
        const avg = pastCounts.reduce((s, v) => s + v, 0) / pastCounts.length;
        if (avg > 0 && curCount > avg * 5) {
          anomalyDelta += 3;
          logger.info(
            `Behavioural anomaly: hourly spike — client=${accessToken.client_id} ` +
            `cur=${curCount} avg=${avg.toFixed(1)} ip=${ip}`
          );
          suspensionReason = suspensionReason || `Hourly rate spike: ${curCount} vs avg ${avg.toFixed(1)}`;
        }
      }
    }

    if (anomalyDelta > 0) {
      const newScore =
        (accessToken.request_pattern ? accessToken.request_pattern.anomaly_score || 0 : 0) +
        anomalyDelta;
      updates["request_pattern.anomaly_score"] = newScore;
      updates["request_pattern.avg_hourly_rate"] = curCount || 0;

      if (newScore >= ANOMALY_SUSPEND_THRESHOLD) {
        const suspendedAt = new Date();
        updates["request_pattern.auto_suspended"]     = true;
        updates["request_pattern.suspension_reason"]  = suspensionReason;
        updates["request_pattern.suspended_at"]       = suspendedAt;
        logger.warn(
          `🚫 Token auto-suspended by anomaly detector — client=${accessToken.client_id} score=${newScore} reason="${suspensionReason}"`
        );
      }
    }

    // Perform the DB write first so the pre-update document (prevDoc) can act as the
    // dedup gate: if prevDoc shows auto_suspended was already true, someone else already
    // handled this suspension and we skip the email. No Redis key needed.
    let prevDoc = null;
    if (Object.keys(updates).length > 0) {
      // Gate suspension writes on auto_suspended: {$ne: true} so concurrent requests
      // cannot overwrite the original suspended_at / suspension_reason after the first
      // transition false→true. Non-suspension updates use the plain filter so they
      // are never blocked on already-suspended tokens (which in practice never reach
      // here due to the line-1465 early-exit, but keeps the intent explicit).
      // The bypass_anomaly_detection clause re-checks the exemption inside this
      // same atomic write, closing the gap between the early bypass check at
      // the top of this function and this write (several awaits — Redis
      // incr/mget — happen in between, during which the exemption could change).
      const suspensionFilter = updates["request_pattern.auto_suspended"]
        ? {
            token: rawToken,
            "request_pattern.auto_suspended": { $ne: true },
            $or: [
              { bypass_anomaly_detection: { $ne: true } },
              { bypass_anomaly_detection_expires_at: { $lte: new Date() } },
            ],
          }
        : { token: rawToken };
      prevDoc = await AccessTokenModel("airqo").findOneAndUpdate(
        suspensionFilter,
        { $set: updates },
        { new: false, lean: true }
      );
    }

    // Send the suspension email only if this call was the one to flip auto_suspended.
    if (
      updates["request_pattern.auto_suspended"] &&
      prevDoc &&
      !prevDoc.request_pattern?.auto_suspended
    ) {
      const suspensionReasonForEmail = updates["request_pattern.suspension_reason"];
      const suspendedAtForEmail      = updates["request_pattern.suspended_at"];
      // Fire-and-forget — never blocks the verify path.
      Promise.resolve().then(async () => {
        try {
          const client = await ClientModel("airqo")
            .findById(accessToken.client_id)
            .select("user_id")
            .lean();
          if (!client || !client.user_id) return;

          const user = await UserModel("airqo")
            .findById(client.user_id)
            .select("email firstName lastName")
            .lean();
          if (!user || !user.email) return;

          const emailResponse = await mailer.autoSuspendedToken({
            email:             user.email,
            firstName:         user.firstName || "",
            lastName:          user.lastName  || "",
            token:             rawToken,
            tokenName:         accessToken.name || "",
            suspensionReason:  suspensionReasonForEmail || "",
            suspendedAt:       suspendedAtForEmail,
          });

          if (emailResponse && emailResponse.success !== false) {
            logger.info(
              `Auto-suspension email sent — user=${user.email} client=${accessToken.client_id}`
            );
          }
        } catch (mailErr) {
          logger.error(
            `Non-critical: auto-suspension email failed for client=${accessToken.client_id}: ${mailErr.message}`
          );
        }
      });
    }
  } catch (err) {
    logger.error(`Non-critical: _trackBehaviouralAnomaly error: ${err.message}`);
  }
};

// The three admin-only security-bypass booleans and their matching optional
// expiry fields. Shared by updateAccessToken (strip/audit) and the enforcement
// helper below so the list only needs to be maintained in one place.
const BYPASS_BOOLEAN_FIELDS = [
  "bypass_anomaly_detection",
  "bypass_compromise_detection",
  "bypass_ip_blacklist",
];
const BYPASS_ADMIN_ONLY_FIELDS = BYPASS_BOOLEAN_FIELDS.reduce(
  (acc, f) => acc.concat([f, `${f}_expires_at`]),
  []
);

// A bypass flag is only "active" if it is true AND (no expiry is set OR the
// expiry is still in the future). This is checked live at every enforcement
// site rather than relying solely on the daily cleanup job, so there is never
// a window where an expired bypass is still honoured.
const _isBypassActive = (flag, expiresAt) => {
  if (!flag) return false;
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
};

const token = {
  verifyEmail: async (request, next) => {
    try {
      const { tenant, limit, skip, user_id, token } = {
        ...request.query,
        ...request.params,
      };
      const timeZone = moment.tz.guess();
      let filter = {
        token,
        expires: {
          $gt: moment().tz(timeZone).toDate(),
        },
      };

      const userDetails = await UserModel(tenant)
        .find({
          _id: ObjectId(user_id),
        })
        .lean();

      if (isEmpty(userDetails)) {
        next(
          new HttpError("Bad Reqest Error", httpStatus.BAD_REQUEST, {
            message: "User does not exist",
          }),
        );
      }

      const responseFromListAccessToken = await VerifyTokenModel(tenant).list(
        {
          skip,
          limit,
          filter,
        },
        next,
      );

      if (responseFromListAccessToken.success === true) {
        if (responseFromListAccessToken.status === httpStatus.NOT_FOUND) {
          next(
            new HttpError("Invalid link", httpStatus.BAD_REQUEST, {
              message: "incorrect user or token details provided",
            }),
          );
        } else if (responseFromListAccessToken.status === httpStatus.OK) {
          let update = {
            verified: true,
          };
          filter = { _id: user_id };

          const responseFromUpdateUser = await UserModel(tenant).modify(
            {
              filter,
              update,
            },
            next,
          );

          if (responseFromUpdateUser.success === true) {
            /**
             * we shall also need to handle case where there was no update
             * later...cases where the user never existed in the first place
             * this will not be necessary if user deletion is cascaded.
             */
            if (responseFromUpdateUser.status === httpStatus.BAD_REQUEST) {
              return responseFromUpdateUser;
            }

            filter = { token };
            logObject("the deletion of the token filter", filter);
            const responseFromDeleteToken = await VerifyTokenModel(
              tenant,
            ).remove({ filter }, next);

            logObject("responseFromDeleteToken", responseFromDeleteToken);

            if (responseFromDeleteToken.success === true) {
              const responseFromSendEmail = await mailer.afterEmailVerification(
                {
                  firstName: userDetails[0].firstName,
                  username: userDetails[0].userName,
                  email: userDetails[0].email,
                },
                next,
              );

              if (responseFromSendEmail.success === true) {
                return {
                  success: true,
                  message: "email verified sucessfully",
                  status: httpStatus.OK,
                };
              } else if (responseFromSendEmail.success === false) {
                return responseFromSendEmail;
              }
            } else if (responseFromDeleteToken.success === false) {
              next(
                new HttpError(
                  "unable to verify user",
                  responseFromDeleteToken.status
                    ? responseFromDeleteToken.status
                    : httpStatus.INTERNAL_SERVER_ERROR,
                  responseFromDeleteToken.errors
                    ? responseFromDeleteToken.errors
                    : { message: "internal server errors" },
                ),
              );
            }
          } else if (responseFromUpdateUser.success === false) {
            next(
              new HttpError(
                "unable to verify user",
                responseFromUpdateUser.status
                  ? responseFromUpdateUser.status
                  : httpStatus.INTERNAL_SERVER_ERROR,
                responseFromUpdateUser.errors
                  ? responseFromUpdateUser.errors
                  : { message: "internal server errors" },
              ),
            );
          }
        }
      } else if (responseFromListAccessToken.success === false) {
        return responseFromListAccessToken;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  updateAccessToken: async (request, next) => {
    try {
      const { query, body, params } = request;
      const { tenant, token } = { ...query, ...params };
      const tokenDetails = await AccessTokenModel(tenant)
        .find({ token })
        .lean();

      if (isEmpty(tokenDetails)) {
        next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message: `Bad request -- Token ${token} does not exist`,
          }),
        );
      } else {
        const tokenRecord = tokenDetails[0];
        const tokenId = tokenRecord._id;

        // Ownership check — the requesting user must own the client that issued
        // this token, OR be a super-admin.  Prevents any authenticated user from
        // reinstating (or otherwise patching) a token they do not own.
        const callerEmail = ((request.user && request.user.email) || "").toLowerCase();
        const isAdmin = (constants.SUPER_ADMIN_EMAIL_ALLOWLIST || [])
          .some(e => e.toLowerCase() === callerEmail);

        if (!isAdmin) {
          const linkedClient = await ClientModel(tenant)
            .findById(tokenRecord.client_id)
            .select("user_id")
            .lean();

          const ownerId = linkedClient && linkedClient.user_id
            ? linkedClient.user_id.toString()
            : null;
          const callerId = request.user && (request.user._id || request.user.id)
            ? (request.user._id || request.user.id).toString()
            : null;

          if (!ownerId || !callerId || ownerId !== callerId) {
            securityAuditLogger.warn(
              `🚫 Ownership check failed on token update — caller=${callerEmail} ` +
              `tokenId=${tokenId} clientId=${tokenRecord.client_id}`
            );
            return next(
              new HttpError("Forbidden", httpStatus.FORBIDDEN, {
                message: "You do not have permission to update this token",
              }),
            );
          }
        }

        let update = Object.assign({}, body);
        if (update.token) {
          delete update.token;
        }
        if (update.expires) {
          delete update.expires;
        }
        if (update._id) {
          delete update._id;
        }
        // The bypass_* booleans and their _expires_at companions are admin-only
        // — non-super-admins cannot set any of them via the public PATCH
        // endpoint even if the validator accepts the fields.
        if (!isAdmin) {
          for (const field of BYPASS_ADMIN_ONLY_FIELDS) {
            if (update[field] !== undefined) {
              delete update[field];
            }
          }
        }
        // Expand request_pattern into dotted-path keys before passing to
        // findByIdAndUpdate. Without this, Mongoose's implicit $set would
        // replace the entire request_pattern subdocument, silently wiping
        // suspension_count, suspended_at, and other tracking fields.
        if (update.request_pattern && typeof update.request_pattern === "object") {
          const rp = update.request_pattern;
          delete update.request_pattern;
          for (const [k, v] of Object.entries(rp)) {
            update[`request_pattern.${k}`] = v;
          }
        }
        const updatedToken = await AccessTokenModel(tenant)
          .findByIdAndUpdate(tokenId, update, { new: true })
          .lean();

        if (!isEmpty(updatedToken)) {
          // Audit trail — log every sensitive field change with caller identity.
          // Read from updatedToken (what Mongo persisted) not from update (the
          // request payload), so the log reflects actual stored values after any
          // Mongoose coercion or subdocument replacement.
          const auditFields = [];
          if (update.request_pattern !== undefined) {
            auditFields.push(`request_pattern=${JSON.stringify(updatedToken.request_pattern)}`);
          }
          for (const field of BYPASS_ADMIN_ONLY_FIELDS) {
            if (update[field] !== undefined) {
              auditFields.push(`${field}=${updatedToken[field]}`);
            }
          }
          if (auditFields.length > 0) {
            securityAuditLogger.info(
              `Token metadata updated — caller=${callerEmail} ` +
              `tokenId=${tokenId} clientId=${tokenRecord.client_id} ` +
              `changes=[${auditFields.join(", ")}]`
            );
          }

          return {
            success: true,
            message: "Successfully updated the token's metadata",
            data: updatedToken,
            status: httpStatus.OK,
          };
        } else {
          next(
            new HttpError("Internal Server Error", httpStatus.CONFLICT, {
              message: "Unable to update the token's metadata",
            }),
          );
        }
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  regenerateAccessToken: async (request, next) => {
    try {
      return {
        success: false,
        message: "Service temporarily unavailable",
        status: httpStatus.SERVICE_UNAVAILABLE,
        errors: {
          message: "Service temporarily unavailable",
        },
      };
      const { query, body } = request;
      const { tenant } = query;

      const filter = generateFilter.tokens(request, next);
      const token = accessCodeGenerator
        .generate(
          constants.RANDOM_PASSWORD_CONFIGURATION(constants.TOKEN_LENGTH),
        )
        .toUpperCase();

      let update = Object.assign({}, body);
      update.token = token;

      const responseFromUpdateToken = await AccessTokenModel(
        tenant.toLowerCase(),
      ).modify({ filter, update }, next);
      return responseFromUpdateToken;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  deleteAccessToken: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.tokens(request, next);
      const responseFromDeleteToken = await AccessTokenModel(
        tenant.toLowerCase(),
      ).remove({ filter }, next);
      logObject("responseFromDeleteToken", responseFromDeleteToken);
      return responseFromDeleteToken;
    } catch (error) {
      logObject("error", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
      return;
    }
  },
  verifyToken: async (request, next) => {
    try {
      logText("I have just entered the verifyToken() function");
      const ip =
        request.headers["x-client-ip"] ||
        request.headers["x-client-original-ip"];
      const endpoint = request.headers["x-original-uri"];
      const { token } = {
        ...request.params,
      };
      const accessToken = await AccessTokenModel("airqo")
        .findOne({ token })
        .select(
          "client_id token name tier scopes allowed_grids allowed_cohorts " +
          "access_schedule last_user_agent request_pattern allowed_origins " +
          "bypass_anomaly_detection bypass_anomaly_detection_expires_at"
        );

      if (isEmpty(accessToken)) {
        return createUnauthorizedResponse();
      } else if (isEmpty(ip)) {
        logText(`🚨🚨 Token is being accessed without an IP address`);
        logger.error(`🚨🚨 Token is being accessed without an IP address`);
        return createUnauthorizedResponse();
      } else {
        const client = await ClientModel("airqo")
          .findById(accessToken.client_id)
          .select("isActive user_id enforce_origin allowed_origins");

        if (isEmpty(client) || (client && !client.isActive)) {
          logger.error(
            `🚨🚨 Client ${accessToken.client_id} associated with Token ${accessToken.token} is INACTIVE or does not exist`,
          );
          return createUnauthorizedResponse();
        }

        // Guard: auto-suspended tokens are immediately rejected.
        if (accessToken.request_pattern && accessToken.request_pattern.auto_suspended) {
          logger.warn(
            `🚫 Auto-suspended token attempted access — client=${accessToken.client_id} ip=${ip}`
          );
          return createUnauthorizedResponse();
        }

        const isBlacklisted = await isIPBlacklisted({
          request,
          next,
        });
        logText("I have now returned back to the verifyToken() function");
        if (isBlacklisted) {
          return createUnauthorizedResponse();
        } else {
          const tier = accessToken.tier || "Free";

          const rateLimitUserId = client.user_id || accessToken.client_id;

          // Tier-based hourly rate limiting.
          // Controlled by ENABLE_TOKEN_RATE_LIMITING (default: false).
          if (constants.ENABLE_TOKEN_RATE_LIMITING) {
            try {
              const withinLimit = await checkTokenVerifyRateLimit(rateLimitUserId, tier);
              if (!withinLimit) {
                logger.warn(
                  `Hourly rate limit exceeded: client=${accessToken.client_id} tier=${tier} ip=${ip}`
                );
                return createRateLimitResponse(tier, "Hourly");
              }
            } catch (rateLimitErr) {
              logger.error(
                `Non-critical: hourly rate limit check failed, allowing through: ${rateLimitErr.message}`
              );
            }
          }

          // Daily rate limiting — controlled by ENABLE_DAILY_RATE_LIMITING (default: false).
          if (constants.ENABLE_DAILY_RATE_LIMITING) {
            try {
              const withinDailyLimit = await checkDailyRateLimit(rateLimitUserId, tier);
              if (!withinDailyLimit) {
                logger.warn(
                  `Daily rate limit exceeded: client=${accessToken.client_id} tier=${tier} ip=${ip}`
                );
                return createRateLimitResponse(tier, "Daily");
              }
            } catch (rateLimitErr) {
              logger.error(
                `Non-critical: daily rate limit check failed, allowing through: ${rateLimitErr.message}`
              );
            }
          }

          // Weekly rate limiting — controlled by ENABLE_WEEKLY_RATE_LIMITING (default: false).
          if (constants.ENABLE_WEEKLY_RATE_LIMITING) {
            try {
              const withinWeeklyLimit = await checkWeeklyRateLimit(rateLimitUserId, tier);
              if (!withinWeeklyLimit) {
                logger.warn(
                  `Weekly rate limit exceeded: client=${accessToken.client_id} tier=${tier} ip=${ip}`
                );
                return createRateLimitResponse(tier, "Weekly");
              }
            } catch (rateLimitErr) {
              logger.error(
                `Non-critical: weekly rate limit check failed, allowing through: ${rateLimitErr.message}`
              );
            }
          }

          // Monthly rate limiting — controlled by ENABLE_MONTHLY_RATE_LIMITING (default: false).
          if (constants.ENABLE_MONTHLY_RATE_LIMITING) {
            try {
              const withinMonthlyLimit = await checkMonthlyRateLimit(rateLimitUserId, tier);
              if (!withinMonthlyLimit) {
                logger.warn(
                  `Monthly rate limit exceeded: client=${accessToken.client_id} tier=${tier} ip=${ip}`
                );
                return createRateLimitResponse(tier, "Monthly");
              }
            } catch (rateLimitErr) {
              logger.error(
                `Non-critical: monthly rate limit check failed, allowing through: ${rateLimitErr.message}`
              );
            }
          }

          // Error-rate circuit breaker — controlled by ENABLE_ERROR_RATE_BREAKER (default: false).
          // Tokens that generate > ERROR_RATE_THRESHOLD 4xx responses within a
          // 15-minute window are auto-suspended.  This penalises endpoint probing
          // and parameter fuzzing without affecting legitimate high-volume callers.
          if (constants.ENABLE_ERROR_RATE_BREAKER) {
            try {
              const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
              const slot15 = Math.floor(Date.now() / 900000); // 15-minute bucket
              const errKey = `errcb:${tokenHash}:${slot15}`;
              const errCount = parseInt(await redisGetAsync(errKey) || "0", 10);
              const errThreshold = constants.ERROR_RATE_THRESHOLD || 50;
              if (errCount >= errThreshold) {
                // Auto-suspend the token so future requests are rejected before
                // reaching the DB.  Fire-and-forget — never block on this write.
                AccessTokenModel("airqo")
                  .findOneAndUpdate(
                    { token },
                    {
                      $set: {
                        "request_pattern.auto_suspended": true,
                        "request_pattern.suspension_reason": `Error-rate circuit breaker: ${errCount} 4xx in 15 min`,
                        "request_pattern.suspended_at": new Date(),
                      },
                    }
                  )
                  .catch((e) =>
                    logger.error(`Non-critical: failed to auto-suspend token: ${e.message}`)
                  );
                logger.warn(
                  `🚫 Error-rate circuit breaker tripped — client=${accessToken.client_id} errors=${errCount} ip=${ip}`
                );
                return createRateLimitResponse(tier, "Error-rate");
              }
            } catch (cbErr) {
              logger.error(`Non-critical: error-rate breaker check failed: ${cbErr.message}`);
            }
          }

          // Scope enforcement — only for tokens with explicit scopes AND only
          // when ENABLE_SCOPE_ENFORCEMENT is true (default: false).
          // Legacy tokens (empty scopes) are always allowed through regardless.
          if (
            constants.ENABLE_SCOPE_ENFORCEMENT &&
            Array.isArray(accessToken.scopes) &&
            accessToken.scopes.length > 0
          ) {
            try {
              const scopeCheck = checkUriScope(endpoint, accessToken.scopes);
              if (scopeCheck.required && !scopeCheck.granted) {
                logger.warn(
                  `Scope denied: client=${accessToken.client_id} tier=${tier} required=${scopeCheck.scope} uri=${endpoint}`
                );
                return createInsufficientScopeResponse(scopeCheck.scope, tier);
              }
            } catch (scopeErr) {
              // Fail open — never block a request due to scope check error
              logger.error(
                `Non-critical: scope check failed, allowing through: ${scopeErr.message}`
              );
            }
          }

          // Origin / Referer enforcement — opt-in per client (enforce_origin flag).
          // Prevents tokens embedded in web apps from being used from unauthorised
          // domains.  Fail-open: any check error allows the request through.
          if (client.enforce_origin) {
            try {
              const requestOrigin =
                request.headers["origin"] ||
                (() => {
                  const ref = request.headers["referer"];
                  if (!ref) return null;
                  try {
                    return new URL(ref).origin;
                  } catch (_) {
                    return null;
                  }
                })();
              // Merge allowed_origins from token and client; token-level takes precedence.
              const allowedOrigins = [
                ...(accessToken.allowed_origins || []),
                ...(client.allowed_origins || []),
              ].filter(Boolean);
              if (
                allowedOrigins.length > 0 &&
                (!requestOrigin || !allowedOrigins.includes(requestOrigin))
              ) {
                logger.warn(
                  `🚫 Origin mismatch — client=${accessToken.client_id} origin=${requestOrigin} allowed=${allowedOrigins.join(",")}`
                );
                return createForbiddenResponse(
                  "Request origin is not permitted for this token"
                );
              }
            } catch (originErr) {
              logger.error(`Non-critical: origin check failed, allowing through: ${originErr.message}`);
            }
          }

          // Temporal access window — opt-in via access_schedule.enabled.
          // Useful for pipeline tokens with known schedules; any request outside
          // the window is flagged as potential credential theft.
          if (
            accessToken.access_schedule &&
            accessToken.access_schedule.enabled
          ) {
            try {
              const now = new Date();
              const utcDay  = now.getUTCDay();   // 0=Sun … 6=Sat
              const utcHour = now.getUTCHours();
              const { allowed_days = [], allowed_hours_utc = {} } =
                accessToken.access_schedule;
              const { start, end } = allowed_hours_utc;
              // Handle wraparound schedules (e.g. 22:00–06:00 crossing midnight).
              // When start > end the window spans two calendar days, so the
              // correct check is utcHour >= start OR utcHour <= end.
              const hourOk =
                start === undefined ||
                end   === undefined ||
                (start <= end
                  ? utcHour >= start && utcHour <= end
                  : utcHour >= start || utcHour <= end);
              // For overnight windows (start > end), a request arriving at
              // utcHour <= end is in the post-midnight portion and should be
              // validated against the *previous* UTC day (e.g. a 22:00-Mon →
              // 06:00-Tue schedule must accept Tuesday-morning requests as
              // belonging to Monday's window).
              const isOvernightPostMidnight =
                start !== undefined &&
                end   !== undefined &&
                start > end &&
                utcHour <= end;
              const effectiveDay = isOvernightPostMidnight
                ? (utcDay + 6) % 7   // previous UTC day
                : utcDay;
              const dayOk =
                allowed_days.length === 0 ||
                allowed_days.includes(effectiveDay);
              if (!dayOk || !hourOk) {
                logger.warn(
                  `🚫 Temporal window violation — client=${accessToken.client_id} utcDay=${utcDay} utcHour=${utcHour} ip=${ip}`
                );
                return createForbiddenResponse(
                  "Request is outside the permitted access schedule for this token"
                );
              }
            } catch (schedErr) {
              logger.error(`Non-critical: schedule check failed, allowing through: ${schedErr.message}`);
            }
          }

          // Fire-and-forget: increment MongoDB usage counters (hourly/daily/monthly).
          if (client.user_id) {
            _incrementUsageCounters(client.user_id);
          }

          // Fire-and-forget: record API token usage as user activity so that
          // API-only users are not incorrectly flagged as inactive. Throttled
          // to at most once per hour per user to avoid excessive writes.
          if (client.user_id) {
            const oneHourAgo = new Date(Date.now() - 3600000);
            UserModel("airqo")
              .updateOne(
                {
                  _id: client.user_id,
                  verified: true,
                  $or: [
                    { lastActiveAt: { $exists: false } },
                    { lastActiveAt: { $lt: oneHourAgo } },
                  ],
                },
                { $set: { lastActiveAt: new Date(), isActive: true } },
              )
              .catch((err) =>
                logger.error(
                  `Non-critical: failed to touch user activity for client ${accessToken.client_id}: ${err.message}`,
                ),
              );
          }

          // Fire-and-forget: behavioural anomaly tracking.
          // Updates last_user_agent and checks for suspicious patterns.
          // Never blocks a request — runs entirely after the valid response is queued.
          Promise.resolve().then(() =>
            _trackBehaviouralAnomaly({
              accessToken,
              token,
              ip,
              userAgent: request.headers["user-agent"] || "",
            }).catch((e) =>
              logger.error(`Non-critical: behavioural tracking failed: ${e.message}`)
            )
          );

          winstonLogger.debug("verify token", {
            clientId: accessToken.client_id,
            service: "verify-token",
            clientIp: ip,
            clientOriginalIp: ip,
            endpoint: endpoint ? endpoint : "unknown",
          });

          // Return resource-binding data so downstream services (e.g.
          // device-registry) can enforce grid/cohort restrictions without a
          // second DB call.
          return createValidTokenResponse({
            allowed_grids:   accessToken.allowed_grids   || [],
            allowed_cohorts: accessToken.allowed_cohorts || [],
          });
        }
      }
    } catch (error) {
      throw error;
    }
  },
  listAccessToken: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant, limit, skip, token } = { ...query, ...params };

      const filter = generateFilter.tokens(request, next);

      if (isEmpty(token)) {
        next(
          new HttpError(
            "service is temporarily disabled",
            httpStatus.NOT_IMPLEMENTED,
            { message: "service is temporarily disabled" },
          ),
        );
      }

      const responseFromListToken = await AccessTokenModel(
        tenant.toLowerCase(),
      ).list({ skip, limit, filter }, next);
      return responseFromListToken;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  listExpiringTokens: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant, limit, skip } = { ...query, ...params };
      const filter = generateFilter.tokens(request, next);
      const responseFromListExpiringTokens = await AccessTokenModel(
        tenant.toLowerCase(),
      ).getExpiringTokens({ skip, limit, filter }, next);
      return responseFromListExpiringTokens;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  listExpiredTokens: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant, limit, skip } = { ...query, ...params };
      const filter = generateFilter.tokens(request, next);
      const responseFromListExpiredTokens = await AccessTokenModel(
        tenant.toLowerCase(),
      ).getExpiredTokens({ skip, limit, filter }, next);
      return responseFromListExpiredTokens;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  createAccessToken: async (request, next) => {
    try {
      // return {
      //   success: false,
      //   message: "Service Temporarily Disabled",
      //   errors: {
      //     message: "Service Temporarily Disabled",
      //   },
      //   status: httpStatus.SERVICE_UNAVAILABLE,
      // };
      const { tenant, client_id } = { ...request.body, ...request.query };

      const client = await ClientModel(tenant)
        .findById(ObjectId(client_id))
        .lean();

      if (!client) {
        next(
          new HttpError("Client not found", httpStatus.BAD_REQUEST, {
            message: `Invalid request, Client ${client_id} not found`,
          }),
        );
        return;
      }

      if (isEmpty(client.isActive) || client.isActive === false) {
        next(
          new HttpError(
            "Client not yet activated, reach out to Support",
            httpStatus.BAD_REQUEST,
            {
              message: `Invalid request, Client ${client_id} not yet activated, reach out to Support`,
            },
          ),
        );
        return;
      }
      const token = accessCodeGenerator
        .generate(
          constants.RANDOM_PASSWORD_CONFIGURATION(constants.TOKEN_LENGTH),
        )
        .toUpperCase();

      // Resolve the user's current subscription tier so the new token is
      // stamped with the correct tier and scopes at creation time. Falls back
      // to Free if the user cannot be found — never throws.
      let tokenTier = "Free";
      let tokenScopes = TIER_SCOPE_MAP.Free;
      try {
        if (client.user_id) {
          const user = await UserModel(tenant)
            .findById(client.user_id)
            .select("subscriptionTier")
            .lean();
          const resolvedTier = user?.subscriptionTier;
          if (resolvedTier && TIER_SCOPE_MAP[resolvedTier]) {
            tokenTier = resolvedTier;
            tokenScopes = TIER_SCOPE_MAP[resolvedTier];
          }
        }
      } catch (tierErr) {
        logger.error(
          `Non-critical: could not resolve tier for client ${client_id}, defaulting to Free: ${tierErr.message}`
        );
      }

      let tokenCreationBody = Object.assign(
        { token, client_id: ObjectId(client_id) },
        request.body,
      );
      tokenCreationBody.category = "api";
      tokenCreationBody.tier   = tokenTier;
      tokenCreationBody.scopes = tokenScopes;

      // Use findOneAndReplace with upsert so the old token is replaced
      // atomically. This avoids the delete-before-create pattern where a
      // failed register() would leave the user with no token at all.
      const tokenModel = AccessTokenModel(tenant.toLowerCase());
      const expires = tokenCreationBody.expires || Date.now() + API_TOKEN_TTL_MS;

      const _attemptReplace = async (body) =>
        tokenModel.findOneAndReplace(
          { client_id: ObjectId(client_id) },
          { ...body, expires },
          {
            upsert: true,
            new: true,
            runValidators: true,
            setDefaultsOnInsert: true,
          },
        );

      // Resolve which field caused a 11000 from keyPattern (most reliable),
      // falling back to keyValue if keyPattern is absent.
      const _collisionField = (err) =>
        err.keyPattern
          ? Object.keys(err.keyPattern)[0]
          : err.keyValue
          ? Object.keys(err.keyValue)[0]
          : null;

      let replacedDoc;
      try {
        replacedDoc = await _attemptReplace(tokenCreationBody);
      } catch (replaceErr) {
        if (replaceErr.code !== 11000) throw replaceErr;
        const conflictField = _collisionField(replaceErr);
        if (conflictField !== null && conflictField !== "token") {
          // Definitively not a token collision — retrying won't help.
          return {
            success: false,
            message: "A token already exists for one of the provided unique fields",
            status: httpStatus.CONFLICT,
            errors: {
              [conflictField]: `the ${conflictField} must be unique`,
            },
          };
        }
        // Astronomically unlikely token collision — regenerate and retry once.
        logger.warn(
          `Non-critical: token collision on insert for client ${client_id} — regenerating and retrying`
        );
        const retryToken = accessCodeGenerator
          .generate(constants.RANDOM_PASSWORD_CONFIGURATION(constants.TOKEN_LENGTH))
          .toUpperCase();
        tokenCreationBody.token = retryToken;
        try {
          replacedDoc = await _attemptReplace(tokenCreationBody);
        } catch (retryErr) {
          if (retryErr.code === 11000) {
            const retryConflictField = _collisionField(retryErr);
            return {
              success: false,
              message: "A token already exists for one of the provided unique fields",
              status: httpStatus.CONFLICT,
              errors: {
                [retryConflictField || "token"]: `the ${retryConflictField || "token"} must be unique`,
              },
            };
          }
          throw retryErr;
        }
      }

      if (!replacedDoc) {
        return {
          success: false,
          message: "Token could not be created",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: "findOneAndReplace returned null" },
        };
      }

      return {
        success: true,
        message: "Token created",
        status: httpStatus.OK,
        data: replacedDoc,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  generateVerificationToken: async (request, next) => {
    try {
      return {
        success: false,
        message: "Service Temporarily Disabled",
        errors: {
          message: "Service Temporarily Disabled",
        },
        status: httpStatus.SERVICE_UNAVAILABLE,
      };
      const { query, body } = request;
      const { email } = body;
      const { tenant } = query;

      const password = body.password
        ? body.password
        : accessCodeGenerator.generate(
            constants.RANDOM_PASSWORD_CONFIGURATION(10),
          );

      const newRequest = Object.assign({ userName: email, password }, request);

      const responseFromCreateUser = await UserModel(tenant).register(
        newRequest,
        next,
      );
      if (responseFromCreateUser.success === true) {
        if (responseFromCreateUser.status === httpStatus.NO_CONTENT) {
          return responseFromCreateUser;
        }
        const token = accessCodeGenerator
          .generate(
            constants.RANDOM_PASSWORD_CONFIGURATION(constants.TOKEN_LENGTH),
          )
          .toUpperCase();

        const toMilliseconds = (hrs, min, sec) =>
          (hrs * 60 * 60 + min * 60 + sec) * 1000;

        const emailVerificationHours = parseInt(
          constants.EMAIL_VERIFICATION_HOURS,
        );
        const emailVerificationMins = parseInt(
          constants.EMAIL_VERIFICATION_MIN,
        );
        const emailVerificationSeconds = parseInt(
          constants.EMAIL_VERIFICATION_SEC,
        );

        /***
         * We need to find a client ID associated with this user?
         */

        const responseFromSaveToken = await AccessTokenModel(tenant).register(
          {
            token,
            client: {},
            user_id: responseFromCreateUser.data._id,
            expires:
              Date.now() +
              toMilliseconds(
                emailVerificationHours,
                emailVerificationMins,
                emailVerificationSeconds,
              ),
          },
          next,
        );

        if (responseFromSaveToken.success === true) {
          let createdUser = await responseFromCreateUser.data;
          logObject("created user in util", createdUser._doc);
          const user_id = createdUser._doc._id;

          const responseFromSendEmail = await mailer.verifyEmail(
            {
              user_id,
              token,
              email,
              firstName,
            },
            next,
          );

          logObject("responseFromSendEmail", responseFromSendEmail);
          if (responseFromSendEmail.success === true) {
            return {
              success: true,
              message: "An Email sent to your account please verify",
              data: createdUser._doc,
              status: responseFromSendEmail.status
                ? responseFromSendEmail.status
                : "",
            };
          } else if (responseFromSendEmail.success === false) {
            return responseFromSendEmail;
          }
        } else if (responseFromSaveToken.success === false) {
          return responseFromSaveToken;
        }
      } else if (responseFromCreateUser.success === false) {
        return responseFromCreateUser;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  verifyVerificationToken: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant, limit, skip, user_id, token } = { ...query, ...params };
      const timeZone = moment.tz.guess();

      let filter = {
        token,
        expires: {
          $gt: moment().tz(timeZone).toDate(),
        },
      };

      const responseFromListAccessToken = await AccessTokenModel(tenant).list(
        {
          skip,
          limit,
          filter,
        },
        next,
      );

      if (responseFromListAccessToken.success === true) {
        if (responseFromListAccessToken.status === httpStatus.NOT_FOUND) {
          next(
            new HttpError("Invalid link", httpStatus.BAD_REQUEST, {
              message: "incorrect user or token details provided",
            }),
          );
        } else if (responseFromListAccessToken.status === httpStatus.OK) {
          const password = accessCodeGenerator.generate(
            constants.RANDOM_PASSWORD_CONFIGURATION(10),
          );
          let update = {
            verified: true,
            password,
            $pull: { tokens: { $in: [token] } },
          };
          filter = { _id: user_id };

          const responseFromUpdateUser = await UserModel(tenant).modify(
            {
              filter,
              update,
            },
            next,
          );

          if (responseFromUpdateUser.success === true) {
            if (responseFromUpdateUser.status === httpStatus.BAD_REQUEST) {
              return responseFromUpdateUser;
            }
            let user = responseFromUpdateUser.data;
            filter = { token };
            logObject("the deletion of the token filter", filter);
            const responseFromDeleteToken = await AccessTokenModel(
              tenant,
            ).remove({ filter }, next);

            if (responseFromDeleteToken.success === true) {
              const responseFromSendEmail = await mailer.afterEmailVerification(
                {
                  firstName: user.firstName,
                  username: user.userName,
                  password,
                  email: user.email,
                },
                next,
              );

              if (responseFromSendEmail.success === true) {
                return {
                  success: true,
                  message: "email verified sucessfully",
                  status: httpStatus.OK,
                };
              } else if (responseFromSendEmail.success === false) {
                return responseFromSendEmail;
              }
            } else if (responseFromDeleteToken.success === false) {
              next(
                new HttpError(
                  "unable to verify user",
                  responseFromDeleteToken.status
                    ? responseFromDeleteToken.status
                    : httpStatus.INTERNAL_SERVER_ERROR,
                  responseFromDeleteToken.errors
                    ? responseFromDeleteToken.errors
                    : { message: "internal server errors" },
                ),
              );
            }
          } else if (responseFromUpdateUser.success === false) {
            next(
              new HttpError(
                "unable to verify user",
                responseFromUpdateUser.status
                  ? responseFromUpdateUser.status
                  : httpStatus.INTERNAL_SERVER_ERROR,
                responseFromUpdateUser.errors
                  ? responseFromUpdateUser.errors
                  : { message: "internal server errors" },
              ),
            );
          }
        }
      } else if (responseFromListAccessToken.success === false) {
        return responseFromListAccessToken;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  /****************** Blacklisting IPs ******************************/
  blackListIp: async (request, next) => {
    try {
      const { ip, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const responseFromBlacklistIp = await BlacklistedIPModel(tenant).register(
        {
          ip,
        },
        next,
      );
      return responseFromBlacklistIp;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  blackListIps: async (request, next) => {
    try {
      const { ips, tenant } = {
        ...request.body,
        ...request.query,
      };

      if (!ips || !Array.isArray(ips) || ips.length === 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Invalid input. Please provide an array of IP addresses.",
          }),
        );
      }

      const responses = await Promise.all(
        ips.map(async (ip) => {
          try {
            const result = await BlacklistedIPModel(tenant).register(
              { ip },
              () => {},
            );
            return { ip, success: result.success };
          } catch (error) {
            logger.error(`Error blacklisting IP ${ip}: ${error.message}`);
            return { ip, success: false };
          }
        }),
      );

      const successful_responses = responses
        .filter((response) => response.success)
        .map((response) => response.ip);

      const unsuccessful_responses = responses
        .filter((response) => !response.success)
        .map((response) => response.ip);

      let finalMessage = "";
      let finalStatus = httpStatus.OK;

      if (
        successful_responses.length > 0 &&
        unsuccessful_responses.length > 0
      ) {
        finalMessage = "Some IPs have been blacklisted.";
      } else if (
        successful_responses.length > 0 &&
        unsuccessful_responses.length === 0
      ) {
        finalMessage = "All responses were successful.";
      } else if (
        successful_responses.length === 0 &&
        unsuccessful_responses.length > 0
      ) {
        finalMessage = "None of the IPs provided were blacklisted.";
        finalStatus = httpStatus.BAD_REQUEST;
      }

      return {
        success: true,
        data: { successful_responses, unsuccessful_responses },
        status: finalStatus,
        message: finalMessage,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  removeBlacklistedIp: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const responseFromRemoveBlacklistedIp = await BlacklistedIPModel(
        tenant,
      ).remove({ filter }, next);
      return responseFromRemoveBlacklistedIp;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  listBlacklistedIp: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const response = await BlacklistedIPModel(tenant).list(
        {
          filter,
        },
        next,
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  /****************** Blacklisting IP ranges *********************************/
  blackListIpRange: async (request, next) => {
    try {
      const { range, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const response = await BlacklistedIPRangeModel(tenant).register(
        {
          range,
        },
        next,
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  bulkInsertBlacklistIpRanges: async (request, next) => {
    try {
      const { ranges, tenant } = {
        ...request.body,
        ...request.query,
      };

      if (!ranges || !Array.isArray(ranges) || ranges.length === 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "Invalid input. Please provide an array of IP address ranges.",
          }),
        );
        return;
      }

      const responses = await Promise.all(
        ranges.map(async (range) => {
          const result = await BlacklistedIPRangeModel(tenant).register(
            { range },
            next,
          );
          return { range, success: result.success };
        }),
      );

      const successful_responses = responses
        .filter((response) => response.success)
        .map((response) => response.range);

      const unsuccessful_responses = responses
        .filter((response) => !response.success)
        .map((response) => response.range);

      let finalMessage = "";
      let finalStatus = httpStatus.OK;

      if (
        successful_responses.length > 0 &&
        unsuccessful_responses.length > 0
      ) {
        finalMessage = "Some IP ranges have been blacklisted.";
      } else if (
        successful_responses.length > 0 &&
        unsuccessful_responses.length === 0
      ) {
        finalMessage = "All responses were successful.";
      } else if (
        successful_responses.length === 0 &&
        unsuccessful_responses.length > 0
      ) {
        finalMessage = "None of the IP ranges provided were blacklisted.";
        finalStatus = httpStatus.BAD_REQUEST;
      }

      return {
        success: true,
        data: { successful_responses, unsuccessful_responses },
        status: finalStatus,
        message: finalMessage,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
      return;
    }
  },
  removeBlacklistedIpRange: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const response = await BlacklistedIPRangeModel(tenant).remove(
        { filter },
        next,
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  listBlacklistedIpRange: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const response = await BlacklistedIPRangeModel(tenant).list(
        {
          filter,
        },
        next,
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  /****************** Blacklisting IP prefix *********************************/
  blackListIpPrefix: async (request, next) => {
    try {
      const { prefix, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const response = await BlacklistedIPPrefixModel(tenant).register(
        {
          prefix,
        },
        next,
      );
      if (response && response.success) {
        redisDelAsync(IP_PREFIX_CACHE_KEY).catch((err) =>
          logger.warn(
            `Failed to invalidate IP prefix cache after single insert: ${err.message}`,
          ),
        );
      }
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  bulkInsertBlacklistIpPrefix: async (request, next) => {
    try {
      const { prefixes, tenant } = {
        ...request.body,
        ...request.query,
      };

      if (!prefixes || !Array.isArray(prefixes) || prefixes.length === 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "Invalid input. Please provide an array of IP address prefixes.",
          }),
        );
        return;
      }

      const responses = await Promise.all(
        prefixes.map(async (prefix) => {
          const result = await BlacklistedIPPrefixModel(tenant).register(
            { prefix },
            next,
          );
          return { prefix, success: result.success };
        }),
      );

      const successful_responses = responses
        .filter((response) => response.success)
        .map((response) => response.prefix);

      const unsuccessful_responses = responses
        .filter((response) => !response.success)
        .map((response) => response.prefix);

      let finalMessage = "";
      let finalStatus = httpStatus.OK;

      if (
        successful_responses.length > 0 &&
        unsuccessful_responses.length > 0
      ) {
        finalMessage = "Some IP prefixes have been blacklisted.";
      } else if (
        successful_responses.length > 0 &&
        unsuccessful_responses.length === 0
      ) {
        finalMessage = "All responses were successful.";
      } else if (
        successful_responses.length === 0 &&
        unsuccessful_responses.length > 0
      ) {
        finalMessage = "None of the IP prefixes provided were blacklisted.";
        finalStatus = httpStatus.BAD_REQUEST;
      }

      // Invalidate the cached prefix list so the new entries are visible
      // on the next request. Non-fatal — a stale cache is acceptable for
      // up to IP_PREFIX_CACHE_TTL_SECONDS if Redis is momentarily unavailable.
      if (successful_responses.length > 0) {
        redisDelAsync(IP_PREFIX_CACHE_KEY).catch((err) =>
          logger.warn(
            `Failed to invalidate IP prefix cache after bulk insert: ${err.message}`,
          ),
        );
      }

      return {
        success: true,
        data: { successful_responses, unsuccessful_responses },
        status: finalStatus,
        message: finalMessage,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
      return;
    }
  },
  removeBlacklistedIpPrefix: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const response = await BlacklistedIPPrefixModel(tenant).remove(
        { filter },
        next,
      );
      if (response && response.success) {
        redisDelAsync(IP_PREFIX_CACHE_KEY).catch((err) =>
          logger.warn(
            `Failed to invalidate IP prefix cache after removal: ${err.message}`,
          ),
        );
      }
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  listBlacklistedIpPrefix: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const response = await BlacklistedIPPrefixModel(tenant).list(
        {
          filter,
        },
        next,
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  /****************** IP prefix *********************************/
  ipPrefix: async (request, next) => {
    try {
      const { prefix, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const response = await IPPrefixModel(tenant).register(
        {
          prefix,
        },
        next,
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  bulkInsertIpPrefix: async (request, next) => {
    try {
      const { prefixes, tenant } = {
        ...request.body,
        ...request.query,
      };

      if (!prefixes || !Array.isArray(prefixes) || prefixes.length === 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "Invalid input. Please provide an array of IP address prefixes.",
          }),
        );
        return;
      }

      const responses = await Promise.all(
        prefixes.map(async (prefix) => {
          const result = await IPPrefixModel(tenant).register({ prefix }, next);
          return { prefix, success: result.success };
        }),
      );

      const successful_responses = responses
        .filter((response) => response.success)
        .map((response) => response.prefix);

      const unsuccessful_responses = responses
        .filter((response) => !response.success)
        .map((response) => response.prefix);

      let finalMessage = "";
      let finalStatus = httpStatus.OK;

      if (
        successful_responses.length > 0 &&
        unsuccessful_responses.length > 0
      ) {
        finalMessage = "Some IP prefixes have been added.";
      } else if (
        successful_responses.length > 0 &&
        unsuccessful_responses.length === 0
      ) {
        finalMessage = "All responses were successful.";
      } else if (
        successful_responses.length === 0 &&
        unsuccessful_responses.length > 0
      ) {
        finalMessage = "None of the IP prefixes provided were added.";
        finalStatus = httpStatus.BAD_REQUEST;
      }

      return {
        success: true,
        data: { successful_responses, unsuccessful_responses },
        status: finalStatus,
        message: finalMessage,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
      return;
    }
  },
  removeIpPrefix: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const response = await IPPrefixModel(tenant).remove({ filter }, next);
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  listIpPrefix: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const response = await IPPrefixModel(tenant).list(
        {
          filter,
        },
        next,
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  /****************** Whitelisting IPs ******************************/
  whiteListIp: async (request, next) => {
    try {
      const { ip, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const responseFromWhitelistIp = await WhitelistedIPModel(tenant).register(
        {
          ip,
        },
        next,
      );
      return responseFromWhitelistIp;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  bulkWhiteListIps: async (request, next) => {
    try {
      const { ips, tenant } = {
        ...request.body,
        ...request.query,
      };

      if (!ips || !Array.isArray(ips) || ips.length === 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Invalid input. Please provide an array of IP addresses.",
          }),
        );
      }

      const responses = await Promise.all(
        ips.map(async (ip) => {
          try {
            const result = await WhitelistedIPModel(tenant).register(
              { ip },
              () => {},
            );
            return { ip, success: result.success };
          } catch (error) {
            logger.error(`Error whitelisting IP ${ip}: ${error.message}`);
            return { ip, success: false };
          }
        }),
      );

      const successful_responses = responses
        .filter((response) => response.success)
        .map((response) => response.ip);

      const unsuccessful_responses = responses
        .filter((response) => !response.success)
        .map((response) => response.ip);

      let finalMessage = "";
      let finalStatus = httpStatus.OK;

      if (
        successful_responses.length > 0 &&
        unsuccessful_responses.length > 0
      ) {
        finalMessage = "Some IPs have been whitelisted.";
      } else if (
        successful_responses.length > 0 &&
        unsuccessful_responses.length === 0
      ) {
        finalMessage = "All responses were successful.";
      } else if (
        successful_responses.length === 0 &&
        unsuccessful_responses.length > 0
      ) {
        finalMessage = "None of the IPs provided were whitelisted.";
        finalStatus = httpStatus.BAD_REQUEST;
      }

      return {
        success: true,
        data: { successful_responses, unsuccessful_responses },
        status: finalStatus,
        message: finalMessage,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  removeWhitelistedIp: async (request, next) => {
    try {
      const { ip, tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const responseFromRemoveWhitelistedIp = await WhitelistedIPModel(
        tenant,
      ).remove({ filter }, next);
      return responseFromRemoveWhitelistedIp;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  listWhitelistedIp: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const response = await WhitelistedIPModel(tenant).list(
        {
          filter,
        },
        next,
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  /****************** Unknown IPs ******************************/
  listUnknownIPs: async (request, next) => {
    try {
      const { tenant } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.ips(request, next);
      const responseFromListUnkownIP = await UnknownIPModel(tenant).list(
        {
          filter,
        },
        next,
      );
      return responseFromListUnkownIP;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  analyzeIPRequestPatterns: async ({ ip, tenant = "airqo", endpoint } = {}) => {
    try {
      // Immediately exit if the IP is whitelisted
      const isWhitelisted = await WhitelistedIPModel(tenant).exists({ ip });
      if (isWhitelisted) {
        logger.info(`IP ${ip} is whitelisted. Skipping bot pattern analysis.`);
        return;
      }

      // Check if the request endpoint starts with any of the monitored base paths.
      // This is more robust than an exact match and aligns with patterns elsewhere in the codebase.
      const isMonitored = constants.BOT_MONITORED_ENDPOINTS.some(
        (monitoredPath) => endpoint && endpoint.startsWith(monitoredPath),
      );
      if (!isMonitored) {
        return;
      }

      const MIN_REQUESTS_FOR_ANALYSIS = 10;
      const MIN_PATTERN_OCCURRENCES = 5;
      const MIN_INTERVAL_MINUTES = 20; // Ignore intervals less than 20 minutes
      const MAX_PREFIX_BOTS = 3;

      // Fetch requests specifically for this IP and endpoint
      const requests = await IPRequestLogModel(tenant).getRequestsForEndpoint(
        ip,
        endpoint,
      );

      if (requests.length < MIN_REQUESTS_FOR_ANALYSIS) {
        return; // Not enough data to analyze
      }

      requests.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      const deltas = [];
      for (let i = 1; i < requests.length; i++) {
        const deltaMinutes =
          (requests[i].timestamp.getTime() -
            requests[i - 1].timestamp.getTime()) /
          (1000 * 60);
        deltas.push(Math.round(deltaMinutes));
      }

      const deltaCounts = deltas.reduce((acc, delta) => {
        if (delta < MIN_INTERVAL_MINUTES) return acc; // Ignore short intervals
        acc[delta] = (acc[delta] || 0) + 1;
        return acc;
      }, {});

      // Find the most frequent interval
      let mostFrequentInterval = 0;
      let maxCount = 0;
      for (const interval in deltaCounts) {
        if (deltaCounts[interval] > maxCount) {
          maxCount = deltaCounts[interval];
          mostFrequentInterval = parseInt(interval, 10);
        }
      }

      if (maxCount < MIN_PATTERN_OCCURRENCES) {
        return; // No significant pattern found
      }

      // Pattern detected!
      logger.warn(
        `🤖 Bot-like pattern detected for IP: ${ip}. Interval: ~${mostFrequentInterval} minutes. Occurrences: ${maxCount}.`,
      );

      // 1. Blacklist the IP
      const blacklistResponse = await BlacklistedIPModel(tenant).register({
        ip,
      });
      if (!blacklistResponse.success) {
        logger.error(
          `Failed to blacklist IP ${ip}: ${blacklistResponse.message}`,
        );
      }
      await IPRequestLogModel(tenant).markAsBot(ip, mostFrequentInterval);

      // 2. Handle serverless/cloud provider IPs by blacklisting the prefix
      const ipPrefix = ip.split(".").slice(0, 2).join(".");
      const prefixBotLogs =
        await IPRequestLogModel(tenant).getBotLogsByPrefix(ipPrefix);

      if (prefixBotLogs.length >= MAX_PREFIX_BOTS) {
        logger.warn(
          `Multiple bots (${prefixBotLogs.length}) detected from prefix ${ipPrefix}. Blacklisting prefix.`,
        );
        const prefixBlacklistResponse = await BlacklistedIPPrefixModel(
          tenant,
        ).register({
          prefix: ipPrefix,
        });
        if (!prefixBlacklistResponse.success) {
          logger.error(
            `Failed to blacklist prefix ${ipPrefix}: ${prefixBlacklistResponse.message}`,
          );
        } else {
          // New prefix written — invalidate cache so the next request picks it up immediately
          redisDelAsync(IP_PREFIX_CACHE_KEY).catch((err) =>
            logger.warn(
              `Failed to invalidate IP prefix cache after auto-blacklist of ${ipPrefix}: ${err.message}`,
            ),
          );
        }
      }

      // 3. Notify admins
      const adminEmails = constants.SUPER_ADMIN_EMAIL_ALLOWLIST;
      if (adminEmails.length > 0) {
        mailer
          .sendBotAlert({
            recipients: adminEmails,
            tenant,
            ip,
            interval: mostFrequentInterval,
            occurrences: maxCount,
            prefix: ipPrefix,
            prefixBotCount: prefixBotLogs.length,
          })
          .catch((err) =>
            logger.error(
              `Failed to send bot alert email for IP ${ip}: ${err.message}`,
            ),
          );
      }
    } catch (error) {
      logObject(
        `Error during IP pattern analysis for ${ip}: ${error.message}`,
        error,
      );
      logger.error(
        `🐛🐛 Error during IP pattern analysis for ${ip}: ${error.message}`,
      );
    }
  },
  getWhitelistedIPStats: async (request, next) => {
    try {
      const { tenant, active_only } = { ...request.query, ...request.params };
      const skip = parseInt(request.query.skip, 10) || 0;
      const limit = parseInt(request.query.limit, 10) || 100;

      let queryFilter = {};
      // Use a strict check for the boolean query parameter
      if (String(active_only).toLowerCase() === "true") {
        const activeIPs = await IPRequestLogModel(tenant).distinct("ip");
        queryFilter.ip = { $in: activeIPs };
      }

      const totalIPs =
        await WhitelistedIPModel(tenant).countDocuments(queryFilter);

      const whitelistedIPs = await WhitelistedIPModel(tenant)
        .find(queryFilter)
        .skip(skip)
        .limit(limit)
        .lean();

      if (isEmpty(whitelistedIPs)) {
        // Return early if no IPs match the filter, but still provide meta
        const meta = { total: 0, pages: 0, page: 1, limit, hasNextPage: false };
        return {
          success: true,
          message: "No whitelisted IPs found.",
          data: [],
          meta: meta,
          status: httpStatus.OK,
        };
      }

      const ipList = whitelistedIPs.map((item) => item.ip);

      const ipLogs = await IPRequestLogModel(tenant)
        .find({ ip: { $in: ipList } })
        .lean();

      const ipLogMap = new Map(ipLogs.map((log) => [log.ip, log]));

      const maskToken = (token) => {
        if (!token || token.length < 8) {
          return "invalid-token";
        }
        return `${token.slice(0, 4)}...${token.slice(-4)}`;
      };

      const stats = whitelistedIPs.map((whitelistedIp) => {
        const log = ipLogMap.get(whitelistedIp.ip);

        if (!log) {
          return {
            ip: whitelistedIp.ip,
            total_requests: 0,
            endpoint_frequency: {},
            tokens_used: [],
            first_request: null,
            last_request: null,
          };
        } else {
          const endpointStats = {};
          const tokenUsage = {};

          log.requests.forEach((req) => {
            endpointStats[req.endpoint] =
              (endpointStats[req.endpoint] || 0) + 1;

            if (req.token) {
              const masked = maskToken(req.token);
              if (!tokenUsage[masked]) {
                tokenUsage[masked] = { count: 0, endpoints: new Set() };
              }
              tokenUsage[masked].count += 1;
              tokenUsage[masked].endpoints.add(req.endpoint);
            }
          });

          const tokens = Object.keys(tokenUsage).map((maskedToken) => ({
            masked_token: maskedToken,
            access_count: tokenUsage[maskedToken].count,
            endpoints: Array.from(tokenUsage[maskedToken].endpoints),
          }));

          const { first_request, last_request } = log.requests.reduce(
            (acc, req) => {
              if (!acc.first_request || req.timestamp < acc.first_request) {
                acc.first_request = req.timestamp;
              }
              if (!acc.last_request || req.timestamp > acc.last_request) {
                acc.last_request = req.timestamp;
              }
              return acc;
            },
            { first_request: null, last_request: null },
          );

          return {
            ip: log.ip,
            total_requests: log.requests.length,
            endpoint_frequency: endpointStats,
            tokens_used: tokens,
            first_request,
            last_request,
          };
        }
      });

      const totalPages = limit > 0 ? Math.ceil(totalIPs / limit) : 0;
      const currentPage = Math.floor(skip / limit) + 1;
      const meta = {
        total: totalIPs,
        pages: totalPages,
        page: currentPage,
        limit,
        hasNextPage: currentPage < totalPages,
      };

      return {
        success: true,
        message: "Successfully retrieved statistics for whitelisted IPs.",
        data: stats,
        meta: meta,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  getBotLikeIPStats: async (request, next) => {
    try {
      const { tenant, endpoint_filter } = request.query;
      const parsedLimit = parseInt(request.query.limit, 10) || 100;
      const parsedSkip = parseInt(request.query.skip, 10) || 0;

      const filter = {};
      if (endpoint_filter) {
        // Filter requests array for specific endpoints
        filter["requests.endpoint"] = endpoint_filter;
      }

      const response = await IPRequestLogModel(tenant).getBotLikeIPs(
        filter,
        parsedSkip,
        parsedLimit,
      );

      if (!response.success) {
        logger.error(
          `🐛🐛 Internal Server Error -- Failed to retrieve bot-like IPs: ${response.message}`,
        );
        return response;
      }

      const botIPs = response.data.map((ipLog) => ({
        ip: ipLog.ip,
        detectedInterval: ipLog.detectedInterval,
        isBot: ipLog.isBot,
        totalRequests: ipLog.requests.length,
        accessedEndpoints: [
          ...new Set(ipLog.requests.map((req) => req.endpoint)),
        ],
        createdAt: ipLog.createdAt,
        updatedAt: ipLog.updatedAt,
      }));

      return {
        success: true,
        message: "Successfully retrieved bot-like IP statistics",
        status: httpStatus.OK,
        data: botIPs,
        meta: { total: response.total, skip: parsedSkip, limit: parsedLimit },
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  /******************** blocked domains ***********************************/
  createBlockedDomain: async (request, next) => {
    try {
      const { domain, reason } = request.body;
      const { tenant } = request.query;
      const result = await BlockedDomainModel(tenant).register({
        domain,
        reason,
      });

      if (result.success) {
        await token.clearBlockedDomainsCache(tenant); // Clear cache on change
      }
      return result;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  listBlockedDomains: async (request, next) => {
    try {
      const { tenant } = request.query;
      const limit = parseInt(request.query.limit, 10) || 100;
      const skip = parseInt(request.query.skip, 10) || 0;
      const filter = {}; // Implement filtering logic if needed
      const result = await BlockedDomainModel(tenant).list({
        filter,
        limit,
        skip,
      });
      return result;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
  removeBlockedDomain: async (request, next) => {
    try {
      const { domain } = request.params;
      const { tenant } = request.query;

      const normalizedDomain = token.extractAndNormalizeDomain(domain);
      if (!normalizedDomain) {
        throw new HttpError("Invalid domain format", httpStatus.BAD_REQUEST, {
          message: "The provided domain is not a valid format.",
        });
      }
      const filter = { domain: normalizedDomain };
      const result = await BlockedDomainModel(tenant).remove({
        filter,
      });

      if (result.success) {
        await token.clearBlockedDomainsCache(tenant); // Clear cache on change
      }
      return result;
    } catch (error) {
      if (error instanceof HttpError) {
        next(error);
        return;
      } else {
        logger.error(`🐛🐛 Internal Server Error ${error.message}`);
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message },
          ),
        );
      }
    }
  },
  /**
   * Domain utility functions
   */
  extractAndNormalizeDomain: (urlString) => {
    if (!urlString || typeof urlString !== "string") {
      return null;
    }
    try {
      // Add a protocol if missing to handle simple domains like 'example.com'
      const fullUrlString = urlString.startsWith("http")
        ? urlString
        : `http://${urlString}`;
      const url = new URL(fullUrlString);
      let domain = url.hostname;
      // Remove 'www.' prefix if present
      if (domain.startsWith("www.")) {
        domain = domain.substring(4);
      }
      return domain.toLowerCase();
    } catch (error) {
      logger.debug(
        `Failed to parse URL string "${urlString}": ${error.message}`,
      );
      return null;
    }
  },
  getBlockedDomains: async (tenant = "airqo") => {
    const BLOCKED_DOMAINS_CACHE_KEY = "blocked_domains_cache";
    const BLOCKED_DOMAINS_CACHE_TTL = 5 * 60; // 5 minutes
    try {
      let cached = await redisGetAsync(BLOCKED_DOMAINS_CACHE_KEY);
      if (cached) {
        return new Set(JSON.parse(cached));
      }

      const blockedList = await BlockedDomainModel(tenant)
        .find({ isActive: true })
        .select("domain")
        .lean();
      const domains = blockedList.map((item) => item.domain);
      await redisSetAsync(
        BLOCKED_DOMAINS_CACHE_KEY,
        JSON.stringify(domains),
        BLOCKED_DOMAINS_CACHE_TTL,
      );
      return new Set(domains);
    } catch (error) {
      logger.error(`🐛🐛 Error fetching blocked domains: ${error.message}`);
      // Fail open: if DB/Redis fails, don't block requests
      return new Set();
    }
  },
  clearBlockedDomainsCache: async (tenant = "airqo") => {
    const tenantCacheKey = `blocked_domains_cache:${tenant}`;
    try {
      await redisDelAsync(tenantCacheKey);
    } catch (error) {
      logger.error(
        `🐛🐛 Error clearing blocked domains cache: ${error.message}`,
      );
    }
  },

  /**
   * Read MongoDB usage counters and return usage stats for the billing dashboard.
   * Returns 0 when no calls have been made in the current window.
   * Returns null only if the DB query itself fails.
   * The shape matches what the frontend UsageStats component expects.
   */
  getApiUsageStats: async (userId, tier) => {
    const limits  = TIER_RATE_LIMITS[tier] || TIER_RATE_LIMITS.Free;
    const now     = new Date();
    const year    = now.getUTCFullYear();
    const month   = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day     = String(now.getUTCDate()).padStart(2, "0");
    const hour    = String(now.getUTCHours()).padStart(2, "0");

    const hourKey  = `${year}${month}${day}${hour}`;
    const dayKey   = `${year}${month}${day}`;
    const monthKey = `${year}${month}`;

    const hourResetTime  = new Date(Date.UTC(year, now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() + 1)).toISOString();
    const dayResetTime   = new Date(Date.UTC(year, now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
    const monthResetTime = new Date(Date.UTC(year, now.getUTCMonth() + 1, 1)).toISOString();

    const uid = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(String(userId))
      : userId;

    const readCounter = async (period, window_key) => {
      try {
        const doc = await ApiUsageCounterModel("airqo")
          .findOne({ user_id: uid, period, window_key })
          .select("count")
          .lean();
        return doc ? doc.count : 0;
      } catch (_err) {
        return null;
      }
    };

    const [hourUsed, dayUsed, monthUsed] = await Promise.all([
      readCounter("hourly",  hourKey),
      readCounter("daily",   dayKey),
      readCounter("monthly", monthKey),
    ]);

    return {
      hourly:  { used: hourUsed,  limit: limits.hourlyLimit,  resetTime: hourResetTime  },
      daily:   { used: dayUsed,   limit: limits.dailyLimit,   resetTime: dayResetTime   },
      monthly: { used: monthUsed, limit: limits.monthlyLimit, resetTime: monthResetTime },
    };
  },
};

module.exports = token;
module.exports.invalidateBlockedAsnCache = invalidateBlockedAsnCache;

/**
 * Util methods for BlockedASN management.
 * Appended to the token export namespace so callers use tokenUtil.createBlockedASN(…).
 */
token.createBlockedASN = async (request, next) => {
  try {
    const { tenant } = { ...request.query };
    const dbTenant = tenant || constants.DEFAULT_TENANT || "airqo";
    const { provider, asn, cidr_ranges, reason, active } = request.body;
    const response = await BlockedASNModel(dbTenant).register(
      { provider, asn, cidr_ranges, reason, active },
      next
    );
    // Invalidate the cache for this tenant so the new entry is picked up
    // on the next request without waiting for the TTL to expire.
    await invalidateBlockedAsnCache(dbTenant);
    return response;
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

token.listBlockedASNs = async (request, next) => {
  try {
    const { tenant, limit, skip } = { ...request.query };
    const dbTenant = tenant || constants.DEFAULT_TENANT || "airqo";
    const { id, asn, active } = { ...request.query, ...request.params };
    const filter = {};
    if (id) filter._id = ObjectId(id);
    if (asn) filter.asn = asn;
    if (active !== undefined) filter.active = active !== "false";
    return await BlockedASNModel(dbTenant).list(
      { skip: parseInt(skip) || 0, limit: parseInt(limit) || 100, filter },
      next
    );
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

token.deleteBlockedASN = async (request, next) => {
  try {
    const { tenant } = { ...request.query };
    const dbTenant = tenant || constants.DEFAULT_TENANT || "airqo";
    const { id } = request.params;
    const filter = { _id: ObjectId(id) };
    const response = await BlockedASNModel(dbTenant).remove({ filter }, next);
    await invalidateBlockedAsnCache(dbTenant);
    return response;
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

/**
 * Util methods for FlaggedToken management.
 */
token.listFlaggedTokens = async (request, next) => {
  try {
    const { tenant, limit, skip, resolved } = { ...request.query };
    const dbTenant = tenant || constants.DEFAULT_TENANT || "airqo";
    const filter = {};
    if (resolved !== undefined) filter.resolved = resolved !== "false";
    return await FlaggedTokenModel(dbTenant).list(
      { skip: parseInt(skip) || 0, limit: parseInt(limit) || 100, filter },
      next
    );
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

token.resolveFlaggedToken = async (request, next) => {
  try {
    const { tenant } = { ...request.query };
    const dbTenant = tenant || constants.DEFAULT_TENANT || "airqo";
    const { id } = request.params;
    const { note } = request.body;
    const filter = { _id: ObjectId(id) };
    return await FlaggedTokenModel(dbTenant).resolve({ filter, note: note || "" }, next);
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

// Exposed so bin/jobs/bypass-expiry-job.js can iterate the same set of
// bypass fields without duplicating the list.
token.BYPASS_BOOLEAN_FIELDS = BYPASS_BOOLEAN_FIELDS;

/**
 * Admin-only report of tokens that currently have at least one security-bypass
 * flag active (bypass_anomaly_detection / bypass_compromise_detection /
 * bypass_ip_blacklist). Backs both the GET /tokens/bypasses endpoint and the
 * weekly bypass-report digest email sent by bin/jobs/bypass-expiry-job.js.
 * Only reports flags currently in force per _isBypassActive — a boolean left
 * true past its own expires_at is not reported here (it will be cleared and
 * reported as "expired" by the job on its next run instead).
 */
token.listActiveBypasses = async (tenant = "airqo") => {
  const dbTenant = tenant || constants.DEFAULT_TENANT || "airqo";
  const candidates = await AccessTokenModel(dbTenant)
    .find({
      $or: BYPASS_BOOLEAN_FIELDS.map((f) => ({ [f]: true })),
    })
    .select(
      `name token client_id ${BYPASS_ADMIN_ONLY_FIELDS.join(" ")}`
    )
    .lean();

  const active = candidates
    .map((doc) => {
      const bypasses = BYPASS_BOOLEAN_FIELDS.filter((f) =>
        _isBypassActive(doc[f], doc[`${f}_expires_at`])
      ).map((f) => ({
        type: f,
        expires_at: doc[`${f}_expires_at`] || null,
      }));
      return { doc, bypasses };
    })
    .filter((entry) => entry.bypasses.length > 0);

  if (active.length === 0) return [];

  const clientIds = [...new Set(active.map((e) => e.doc.client_id.toString()))];
  const clients = await ClientModel(dbTenant)
    .find({ _id: { $in: clientIds } })
    .select("user_id")
    .lean();
  const clientOwnerMap = new Map(
    clients.map((c) => [c._id.toString(), c.user_id])
  );

  const userIds = [...new Set([...clientOwnerMap.values()].filter(Boolean).map((id) => id.toString()))];
  const users = await UserModel(dbTenant)
    .find({ _id: { $in: userIds } })
    .select("email firstName lastName")
    .lean();
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  return active.map(({ doc, bypasses }) => {
    const ownerId = clientOwnerMap.get(doc.client_id.toString());
    const owner = ownerId ? userMap.get(ownerId.toString()) : null;
    return {
      token_suffix: doc.token ? doc.token.slice(-4) : "",
      token_name: doc.name || "",
      client_id: doc.client_id,
      owner_email: (owner && owner.email) || null,
      owner_name: owner ? `${owner.firstName || ""} ${owner.lastName || ""}`.trim() : null,
      bypasses,
    };
  });
};

token.listBypassedTokens = async (request, next) => {
  try {
    const { tenant } = { ...request.query };
    const data = await token.listActiveBypasses(tenant);
    return {
      success: true,
      message: isEmpty(data)
        ? "No tokens currently have an active security bypass."
        : "Successfully retrieved tokens with active security bypasses.",
      data,
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};
