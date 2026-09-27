const mongoose = require("mongoose");
const moment = require("moment-timezone");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const ApiKeyUsageDailyModel = require("@models/ApiKeyUsageDaily");
const ClientModel = require("@models/Client");
const AccessTokenModel = require("@models/AccessToken");
const UserModel = require("@models/User");
const { addDays, eachDate, daySpan, csvCell } = require("@utils/usage.util");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- api-key-usage-util`);

/**
 * Admin views over api_key_usage_daily: which API keys generate the most
 * traffic, how that traffic moves over time, and where a single key's calls
 * go (services, routes, hours, IPs). All dates are UTC days.
 */

const DEFAULT_RANGE_DAYS = 7;
const MAX_RANGE_DAYS = 92;
const MAX_HOURLY_RANGE_DAYS = 14;
const DEFAULT_TOP_SERIES = 5;
const DETAIL_TOP_ROUTES = 50;
const DETAIL_TOP_IPS = 20;
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

const tenantOf = (request) =>
  String(
    (request.query && request.query.tenant) || constants.DEFAULT_TENANT || "airqo",
  ).toLowerCase();

const utcToday = () => moment.utc().format("YYYY-MM-DD");

/** Resolves ?from/?to into an inclusive UTC day range, or a 400 result. */
const resolveRange = (query, maxDays = MAX_RANGE_DAYS) => {
  const to = query.to || utcToday();
  const from = query.from || addDays(to, -(DEFAULT_RANGE_DAYS - 1));
  if (from > to) {
    return { error: fail(httpStatus.BAD_REQUEST, "from must not be after to") };
  }
  if (daySpan(from, to) > maxDays) {
    return {
      error: fail(
        httpStatus.BAD_REQUEST,
        `date range must not exceed ${maxDays} days`,
      ),
    };
  }
  return { from, to };
};

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

/** Calls field to rank/sum on: all calls, or one service's calls. */
const callsExpr = (service) =>
  service ? { $ifNull: [`$services.${service}`, 0] } : "$calls";

const baseMatch = (tenant, from, to, { service, userId } = {}) => {
  const match = { tenant, day: { $gte: from, $lte: to } };
  if (service) match[`services.${service}`] = { $gt: 0 };
  if (userId) match.user_id = toObjectId(userId);
  return match;
};

const addInto = (target, source) => {
  if (!source) return target;
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "number") target[key] = (target[key] || 0) + value;
  }
  return target;
};

const topEntries = (map, limit, keyName) =>
  Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, calls]) => ({ [keyName]: key, calls }));

const pct = (part, whole) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

/**
 * Stored IP keys have "." replaced by "_" (Mongo key rules); undo that for
 * IPv4 and IPv4-mapped IPv6 ("::ffff:1_2_3_4").
 */
const decodeIp = (key) =>
  /^([0-9a-f:]*:)?\d{1,3}(_\d{1,3}){3}$/i.test(key) ? key.replace(/_/g, ".") : key;

/**
 * Looks up display identity for a set of client ids: key name, tier and
 * status from the token, and the owner's name/email. Never returns the token.
 */
const resolveIdentities = async (tenant, clientIds) => {
  const ids = clientIds.map(toObjectId);
  const [clients, tokens] = await Promise.all([
    ClientModel(tenant)
      .find({ _id: { $in: ids } })
      .select("name user_id isActive")
      .lean(),
    AccessTokenModel(tenant)
      .find({ client_id: { $in: ids } })
      .select("client_id name tier expires last_used_at request_pattern.auto_suspended")
      .lean(),
  ]);
  const userIds = [
    ...new Set(clients.map((c) => c.user_id).filter(Boolean).map(String)),
  ];
  const users = userIds.length
    ? await UserModel(tenant)
        .find({ _id: { $in: userIds.map(toObjectId) } })
        .select("email firstName lastName")
        .lean()
    : [];
  const clientById = new Map(clients.map((c) => [String(c._id), c]));
  const tokenByClient = new Map(tokens.map((t) => [String(t.client_id), t]));
  const userById = new Map(users.map((u) => [String(u._id), u]));

  const identities = new Map();
  for (const clientId of clientIds) {
    const client = clientById.get(String(clientId));
    const token = tokenByClient.get(String(clientId));
    const user = client && client.user_id && userById.get(String(client.user_id));
    identities.set(String(clientId), {
      client_id: String(clientId),
      client_name: client ? client.name : null,
      key_name: token ? token.name : null,
      tier: token ? token.tier || "Free" : null,
      client_active: client ? client.isActive !== false : false,
      auto_suspended: !!(token && token.request_pattern && token.request_pattern.auto_suspended),
      key_expires: token ? token.expires || null : null,
      deleted: !client,
      owner: user
        ? {
            user_id: String(user._id),
            email: user.email || null,
            name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
          }
        : null,
    });
  }
  return identities;
};

// ── Leaderboard ──────────────────────────────────────────────────────────────

const SORT_FIELDS = {
  calls: "calls",
  active_days: "active_days",
  peak_day_calls: "peak_day_calls",
  last_used: "last_at",
};

/**
 * GET /usage/api-keys — keys ranked by calls over a date range, with each
 * key's share of all key traffic so load can be apportioned.
 */
const listApiKeys = async (request) => {
  try {
    const tenant = tenantOf(request);
    const q = request.query;
    const range = resolveRange(q);
    if (range.error) return range.error;
    const { from, to } = range;
    const service = q.service || null;
    const limit = Number(q.limit) || 20;
    const page = Number(q.page) || 1;
    const isCsv = q.format === "csv";
    const sortField = SORT_FIELDS[q.sort] || "calls";
    const order = q.order === "asc" ? 1 : -1;
    const Model = ApiKeyUsageDailyModel(tenant);
    const match = baseMatch(tenant, from, to, { service, userId: q.user_id });
    const calls = callsExpr(service);

    const [result] = await Model.aggregate([
      { $match: match },
      { $sort: { last_at: 1 } },
      {
        $group: {
          _id: "$client_id",
          user_id: { $last: "$user_id" },
          calls: { $sum: calls },
          active_days: { $sum: 1 },
          peak_day_calls: { $max: calls },
          first_at: { $min: "$first_at" },
          last_at: { $max: "$last_at" },
          last_ip: { $last: "$last_ip" },
        },
      },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                keys: { $sum: 1 },
                calls: { $sum: "$calls" },
              },
            },
          ],
          rows: [
            { $sort: { [sortField]: order, _id: 1 } },
            ...(isCsv
              ? [{ $limit: CSV_MAX_ROWS }]
              : [{ $skip: (page - 1) * limit }, { $limit: limit }]),
          ],
        },
      },
    ]).allowDiskUse(true);

    const totals = (result && result.totals[0]) || { keys: 0, calls: 0 };
    const rows = (result && result.rows) || [];
    const clientIds = rows.map((r) => String(r._id));

    // Per-key service mix for the rows on this page.
    const serviceDocs = clientIds.length
      ? await Model.find(
          { ...match, client_id: { $in: clientIds.map(toObjectId) } },
          { client_id: 1, services: 1 },
        ).lean()
      : [];
    const servicesByClient = new Map();
    for (const doc of serviceDocs) {
      const key = String(doc.client_id);
      if (!servicesByClient.has(key)) servicesByClient.set(key, {});
      addInto(servicesByClient.get(key), doc.services);
    }

    const identities = await resolveIdentities(tenant, clientIds);
    const keys = rows.map((row, index) => ({
      rank: (isCsv ? 0 : (page - 1) * limit) + index + 1,
      ...identities.get(String(row._id)),
      calls: row.calls,
      share_pct: pct(row.calls, totals.calls),
      active_days: row.active_days,
      avg_calls_per_active_day: Math.round(row.calls / (row.active_days || 1)),
      peak_day_calls: row.peak_day_calls,
      services: servicesByClient.get(String(row._id)) || {},
      first_seen: row.first_at || null,
      last_seen: row.last_at || null,
      last_ip: row.last_ip || null,
    }));

    if (isCsv) {
      const header = [
        "rank", "client_id", "key_name", "tier", "owner_email", "owner_name",
        "calls", "share_pct", "active_days", "avg_calls_per_active_day",
        "peak_day_calls", "top_service", "last_seen", "last_ip",
      ];
      const lines = [header.join(",")];
      for (const k of keys) {
        const [topService] = topEntries(k.services, 1, "service");
        lines.push(
          [
            k.rank, k.client_id, k.key_name, k.tier,
            k.owner && k.owner.email, k.owner && k.owner.name,
            k.calls, k.share_pct, k.active_days, k.avg_calls_per_active_day,
            k.peak_day_calls, topService ? topService.service : "",
            k.last_seen ? new Date(k.last_seen).toISOString() : "", k.last_ip,
          ]
            .map(csvCell)
            .join(","),
        );
      }
      return {
        success: true,
        status: httpStatus.OK,
        csv: lines.join("\n"),
        filename: `api-key-usage-${from}-to-${to}${service ? `-${service}` : ""}.csv`,
      };
    }

    return ok("API key usage retrieved", {
      range: { from, to, days: daySpan(from, to) },
      service,
      totals: { keys: totals.keys, calls: totals.calls },
      keys,
      meta: {
        page,
        limit,
        total: totals.keys,
        pages: Math.max(1, Math.ceil(totals.keys / limit)),
      },
    });
  } catch (error) {
    logger.error(`listApiKeys failed: ${error.message}`);
    return fail(httpStatus.INTERNAL_SERVER_ERROR, "Internal Server Error", error.message);
  }
};

// ── Timeseries (graph) ───────────────────────────────────────────────────────

const hourLabels = (from, to) => {
  const labels = [];
  for (const day of eachDate(from, to)) {
    for (let h = 0; h < 24; h += 1) {
      labels.push(`${day}T${String(h).padStart(2, "0")}:00:00Z`);
    }
  }
  return labels;
};

/**
 * GET /usage/api-keys/timeseries — calls per day (or UTC hour) for the top N
 * keys, everyone else as "other", and the overall total, ready for a stacked
 * chart. Pass client_id to chart specific keys instead of the top N.
 */
const apiKeysTimeseries = async (request) => {
  try {
    const tenant = tenantOf(request);
    const q = request.query;
    const interval = q.interval === "hour" ? "hour" : "day";
    const service = q.service || null;
    if (interval === "hour" && service) {
      return fail(
        httpStatus.BAD_REQUEST,
        "service filter is only available with interval=day",
        "Hourly counts are recorded per key across all services, not per service",
      );
    }
    const range = resolveRange(
      q,
      interval === "hour" ? MAX_HOURLY_RANGE_DAYS : MAX_RANGE_DAYS,
    );
    if (range.error) return range.error;
    const { from, to } = range;
    const top = Number(q.top) || DEFAULT_TOP_SERIES;
    const Model = ApiKeyUsageDailyModel(tenant);
    const match = baseMatch(tenant, from, to, { service, userId: q.user_id });
    const calls = callsExpr(service);

    let selected = [];
    if (q.client_id) {
      selected = [...new Set(String(q.client_id).split(",").map((s) => s.trim()))];
    } else {
      const ranked = await Model.aggregate([
        { $match: match },
        { $group: { _id: "$client_id", calls: { $sum: calls } } },
        { $sort: { calls: -1, _id: 1 } },
        { $limit: top },
      ]);
      selected = ranked.map((r) => String(r._id));
    }

    const labels = interval === "hour" ? hourLabels(from, to) : eachDate(from, to);
    const indexOf = new Map(labels.map((label, i) => [label, i]));
    const zeros = () => new Array(labels.length).fill(0);
    const seriesData = new Map(selected.map((id) => [id, zeros()]));
    const total = zeros();

    const projection =
      interval === "hour"
        ? { client_id: 1, day: 1, hours: 1 }
        : { client_id: 1, day: 1, calls: 1, services: 1 };
    const cursor = Model.find(match, projection).lean().cursor();
    for await (const doc of cursor) {
      const series = seriesData.get(String(doc.client_id));
      if (interval === "hour") {
        for (const [hour, value] of Object.entries(doc.hours || {})) {
          const i = indexOf.get(`${doc.day}T${String(hour).padStart(2, "0")}:00:00Z`);
          if (i === undefined) continue;
          total[i] += value;
          if (series) series[i] += value;
        }
      } else {
        const i = indexOf.get(doc.day);
        if (i === undefined) continue;
        const value = service
          ? (doc.services && doc.services[service]) || 0
          : doc.calls || 0;
        total[i] += value;
        if (series) series[i] += value;
      }
    }

    const identities = await resolveIdentities(tenant, selected);
    const series = selected.map((id) => {
      const identity = identities.get(id);
      const data = seriesData.get(id);
      return {
        client_id: id,
        label:
          identity.key_name ||
          identity.client_name ||
          (identity.owner && identity.owner.email) ||
          id,
        owner_email: identity.owner ? identity.owner.email : null,
        total: data.reduce((a, b) => a + b, 0),
        data,
      };
    });
    const other = total.map(
      (value, i) => value - series.reduce((sum, s) => sum + s.data[i], 0),
    );

    return ok("API key usage timeseries retrieved", {
      range: { from, to, days: daySpan(from, to) },
      interval,
      service,
      labels,
      series,
      other: q.client_id ? null : other,
      total,
    });
  } catch (error) {
    logger.error(`apiKeysTimeseries failed: ${error.message}`);
    return fail(httpStatus.INTERNAL_SERVER_ERROR, "Internal Server Error", error.message);
  }
};

// ── Single-key drill-down ────────────────────────────────────────────────────

/**
 * GET /usage/api-keys/:clientId — one key's traffic: daily calls, service mix,
 * top routes, UTC hour-of-day profile and source IPs.
 */
const apiKeyDetail = async (request) => {
  try {
    const tenant = tenantOf(request);
    const { clientId } = request.params;
    const range = resolveRange(request.query);
    if (range.error) return range.error;
    const { from, to } = range;

    const identities = await resolveIdentities(tenant, [clientId]);
    const identity = identities.get(String(clientId));
    const docs = await ApiKeyUsageDailyModel(tenant)
      .find({ tenant, client_id: toObjectId(clientId), day: { $gte: from, $lte: to } })
      .lean();
    if (identity.deleted && docs.length === 0) {
      return fail(httpStatus.NOT_FOUND, "API client not found");
    }

    const byDay = new Map(docs.map((d) => [d.day, d.calls || 0]));
    const services = {};
    const routes = {};
    const hours = {};
    const ips = {};
    let calls = 0;
    let lastSeen = null;
    let lastIp = null;
    for (const doc of docs) {
      calls += doc.calls || 0;
      addInto(services, doc.services);
      addInto(routes, doc.api);
      addInto(hours, doc.hours);
      addInto(ips, doc.ips);
      if (doc.last_at && (!lastSeen || doc.last_at > lastSeen)) {
        lastSeen = doc.last_at;
        lastIp = doc.last_ip || lastIp;
      }
    }

    return ok("API key usage detail retrieved", {
      range: { from, to, days: daySpan(from, to) },
      key: identity,
      totals: {
        calls,
        active_days: docs.length,
        peak_day_calls: docs.reduce((m, d) => Math.max(m, d.calls || 0), 0),
        last_seen: lastSeen,
        last_ip: lastIp,
      },
      daily: eachDate(from, to).map((day) => ({ day, calls: byDay.get(day) || 0 })),
      services: topEntries(services, Infinity, "service").map((s) => ({
        ...s,
        share_pct: pct(s.calls, calls),
      })),
      routes: topEntries(routes, DETAIL_TOP_ROUTES, "route").map((r) => {
        const [method, ...rest] = r.route.split(" ");
        return rest.length
          ? { method, path: rest.join(" "), calls: r.calls, share_pct: pct(r.calls, calls) }
          : { method: null, path: r.route, calls: r.calls, share_pct: pct(r.calls, calls) };
      }),
      hours_utc: Array.from({ length: 24 }, (_, h) => ({ hour: h, calls: hours[h] || 0 })),
      ips: topEntries(ips, DETAIL_TOP_IPS, "ip").map((i) => ({
        ip: decodeIp(i.ip),
        calls: i.calls,
      })),
    });
  } catch (error) {
    logger.error(`apiKeyDetail failed: ${error.message}`);
    return fail(httpStatus.INTERNAL_SERVER_ERROR, "Internal Server Error", error.message);
  }
};

module.exports = {
  listApiKeys,
  apiKeysTimeseries,
  apiKeyDetail,
  // exported for tests
  resolveRange,
  decodeIp,
  hourLabels,
};
