const mongoose = require("mongoose");
const moment = require("moment-timezone");
const constants = require("@config/constants");
const ApiKeyUsageDailyModel = require("@models/ApiKeyUsageDaily");
const {
  normalisePath,
  foldKeysOverBudget,
} = require("@utils/usage-recorder.util");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- api-key-usage-recorder`,
);

/**
 * Records per-API-key usage seen on the nginx token-verify hop, so admins can
 * attribute load on downstream services (e.g. BigQuery-backed analytics) to
 * the key that caused it.
 *
 * Same design as usage-recorder.util.js: recording only bumps counters in a
 * bounded in-memory Map, and a timer flushes it every USAGE_FLUSH_INTERVAL_MS
 * as one bulkWrite of `$inc` upserts. Mongo write volume scales with active
 * (key, day) pairs per window, not with requests. A crash loses at most one
 * flush window.
 */

const OTHER_KEY = "(other)";
const MAX_IPS_PER_DAY = 50;
const MAX_SERVICE_LENGTH = 40;
const IGNORED_METHODS = new Set(["HEAD", "OPTIONS"]);
const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;

const stats = {
  recorded: 0,
  shed: 0,
  flushes: 0,
  flushed_entries: 0,
  failed_entries: 0,
  last_flush_at: null,
  last_flush_ms: null,
};

let buffer = new Map();
let timer = null;
let inFlight = null;
let atCapacity = false;

/**
 * The service a gateway path targets: "/api/v2/analytics/..." → "analytics".
 * Falls back to the first path segment for unversioned paths.
 */
const serviceOf = (path) => {
  const segments = String(path || "")
    .split("/")
    .filter(Boolean);
  const index = segments[0] === "api" && /^v\d+$/i.test(segments[1] || "") ? 2 : 0;
  const segment = segments[index] || "";
  // ":id" is a folded id segment, not a service name.
  if (!segment || segment.startsWith(":")) return OTHER_KEY;
  return segment
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .slice(0, MAX_SERVICE_LENGTH);
};

/** Mongo keys cannot contain "." or start with "$". */
const ipKey = (ip) =>
  String(ip || "")
    .trim()
    .slice(0, 64)
    .replace(/\./g, "_")
    .replace(/^\$/, "_") || null;

const newEntry = ({ tenant, clientId, userId, day, now }) => ({
  tenant,
  clientId,
  userId,
  day,
  firstAt: now,
  lastAt: now,
  lastIp: null,
  calls: 0,
  services: {},
  api: {},
  apiKeys: 0,
  hours: {},
  ips: {},
});

const getEntry = ({ tenant, clientId, userId, now }) => {
  const day = now.toISOString().slice(0, 10);
  const entryKey = `${tenant}|${clientId}|${day}`;
  let entry = buffer.get(entryKey);
  if (!entry) {
    if (buffer.size >= constants.USAGE_BUFFER_MAX_ENTRIES) {
      stats.shed += 1;
      if (!atCapacity) {
        atCapacity = true;
        logger.warn(
          `api-key usage buffer full (${buffer.size} entries); shedding new entries until the next flush`,
        );
      }
      return null;
    }
    entry = newEntry({ tenant, clientId, userId, day, now });
    buffer.set(entryKey, entry);
  }
  entry.lastAt = now;
  return entry;
};

const ensureTimer = () => {
  if (timer) return;
  timer = setInterval(() => {
    flush().catch((error) =>
      logger.warn(`api-key usage flush failed: ${error.message}`),
    );
  }, constants.USAGE_FLUSH_INTERVAL_MS);
  // Never keep the process (or a test run) alive just for this timer.
  timer.unref();
};

/**
 * Records one successful token verification. Synchronous and
 * allocation-light; never throws and never touches the database.
 */
const recordKeyCall = ({ clientId, userId, uri, method, ip } = {}) => {
  try {
    if (!constants.USAGE_TRACKING_ENABLED) return false;
    const client = clientId ? String(clientId) : "";
    if (!OBJECT_ID_RE.test(client)) return false;
    // nginx does not always forward the method on the token-verify hop.
    const verb = String(method || "GET").toUpperCase();
    if (!/^[A-Z]{3,7}$/.test(verb) || IGNORED_METHODS.has(verb)) return false;
    const path = normalisePath(uri) || "/(unknown)";

    const now = new Date();
    const user = userId ? String(userId) : "";
    const entry = getEntry({
      tenant: String(constants.DEFAULT_TENANT || "airqo").toLowerCase(),
      clientId: client,
      userId: OBJECT_ID_RE.test(user) ? user : null,
      now,
    });
    if (!entry) return false;

    let key = `${verb} ${path}`;
    if (!(key in entry.api)) {
      if (entry.apiKeys >= constants.USAGE_MAX_KEYS_PER_ENTRY) key = OTHER_KEY;
      if (!(key in entry.api)) entry.apiKeys += 1;
    }
    entry.api[key] = (entry.api[key] || 0) + 1;

    const service = serviceOf(path);
    entry.services[service] = (entry.services[service] || 0) + 1;

    const hour = now.getUTCHours();
    entry.hours[hour] = (entry.hours[hour] || 0) + 1;

    const ipField = ipKey(ip);
    if (ipField) {
      if (ipField in entry.ips || Object.keys(entry.ips).length < MAX_IPS_PER_DAY) {
        entry.ips[ipField] = (entry.ips[ipField] || 0) + 1;
      } else {
        entry.ips[OTHER_KEY] = (entry.ips[OTHER_KEY] || 0) + 1;
      }
      entry.lastIp = String(ip).trim().slice(0, 64);
    }

    entry.calls += 1;
    stats.recorded += 1;
    ensureTimer();
    return true;
  } catch (error) {
    logger.warn(`recordKeyCall failed: ${error.message}`);
    return false;
  }
};

const retentionExpiry = (day) =>
  moment
    .utc(day, "YYYY-MM-DD")
    .add(constants.USAGE_RETENTION_MONTHS, "months")
    .toDate();

const buildDailyUpdate = (entry) => {
  const inc = { calls: entry.calls };
  const addMap = (field, map) => {
    for (const [key, value] of Object.entries(map)) {
      if (value) inc[`${field}.${key}`] = value;
    }
  };
  addMap("services", entry.services);
  addMap("api", entry.api);
  addMap("hours", entry.hours);
  addMap("ips", entry.ips);

  const update = {
    $inc: inc,
    $min: { first_at: entry.firstAt },
    $max: { last_at: entry.lastAt },
    $setOnInsert: { expireAt: retentionExpiry(entry.day) },
  };
  const set = {};
  if (entry.userId) set.user_id = new mongoose.Types.ObjectId(entry.userId);
  if (entry.lastIp) set.last_ip = entry.lastIp;
  if (Object.keys(set).length) update.$set = set;
  return update;
};

/** Builds the bulkWrite operations for a set of buffered entries. */
const buildOps = (entries) =>
  entries.map((entry) => ({
    updateOne: {
      filter: {
        tenant: entry.tenant,
        client_id: new mongoose.Types.ObjectId(entry.clientId),
        day: entry.day,
      },
      update: buildDailyUpdate(entry),
      upsert: true,
    },
  }));

/**
 * Folds route and IP keys that would push a persisted (key, day) document past
 * its budget into "(other)", so one runaway key cannot grow a document without
 * limit across flushes.
 */
const enforceKeyBudget = async (tenant, entries) => {
  const existing = await ApiKeyUsageDailyModel(tenant)
    .find(
      {
        tenant,
        day: { $in: [...new Set(entries.map((e) => e.day))] },
        client_id: {
          $in: entries.map((e) => new mongoose.Types.ObjectId(e.clientId)),
        },
      },
      { client_id: 1, day: 1, api: 1, ips: 1 },
    )
    .lean();
  const byDoc = new Map(existing.map((d) => [`${d.client_id}|${d.day}`, d]));
  for (const entry of entries) {
    const doc = byDoc.get(`${entry.clientId}|${entry.day}`);
    foldKeysOverBudget(entry.api, doc && doc.api, constants.USAGE_MAX_KEYS_PER_DAY);
    foldKeysOverBudget(entry.ips, doc && doc.ips, MAX_IPS_PER_DAY);
  }
};

const writeEntries = async (entries) => {
  const byTenant = new Map();
  for (const entry of entries) {
    if (!byTenant.has(entry.tenant)) byTenant.set(entry.tenant, []);
    byTenant.get(entry.tenant).push(entry);
  }
  for (const [tenant, tenantEntries] of byTenant) {
    try {
      await enforceKeyBudget(tenant, tenantEntries);
      await ApiKeyUsageDailyModel(tenant).bulkWrite(buildOps(tenantEntries), {
        ordered: false,
      });
      stats.flushed_entries += tenantEntries.length;
    } catch (error) {
      // Counters are best-effort: drop the batch rather than re-queue it,
      // since $inc is not idempotent and a retry could double count.
      stats.failed_entries += tenantEntries.length;
      logger.warn(
        `api-key usage flush failed for tenant ${tenant} (${tenantEntries.length} entries dropped): ${error.message}`,
      );
    }
  }
};

/**
 * Writes the current buffer to MongoDB. The buffer is swapped out
 * synchronously, so calls recorded while the write is in flight land in a
 * fresh buffer. Concurrent calls share the in-flight write.
 */
const flush = async () => {
  if (inFlight) return inFlight;
  if (buffer.size === 0) return { flushed: 0 };

  const entries = Array.from(buffer.values());
  buffer = new Map();
  atCapacity = false;
  const startedAt = Date.now();

  inFlight = (async () => {
    try {
      await writeEntries(entries);
    } finally {
      stats.flushes += 1;
      stats.last_flush_at = new Date();
      stats.last_flush_ms = Date.now() - startedAt;
      inFlight = null;
    }
    return { flushed: entries.length };
  })();
  return inFlight;
};

/** Stops the timer and flushes what is left. Call from graceful shutdown. */
const shutdown = async () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (inFlight) await inFlight;
  return flush();
};

const getStats = () => ({ ...stats, buffered_entries: buffer.size });

// Test helper: drops buffered state without writing it.
const _reset = () => {
  buffer = new Map();
  inFlight = null;
  atCapacity = false;
  Object.assign(stats, {
    recorded: 0,
    shed: 0,
    flushes: 0,
    flushed_entries: 0,
    failed_entries: 0,
    last_flush_at: null,
    last_flush_ms: null,
  });
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

module.exports = {
  recordKeyCall,
  flush,
  shutdown,
  getStats,
  serviceOf,
  ipKey,
  buildOps,
  _reset,
};
