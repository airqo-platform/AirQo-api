const mongoose = require("mongoose");
const moment = require("moment-timezone");
const constants = require("@config/constants");
const UserUsageDailyModel = require("@models/UserUsageDaily");
const UserUsageProfileModel = require("@models/UserUsageProfile");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- usage-recorder`);

/**
 * Records per-user API and page usage with near-zero cost on the request path.
 *
 * Recording only increments counters in a bounded in-memory Map. A timer
 * flushes that Map every USAGE_FLUSH_INTERVAL_MS as a single bulkWrite of
 * `$inc` upserts, so Mongo write volume scales with active (user, day) pairs
 * per window, not with requests. `$inc` is commutative, which makes flushes
 * from multiple pods safe. A crash loses at most one flush window.
 */

const MAX_PATH_DEPTH = 8;
const MAX_KEY_LENGTH = 120;
const MAX_PAGE_DURATION_SEC = 4 * 60 * 60;
const OTHER_KEY = "(other)";
const IGNORED_METHODS = new Set(["HEAD", "OPTIONS"]);
const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isIdLike = (segment) => {
  if (/^\d+$/.test(segment)) return true;
  if (OBJECT_ID_RE.test(segment) || UUID_RE.test(segment)) return true;
  if (/^[0-9a-f]{16,}$/i.test(segment)) return true;
  // Emails and percent-encoded user input are never route names.
  if (/[@%]/.test(segment)) return true;
  // Long opaque tokens / slugs that embed digits.
  if (segment.length >= 24 && /\d/.test(segment)) return true;
  return false;
};

/**
 * Reduces a raw URL path to a route template that is safe to store as a Mongo
 * key and has bounded cardinality: query/hash dropped, id-like segments
 * replaced with ":id", depth capped, characters outside [A-Za-z0-9/_-:[] ]
 * replaced (this also removes "." and "$", which Mongo keys cannot contain).
 * Returns null for anything that is not an absolute path.
 */
const normalisePath = (raw) => {
  if (typeof raw !== "string") return null;
  const path = raw.split(/[?#]/)[0].trim();
  if (!path.startsWith("/")) return null;
  const segments = path
    .split("/")
    .filter(Boolean)
    .slice(0, MAX_PATH_DEPTH)
    .map((segment) => (isIdLike(segment) ? ":id" : segment));
  const key = `/${segments.join("/")}`.replace(/[^A-Za-z0-9/_\-:[\]]/g, "_");
  return key.slice(0, MAX_KEY_LENGTH);
};

const isInternalEmail = (email) => {
  const domains = constants.USAGE_INTERNAL_EMAIL_DOMAINS || [];
  if (!domains.length || typeof email !== "string") return false;
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  return domains.includes(email.slice(at + 1).toLowerCase());
};

// ── Buffer ────────────────────────────────────────────────────────────────────
let buffer = new Map();
let timer = null;
let inFlight = null;
let atCapacity = false;
const stats = {
  recorded: 0,
  shed: 0,
  flushes: 0,
  flushed_entries: 0,
  failed_entries: 0,
  profile_retry_queued: 0,
  last_flush_at: null,
  last_flush_ms: null,
};

const newEntry = ({ tenant, userId, day, internal, now }) => ({
  tenant,
  userId,
  day,
  internal,
  firstAt: now,
  lastAt: now,
  pages: {},
  api: {},
  pageKeys: 0,
  apiKeys: 0,
  page_hours: {},
  api_hours: {},
  page_views: 0,
  api_calls: 0,
  sessions: 0,
  duration_sec: 0,
});

const getEntry = ({ tenant, user, now }) => {
  const userId = user && user._id ? String(user._id) : "";
  if (!OBJECT_ID_RE.test(userId)) return null;
  const day = now.toISOString().slice(0, 10);
  const entryKey = `${tenant}|${userId}|${day}`;
  let entry = buffer.get(entryKey);
  if (!entry) {
    if (buffer.size >= constants.USAGE_BUFFER_MAX_ENTRIES) {
      stats.shed += 1;
      if (!atCapacity) {
        atCapacity = true;
        logger.warn(
          `usage buffer full (${buffer.size} entries); shedding new entries until the next flush`,
        );
      }
      return null;
    }
    entry = newEntry({
      tenant,
      userId,
      day,
      internal: isInternalEmail(user.email),
      now,
    });
    buffer.set(entryKey, entry);
  }
  entry.lastAt = now;
  return entry;
};

const ensureTimer = () => {
  if (timer) return;
  timer = setInterval(() => {
    flush().catch((error) =>
      logger.warn(`usage flush failed: ${error.message}`),
    );
  }, constants.USAGE_FLUSH_INTERVAL_MS);
  // Never keep the process (or a test run) alive just for this timer.
  timer.unref();
};

const tenantOf = (tenant) =>
  String(tenant || constants.DEFAULT_TENANT || "airqo").toLowerCase();

/**
 * Records one API call seen on the nginx verify hop. Synchronous and
 * allocation-light; never throws and never touches the database.
 */
const recordApiCall = ({ tenant, user, uri, method } = {}) => {
  try {
    if (!constants.USAGE_TRACKING_ENABLED) return false;
    const verb = String(method || "").toUpperCase();
    if (!/^[A-Z]{3,7}$/.test(verb) || IGNORED_METHODS.has(verb)) return false;
    const path = normalisePath(uri);
    // The beacon itself is not user activity.
    if (!path || path.endsWith("/usage/events")) return false;

    const now = new Date();
    const entry = getEntry({ tenant: tenantOf(tenant), user, now });
    if (!entry) return false;

    let key = `${verb} ${path}`;
    if (!(key in entry.api)) {
      if (entry.apiKeys >= constants.USAGE_MAX_KEYS_PER_ENTRY) {
        key = OTHER_KEY;
      }
      if (!(key in entry.api)) entry.apiKeys += 1;
    }
    entry.api[key] = (entry.api[key] || 0) + 1;
    entry.api_calls += 1;
    const hour = now.getUTCHours();
    entry.api_hours[hour] = (entry.api_hours[hour] || 0) + 1;
    stats.recorded += 1;
    ensureTimer();
    return true;
  } catch (error) {
    logger.warn(`recordApiCall failed: ${error.message}`);
    return false;
  }
};

/**
 * Records a batch of page events sent by the Nexus beacon. Events are bucketed
 * by server receipt time. Returns how many events were accepted.
 */
const recordPageEvents = ({ tenant, user, events } = {}) => {
  let accepted = 0;
  try {
    if (!constants.USAGE_TRACKING_ENABLED || !Array.isArray(events)) return 0;
    const now = new Date();
    const entry = getEntry({ tenant: tenantOf(tenant), user, now });
    if (!entry) return 0;

    const hour = now.getUTCHours();
    for (const event of events) {
      if (!event || (event.type && event.type !== "page_view")) continue;
      let key = normalisePath(event.path);
      if (!key) continue;
      if (!(key in entry.pages)) {
        if (entry.pageKeys >= constants.USAGE_MAX_KEYS_PER_ENTRY) {
          key = OTHER_KEY;
        }
        if (!(key in entry.pages)) {
          entry.pages[key] = { n: 0, d: 0 };
          entry.pageKeys += 1;
        }
      }
      const seconds = Math.min(
        Math.max(Math.round(Number(event.duration_sec) || 0), 0),
        MAX_PAGE_DURATION_SEC,
      );
      entry.pages[key].n += 1;
      entry.pages[key].d += seconds;
      entry.page_views += 1;
      entry.duration_sec += seconds;
      entry.page_hours[hour] = (entry.page_hours[hour] || 0) + 1;
      if (event.session_start === true) entry.sessions += 1;
      accepted += 1;
    }
    stats.recorded += accepted;
    if (accepted) ensureTimer();
  } catch (error) {
    logger.warn(`recordPageEvents failed: ${error.message}`);
  }
  return accepted;
};

// ── Flush ─────────────────────────────────────────────────────────────────────
const retentionExpiry = (day) =>
  moment
    .utc(day, "YYYY-MM-DD")
    .add(constants.USAGE_RETENTION_MONTHS, "months")
    .toDate();

const buildDailyUpdate = (entry) => {
  const inc = {};
  const add = (path, value) => {
    if (value) inc[path] = value;
  };
  add("page_views", entry.page_views);
  add("api_calls", entry.api_calls);
  add("sessions", entry.sessions);
  add("duration_sec", entry.duration_sec);
  for (const [key, value] of Object.entries(entry.pages)) {
    add(`pages.${key}.n`, value.n);
    add(`pages.${key}.d`, value.d);
  }
  for (const [key, value] of Object.entries(entry.api)) {
    add(`api.${key}`, value);
  }
  for (const [hour, value] of Object.entries(entry.page_hours)) {
    add(`page_hours.${hour}`, value);
  }
  for (const [hour, value] of Object.entries(entry.api_hours)) {
    add(`api_hours.${hour}`, value);
  }
  return {
    $inc: inc,
    $setOnInsert: {
      expireAt: retentionExpiry(entry.day),
      internal: entry.internal,
    },
  };
};

// Profile writes are deliberately idempotent ($min / $max / $setOnInsert only,
// no counters), so a failed batch can be retried without double counting.
const profileOp = (p) => ({
  updateOne: {
    filter: {
      tenant: p.tenant,
      user_id: new mongoose.Types.ObjectId(p.userId),
    },
    update: {
      $min: { first_seen: p.firstAt },
      $max: { last_seen: p.lastAt },
      $setOnInsert: { internal: p.internal },
    },
    upsert: true,
  },
});

const MAX_PENDING_PROFILES = 5000;
// Profile updates whose write failed, keyed by tenant|user, awaiting a retry.
const pendingProfiles = new Map();

const mergeProfile = (map, p) => {
  const key = `${p.tenant}|${p.userId}`;
  const cur = map.get(key);
  if (!cur) {
    map.set(key, {
      tenant: p.tenant,
      userId: p.userId,
      internal: p.internal,
      firstAt: p.firstAt,
      lastAt: p.lastAt,
    });
    return;
  }
  if (p.firstAt < cur.firstAt) cur.firstAt = p.firstAt;
  if (p.lastAt > cur.lastAt) cur.lastAt = p.lastAt;
};

/**
 * Folds keys that would push a persisted (user, day) document past
 * USAGE_MAX_KEYS_PER_DAY into "(other)". `existing` is the map already stored
 * for that document, so the budget holds across flushes, not just within one.
 */
const foldKeysOverBudget = (incoming, existing, budget) => {
  const stored = new Set(existing ? Object.keys(existing) : []);
  let remaining = budget - stored.size;
  for (const key of Object.keys(incoming)) {
    if (key === OTHER_KEY || stored.has(key)) continue;
    if (remaining > 0) {
      remaining -= 1;
      continue;
    }
    const value = incoming[key];
    delete incoming[key];
    if (typeof value === "number") {
      incoming[OTHER_KEY] = (incoming[OTHER_KEY] || 0) + value;
    } else {
      const other = incoming[OTHER_KEY] || (incoming[OTHER_KEY] = { n: 0, d: 0 });
      other.n += value.n;
      other.d += value.d;
    }
  }
};

const enforceKeyBudget = async (tenant, entries) => {
  const budget = constants.USAGE_MAX_KEYS_PER_DAY;
  const existing = await UserUsageDailyModel(tenant)
    .find(
      {
        tenant,
        day: { $in: [...new Set(entries.map((e) => e.day))] },
        user_id: {
          $in: entries.map((e) => new mongoose.Types.ObjectId(e.userId)),
        },
      },
      { user_id: 1, day: 1, pages: 1, api: 1 },
    )
    .lean();
  const byDoc = new Map(existing.map((d) => [`${d.user_id}|${d.day}`, d]));
  for (const entry of entries) {
    const doc = byDoc.get(`${entry.userId}|${entry.day}`);
    foldKeysOverBudget(entry.pages, doc && doc.pages, budget);
    foldKeysOverBudget(entry.api, doc && doc.api, budget);
  }
};

/** Builds the bulkWrite operations for a set of buffered entries. */
const buildOps = (entries) => {
  const daily = [];
  const profile = [];
  for (const entry of entries) {
    const user_id = new mongoose.Types.ObjectId(entry.userId);
    daily.push({
      updateOne: {
        filter: { tenant: entry.tenant, user_id, day: entry.day },
        update: buildDailyUpdate(entry),
        upsert: true,
      },
    });
    profile.push(profileOp(entry));
  }
  return { daily, profile };
};

const writeProfiles = async (tenant, entries) => {
  const batch = new Map();
  for (const [key, pending] of pendingProfiles) {
    if (pending.tenant === tenant) {
      mergeProfile(batch, pending);
      pendingProfiles.delete(key);
    }
  }
  for (const entry of entries) mergeProfile(batch, entry);
  if (batch.size === 0) return;
  try {
    await UserUsageProfileModel(tenant).bulkWrite(
      [...batch.values()].map(profileOp),
      { ordered: false },
    );
  } catch (error) {
    // Safe to retry: profile ops are idempotent. Bounded so an outage cannot
    // grow memory without limit.
    let dropped = 0;
    for (const p of batch.values()) {
      if (pendingProfiles.size < MAX_PENDING_PROFILES) {
        mergeProfile(pendingProfiles, p);
      } else {
        dropped += 1;
      }
    }
    stats.profile_retry_queued = pendingProfiles.size;
    logger.warn(
      `usage profile write failed for tenant ${tenant} (${batch.size - dropped} queued for retry, ${dropped} dropped): ${error.message}`,
    );
  }
};

const writeEntries = async (entries) => {
  const byTenant = new Map();
  const bucket = (tenant) => {
    if (!byTenant.has(tenant)) byTenant.set(tenant, []);
    return byTenant.get(tenant);
  };
  for (const entry of entries) bucket(entry.tenant).push(entry);
  // Tenants with only retryable profile updates still get a write attempt.
  for (const pending of pendingProfiles.values()) bucket(pending.tenant);

  for (const [tenant, tenantEntries] of byTenant) {
    if (tenantEntries.length) {
      try {
        await enforceKeyBudget(tenant, tenantEntries);
        const { daily } = buildOps(tenantEntries);
        await UserUsageDailyModel(tenant).bulkWrite(daily, { ordered: false });
        stats.flushed_entries += tenantEntries.length;
      } catch (error) {
        // Counters are best-effort: drop the batch rather than re-queue it,
        // since $inc is not idempotent and a retry could double count.
        stats.failed_entries += tenantEntries.length;
        logger.warn(
          `usage flush failed for tenant ${tenant} (${tenantEntries.length} entries dropped): ${error.message}`,
        );
      }
    }
    await writeProfiles(tenant, tenantEntries);
  }
};

/**
 * Writes the current buffer to MongoDB. The buffer is swapped out
 * synchronously, so events recorded while the write is in flight land in a
 * fresh buffer. Concurrent calls share the in-flight write.
 */
const flush = async () => {
  if (inFlight) return inFlight;
  if (buffer.size === 0 && pendingProfiles.size === 0) return { flushed: 0 };

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

const getStats = () => ({
  ...stats,
  buffered_entries: buffer.size,
  pending_profiles: pendingProfiles.size,
});

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
    profile_retry_queued: 0,
    last_flush_at: null,
    last_flush_ms: null,
  });
  pendingProfiles.clear();
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

module.exports = {
  recordApiCall,
  recordPageEvents,
  flush,
  shutdown,
  getStats,
  normalisePath,
  isIdLike,
  isInternalEmail,
  buildOps,
  foldKeysOverBudget,
  _reset,
  _getBuffer: () => buffer,
  _getPendingProfiles: () => pendingProfiles,
};
