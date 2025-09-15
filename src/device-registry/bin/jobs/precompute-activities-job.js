const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/precompute-activities-job`
);
const ActivityModel = require("@models/Activity");
const DeviceModel = require("@models/Device");
const SiteModel = require("@models/Site");
const { logObject, logText } = require("@utils/shared");
const cron = require("node-cron");
const moment = require("moment-timezone");

const TIMEZONE = moment.tz.guess();
const JOB_NAME = "precompute-activities-job";
const JOB_SCHEDULE = "30 * * * *"; // At minute 30 of every hour
const BATCH_SIZE = 100;

class ActivityPrecomputeProcessor {
  constructor() {
    this.processedSites = 0;
    this.processedDevices = 0;
    this.errors = [];
  }

  async precomputeSiteActivities(tenant) {
    try {
      logText("Starting site activities precomputation...");

      const activitiesColl = ActivityModel(tenant).collection.name;
      const devicesColl = DeviceModel(tenant).collection.name;
      // Get all sites with their activity summaries
      const pipeline = [
        {
          $lookup: {
            from: activitiesColl,
            let: { siteId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$site_id", "$$siteId"] } } },
              { $sort: { createdAt: -1 } },
              {
                $group: {
                  _id: "$activityType",
                  count: { $sum: 1 },
                  latest: { $first: "$$ROOT" },
                  latestDate: { $first: "$createdAt" },
                },
              },
            ],
            as: "activitySummary",
          },
        },
        {
          $lookup: {
            from: devicesColl,
            localField: "_id",
            foreignField: "site_id",
            pipeline: [
              { $project: { _id: 1, name: 1, cached_total_activities: 1 } },
            ],
            as: "devices",
          },
        },
        {
          $project: {
            _id: 1,
            activitySummary: 1,
            deviceCount: { $size: "$devices" },
            devices: 1,
          },
        },
      ];

      const sites = await SiteModel(tenant).aggregate(pipeline);

      for (let i = 0; i < sites.length; i += BATCH_SIZE) {
        const batch = sites.slice(i, i + BATCH_SIZE);
        await this.processSiteBatch(tenant, batch);
      }

      logText(
        `Completed site activities precomputation. Processed: ${this.processedSites} sites`
      );
    } catch (error) {
      logger.error(`Site precomputation error: ${error.message}`);
      this.errors.push({ type: "site", error: error.message });
    }
  }

  async processSiteBatch(tenant, sites) {
    const bulkOps = sites.map((site) => {
      // Build activity summary
      const activitiesByType = {};
      const latestActivitiesByType = {};
      let totalActivities = 0;

      site.activitySummary.forEach((summary) => {
        const type = summary._id || "unknown";
        activitiesByType[type] = summary.count;
        totalActivities += summary.count;

        if (summary.latest) {
          const {
            groups,
            activity_codes,
            updatedAt,
            __v,
            ...cleanActivity
          } = summary.latest;
          latestActivitiesByType[type] = cleanActivity;
        }
      });

      // Create device activity summary
      const deviceActivitySummary = site.devices.map((device) => ({
        device_id: device._id,
        device_name: device.name,
        activity_count: device.cached_total_activities || 0,
      }));

      // Backward compatibility fields
      const latestDeployment = latestActivitiesByType.deployment || null;
      const latestMaintenance = latestActivitiesByType.maintenance || null;
      const latestRecall =
        latestActivitiesByType.recall ||
        latestActivitiesByType.recallment ||
        null;
      const siteCreation = latestActivitiesByType["site-creation"] || null;

      return {
        updateOne: {
          filter: { _id: site._id },
          update: {
            $set: {
              // Precomputed activity data
              cached_activities_by_type: activitiesByType,
              cached_latest_activities_by_type: latestActivitiesByType,
              cached_total_activities: totalActivities,
              cached_device_activity_summary: deviceActivitySummary,

              // Backward compatibility
              cached_latest_deployment_activity: latestDeployment,
              cached_latest_maintenance_activity: latestMaintenance,
              cached_latest_recall_activity: latestRecall,
              cached_site_creation_activity: siteCreation,

              // Metadata
              cached_total_devices: site.deviceCount,
              activities_cache_updated_at: new Date(),
            },
          },
          upsert: false,
        },
      };
    });

    if (bulkOps.length > 0) {
      await SiteModel(tenant).bulkWrite(bulkOps);
      this.processedSites += bulkOps.length;
    }
  }

  async precomputeDeviceActivities(tenant) {
    try {
      logText("Starting device activities precomputation...");

      const activitiesColl = ActivityModel(tenant).collection.name;
      const pipeline = [
        {
          $lookup: {
            from: activitiesColl,
            let: { deviceName: "$name", deviceId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ["$device", "$$deviceName"] },
                      { $eq: ["$device_id", "$$deviceId"] },
                    ],
                  },
                },
              },
              { $sort: { createdAt: -1 } },
              {
                $group: {
                  _id: "$activityType",
                  count: { $sum: 1 },
                  latest: { $first: "$$ROOT" },
                  latestDate: { $first: "$createdAt" },
                },
              },
            ],
            as: "activitySummary",
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            activitySummary: 1,
          },
        },
      ];

      const devices = await DeviceModel(tenant).aggregate(pipeline);

      for (let i = 0; i < devices.length; i += BATCH_SIZE) {
        const batch = devices.slice(i, i + BATCH_SIZE);
        await this.processDeviceBatch(tenant, batch);
      }

      logText(
        `Completed device activities precomputation. Processed: ${this.processedDevices} devices`
      );
    } catch (error) {
      logger.error(`Device precomputation error: ${error.message}`);
      this.errors.push({ type: "device", error: error.message });
    }
  }

  async processDeviceBatch(tenant, devices) {
    const bulkOps = devices.map((device) => {
      const activitiesByType = {};
      const latestActivitiesByType = {};
      let totalActivities = 0;

      device.activitySummary.forEach((summary) => {
        const type = summary._id || "unknown";
        activitiesByType[type] = summary.count;
        totalActivities += summary.count;

        if (summary.latest) {
          const {
            groups,
            activity_codes,
            updatedAt,
            __v,
            ...cleanActivity
          } = summary.latest;
          latestActivitiesByType[type] = cleanActivity;
        }
      });

      const latestDeployment = latestActivitiesByType.deployment || null;
      const latestMaintenance = latestActivitiesByType.maintenance || null;
      const latestRecall =
        latestActivitiesByType.recall ||
        latestActivitiesByType.recallment ||
        null;

      return {
        updateOne: {
          filter: { _id: device._id },
          update: {
            $set: {
              cached_activities_by_type: activitiesByType,
              cached_latest_activities_by_type: latestActivitiesByType,
              cached_total_activities: totalActivities,
              cached_latest_deployment_activity: latestDeployment,
              cached_latest_maintenance_activity: latestMaintenance,
              cached_latest_recall_activity: latestRecall,
              activities_cache_updated_at: new Date(),
            },
          },
          upsert: false,
        },
      };
    });

    if (bulkOps.length > 0) {
      await DeviceModel(tenant).bulkWrite(bulkOps);
      this.processedDevices += bulkOps.length;
    }
  }

  async cleanupStaleCache(tenant) {
    try {
      const staleThreshold = moment()
        .subtract(2, "hours")
        .toDate();

      // Clean up stale cache entries (optional - for data consistency)
      const [siteCleanup, deviceCleanup] = await Promise.all([
        SiteModel(tenant).updateMany(
          {
            activities_cache_updated_at: { $exists: true, $lt: staleThreshold },
          },
          {
            $unset: {
              cached_activities_by_type: 1,
              cached_latest_activities_by_type: 1,
              cached_total_activities: 1,
              cached_device_activity_summary: 1,
              cached_latest_deployment_activity: 1,
              cached_latest_maintenance_activity: 1,
              cached_latest_recall_activity: 1,
              cached_site_creation_activity: 1,
              cached_total_devices: 1,
              activities_cache_updated_at: 1,
            },
          }
        ),
        DeviceModel(tenant).updateMany(
          {
            activities_cache_updated_at: { $exists: true, $lt: staleThreshold },
          },
          {
            $unset: {
              cached_activities_by_type: 1,
              cached_latest_activities_by_type: 1,
              cached_total_activities: 1,
              cached_latest_deployment_activity: 1,
              cached_latest_maintenance_activity: 1,
              cached_latest_recall_activity: 1,
              activities_cache_updated_at: 1,
            },
          }
        ),
      ]);

      if (siteCleanup.modifiedCount > 0 || deviceCleanup.modifiedCount > 0) {
        logText(
          `Cleaned up stale cache: ${siteCleanup.modifiedCount} sites, ${deviceCleanup.modifiedCount} devices`
        );
      }
    } catch (error) {
      logger.error(`Cache cleanup error: ${error.message}`);
    }
  }
}

async function precomputeActivitiesAndMetrics() {
  const processor = new ActivityPrecomputeProcessor();

  try {
    logText("Starting activities precomputation job");

    // Process for each tenant (add more as needed)
    const tenants = ["airqo"]; // Add other tenants as needed

    for (const tenant of tenants) {
      logText(`Processing tenant: ${tenant}`);

      await Promise.all([
        processor.precomputeSiteActivities(tenant),
        processor.precomputeDeviceActivities(tenant),
      ]);

      // Optional cleanup
      await processor.cleanupStaleCache(tenant);
    }

    const summary = {
      processedSites: processor.processedSites,
      processedDevices: processor.processedDevices,
      errors: processor.errors,
      timestamp: new Date(),
    };

    logText(`Precomputation completed: ${JSON.stringify(summary)}`);
  } catch (error) {
    logger.error(`Activities precomputation job failed: ${error.message}`);
  }
}

// Create and register the job
const startJob = () => {
  const cronJobInstance = cron.schedule(
    JOB_SCHEDULE,
    precomputeActivitiesAndMetrics,
    {
      scheduled: true,
      timezone: TIMEZONE,
    }
  );

  if (!global.cronJobs) {
    global.cronJobs = {};
  }

  global.cronJobs[JOB_NAME] = {
    job: cronJobInstance,
    stop: async () => {
      cronJobInstance.stop();
      if (typeof cronJobInstance.destroy === "function") {
        cronJobInstance.destroy();
      }
      delete global.cronJobs[JOB_NAME];
    },
  };

  console.log(`✅ ${JOB_NAME} started - precomputing activities every hour`);
};

startJob();

module.exports = {
  precomputeActivitiesAndMetrics,
  ActivityPrecomputeProcessor,
};
