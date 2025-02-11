const cron = require("node-cron");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- user-activity-job`
);
const { logObject, logText } = require("@utils/shared");

const { LogModel } = require("@models/log");
const ActivityModel = require("@models/Activity");

const BATCH_SIZE = 500;
const MAX_RETRIES = 3;
const CONCURRENT_BATCH_LIMIT = 5;

// Helper function for calculating engagement score
function calculateEngagementScore({
  totalActions,
  uniqueServices,
  uniqueEndpoints,
  activityDays,
}) {
  const actionsPerDay = totalActions / Math.max(activityDays, 30);
  const serviceDiversity = uniqueServices / 20; // Normalize against max expected services
  const endpointDiversity = Math.min(uniqueEndpoints / 10, 1);
  return (
    (actionsPerDay * 0.4 + serviceDiversity * 0.3 + endpointDiversity * 0.3) *
    100
  );
}

function calculateEngagementTier(score) {
  if (score >= 80) return "Elite User";
  if (score >= 65) return "Super User";
  if (score >= 45) return "High Engagement";
  if (score >= 25) return "Moderate Engagement";
  return "Low Engagement";
}

async function processDailyStats(logs) {
  const dailyGroups = new Map();

  for await (const log of logs) {
    const date = new Date(log.timestamp);
    date.setHours(0, 0, 0, 0);
    const dateKey = date.toISOString();

    if (!dailyGroups.has(dateKey)) {
      dailyGroups.set(dateKey, {
        date,
        totalActions: 0,
        services: new Map(),
        endpoints: new Map(),
      });
    }

    const dayStats = dailyGroups.get(dateKey);
    dayStats.totalActions++;

    dayStats.services.set(
      log.meta.service,
      (dayStats.services.get(log.meta.service) || 0) + 1
    );
    dayStats.endpoints.set(
      log.meta.endpoint,
      (dayStats.endpoints.get(log.meta.endpoint) || 0) + 1
    );
  }

  return Array.from(dailyGroups.values()).map((stats) => ({
    date: stats.date,
    totalActions: stats.totalActions,
    services: Array.from(stats.services.entries()).map(([name, count]) => ({
      name,
      count,
    })),
    endpoints: Array.from(stats.endpoints.entries()).map(([name, count]) => ({
      name,
      count,
    })),
  }));
}

async function processMonthlyStats(dailyStats) {
  const monthlyGroups = new Map();

  for (const day of dailyStats) {
    const year = day.date.getFullYear();
    const month = day.date.getMonth() + 1;
    const key = `${year}-${month}`;

    if (!monthlyGroups.has(key)) {
      monthlyGroups.set(key, {
        year,
        month,
        totalActions: 0,
        services: new Set(),
        endpoints: new Set(),
        serviceCount: new Map(),
        firstActivity: day.date,
        lastActivity: day.date,
      });
    }

    const monthStats = monthlyGroups.get(key);
    monthStats.totalActions += day.totalActions;

    day.services.forEach(({ name, count }) => {
      monthStats.services.add(name);
      const currentCount = monthStats.serviceCount.get(name) || 0;
      monthStats.serviceCount.set(name, currentCount + count);
    });

    day.endpoints.forEach(({ name }) => {
      monthStats.endpoints.add(name);
    });

    if (day.date < monthStats.firstActivity)
      monthStats.firstActivity = day.date;
    if (day.date > monthStats.lastActivity) monthStats.lastActivity = day.date;
  }

  return Array.from(monthlyGroups.values()).map((month) => {
    const topServices = Array.from(month.serviceCount.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const activityDays = Math.ceil(
      (month.lastActivity - month.firstActivity) / (1000 * 60 * 60 * 24)
    );

    const engagementScore = calculateEngagementScore({
      totalActions: month.totalActions,
      uniqueServices: month.services.size,
      uniqueEndpoints: month.endpoints.size,
      activityDays,
    });

    return {
      year: month.year,
      month: month.month,
      totalActions: month.totalActions,
      uniqueServices: Array.from(month.services),
      uniqueEndpoints: Array.from(month.endpoints),
      topServices,
      firstActivity: month.firstActivity,
      lastActivity: month.lastActivity,
      engagementScore,
      engagementTier: calculateEngagementTier(engagementScore),
    };
  });
}
async function getLastProcessedLogs(tenant) {
  const lastProcessedMap = new Map();

  const cursor = await ActivityModel(tenant)
    .find({}, { email: 1, lastProcessedLog: 1 })
    .lean()
    .cursor();

  for await (const doc of cursor) {
    lastProcessedMap.set(doc.email, doc.lastProcessedLog);
  }

  return lastProcessedMap;
}

async function processUserLogs(
  tenant,
  email,
  lastProcessedLog,
  retryCount = 0
) {
  try {
    const query = {
      "meta.email": email,
      "meta.service": { $nin: ["unknown", "none", "", null] },
    };
    if (lastProcessedLog) query._id = { $gt: lastProcessedLog };

    const cursor = await LogModel(tenant)
      .find(query)
      .sort({ timestamp: 1 })
      .lean()
      .cursor();

    const logs = [];
    for await (const log of cursor) {
      logs.push(log);
    }

    if (logs.length === 0) return null;

    const dailyStats = await processDailyStats(logs);
    const monthlyStats = await processMonthlyStats(dailyStats);

    return {
      updateOne: {
        filter: { email, tenant },
        update: {
          $push: {
            dailyStats: { $each: dailyStats, $sort: { date: 1 } },
            monthlyStats: { $each: monthlyStats, $sort: { year: 1, month: 1 } },
          },
          $set: {
            lastProcessedLog: logs[logs.length - 1]._id,
            username: logs[logs.length - 1].meta.username,
            "overallStats.lastActivity": logs[logs.length - 1].timestamp,
            tenant,
          },
          $min: { "overallStats.firstActivity": logs[0].timestamp },
          $inc: { "overallStats.totalActions": logs.length },
        },
        upsert: true,
      },
    };
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * (retryCount + 1))
      );
      return processUserLogs(tenant, email, lastProcessedLog, retryCount + 1);
    }
    throw error;
  }
}

async function processEmailBatch(batch, tenant, lastProcessedMap) {
  const updates = await Promise.all(
    batch.map((email) =>
      processUserLogs(tenant, email, lastProcessedMap.get(email)).catch(
        (error) => {
          logger.error(`Error processing user ${email}: ${error.message}`);
          return null;
        }
      )
    )
  );

  const validUpdates = updates.filter(Boolean);
  if (validUpdates.length > 0) {
    await ActivityModel(tenant).bulkWrite(validUpdates, { ordered: false });
  }
  return validUpdates.length;
}

async function updateUserActivities({ tenant = "airqo" } = {}, retryCount = 0) {
  const startTime = Date.now();
  let processedCount = 0;
  let errorCount = 0;
  const timeout = 30000; // 30 seconds

  try {
    logText("Starting user activity update job");

    const query = {
      "meta.email": { $exists: true, $ne: null },
      "meta.service": { $nin: ["unknown", "none", "", null] },
    };

    const uniqueEmails = await LogModel(tenant)
      .distinct("meta.email", query)
      .maxTimeMS(timeout);
    if (uniqueEmails.length === 0)
      return { success: true, processedCount: 0, errorCount: 0, duration: 0 };

    const lastProcessedMap = await getLastProcessedLogs(tenant);
    const batches = [];

    for (let i = 0; i < uniqueEmails.length; i += BATCH_SIZE) {
      batches.push(uniqueEmails.slice(i, i + BATCH_SIZE));
    }

    for (let i = 0; i < batches.length; i += CONCURRENT_BATCH_LIMIT) {
      const currentBatches = batches.slice(i, i + CONCURRENT_BATCH_LIMIT);
      const results = await Promise.all(
        currentBatches.map((batch) =>
          processEmailBatch(batch, tenant, lastProcessedMap)
        )
      );

      processedCount += results.reduce((a, b) => a + b, 0);

      logger.info(
        `Processed batch ${i + 1}/${batches.length}: ${processedCount} users`
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const duration = (Date.now() - startTime) / 1000;
    logText(
      `Job completed. Processed ${processedCount} users in ${duration}s. Errors: ${errorCount}`
    );
    logger.info(
      `Job completed. Processed ${processedCount} users in ${duration}s. Errors: ${errorCount}`
    );
    return { success: true, processedCount, errorCount, duration };
  } catch (error) {
    logger.error(`Fatal error in updateUserActivities: ${error.message}`);
    if (error.message.includes("timed out") && retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return updateUserActivities({ tenant }, retryCount + 1);
    }
    throw error;
  }
}

async function runUpdateUserActivities() {
  try {
    const result = await updateUserActivities({ tenant: "airqo" });
    logObject("Run result", result);
  } catch (error) {
    logObject("Run error", error);
    logger.error(`Cron job error: ${error.message}`);
  }
}

cron.schedule("0 * * * *", runUpdateUserActivities, {
  scheduled: true,
  timezone: "Africa/Nairobi",
});

module.exports = { updateUserActivities };
