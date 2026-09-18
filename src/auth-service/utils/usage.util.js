const mongoose = require("mongoose");
const moment = require("moment-timezone");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const UserModel = require("@models/User");
const UserUsageDailyModel = require("@models/UserUsageDaily");
const UserUsageProfileModel = require("@models/UserUsageProfile");
const UsageSummaryModel = require("@models/UsageSummary");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- usage-util`);

const MS_PER_HOUR = 3600 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MAX_CALENDAR_DAYS = 366;
const TOP_KEYS_STORED = 50;
const SUMMARY_MEMO_TTL_MS = 5 * 60 * 1000;
const SUMMARY_MEMO_MAX = 200;
const CSV_MAX_ROWS = 10000;

const ok = (message, data) => ({
  success: true,
  message,
  data,
  status: httpStatus.OK,
});
const fail = (status, message, detail) => ({
  success: false,
  message,
  errors: { message: detail || message },
  status,
});

// ── Small pure helpers (exported for tests) ──────────────────────────────────
const addDays = (date, n) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);

const eachDate = (from, to) => {
  const dates = [];
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
  return dates;
};

const utcToday = () => moment.utc().format("YYYY-MM-DD");

const monthBounds = (month) => {
  const start = moment.utc(month, "YYYY-MM", true);
  return {
    month,
    start: start.format("YYYY-MM-DD"),
    end: start.clone().endOf("month").format("YYYY-MM-DD"),
    previous: start.clone().subtract(1, "month").format("YYYY-MM"),
  };
};

const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const changePct = (current, previous) =>
  previous > 0 ? round(((current - previous) / previous) * 100) : null;

const getZone = (tz) => moment.tz.zone(tz || "UTC");

/** Local calendar parts of a UTC instant in `zone` (Monday = 0). */
const localParts = (ms, zone) => {
  const shifted = new Date(ms - zone.utcOffset(ms) * 60 * 1000);
  return {
    date: shifted.toISOString().slice(0, 10),
    hour: shifted.getUTCHours(),
    weekday: (shifted.getUTCDay() + 6) % 7,
  };
};

/**
 * Calls cb(local, { page_views, api_calls }) for every non-empty UTC hour slot
 * of every document, so day/hour re-bucketing follows the viewer's timezone.
 */
const forEachHour = (docs, zone, cb) => {
  for (const doc of docs) {
    const base = Date.parse(`${doc.day}T00:00:00Z`);
    const hours = new Set([
      ...Object.keys(doc.page_hours || {}),
      ...Object.keys(doc.api_hours || {}),
    ]);
    for (const h of hours) {
      cb(localParts(base + Number(h) * MS_PER_HOUR, zone), {
        page_views: (doc.page_hours && doc.page_hours[h]) || 0,
        api_calls: (doc.api_hours && doc.api_hours[h]) || 0,
      });
    }
  }
};

const bucketByLocalDate = (docs, zone) => {
  const map = new Map();
  forEachHour(docs, zone, (local, counts) => {
    const cur = map.get(local.date) || { page_views: 0, api_calls: 0 };
    cur.page_views += counts.page_views;
    cur.api_calls += counts.api_calls;
    map.set(local.date, cur);
  });
  return map;
};

const metricValue = (counts, metric) =>
  metric === "page_views"
    ? counts.page_views
    : metric === "api_calls"
      ? counts.api_calls
      : counts.page_views + counts.api_calls;

/** GitHub-style quartile thresholds over the non-zero days. */
const computeThresholds = (counts) => {
  const sorted = counts.filter((c) => c > 0).sort((a, b) => a - b);
  if (!sorted.length) return [0, 0, 0];
  const at = (p) => sorted[Math.floor(p * (sorted.length - 1))];
  return [at(0.25), at(0.5), at(0.75)];
};

const levelFor = (count, [t1, t2, t3]) => {
  if (count <= 0) return 0;
  if (count <= t1) return 1;
  if (count <= t2) return 2;
  if (count <= t3) return 3;
  return 4;
};

/** series: [{ date, count }] ascending. The current streak may end yesterday. */
const computeStreaks = (series) => {
  let longest = 0;
  let run = 0;
  for (const { count } of series) {
    run = count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let end = series.length - 1;
  if (end > 0 && series[end].count === 0) end -= 1;
  let current = 0;
  for (let i = end; i >= 0 && series[i].count > 0; i -= 1) current += 1;
  return { current, longest };
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const scopeOf = (request) =>
  request.query.exclude_internal === true ||
  request.query.exclude_internal === "true"
    ? "external"
    : "all";
const scopeFilter = (scope) =>
  scope === "external" ? { internal: { $ne: true } } : {};

const tenantOf = (request) =>
  String((request.query && request.query.tenant) || constants.DEFAULT_TENANT || "airqo").toLowerCase();

// Short-lived per-process memo for aggregations over the still-open month.
const memo = new Map();
const memoized = async (key, fn) => {
  const hit = memo.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await fn();
  memo.set(key, { value, expires: Date.now() + SUMMARY_MEMO_TTL_MS });
  if (memo.size > SUMMARY_MEMO_MAX) memo.delete(memo.keys().next().value);
  return value;
};

// ── Per-user data access ─────────────────────────────────────────────────────
const findUser = async (tenant, userId) => {
  if (!mongoose.isValidObjectId(userId)) return null;
  return UserModel(tenant)
    .findOne(
      { _id: userId },
      { email: 1, firstName: 1, lastName: 1, userName: 1 },
    )
    .lean();
};

const userDocs = (tenant, userId, fromDay, toDay, projection) =>
  UserUsageDailyModel(tenant)
    .find(
      {
        tenant,
        user_id: new mongoose.Types.ObjectId(String(userId)),
        day: { $gte: fromDay, $lte: toDay },
      },
      projection,
    )
    .sort({ day: 1 })
    .lean();

const userIdentity = (user) => ({
  user_id: String(user._id),
  email: user.email,
  name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.userName || null,
});

const notFoundUser = () =>
  fail(httpStatus.NOT_FOUND, "User not found", "no user matches the given userId");

const localToday = (tz) => moment.tz(tz).format("YYYY-MM-DD");

// ── Per-user endpoints ───────────────────────────────────────────────────────
const userCalendar = async (request) => {
  const tenant = tenantOf(request);
  const { userId } = request.params;
  const { year, from, to, metric = "activity", tz = "UTC" } = request.query;
  const zone = getZone(tz);
  if (!zone) return fail(httpStatus.BAD_REQUEST, "Invalid timezone", `unknown tz "${tz}"`);
  const user = await findUser(tenant, userId);
  if (!user) return notFoundUser();

  const today = localToday(tz);
  let start;
  let end;
  if (year) {
    start = `${year}-01-01`;
    end = `${year}-12-31`;
  } else if (from && to) {
    start = from;
    end = to;
  } else {
    end = today;
    start = addDays(today, -(MAX_CALENDAR_DAYS - 2));
  }
  if (end > today) end = today;
  if (start > end) {
    return ok("No calendar days in the requested range", {
      ...userIdentity(user),
      tz,
      metric,
      from: start,
      to: end,
      days: [],
    });
  }
  if (eachDate(start, end).length > MAX_CALENDAR_DAYS) {
    return fail(httpStatus.BAD_REQUEST, "Range too large", `range cannot exceed ${MAX_CALENDAR_DAYS} days`);
  }

  const docs = await userDocs(tenant, userId, addDays(start, -1), addDays(end, 1), {
    day: 1,
    page_hours: 1,
    api_hours: 1,
  });
  const buckets = bucketByLocalDate(docs, zone);
  const series = eachDate(start, end).map((date) => ({
    date,
    count: buckets.has(date) ? metricValue(buckets.get(date), metric) : 0,
  }));
  const thresholds = computeThresholds(series.map((s) => s.count));
  const streaks = computeStreaks(series);
  return ok("Usage calendar retrieved", {
    ...userIdentity(user),
    tz,
    metric,
    from: start,
    to: end,
    total: series.reduce((sum, s) => sum + s.count, 0),
    active_days: series.filter((s) => s.count > 0).length,
    max_count: Math.max(0, ...series.map((s) => s.count)),
    current_streak: streaks.current,
    longest_streak: streaks.longest,
    thresholds,
    days: series.map((s) => ({ ...s, level: levelFor(s.count, thresholds) })),
  });
};

const monthTotals = (docs, zone, bounds, today) => {
  const buckets = bucketByLocalDate(docs, zone);
  const lastDay = bounds.end < today ? bounds.end : today;
  const series = [];
  let page_views = 0;
  let api_calls = 0;
  for (const date of eachDate(bounds.start, lastDay < bounds.start ? bounds.start : lastDay)) {
    const c = buckets.get(date) || { page_views: 0, api_calls: 0 };
    page_views += c.page_views;
    api_calls += c.api_calls;
    series.push({ date, count: c.page_views + c.api_calls });
  }
  let sessions = 0;
  let duration_sec = 0;
  for (const doc of docs) {
    if (doc.day >= bounds.start && doc.day <= bounds.end) {
      sessions += doc.sessions || 0;
      duration_sec += doc.duration_sec || 0;
    }
  }
  return {
    page_views,
    api_calls,
    total_actions: page_views + api_calls,
    active_days: series.filter((s) => s.count > 0).length,
    sessions,
    duration_sec,
    streaks: computeStreaks(series),
  };
};

const userSummary = async (request) => {
  const tenant = tenantOf(request);
  const { userId } = request.params;
  const { month, tz = "UTC" } = request.query;
  const zone = getZone(tz);
  if (!zone) return fail(httpStatus.BAD_REQUEST, "Invalid timezone", `unknown tz "${tz}"`);
  const user = await findUser(tenant, userId);
  if (!user) return notFoundUser();

  const bounds = monthBounds(month);
  const prev = monthBounds(bounds.previous);
  const today = localToday(tz);
  const docs = await userDocs(tenant, userId, addDays(prev.start, -1), addDays(bounds.end, 1), {
    day: 1,
    page_hours: 1,
    api_hours: 1,
    sessions: 1,
    duration_sec: 1,
  });
  const cur = monthTotals(docs, zone, bounds, today);
  const prv = monthTotals(docs, zone, prev, today);
  const profile = await UserUsageProfileModel(tenant)
    .findOne({ tenant, user_id: new mongoose.Types.ObjectId(String(userId)) })
    .lean();

  return ok("Usage summary retrieved", {
    ...userIdentity(user),
    month,
    tz,
    total_actions: cur.total_actions,
    page_views: cur.page_views,
    api_calls: cur.api_calls,
    active_days: cur.active_days,
    days_in_month: moment.utc(month, "YYYY-MM").daysInMonth(),
    current_streak: cur.streaks.current,
    longest_streak: cur.streaks.longest,
    sessions: cur.sessions,
    total_time_sec: cur.duration_sec,
    avg_session_sec: cur.sessions ? Math.round(cur.duration_sec / cur.sessions) : null,
    previous_month: {
      month: bounds.previous,
      total_actions: prv.total_actions,
      active_days: prv.active_days,
      sessions: prv.sessions,
    },
    change_pct: {
      total_actions: changePct(cur.total_actions, prv.total_actions),
      active_days: changePct(cur.active_days, prv.active_days),
      sessions: changePct(cur.sessions, prv.sessions),
    },
    first_seen: profile ? profile.first_seen : null,
    last_seen: profile ? profile.last_seen : null,
  });
};

const userBreakdown = async (request) => {
  const tenant = tenantOf(request);
  const { userId } = request.params;
  const { month, kind = "page", limit = 20 } = request.query;
  const user = await findUser(tenant, userId);
  if (!user) return notFoundUser();

  const bounds = monthBounds(month);
  const docs = await userDocs(tenant, userId, bounds.start, bounds.end, {
    day: 1,
    pages: 1,
    api: 1,
  });
  const totals = new Map();
  for (const doc of docs) {
    if (kind === "page") {
      for (const [key, v] of Object.entries(doc.pages || {})) {
        const cur = totals.get(key) || { count: 0, duration_sec: 0 };
        cur.count += v.n || 0;
        cur.duration_sec += v.d || 0;
        totals.set(key, cur);
      }
    } else {
      for (const [key, n] of Object.entries(doc.api || {})) {
        const cur = totals.get(key) || { count: 0 };
        cur.count += n || 0;
        totals.set(key, cur);
      }
    }
  }
  const grand = [...totals.values()].reduce((sum, v) => sum + v.count, 0);
  const items = [...totals.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, Number(limit))
    .map(([key, v]) => ({
      key,
      count: v.count,
      share_pct: grand ? round((v.count / grand) * 100) : 0,
      ...(kind === "page"
        ? {
            total_duration_sec: v.duration_sec,
            avg_duration_sec: v.count ? Math.round(v.duration_sec / v.count) : 0,
          }
        : {}),
    }));
  return ok("Usage breakdown retrieved", {
    ...userIdentity(user),
    month,
    kind,
    // Breakdown maps are attributed to UTC days; `tz` does not apply here.
    basis: "utc_day",
    total: grand,
    items,
  });
};

const userTimeline = async (request) => {
  const tenant = tenantOf(request);
  const { userId } = request.params;
  const { date, tz = "UTC" } = request.query;
  const zone = getZone(tz);
  if (!zone) return fail(httpStatus.BAD_REQUEST, "Invalid timezone", `unknown tz "${tz}"`);
  const user = await findUser(tenant, userId);
  if (!user) return notFoundUser();

  const docs = await userDocs(tenant, userId, addDays(date, -1), addDays(date, 1), {
    day: 1,
    page_hours: 1,
    api_hours: 1,
    pages: 1,
    api: 1,
    sessions: 1,
    duration_sec: 1,
  });
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, page_views: 0, api_calls: 0 }));
  forEachHour(docs, zone, (local, counts) => {
    if (local.date !== date) return;
    hours[local.hour].page_views += counts.page_views;
    hours[local.hour].api_calls += counts.api_calls;
  });
  const dayDoc = docs.find((d) => d.day === date);
  const top = (obj, pick) =>
    Object.entries(obj || {})
      .map(([key, v]) => ({ key, count: pick(v) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  return ok("Usage timeline retrieved", {
    ...userIdentity(user),
    date,
    tz,
    page_views: hours.reduce((s, h) => s + h.page_views, 0),
    api_calls: hours.reduce((s, h) => s + h.api_calls, 0),
    hours,
    // Top lists come from the UTC day document with the same date.
    top_pages: top(dayDoc && dayDoc.pages, (v) => v.n || 0),
    top_endpoints: top(dayDoc && dayDoc.api, (v) => v || 0),
  });
};

const userRhythm = async (request) => {
  const tenant = tenantOf(request);
  const { userId } = request.params;
  const { from, to, tz = "UTC", metric = "activity" } = request.query;
  const zone = getZone(tz);
  if (!zone) return fail(httpStatus.BAD_REQUEST, "Invalid timezone", `unknown tz "${tz}"`);
  const user = await findUser(tenant, userId);
  if (!user) return notFoundUser();

  const end = to || localToday(tz);
  const start = from || addDays(end, -89);
  if (start > end) return fail(httpStatus.BAD_REQUEST, "Invalid range", "from must not be after to");
  if (eachDate(start, end).length > MAX_CALENDAR_DAYS) {
    return fail(httpStatus.BAD_REQUEST, "Range too large", `range cannot exceed ${MAX_CALENDAR_DAYS} days`);
  }
  const docs = await userDocs(tenant, userId, addDays(start, -1), addDays(end, 1), {
    day: 1,
    page_hours: 1,
    api_hours: 1,
  });
  // matrix[weekday 0=Mon..6=Sun][hour 0..23]
  const matrix = Array.from({ length: 7 }, () => new Array(24).fill(0));
  forEachHour(docs, zone, (local, counts) => {
    if (local.date < start || local.date > end) return;
    matrix[local.weekday][local.hour] += metricValue(counts, metric);
  });
  return ok("Usage rhythm retrieved", {
    ...userIdentity(user),
    from: start,
    to: end,
    tz,
    metric,
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    matrix,
  });
};

// ── Platform-wide aggregation ────────────────────────────────────────────────
const dayMatch = (tenant, start, end, scope, extra = {}) => ({
  tenant,
  day: { $gte: start, $lte: end },
  ...scopeFilter(scope),
  ...extra,
});

const aggregateDaily = async (tenant, start, end, scope) => {
  const rows = await UserUsageDailyModel(tenant)
    .aggregate([
      { $match: dayMatch(tenant, start, end, scope) },
      {
        $group: {
          _id: "$day",
          active_users: { $sum: 1 },
          page_views: { $sum: "$page_views" },
          api_calls: { $sum: "$api_calls" },
          sessions: { $sum: "$sessions" },
        },
      },
    ])
    .allowDiskUse(true);
  return new Map(rows.map((r) => [r._id, r]));
};

/** Daily totals for [start, end]; closed days are read from / stored in the cache. */
const getDailyTotals = async (tenant, start, end, scope) => {
  const dates = eachDate(start, end);
  const today = utcToday();
  const Summary = UsageSummaryModel(tenant);
  const cached = await Summary.find(
    { tenant, period: "day", scope, key: { $in: dates } },
    { key: 1, data: 1 },
  ).lean();
  const byKey = new Map(cached.map((c) => [c.key, c.data]));
  const missing = dates.filter((d) => !byKey.has(d));

  if (missing.length) {
    const fresh = await aggregateDaily(tenant, missing[0], missing[missing.length - 1], scope);
    const toStore = [];
    for (const date of missing) {
      const row = fresh.get(date);
      const data = {
        active_users: row ? row.active_users : 0,
        page_views: row ? row.page_views : 0,
        api_calls: row ? row.api_calls : 0,
        sessions: row ? row.sessions : 0,
      };
      byKey.set(date, data);
      if (date < today) {
        toStore.push({
          updateOne: {
            filter: { tenant, period: "day", scope, key: date },
            update: {
              $set: { data },
              $setOnInsert: {
                expireAt: moment
                  .utc(date, "YYYY-MM-DD")
                  .add(constants.USAGE_RETENTION_MONTHS, "months")
                  .toDate(),
              },
            },
            upsert: true,
          },
        });
      }
    }
    if (toStore.length) {
      await Summary.bulkWrite(toStore, { ordered: false }).catch((error) =>
        logger.warn(`day summary cache write failed: ${error.message}`),
      );
    }
  }
  return dates.map((date) => ({ date, ...byKey.get(date) }));
};

const aggregateTopKeys = async (tenant, start, end, scope) => {
  const Daily = UserUsageDailyModel(tenant);
  const match = (field) => ({
    $match: dayMatch(tenant, start, end, scope, { [field]: { $type: "object" } }),
  });
  const [pages, api] = await Promise.all([
    Daily.aggregate([
      match("pages"),
      { $project: { user_id: 1, items: { $objectToArray: "$pages" } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: { k: "$items.k", u: "$user_id" },
          n: { $sum: "$items.v.n" },
          d: { $sum: "$items.v.d" },
        },
      },
      {
        $group: {
          _id: "$_id.k",
          count: { $sum: "$n" },
          total_duration_sec: { $sum: "$d" },
          users: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
      { $limit: TOP_KEYS_STORED },
    ]).allowDiskUse(true),
    Daily.aggregate([
      match("api"),
      { $project: { user_id: 1, items: { $objectToArray: "$api" } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: { k: "$items.k", u: "$user_id" },
          n: { $sum: "$items.v" },
        },
      },
      {
        $group: { _id: "$_id.k", count: { $sum: "$n" }, users: { $sum: 1 } },
      },
      { $sort: { count: -1, _id: 1 } },
      { $limit: TOP_KEYS_STORED },
    ]).allowDiskUse(true),
  ]);
  return {
    pages: pages.map((p) => ({
      key: p._id,
      count: p.count,
      users: p.users,
      total_duration_sec: p.total_duration_sec,
    })),
    endpoints: api.map((p) => ({ key: p._id, count: p.count, users: p.users })),
  };
};

const activeUserIds = async (tenant, start, end, scope) =>
  (
    await UserUsageDailyModel(tenant).distinct(
      "user_id",
      dayMatch(tenant, start, end, scope),
    )
  ).map(String);

const computeMonthly = async (tenant, month, scope) => {
  const bounds = monthBounds(month);
  const prev = monthBounds(bounds.previous);
  const Daily = UserUsageDailyModel(tenant);
  const [totals] = await Daily.aggregate([
    { $match: dayMatch(tenant, bounds.start, bounds.end, scope) },
    {
      $group: {
        _id: null,
        page_views: { $sum: "$page_views" },
        api_calls: { $sum: "$api_calls" },
        sessions: { $sum: "$sessions" },
        duration_sec: { $sum: "$duration_sec" },
        active_user_days: { $sum: 1 },
      },
    },
  ]).allowDiskUse(true);

  const [current, previous, top, newUsers] = await Promise.all([
    activeUserIds(tenant, bounds.start, bounds.end, scope),
    activeUserIds(tenant, prev.start, prev.end, scope),
    aggregateTopKeys(tenant, bounds.start, bounds.end, scope),
    UserUsageProfileModel(tenant).countDocuments({
      tenant,
      first_seen: {
        $gte: new Date(`${bounds.start}T00:00:00Z`),
        $lt: new Date(Date.parse(`${bounds.end}T00:00:00Z`) + MS_PER_DAY),
      },
      ...scopeFilter(scope),
    }),
  ]);
  const currentSet = new Set(current);
  const previousSet = new Set(previous);
  const returning = current.filter((id) => previousSet.has(id)).length;
  const dormant = previous.filter((id) => !currentSet.has(id)).length;

  return {
    month,
    mau: current.length,
    page_views: totals ? totals.page_views : 0,
    api_calls: totals ? totals.api_calls : 0,
    sessions: totals ? totals.sessions : 0,
    duration_sec: totals ? totals.duration_sec : 0,
    active_user_days: totals ? totals.active_user_days : 0,
    lifecycle: {
      new: newUsers,
      returning,
      // Active now, inactive last month, and not brand new.
      resurrected: Math.max(current.length - returning - newUsers, 0),
      dormant,
    },
    top_pages: top.pages,
    top_endpoints: top.endpoints,
  };
};

/** Closed months are computed once and cached; the open month is memoised briefly. */
const getMonthly = async (tenant, month, scope) => {
  const bounds = monthBounds(month);
  if (bounds.end >= utcToday()) {
    return memoized(`monthly|${tenant}|${month}|${scope}`, () =>
      computeMonthly(tenant, month, scope),
    );
  }
  const Summary = UsageSummaryModel(tenant);
  const filter = { tenant, period: "month", key: month, scope };
  const hit = await Summary.findOne(filter, { data: 1 }).lean();
  if (hit) return hit.data;
  const data = await computeMonthly(tenant, month, scope);
  await Summary.updateOne(filter, { $set: { data } }, { upsert: true }).catch((error) =>
    logger.warn(`month summary cache write failed: ${error.message}`),
  );
  return data;
};

const usageOverview = async (request) => {
  const tenant = tenantOf(request);
  const scope = scopeOf(request);
  const { month } = request.query;
  const bounds = monthBounds(month);
  const today = utcToday();
  const lastDay = bounds.end < today ? bounds.end : today;
  if (bounds.start > today) {
    return fail(httpStatus.BAD_REQUEST, "Month is in the future", "month cannot be after the current month");
  }

  const [series, current, previous] = await Promise.all([
    getDailyTotals(tenant, bounds.start, lastDay, scope),
    getMonthly(tenant, month, scope),
    getMonthly(tenant, bounds.previous, scope),
  ]);
  const avgDau = series.length
    ? series.reduce((sum, d) => sum + d.active_users, 0) / series.length
    : 0;
  const peak = series.reduce(
    (best, d) => (d.active_users > best.active_users ? d : best),
    { date: null, active_users: 0 },
  );

  return ok("Usage overview retrieved", {
    month,
    scope,
    // Platform-wide metrics are bucketed by UTC day.
    basis: "utc_day",
    mau: current.mau,
    avg_dau: round(avgDau),
    peak_dau: { date: peak.date, active_users: peak.active_users },
    stickiness_pct: current.mau ? round((avgDau / current.mau) * 100) : null,
    page_views: current.page_views,
    api_calls: current.api_calls,
    sessions: current.sessions,
    lifecycle: current.lifecycle,
    change_pct: {
      mau: changePct(current.mau, previous.mau),
      page_views: changePct(current.page_views, previous.page_views),
      api_calls: changePct(current.api_calls, previous.api_calls),
      sessions: changePct(current.sessions, previous.sessions),
    },
    previous_month: {
      month: bounds.previous,
      mau: previous.mau,
      page_views: previous.page_views,
      api_calls: previous.api_calls,
      sessions: previous.sessions,
    },
    daily: series,
  });
};

const usagePages = async (request) => {
  const tenant = tenantOf(request);
  const scope = scopeOf(request);
  const { month, kind = "page", limit = 20 } = request.query;
  const monthly = await getMonthly(tenant, month, scope);
  const source = kind === "page" ? monthly.top_pages : monthly.top_endpoints;
  const grand = source.reduce((sum, i) => sum + i.count, 0);
  const items = source.slice(0, Number(limit)).map((i) => ({
    key: i.key,
    count: i.count,
    unique_users: i.users,
    adoption_pct: monthly.mau ? round((i.users / monthly.mau) * 100) : null,
    share_pct: grand ? round((i.count / grand) * 100) : 0,
    ...(kind === "page"
      ? {
          avg_duration_sec: i.count ? Math.round(i.total_duration_sec / i.count) : 0,
        }
      : {}),
  }));
  return ok("Usage pages retrieved", {
    month,
    kind,
    scope,
    mau: monthly.mau,
    basis: "utc_day",
    items,
  });
};

const USER_SORT_FIELDS = {
  active_days: "active_days",
  page_views: "page_views",
  api_calls: "api_calls",
  sessions: "sessions",
  total_actions: "total_actions",
  last_active: "last_active_day",
};

const csvCell = (value) => {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const usageUsers = async (request) => {
  const tenant = tenantOf(request);
  const scope = scopeOf(request);
  const {
    month,
    sort = "total_actions",
    order = "desc",
    search,
    format,
  } = request.query;
  const page = Math.max(parseInt(request.query.page, 10) || 1, 1);
  const isCsv = format === "csv";
  const limit = isCsv
    ? CSV_MAX_ROWS
    : Math.min(Math.max(parseInt(request.query.limit, 10) || 25, 1), 100);
  const bounds = monthBounds(month);

  let idFilter = {};
  if (search) {
    const re = new RegExp(escapeRegex(String(search).trim()), "i");
    const matches = await UserModel(tenant)
      .find(
        { $or: [{ email: re }, { firstName: re }, { lastName: re }, { userName: re }] },
        { _id: 1 },
      )
      .limit(500)
      .lean();
    if (!matches.length) {
      return ok("Usage users retrieved", { month, page, limit, total: 0, users: [] });
    }
    idFilter = { user_id: { $in: matches.map((m) => m._id) } };
  }

  const sortField = USER_SORT_FIELDS[sort] || "total_actions";
  const [result] = await UserUsageDailyModel(tenant)
    .aggregate([
      { $match: dayMatch(tenant, bounds.start, bounds.end, scope, idFilter) },
      {
        $group: {
          _id: "$user_id",
          active_days: { $sum: 1 },
          page_views: { $sum: "$page_views" },
          api_calls: { $sum: "$api_calls" },
          sessions: { $sum: "$sessions" },
          duration_sec: { $sum: "$duration_sec" },
          last_active_day: { $max: "$day" },
          ...(isCsv
            ? {}
            : {
                daily: {
                  $push: { d: "$day", n: { $add: ["$page_views", "$api_calls"] } },
                },
              }),
        },
      },
      { $addFields: { total_actions: { $add: ["$page_views", "$api_calls"] } } },
      { $sort: { [sortField]: order === "asc" ? 1 : -1, _id: 1 } },
      {
        $facet: {
          rows: [{ $skip: isCsv ? 0 : (page - 1) * limit }, { $limit: limit }],
          total: [{ $count: "n" }],
        },
      },
    ])
    .allowDiskUse(true);

  const rows = result.rows;
  const total = result.total[0] ? result.total[0].n : 0;
  const ids = rows.map((r) => r._id);
  const [users, profiles] = await Promise.all([
    UserModel(tenant)
      .find({ _id: { $in: ids } }, { email: 1, firstName: 1, lastName: 1, userName: 1 })
      .lean(),
    UserUsageProfileModel(tenant)
      .find({ tenant, user_id: { $in: ids } }, { user_id: 1, first_seen: 1, last_seen: 1 })
      .lean(),
  ]);
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const profileById = new Map(profiles.map((p) => [String(p.user_id), p]));
  const days = eachDate(bounds.start, bounds.end);

  const list = rows.map((r) => {
    const id = String(r._id);
    const user = userById.get(id);
    const profile = profileById.get(id);
    const row = {
      user_id: id,
      email: user ? user.email : null,
      name: user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.userName || null
        : null,
      active_days: r.active_days,
      total_actions: r.total_actions,
      page_views: r.page_views,
      api_calls: r.api_calls,
      sessions: r.sessions,
      total_time_sec: r.duration_sec,
      last_active_day: r.last_active_day,
      first_seen: profile ? profile.first_seen : null,
      last_seen: profile ? profile.last_seen : null,
    };
    if (!isCsv) {
      const perDay = new Map(r.daily.map((d) => [d.d, d.n]));
      row.sparkline = days.map((d) => perDay.get(d) || 0);
    }
    return row;
  });

  if (isCsv) {
    const columns = [
      "user_id", "email", "name", "active_days", "total_actions", "page_views",
      "api_calls", "sessions", "total_time_sec", "last_active_day", "first_seen", "last_seen",
    ];
    const lines = [columns.join(",")].concat(
      list.map((row) =>
        columns
          .map((c) => csvCell(row[c] instanceof Date ? row[c].toISOString() : row[c]))
          .join(","),
      ),
    );
    return {
      success: true,
      status: httpStatus.OK,
      csv: lines.join("\n"),
      filename: `nexus-usage-${month}.csv`,
    };
  }
  return ok("Usage users retrieved", {
    month,
    scope,
    basis: "utc_day",
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
    sort: sortField,
    order: order === "asc" ? "asc" : "desc",
    users: list,
  });
};

const usageRetention = async (request) => {
  const tenant = tenantOf(request);
  const scope = scopeOf(request);
  const months = Math.min(Math.max(parseInt(request.query.months, 10) || 6, 1), 12);
  return memoized(`retention|${tenant}|${scope}|${months}`, () =>
    computeRetention(tenant, scope, months),
  );
};

const computeRetention = async (tenant, scope, months) => {
  const currentMonth = moment.utc().format("YYYY-MM");
  const cohortMonths = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    cohortMonths.push(moment.utc(currentMonth, "YYYY-MM").subtract(i, "months").format("YYYY-MM"));
  }

  const activeSets = new Map();
  const activeSetFor = async (month) => {
    if (!activeSets.has(month)) {
      const b = monthBounds(month);
      activeSets.set(month, new Set(await activeUserIds(tenant, b.start, b.end, scope)));
    }
    return activeSets.get(month);
  };

  const cohorts = [];
  for (const cohortMonth of cohortMonths) {
    const b = monthBounds(cohortMonth);
    const profiles = await UserUsageProfileModel(tenant)
      .find(
        {
          tenant,
          first_seen: {
            $gte: new Date(`${b.start}T00:00:00Z`),
            $lt: new Date(Date.parse(`${b.end}T00:00:00Z`) + MS_PER_DAY),
          },
          ...scopeFilter(scope),
        },
        { user_id: 1 },
      )
      .lean();
    const ids = profiles.map((p) => String(p.user_id));
    const retention = [];
    for (
      let m = cohortMonth, offset = 0;
      m <= currentMonth;
      m = moment.utc(m, "YYYY-MM").add(1, "month").format("YYYY-MM"), offset += 1
    ) {
      const active = await activeSetFor(m);
      const retained = ids.filter((id) => active.has(id)).length;
      retention.push({
        offset,
        month: m,
        active: retained,
        rate_pct: ids.length ? round((retained / ids.length) * 100) : null,
      });
    }
    cohorts.push({ cohort: cohortMonth, size: ids.length, retention });
  }
  return ok("Usage retention retrieved", {
    scope,
    // Cohorts are defined by each user's first recorded usage, not signup date.
    cohort_basis: "first_recorded_usage",
    months,
    cohorts,
  });
};


module.exports = {
  userCalendar,
  userSummary,
  userBreakdown,
  userTimeline,
  userRhythm,
  usageOverview,
  usagePages,
  usageUsers,
  usageRetention,
  // exported for tests and the rollup job
  addDays,
  eachDate,
  monthBounds,
  localParts,
  bucketByLocalDate,
  computeThresholds,
  levelFor,
  computeStreaks,
  getDailyTotals,
  getMonthly,
  csvCell,
  changePct,
};
