const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/store-readings-job.beta.js`
);
const EventModel = require("@models/Event");
const GridModel = require("@models/Grid");
const DeviceModel = require("@models/Device");
const SiteModel = require("@models/Site");
const ReadingModel = require("@models/Reading");
const TipsModel = require("@models/HealthTips");
const PhotoModel = require("@models/Photo");
const { logObject, logText } = require("@utils/shared");
const asyncRetry = require("async-retry");
const { stringify, generateFilter } = require("@utils/common");
const cron = require("node-cron");
const moment = require("moment-timezone");
const NodeCache = require("node-cache");

// Constants
const TIMEZONE = moment.tz.guess();
const INACTIVE_THRESHOLD = 5 * 60 * 60 * 1000; // 5 hours in milliseconds

const JOB_NAME = "store-readings-job.beta";
const JOB_SCHEDULE = "30 * * * *"; // At minute 30 of every hour

// Cache manager for storing site averages
const siteAveragesCache = new NodeCache({ stdTTL: 3600 }); // 1 hour TTL

// Utility function to check if an error is a duplicate key error
function isDuplicateKeyError(error) {
  return (
    error &&
    (error.code === 11000 ||
      (error.name === "MongoError" && error.code === 11000))
  );
}

// Helper function to update entity status
async function updateEntityStatus(Model, filter, time, entityType) {
  try {
    const entity = await Model.findOne(filter);
    if (entity) {
      const isActive = isEntityActive(time);
      const updateData = {
        lastActive: moment(time)
          .tz(TIMEZONE)
          .toDate(),
        isOnline: isActive,
      };
      await Model.updateOne(filter, { $set: updateData });
    } else {
      logger.warn(
        `🙀🙀 ${entityType} not found with filter: ${stringify(filter)}`
      );
    }
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return; // Silently ignore duplicate key errors
    }
    logger.error(
      `🐛🐛 Error updating ${entityType}'s status: ${error.message}`
    );
    logger.error(`🐛🐛 Stack trace: ${error.stack}`);
  }
}

// Helper function to check if entity is active
function isEntityActive(time) {
  if (!time) {
    return false;
  }
  const currentTime = moment()
    .tz(TIMEZONE)
    .toDate();
  const measurementTime = moment(time)
    .tz(TIMEZONE)
    .toDate();
  return currentTime - measurementTime < INACTIVE_THRESHOLD;
}

// Batch processing manager
class BatchProcessor {
  constructor(batchSize = 50) {
    this.batchSize = batchSize;
    this.pendingAveragesQueue = new Map(); // site_id -> Promise
    this.processingBatch = false;
    this.operationQueue = []; // Add operation queue
    this.activeOperations = 0; // Track active operations
    // Cache for lookups to avoid repeated database calls
    this.siteCache = new NodeCache({ stdTTL: 3600 }); // 1 hour
    this.deviceCache = new NodeCache({ stdTTL: 3600 }); // 1 hour
    this.gridCache = new NodeCache({ stdTTL: 3600 }); // 1 hour
    this.healthTipsCache = new NodeCache({ stdTTL: 7200 }); // 2 hours
  }

  async processDocument(doc) {
    try {
      const docTime = moment(doc.time).tz(TIMEZONE);
      const updatePromises = [];

      // Handle site and device status updates
      if (doc.site_id) {
        updatePromises.push(
          updateEntityStatus(
            SiteModel("airqo"),
            { _id: doc.site_id },
            docTime.toDate(),
            "Site"
          )
        );
      }

      if (doc.device_id) {
        updatePromises.push(
          updateEntityStatus(
            DeviceModel("airqo"),
            { _id: doc.device_id },
            docTime.toDate(),
            "Device"
          )
        );
      }

      if (doc.grid_id) {
        updatePromises.push(
          updateEntityStatus(
            GridModel("airqo"),
            { _id: doc.grid_id },
            docTime.toDate(),
            "Grid"
          )
        );
      }

      if (doc.grid_id && doc.device_id) {
        updatePromises.push(
          updateGridMobileDeviceActivity(
            doc.grid_id,
            doc.device_id,
            docTime.toDate()
          )
        );
      }

      // Wait for status updates
      await Promise.all(updatePromises);

      const enrichedDoc = await this.enrichDocument(doc, docTime);
      // Prepare and save reading
      // Build appropriate filter based on deployment type
      let filter = null;
      const base = { time: docTime.toDate() };
      if (enrichedDoc.deployment_type === "static" && enrichedDoc.site_id) {
        filter = { ...base, site_id: enrichedDoc.site_id };
      } else if (enrichedDoc.deployment_type === "mobile") {
        if (enrichedDoc.grid_id && enrichedDoc.device_id) {
          filter = {
            ...base,
            grid_id: enrichedDoc.grid_id,
            device_id: enrichedDoc.device_id,
          };
        } else if (enrichedDoc.device_id) {
          filter = { ...base, device_id: enrichedDoc.device_id };
        }
      } else if (enrichedDoc.device_id) {
        filter = { ...base, device_id: enrichedDoc.device_id };
      }
      if (!filter) {
        logger.warn(
          `🙀🙀 Skipping reading without stable identity: ${stringify(
            enrichedDoc
          )}`
        );
        return;
      }
      const { _id, ...updateDoc } = enrichedDoc;

      await ReadingModel("airqo").updateOne(
        filter,
        { $set: updateDoc },
        {
          upsert: true,
        }
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        // Silently ignore duplicate key errors - no logging
        return; // Skip to the next document
      }
      logger.error(`🐛🐛 Error processing document: ${error.message}`);
      throw error;
    }
  }

  async enrichDocument(doc, docTime) {
    try {
      let enrichedDoc = {
        ...doc,
        time: docTime.toDate(),
        timeDifferenceHours: (new Date() - docTime.toDate()) / (1000 * 60 * 60),
      };

      // Set defaults for missing metadata fields
      enrichedDoc.tenant = doc.tenant || "airqo";
      enrichedDoc.network = doc.network || "airqo";
      enrichedDoc.is_test_data = doc.is_test_data || false;

      // **1. Enrich with Site Details (for static devices)**
      if (doc.site_id) {
        const siteDetails = await this.getSiteDetails(doc.site_id);
        if (siteDetails) {
          enrichedDoc.siteDetails = siteDetails;
          // Include site image if available
          const siteImage = await this.getSiteImage(doc.site_id);
          if (siteImage) {
            enrichedDoc.site_image = siteImage.image_url;
          }
        }

        // Get averages for static devices
        const averages = await this.getOrQueueAverages(doc.site_id.toString());
        if (averages) {
          enrichedDoc.averages = averages;
        }
      }

      // **2. Enrich with Grid Details (for mobile devices)**
      if (doc.grid_id) {
        const gridDetails = await this.getGridDetails(doc.grid_id);
        if (gridDetails) {
          enrichedDoc.gridDetails = gridDetails;
        }
      }

      // **3. Enrich with Device Details**
      if (doc.device_id) {
        const deviceDetails = await this.getDeviceDetails(doc.device_id);
        if (deviceDetails) {
          enrichedDoc.deviceDetails = deviceDetails;
          enrichedDoc.is_reading_primary = deviceDetails.isPrimaryInLocation;
          enrichedDoc.device_number = deviceDetails.device_number;
          enrichedDoc.network = deviceDetails.network;
        }
      }

      // **4. Calculate and Add AQI Information**
      enrichedDoc = this.calculateAQI(enrichedDoc);

      // **5. Enrich with Health Tips based on PM2.5**
      if (enrichedDoc.pm2_5?.value) {
        const healthTips = await this.getHealthTips(enrichedDoc.pm2_5.value);
        if (healthTips) {
          enrichedDoc.health_tips = healthTips;
        }
      }

      return enrichedDoc;
    } catch (error) {
      logger.error(`🐛🐛 Error enriching document: ${error.message}`);
      // Return original document if enrichment fails
      return { ...doc, time: docTime.toDate() };
    }
  }

  async getSiteDetails(siteId) {
    const cacheKey = `site_${siteId}`;
    let siteDetails = this.siteCache.get(cacheKey);

    if (!siteDetails) {
      try {
        const site = await SiteModel("airqo")
          .findById(siteId)
          .lean();
        if (site) {
          siteDetails = {
            _id: site._id,
            name: site.name,
            search_name: site.search_name,
            formatted_name: site.formatted_name,
            location_name: site.location_name,
            street: site.street,
            parish: site.parish,
            village: site.village,
            sub_county: site.sub_county,
            town: site.town,
            city: site.city,
            district: site.district,
            county: site.county,
            region: site.region,
            country: site.country,
            approximate_latitude: site.approximate_latitude,
            approximate_longitude: site.approximate_longitude,
            description: site.description,
            data_provider: site.data_provider,
          };
          this.siteCache.set(cacheKey, siteDetails);
        }
      } catch (error) {
        logger.warn(
          `Failed to get site details for ${siteId}: ${error.message}`
        );
      }
    }

    return siteDetails;
  }

  async getGridDetails(gridId) {
    const cacheKey = `grid_${gridId}`;
    let gridDetails = this.gridCache.get(cacheKey);

    if (!gridDetails) {
      try {
        const grid = await GridModel("airqo")
          .findById(gridId)
          .lean();
        if (grid) {
          gridDetails = {
            _id: grid._id,
            name: grid.name,
            long_name: grid.long_name,
            admin_level: grid.admin_level,
            description: grid.description,
            approximate_latitude: grid.centers?.[0]?.latitude,
            approximate_longitude: grid.centers?.[0]?.longitude,
          };
          this.gridCache.set(cacheKey, gridDetails);
        }
      } catch (error) {
        logger.warn(
          `Failed to get grid details for ${gridId}: ${error.message}`
        );
      }
    }

    return gridDetails;
  }

  async getDeviceDetails(deviceId) {
    const cacheKey = `device_${deviceId}`;
    let deviceDetails = this.deviceCache.get(cacheKey);

    if (!deviceDetails) {
      try {
        const device = await DeviceModel("airqo")
          .findById(deviceId)
          .lean();
        if (device) {
          deviceDetails = {
            _id: device._id,
            name: device.name,
            device_number: device.device_number,
            isPrimaryInLocation: device.isPrimaryInLocation,
            network: device.network,
            deployment_type: device.deployment_type,
            mobility: device.mobility,
            isActive: device.isActive,
          };
          this.deviceCache.set(cacheKey, deviceDetails);
        }
      } catch (error) {
        logger.warn(
          `Failed to get device details for ${deviceId}: ${error.message}`
        );
      }
    }

    return deviceDetails;
  }

  async getSiteImage(siteId) {
    const cacheKey = `site_image_${siteId}`;
    let siteImage = this.siteCache.get(cacheKey);

    if (!siteImage) {
      try {
        // Direct model query - more efficient than using .list()
        const photo = await PhotoModel("airqo")
          .findOne(
            { site_id: siteId },
            {
              image_url: 1,
              metadata: 1,
              description: 1,
              tags: 1,
              _id: 1,
            }
          )
          .lean();

        if (photo) {
          this.siteCache.set(cacheKey, photo);
        }
        siteImage = photo;
      } catch (error) {
        logger.warn(`Failed to get site image for ${siteId}: ${error.message}`);
        siteImage = null;
      }
    }

    return siteImage;
  }
  async getHealthTips(pm25Value) {
    const cacheKey = `health_tips_${Math.floor(pm25Value)}`;
    let healthTips = this.healthTipsCache.get(cacheKey);

    if (!healthTips) {
      try {
        // Direct model query with proper projection
        const tips = await TipsModel("airqo")
          .find(
            {
              "aqi_category.min": { $lte: pm25Value },
              "aqi_category.max": { $gte: pm25Value },
            },
            {
              title: 1,
              description: 1,
              tag_line: 1,
              image: 1,
              _id: 0, // Exclude _id for cleaner response
            }
          )
          .lean();

        if (tips && tips.length > 0) {
          healthTips = tips;
          this.healthTipsCache.set(cacheKey, healthTips);
        } else {
          healthTips = null;
        }
      } catch (error) {
        logger.warn(
          `Failed to get health tips for PM2.5 ${pm25Value}: ${error.message}`
        );
        healthTips = null;
      }
    }

    return healthTips;
  }
  calculateAQI(doc) {
    // Add AQI ranges
    doc.aqi_ranges = constants.AQI_RANGES;

    // Calculate AQI color, category, and color name based on PM2.5
    if (doc.pm2_5?.value !== undefined && doc.pm2_5?.value !== null) {
      const pm25Value = doc.pm2_5.value;
      const ranges = constants.AQI_RANGES;

      if (pm25Value >= ranges.good.min && pm25Value <= ranges.good.max) {
        doc.aqi_color = constants.AQI_COLORS.good;
        doc.aqi_category = constants.AQI_CATEGORIES.good;
        doc.aqi_color_name = constants.AQI_COLOR_NAMES.good;
      } else if (
        pm25Value >= ranges.moderate.min &&
        pm25Value <= ranges.moderate.max
      ) {
        doc.aqi_color = constants.AQI_COLORS.moderate;
        doc.aqi_category = constants.AQI_CATEGORIES.moderate;
        doc.aqi_color_name = constants.AQI_COLOR_NAMES.moderate;
      } else if (pm25Value >= ranges.u4sg.min && pm25Value <= ranges.u4sg.max) {
        doc.aqi_color = constants.AQI_COLORS.u4sg;
        doc.aqi_category = constants.AQI_CATEGORIES.u4sg;
        doc.aqi_color_name = constants.AQI_COLOR_NAMES.u4sg;
      } else if (
        pm25Value >= ranges.unhealthy.min &&
        pm25Value <= ranges.unhealthy.max
      ) {
        doc.aqi_color = constants.AQI_COLORS.unhealthy;
        doc.aqi_category = constants.AQI_CATEGORIES.unhealthy;
        doc.aqi_color_name = constants.AQI_COLOR_NAMES.unhealthy;
      } else if (
        pm25Value >= ranges.very_unhealthy.min &&
        pm25Value <= ranges.very_unhealthy.max
      ) {
        doc.aqi_color = constants.AQI_COLORS.very_unhealthy;
        doc.aqi_category = constants.AQI_CATEGORIES.very_unhealthy;
        doc.aqi_color_name = constants.AQI_COLOR_NAMES.very_unhealthy;
      } else if (pm25Value >= ranges.hazardous.min) {
        doc.aqi_color = constants.AQI_COLORS.hazardous;
        doc.aqi_category = constants.AQI_CATEGORIES.hazardous;
        doc.aqi_color_name = constants.AQI_COLOR_NAMES.hazardous;
      } else {
        doc.aqi_color = constants.AQI_COLORS.unknown;
        doc.aqi_category = constants.AQI_CATEGORIES.unknown;
        doc.aqi_color_name = constants.AQI_COLOR_NAMES.unknown;
      }
    }

    return doc;
  }

  async getOrQueueAverages(siteId) {
    // Check cache first
    const cachedAverages = siteAveragesCache.get(siteId);
    if (cachedAverages) {
      return cachedAverages;
    }

    // If there's already a pending request for this site, return that promise
    if (this.pendingAveragesQueue.has(siteId)) {
      return this.pendingAveragesQueue.get(siteId);
    }

    // Create new promise for this site
    const averagesPromise = this.calculateAverages(siteId);
    this.pendingAveragesQueue.set(siteId, averagesPromise);

    try {
      const averages = await averagesPromise;
      // Cache the result
      if (averages) {
        siteAveragesCache.set(siteId, averages);
      }
      return averages;
    } finally {
      // Clean up the queue
      this.pendingAveragesQueue.delete(siteId);
    }
  }

  async calculateAverages(siteId) {
    try {
      const averages = await EventModel("airqo").getAirQualityAverages(siteId);
      return averages?.success ? averages.data : null;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return null; // Silently ignore duplicate key errors
      }
      logger.error(
        `🐛🐛 Error calculating averages for site ${siteId}: ${error.message}`
      );
      return null;
    }
  }
}

// Helper function to update offline devices
async function updateOfflineDevices(data) {
  try {
    const activeDeviceIds = new Set(data.map((doc) => doc.device_id));
    const thresholdTime = moment()
      .subtract(INACTIVE_THRESHOLD, "milliseconds")
      .toDate();

    await DeviceModel("airqo").updateMany(
      {
        _id: { $nin: Array.from(activeDeviceIds) },
        lastActive: { $lt: thresholdTime },
      },
      { $set: { isOnline: false } }
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return; // Silently ignore duplicate key errors
    }
    logger.error(`🐛🐛 Error updating offline devices: ${error.message}`);
  }
}

// Helper function to update offline sites
async function updateOfflineSites(data) {
  try {
    const activeSiteIds = new Set(
      data.map((doc) => doc.site_id).filter(Boolean)
    );
    const thresholdTime = moment()
      .subtract(INACTIVE_THRESHOLD, "milliseconds")
      .toDate();

    await SiteModel("airqo").updateMany(
      {
        _id: { $nin: Array.from(activeSiteIds) },
        lastActive: { $lt: thresholdTime },
      },
      { $set: { isOnline: false } }
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return; // Silently ignore duplicate key errors
    }
    logger.error(`🐛🐛 Error updating offline sites: ${error.message}`);
  }
}

// Helper function to update offline grids for mobile devices
async function updateOfflineGrids(data) {
  try {
    const activeGridIds = new Set(
      data
        .filter((doc) => doc.deployment_type === "mobile" && doc.grid_id)
        .map((doc) => doc.grid_id)
        .filter(Boolean)
    );

    const thresholdTime = moment()
      .subtract(INACTIVE_THRESHOLD, "milliseconds")
      .toDate();

    await GridModel("airqo").updateMany(
      {
        _id: { $nin: Array.from(activeGridIds) },
        lastActive: { $lt: thresholdTime },
      },
      { $set: { isOnline: false } }
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return; // Silently ignore duplicate key errors
    }
    logger.error(`🐛🐛 Error updating offline grids: ${error.message}`);
  }
}

async function updateGridMobileDeviceActivity(gridId, deviceId, time) {
  try {
    await GridModel("airqo").updateMobileDeviceActivity(gridId, deviceId);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return; // Silently ignore duplicate key errors
    }
    logger.error(
      `🐛🐛 Error updating grid mobile device activity: ${error.message}`
    );
  }
}

// Main function to fetch and store data
async function fetchAndStoreDataIntoReadingsModel() {
  const batchProcessor = new BatchProcessor(50);

  try {
    const request = {
      query: {
        tenant: "airqo",
        recent: "yes",
        metadata: "site_id",
        active: "yes",
        brief: "yes",
      },
    };
    const filter = generateFilter.fetch(request);

    let viewEventsResponse;
    try {
      viewEventsResponse = await EventModel("airqo").fetch(filter);
      logText("Running the data insertion script");
    } catch (fetchError) {
      if (isDuplicateKeyError(fetchError)) {
        logText("Ignoring duplicate key error in fetch operation");
        return;
      }
      logger.error(`🐛🐛 Error fetching events: ${stringify(fetchError)}`);
      return;
    }

    if (
      !viewEventsResponse?.success ||
      !Array.isArray(viewEventsResponse.data?.[0]?.data)
    ) {
      logger.warn("🙀🙀 Invalid or empty response from EventModel.fetch()");
      return;
    }

    const data = viewEventsResponse.data[0].data;
    if (data.length === 0) {
      logText("No Events found to insert into Readings");
      return;
    }

    // Process in batches
    const batches = [];
    for (let i = 0; i < data.length; i += batchProcessor.batchSize) {
      batches.push(data.slice(i, i + batchProcessor.batchSize));
    }

    for (const batch of batches) {
      await Promise.all(
        batch.map((doc) =>
          asyncRetry(
            async (bail) => {
              try {
                await batchProcessor.processDocument(doc);
              } catch (error) {
                if (isDuplicateKeyError(error)) {
                  // Silently ignore duplicate key errors
                  return;
                }
                if (error.name === "MongoError") {
                  logger.error(
                    `🐛🐛 MongoError -- fetchAndStoreDataIntoReadingsModel -- ${stringify(
                      error
                    )}`
                  );
                  throw error; // Retry non-duplicate errors
                }
                // Log other errors
                logger.error(
                  `🐛🐛 Error processing document: ${error.message}`
                );
                throw error;
              }
            },
            {
              retries: 3,
              minTimeout: 1000,
              factor: 2,
            }
          )
        )
      );
    }

    // Update offline devices and sites
    await Promise.all([
      updateOfflineDevices(data),
      updateOfflineSites(data),
      updateOfflineGrids(data),
    ]);

    try {
      await GridModel("airqo").cleanupInactiveDevices(
        INACTIVE_THRESHOLD / (60 * 60 * 1000)
      ); // Convert ms to hours
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        logger.error(
          `🐛🐛 Error cleaning up inactive grid devices: ${error.message}`
        );
      }
    }

    logText("All data inserted successfully and offline devices updated");
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      logText("Completed with some duplicate key errors (ignored)");
      return;
    }
    logger.error(`🐛🐛 Internal Server Error ${stringify(error)}`);
  }
}

// Create and register the job
const startJob = () => {
  // Create the cron job instance 👇 THIS IS THE cronJobInstance!
  const cronJobInstance = cron.schedule(
    JOB_SCHEDULE,
    fetchAndStoreDataIntoReadingsModel,
    {
      scheduled: true,
      timezone: TIMEZONE,
    }
  );

  // Initialize global registry
  if (!global.cronJobs) {
    global.cronJobs = {};
  }

  // Register for cleanup 👇 USING cronJobInstance HERE!
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

  console.log(`✅ ${JOB_NAME} started`);
};

startJob();

// Export for testing purposes
module.exports = {
  fetchAndStoreDataIntoReadingsModel,
  BatchProcessor,
  updateEntityStatus,
  updateGridMobileDeviceActivity,
  updateOfflineGrids,
  isEntityActive,
  updateOfflineDevices,
  updateOfflineSites,
  isDuplicateKeyError,
};
