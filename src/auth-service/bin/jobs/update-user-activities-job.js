const cron = require("node-cron");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- user-activity-job`
);
const { logText, logObject } = require("@utils/log");
const { LogModel } = require("@models/log");
const ActivityModel = require("@models/Activity");

const BATCH_SIZE = 1000;
const MAX_RETRIES = 3;

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
  for (const log of logs) {
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

    // Update service counts
    const serviceCount = dayStats.services.get(log.meta.service) || 0;
    dayStats.services.set(log.meta.service, serviceCount + 1);

    // Update endpoint counts
    const endpointCount = dayStats.endpoints.get(log.meta.endpoint) || 0;
    dayStats.endpoints.set(log.meta.endpoint, endpointCount + 1);
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

    // Update service counts and unique services
    day.services.forEach(({ name, count }) => {
      monthStats.services.add(name);
      const currentCount = monthStats.serviceCount.get(name) || 0;
      monthStats.serviceCount.set(name, currentCount + count);
    });

    // Update unique endpoints
    day.endpoints.forEach(({ name }) => {
      monthStats.endpoints.add(name);
    });

    // Update activity period
    if (day.date < monthStats.firstActivity) {
      monthStats.firstActivity = day.date;
    }

    if (day.date > monthStats.lastActivity) {
      monthStats.lastActivity = day.date;
    }
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
  try {
    const activities = await ActivityModel(tenant)
      .find({}, { email: 1, lastProcessedLog: 1 })
      .lean();

    return new Map(
      activities.map((activity) => [activity.email, activity.lastProcessedLog])
    );
  } catch (error) {
    logger.error(`Error fetching last processed logs: ${error.message}`);
    throw error;
  }
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

    if (lastProcessedLog) {
      query._id = { $gt: lastProcessedLog };
    }

    const logs = await LogModel(tenant)
      .find(query)
      .sort({ timestamp: 1 })
      .lean();

    if (logs.length === 0) {
      return null;
    }

    const dailyStats = await processDailyStats(logs);
    const monthlyStats = await processMonthlyStats(dailyStats);

    const lastLog = logs[logs.length - 1];

    return {
      updateOne: {
        filter: { email, tenant },
        update: {
          $push: {
            dailyStats: { $each: dailyStats, $sort: { date: 1 } },
            monthlyStats: { $each: monthlyStats, $sort: { year: 1, month: 1 } },
          },
          $set: {
            lastProcessedLog: lastLog._id,
            username: lastLog.meta.username,
            "overallStats.lastActivity": lastLog.timestamp,
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
      logger.warn(
        `Retrying process for user ${email}. Attempt ${retryCount + 1}`
      );
      return processUserLogs(tenant, email, lastProcessedLog, retryCount + 1);
    }

    throw error;
  }
}

async function updateUserActivities({ tenant = "airqo" } = {}) {
  const startTime = Date.now();
  let processedCount = 0;
  let errorCount = 0;

  try {
    logText("Starting user activity update job");
    logger.info("Starting user activity update job");

    // Get unique emails from logs that need processing
    const lastProcessedMap = await getLastProcessedLogs(tenant);

    let hasMore = true;

    while (hasMore) {
      const query = {
        "meta.email": { $exists: true, $ne: null },
        "meta.service": { $nin: ["unknown", "none", "", null] },
      };

      // Fetch all unique emails without limit
      const uniqueEmails = await LogModel(tenant).distinct("meta.email", query);

      if (uniqueEmails.length === 0) {
        break;
      }

      // Batch processing of emails
      const batches = [];
      for (let i = 0; i < uniqueEmails.length; i += BATCH_SIZE) {
        batches.push(uniqueEmails.slice(i, i + BATCH_SIZE));
      }

      for (const batch of batches) {
        const updates = await Promise.all(
          batch.map(async (email) => {
            try {
              return await processUserLogs(
                tenant,
                email,
                lastProcessedMap.get(email)
              );
            } catch (error) {
              errorCount++;
              logger.error(`Error processing user ${email}: ${error.message}`);
              return null;
            }
          })
        );

        const validUpdates = updates.filter(Boolean);

        if (validUpdates.length > 0) {
          await ActivityModel(tenant).bulkWrite(validUpdates, {
            ordered: false,
          });
          processedCount += validUpdates.length;
        }
      }

      hasMore = batches.length === BATCH_SIZE; // Check if more batches exist
      logText(`Processed ${processedCount} users`);
      logger.info(`Processed ${processedCount} users`);
    }

    const duration = (Date.now() - startTime) / 1000;
    logger.info(
      `Job completed. Processed ${processedCount} users in ${duration}s. Errors: ${errorCount}`
    );

    return { success: true, processedCount, errorCount, duration };
  } catch (error) {
    logger.error(`Fatal error in updateUserActivities: ${error.message}`);
    throw error;
  }
}

// Schedule jobs
cron.schedule("0 * * * *", () => updateUserActivities(), {
  scheduled: true,
  timezone: "Africa/Nairobi",
});

// Clean up old daily stats (keep last 90 days)
cron.schedule("0 0 * * *", async () => {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    await ActivityModel("airqo").updateMany(
      {},
      {
        $pull: {
          dailyStats: { date: { $lt: ninetyDaysAgo } },
        },
      }
    );

    logger.info("Successfully cleaned up old daily stats");
  } catch (error) {
    logger.error(`Error cleaning up old daily stats: ${error.message}`);
  }
});

module.exports = { updateUserActivities };
