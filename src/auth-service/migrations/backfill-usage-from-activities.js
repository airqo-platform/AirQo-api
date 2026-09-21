require("module-alias/register");
const moment = require("moment-timezone");
const constants = require("@config/constants");
const ActivityModel = require("@models/Activity");
const UserModel = require("@models/User");
const UserUsageDailyModel = require("@models/UserUsageDaily");
const UserUsageProfileModel = require("@models/UserUsageProfile");
const { connectToMongoDB } = require("@config/database");
const {
  normalisePath,
  isInternalEmail,
} = require("@utils/usage-recorder.util");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- backfill-usage-from-activities`,
);

/**
 * Seeds user_usage_daily from the legacy per-user `activities` rollups so the
 * new admin views are not empty on day one.
 *
 *  - Idempotent: documents are written with $setOnInsert only, so re-running it
 *    (or running it after live recording has started) never overwrites or
 *    double-counts anything.
 *  - Legacy data has no method or hour resolution: endpoints are stored as
 *    "ANY <route template>" and the day's count is placed at 12:00 UTC, so the
 *    day stays the same for any viewer timezone between UTC-12 and UTC+12.
 *  - Days older than USAGE_RETENTION_MONTHS are skipped (the TTL would delete
 *    them immediately).
 *
 * Usage: node migrations/backfill-usage-from-activities.js [--apply] [--tenant=airqo]
 * Without --apply it only reports what it would write.
 */

const BATCH_SIZE = 200;
const MAX_KEYS = constants.USAGE_MAX_KEYS_PER_ENTRY;

const toDailyDocument = (dailyStat, cutoffDay) => {
  const day = new Date(dailyStat.date).toISOString().slice(0, 10);
  if (day < cutoffDay) return null;

  const counts = new Map();
  for (const endpoint of dailyStat.endpoints || []) {
    const path = normalisePath(endpoint.name);
    if (!path) continue;
    const key = `ANY ${path}`;
    counts.set(key, (counts.get(key) || 0) + (endpoint.count || 0));
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const api = {};
  ranked.forEach(([key, count], index) => {
    const target = index < MAX_KEYS ? key : "(other)";
    api[target] = (api[target] || 0) + count;
  });

  const total = dailyStat.totalActions || Object.values(api).reduce((s, n) => s + n, 0);
  if (!total) return null;
  return { day, api, api_calls: total, api_hours: { 12: total } };
};

const runBackfill = async ({ tenant = "airqo", apply = false } = {}) => {
  const summary = {
    activities_read: 0,
    users_matched: 0,
    users_unmatched: 0,
    days_prepared: 0,
    days_inserted: 0,
    profiles_touched: 0,
  };
  const cutoffDay = moment
    .utc()
    .subtract(constants.USAGE_RETENTION_MONTHS, "months")
    .format("YYYY-MM-DD");

  const cursor = ActivityModel(tenant)
    .find({ tenant }, { email: 1, dailyStats: 1 })
    .lean()
    .cursor({ batchSize: BATCH_SIZE });

  let batch = [];
  const flushBatch = async () => {
    if (!batch.length) return;
    const emails = batch.map((a) => a.email).filter(Boolean);
    const users = await UserModel(tenant)
      .find({ email: { $in: emails } }, { email: 1 })
      .lean();
    const userByEmail = new Map(users.map((u) => [u.email, u]));
    const dailyOps = [];
    const profileOps = [];

    for (const activity of batch) {
      const user = userByEmail.get(activity.email);
      if (!user) {
        summary.users_unmatched += 1;
        continue;
      }
      summary.users_matched += 1;
      const internal = isInternalEmail(user.email);
      const docs = (activity.dailyStats || [])
        .map((d) => toDailyDocument(d, cutoffDay))
        .filter(Boolean);
      if (!docs.length) continue;
      summary.days_prepared += docs.length;

      for (const doc of docs) {
        dailyOps.push({
          updateOne: {
            filter: { tenant, user_id: user._id, day: doc.day },
            update: {
              $setOnInsert: {
                page_views: 0,
                sessions: 0,
                duration_sec: 0,
                api: doc.api,
                api_calls: doc.api_calls,
                api_hours: doc.api_hours,
                internal,
                backfilled: true,
                expireAt: moment
                  .utc(doc.day, "YYYY-MM-DD")
                  .add(constants.USAGE_RETENTION_MONTHS, "months")
                  .toDate(),
              },
            },
            upsert: true,
          },
        });
      }
      const days = docs.map((d) => d.day).sort();
      profileOps.push({
        updateOne: {
          filter: { tenant, user_id: user._id },
          update: {
            $min: { first_seen: new Date(`${days[0]}T00:00:00Z`) },
            $max: { last_seen: new Date(`${days[days.length - 1]}T12:00:00Z`) },
            $setOnInsert: { internal },
          },
          upsert: true,
        },
      });
    }

    if (apply && dailyOps.length) {
      const result = await UserUsageDailyModel(tenant).bulkWrite(dailyOps, {
        ordered: false,
      });
      summary.days_inserted += result.upsertedCount || 0;
      await UserUsageProfileModel(tenant).bulkWrite(profileOps, { ordered: false });
      summary.profiles_touched += profileOps.length;
    }
    batch = [];
  };

  for await (const activity of cursor) {
    summary.activities_read += 1;
    batch.push(activity);
    if (batch.length >= BATCH_SIZE) await flushBatch();
  }
  await flushBatch();
  return { apply, ...summary };
};

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const apply = args.includes("--apply");
    const tenantArg = args.find((a) => a.startsWith("--tenant="));
    const tenant = tenantArg ? tenantArg.split("=")[1] : constants.DEFAULT_TENANT || "airqo";
    try {
      await connectToMongoDB();
      const summary = await runBackfill({ tenant, apply });
      console.log(JSON.stringify(summary, null, 2));
      if (!apply) console.log("Dry run only. Re-run with --apply to write.");
      process.exit(0);
    } catch (error) {
      logger.error(`Backfill failed: ${error.message}`);
      console.error(error);
      process.exit(1);
    }
  })();
}

module.exports = { runBackfill, toDailyDocument };
