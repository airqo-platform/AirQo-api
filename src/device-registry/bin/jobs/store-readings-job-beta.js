const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/store-readings-job-beta.js`
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

const JOB_NAME = "optimized-store-readings-job";
const JOB_SCHEDULE = "0,15,30,45 * * * *"; // Every 15 minutes for better distribution

// **OPTIMIZATION**: Reduced batch sizes and added concurrency limits
const MAX_CONCURRENT_OPERATIONS = 8; // Limit concurrent operations
const OPERATION_DELAY = 50; // 50ms delay between operations
const BATCH_SIZE = 20; // Smaller batch size for better performance
const MAX_DOCUMENTS_PER_RUN = 400; // Limit total documents processed per run

// **OPTIMIZATION**: Longer cache TTLs to reduce database hits
const CACHE_CONFIG = {
  SITE_TTL: 3600, // 1 hour
  DEVICE_TTL: 3600, // 1 hour
  GRID_TTL: 3600, // 1 hour
  HEALTH_TIPS_TTL: 7200, // 2 hours
  AVERAGES_TTL: 1800, // 30 minutes
};

// Cache manager for storing site averages
const siteAveragesCache = new NodeCache({ stdTTL: CACHE_CONFIG.AVERAGES_TTL });

// **NEW**: Performance metrics tracking
const performanceMetrics = {
  totalRuns: 0,
  successfulRuns: 0,
  failedRuns: 0,
  totalDocumentsProcessed: 0,
  averageRunTime: 0,
  lastRunTime: null,
  errors: [],
  slowOperations: [],
};

// **NEW**: Circuit Breaker Pattern for resilience
class CircuitBreaker {
  constructor(threshold = 3, timeout = 30000) {
    this.failureThreshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
    this.successCount = 0;
  }

  async execute(operation, fallback = null) {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = "HALF_OPEN";
        this.successCount = 0;
      } else {
        if (fallback) {
          logger.warn("Circuit breaker OPEN, using fallback");
          return fallback();
        }
        throw new Error("Circuit breaker is OPEN - operation blocked");
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.successCount++;

    if (this.state === "HALF_OPEN" && this.successCount >= 2) {
      this.state = "CLOSED";
      this.failureCount = 0;
      logger.info("Circuit breaker reset to CLOSED state");
    } else if (this.state === "CLOSED") {
      this.failureCount = 0;
    }
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
      logger.error(`Circuit breaker OPEN after ${this.failureCount} failures`);
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount,
    };
  }
}

// **NEW**: Operation Queue for throttling
class OperationQueue {
  constructor(
    maxConcurrent = MAX_CONCURRENT_OPERATIONS,
    delay = OPERATION_DELAY
  ) {
    this.maxConcurrent = maxConcurrent;
    this.delay = delay;
    this.queue = [];
    this.activeOperations = 0;
    this.isProcessing = false;
  }

  async add(operation) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        operation,
        resolve,
        reject,
        timestamp: Date.now(),
      });

      this.processNext();
    });
  }

  async processNext() {
    if (
      this.activeOperations >= this.maxConcurrent ||
      this.queue.length === 0
    ) {
      return;
    }

    const { operation, resolve, reject, timestamp } = this.queue.shift();
    this.activeOperations++;

    try {
      // **OPTIMIZATION**: Track slow operations
      const startTime = Date.now();
      const result = await operation();
      const duration = Date.now() - startTime;

      if (duration > 2000) {
        // 2 seconds threshold
        performanceMetrics.slowOperations.push({
          duration,
          timestamp: startTime,
          queueTime: startTime - timestamp,
        });
        logger.warn(
          `Slow operation detected: ${duration}ms (queued for ${startTime -
            timestamp}ms)`
        );
      }

      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.activeOperations--;

      // **OPTIMIZATION**: Add delay between operations to reduce database load
      if (this.delay > 0) {
        setTimeout(() => this.processNext(), this.delay);
      } else {
        this.processNext();
      }
    }
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      activeOperations: this.activeOperations,
      maxConcurrent: this.maxConcurrent,
    };
  }
}

// Utility function to check if an error is a duplicate key error
function isDuplicateKeyError(error) {
  return (
    error &&
    (error.code === 11000 ||
      (error.name === "MongoError" && error.code === 11000) ||
      (error.name === "MongoServerError" && error.code === 11000))
  );
}

// **OPTIMIZED**: Helper function to update entity status with better error handling
async function updateEntityStatus(
  Model,
  filter,
  time,
  entityType,
  circuitBreaker
) {
  try {
    await circuitBreaker.execute(
      async () => {
        const entity = await Model.findOne(filter).lean(); // Use lean() for better performance
        if (entity) {
          const isActive = isEntityActive(entity, time);
          const updateData = {
            lastActive: moment(time)
              .tz(TIMEZONE)
              .toDate(),
            isOnline: isActive,
          };

          // **OPTIMIZATION**: Use updateOne with upsert for better performance
          await Model.updateOne(filter, updateData, { upsert: false });
        } else {
          logger.warn(
            `🙀🙀 ${entityType} not found with filter: ${stringify(filter)}`
          );
        }
      },
      () => {
        // Fallback: log the failure but don't throw
        logger.warn(`Circuit breaker prevented ${entityType} status update`);
      }
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return; // Silently ignore duplicate key errors
    }

    // **OPTIMIZATION**: Don't log stack traces for common errors
    if (error.message.includes("Circuit breaker")) {
      logger.warn(`${entityType} status update blocked by circuit breaker`);
    } else {
      logger.error(
        `🐛🐛 Error updating ${entityType}'s status: ${error.message}`
      );

      // Only log stack trace in development
      if (constants.ENVIRONMENT === "DEVELOPMENT ENVIRONMENT") {
        logger.error(`🐛🐛 Stack trace: ${error.stack}`);
      }
    }
  }
}

// Helper function to check if entity is active (unchanged)
function isEntityActive(entity, time) {
  if (!entity || !entity.lastActive) {
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

// **HEAVILY OPTIMIZED**: Batch processing manager
class OptimizedBatchProcessor {
  constructor(batchSize = BATCH_SIZE) {
    this.batchSize = batchSize;
    this.pendingAveragesQueue = new Map();
    this.operationQueue = new OperationQueue();
    this.circuitBreaker = new CircuitBreaker(3, 30000);

    // **OPTIMIZATION**: Increased cache TTLs and improved cache management
    this.siteCache = new NodeCache({
      stdTTL: CACHE_CONFIG.SITE_TTL,
      checkperiod: 600, // Check every 10 minutes
      useClones: false, // Better performance
    });
    this.deviceCache = new NodeCache({
      stdTTL: CACHE_CONFIG.DEVICE_TTL,
      checkperiod: 600,
      useClones: false,
    });
    this.gridCache = new NodeCache({
      stdTTL: CACHE_CONFIG.GRID_TTL,
      checkperiod: 600,
      useClones: false,
    });
    this.healthTipsCache = new NodeCache({
      stdTTL: CACHE_CONFIG.HEALTH_TIPS_TTL,
      checkperiod: 1200,
      useClones: false,
    });

    // **NEW**: Batch cache warming
    this.warmingPromises = new Map();
  }

  async processDocument(doc) {
    return this.operationQueue.add(async () => {
      try {
        const docTime = moment(doc.time).tz(TIMEZONE);
        const updatePromises = [];

        // **OPTIMIZATION**: Parallel status updates with circuit breaker protection
        if (doc.site_id) {
          updatePromises.push(
            updateEntityStatus(
              SiteModel("airqo"),
              { _id: doc.site_id },
              docTime.toDate(),
              "Site",
              this.circuitBreaker
            )
          );
        }

        if (doc.device_id) {
          updatePromises.push(
            updateEntityStatus(
              DeviceModel("airqo"),
              { _id: doc.device_id },
              docTime.toDate(),
              "Device",
              this.circuitBreaker
            )
          );
        }

        if (doc.grid_id) {
          updatePromises.push(
            updateEntityStatus(
              GridModel("airqo"),
              { _id: doc.grid_id },
              docTime.toDate(),
              "Grid",
              this.circuitBreaker
            )
          );
        }

        if (doc.grid_id && doc.device_id) {
          updatePromises.push(
            updateGridMobileDeviceActivity(
              doc.grid_id,
              doc.device_id,
              docTime.toDate(),
              this.circuitBreaker
            )
          );
        }

        // **OPTIMIZATION**: Use allSettled instead of all to prevent one failure from stopping everything
        const statusResults = await Promise.allSettled(updatePromises);

        // Log any failures but continue processing
        statusResults.forEach((result, index) => {
          if (
            result.status === "rejected" &&
            !isDuplicateKeyError(result.reason)
          ) {
            logger.warn(
              `Status update ${index} failed: ${result.reason.message}`
            );
          }
        });

        const enrichedDoc = await this.enrichDocument(doc, docTime);

        // **OPTIMIZATION**: Build appropriate filter based on deployment type
        let filter = { time: docTime.toDate() };

        if (enrichedDoc.deployment_type === "static") {
          filter.site_id = enrichedDoc.site_id;
        } else if (enrichedDoc.deployment_type === "mobile") {
          if (enrichedDoc.grid_id) {
            filter.grid_id = enrichedDoc.grid_id;
          }
          filter.device_id = enrichedDoc.device_id;
        }

        const { _id, ...updateDoc } = enrichedDoc;

        // **OPTIMIZATION**: Use circuit breaker for database writes
        await this.circuitBreaker.execute(async () => {
          await ReadingModel("airqo").updateOne(filter, updateDoc, {
            upsert: true,
          });
        });

        return true; // Success indicator
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          return false; // Skip duplicate, but don't count as error
        }

        // **OPTIMIZATION**: Categorize errors for better monitoring
        if (error.message.includes("Circuit breaker")) {
          logger.warn(`Document processing blocked by circuit breaker`);
          return false;
        }

        logger.error(`🐛🐛 Error processing document: ${error.message}`);
        throw error;
      }
    });
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

      // **OPTIMIZATION**: Parallel enrichment operations
      const enrichmentPromises = [];

      // **1. Enrich with Site Details (for static devices)**
      if (doc.site_id) {
        enrichmentPromises.push(
          this.getSiteDetails(doc.site_id)
            .then((siteDetails) => {
              if (siteDetails) {
                enrichedDoc.siteDetails = siteDetails;
              }
              return this.getSiteImage(doc.site_id);
            })
            .then((siteImage) => {
              if (siteImage) {
                enrichedDoc.site_image = siteImage.image_url;
              }
            })
            .catch((error) => {
              logger.warn(`Failed to enrich site details: ${error.message}`);
            })
        );

        // Get averages for static devices
        enrichmentPromises.push(
          this.getOrQueueAverages(doc.site_id.toString())
            .then((averages) => {
              if (averages) {
                enrichedDoc.averages = averages;
              }
            })
            .catch((error) => {
              logger.warn(`Failed to get averages: ${error.message}`);
            })
        );
      }

      // **2. Enrich with Grid Details (for mobile devices)**
      if (doc.grid_id) {
        enrichmentPromises.push(
          this.getGridDetails(doc.grid_id)
            .then((gridDetails) => {
              if (gridDetails) {
                enrichedDoc.gridDetails = gridDetails;
              }
            })
            .catch((error) => {
              logger.warn(`Failed to enrich grid details: ${error.message}`);
            })
        );
      }

      // **3. Enrich with Device Details**
      if (doc.device_id) {
        enrichmentPromises.push(
          this.getDeviceDetails(doc.device_id)
            .then((deviceDetails) => {
              if (deviceDetails) {
                enrichedDoc.deviceDetails = deviceDetails;
                enrichedDoc.is_reading_primary =
                  deviceDetails.isPrimaryInLocation;
                enrichedDoc.device_number = deviceDetails.device_number;
                enrichedDoc.network = deviceDetails.network;
              }
            })
            .catch((error) => {
              logger.warn(`Failed to enrich device details: ${error.message}`);
            })
        );
      }

      // **4. Enrich with Health Tips based on PM2.5**
      if (doc.pm2_5?.value) {
        enrichmentPromises.push(
          this.getHealthTips(doc.pm2_5.value)
            .then((healthTips) => {
              if (healthTips) {
                enrichedDoc.health_tips = healthTips;
              }
            })
            .catch((error) => {
              logger.warn(`Failed to enrich health tips: ${error.message}`);
            })
        );
      }

      // **OPTIMIZATION**: Wait for all enrichment operations to complete
      await Promise.allSettled(enrichmentPromises);

      // **5. Calculate and Add AQI Information (always do this)**
      enrichedDoc = this.calculateAQI(enrichedDoc);

      return enrichedDoc;
    } catch (error) {
      logger.error(`🐛🐛 Error enriching document: ${error.message}`);
      // Return original document if enrichment fails
      return { ...doc, time: docTime.toDate() };
    }
  }

  // **OPTIMIZED**: Cache methods with better error handling and batch warming
  async getSiteDetails(siteId) {
    const cacheKey = `site_${siteId}`;
    let siteDetails = this.siteCache.get(cacheKey);

    if (!siteDetails) {
      try {
        // **OPTIMIZATION**: Use circuit breaker for database calls
        siteDetails = await this.circuitBreaker.execute(async () => {
          const site = await SiteModel("airqo")
            .findById(siteId)
            .select({
              name: 1,
              search_name: 1,
              formatted_name: 1,
              location_name: 1,
              street: 1,
              parish: 1,
              village: 1,
              sub_county: 1,
              town: 1,
              city: 1,
              district: 1,
              county: 1,
              region: 1,
              country: 1,
              approximate_latitude: 1,
              approximate_longitude: 1,
              description: 1,
              data_provider: 1,
            })
            .lean();

          if (site) {
            const details = {
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

            this.siteCache.set(cacheKey, details);
            return details;
          }
          return null;
        });
      } catch (error) {
        if (!error.message.includes("Circuit breaker")) {
          logger.warn(
            `Failed to get site details for ${siteId}: ${error.message}`
          );
        }
        return null;
      }
    }

    return siteDetails;
  }

  async getGridDetails(gridId) {
    const cacheKey = `grid_${gridId}`;
    let gridDetails = this.gridCache.get(cacheKey);

    if (!gridDetails) {
      try {
        gridDetails = await this.circuitBreaker.execute(async () => {
          const grid = await GridModel("airqo")
            .findById(gridId)
            .select({
              name: 1,
              long_name: 1,
              admin_level: 1,
              description: 1,
              centers: 1,
            })
            .lean();

          if (grid) {
            const details = {
              _id: grid._id,
              name: grid.name,
              long_name: grid.long_name,
              admin_level: grid.admin_level,
              description: grid.description,
              approximate_latitude: grid.centers?.[0]?.latitude,
              approximate_longitude: grid.centers?.[0]?.longitude,
            };

            this.gridCache.set(cacheKey, details);
            return details;
          }
          return null;
        });
      } catch (error) {
        if (!error.message.includes("Circuit breaker")) {
          logger.warn(
            `Failed to get grid details for ${gridId}: ${error.message}`
          );
        }
        return null;
      }
    }

    return gridDetails;
  }

  async getDeviceDetails(deviceId) {
    const cacheKey = `device_${deviceId}`;
    let deviceDetails = this.deviceCache.get(cacheKey);

    if (!deviceDetails) {
      try {
        deviceDetails = await this.circuitBreaker.execute(async () => {
          const device = await DeviceModel("airqo")
            .findById(deviceId)
            .select({
              name: 1,
              device_number: 1,
              isPrimaryInLocation: 1,
              network: 1,
              deployment_type: 1,
              mobility: 1,
              isActive: 1,
            })
            .lean();

          if (device) {
            const details = {
              _id: device._id,
              name: device.name,
              device_number: device.device_number,
              isPrimaryInLocation: device.isPrimaryInLocation,
              network: device.network,
              deployment_type: device.deployment_type,
              mobility: device.mobility,
              isActive: device.isActive,
            };

            this.deviceCache.set(cacheKey, details);
            return details;
          }
          return null;
        });
      } catch (error) {
        if (!error.message.includes("Circuit breaker")) {
          logger.warn(
            `Failed to get device details for ${deviceId}: ${error.message}`
          );
        }
        return null;
      }
    }

    return deviceDetails;
  }

  async getSiteImage(siteId) {
    const cacheKey = `site_image_${siteId}`;
    let siteImage = this.siteCache.get(cacheKey);

    if (!siteImage) {
      try {
        siteImage = await this.circuitBreaker.execute(async () => {
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
            return photo;
          }
          return null;
        });
      } catch (error) {
        if (!error.message.includes("Circuit breaker")) {
          logger.warn(
            `Failed to get site image for ${siteId}: ${error.message}`
          );
        }
        return null;
      }
    }

    return siteImage;
  }

  async getHealthTips(pm25Value) {
    const cacheKey = `health_tips_${Math.floor(pm25Value)}`;
    let healthTips = this.healthTipsCache.get(cacheKey);

    if (!healthTips) {
      try {
        healthTips = await this.circuitBreaker.execute(async () => {
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
                _id: 0,
              }
            )
            .lean();

          if (tips && tips.length > 0) {
            this.healthTipsCache.set(cacheKey, tips);
            return tips;
          }
          return null;
        });
      } catch (error) {
        if (!error.message.includes("Circuit breaker")) {
          logger.warn(
            `Failed to get health tips for PM2.5 ${pm25Value}: ${error.message}`
          );
        }
        return null;
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
      const averages = await this.circuitBreaker.execute(async () => {
        return await EventModel("airqo").getAirQualityAverages(siteId);
      });
      return averages?.success ? averages.data : null;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return null;
      }
      if (!error.message.includes("Circuit breaker")) {
        logger.error(
          `🐛🐛 Error calculating averages for site ${siteId}: ${error.message}`
        );
      }
      return null;
    }
  }

  getStats() {
    return {
      cacheStats: {
        site: this.siteCache.getStats(),
        device: this.deviceCache.getStats(),
        grid: this.gridCache.getStats(),
        healthTips: this.healthTipsCache.getStats(),
      },
      operationQueue: this.operationQueue.getStats(),
      circuitBreaker: this.circuitBreaker.getState(),
      pendingAverages: this.pendingAveragesQueue.size,
    };
  }
}

// **OPTIMIZED**: Helper function to update offline devices with circuit breaker
async function updateOfflineDevices(data, circuitBreaker) {
  try {
    await circuitBreaker.execute(async () => {
      const activeDeviceIds = new Set(data.map((doc) => doc.device_id));
      const thresholdTime = moment()
        .subtract(INACTIVE_THRESHOLD, "milliseconds")
        .toDate();

      await DeviceModel("airqo").updateMany(
        {
          _id: { $nin: Array.from(activeDeviceIds) },
          lastActive: { $lt: thresholdTime },
        },
        { isOnline: false }
      );
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return;
    }
    if (!error.message.includes("Circuit breaker")) {
      logger.error(`🐛🐛 Error updating offline devices: ${error.message}`);
    }
  }
}

// **OPTIMIZED**: Helper function to update offline sites with circuit breaker
async function updateOfflineSites(data, circuitBreaker) {
  try {
    await circuitBreaker.execute(async () => {
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
        { isOnline: false }
      );
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return;
    }
    if (!error.message.includes("Circuit breaker")) {
      logger.error(`🐛🐛 Error updating offline sites: ${error.message}`);
    }
  }
}

// **OPTIMIZED**: Helper function to update offline grids for mobile devices with circuit breaker
async function updateOfflineGrids(data, circuitBreaker) {
  try {
    await circuitBreaker.execute(async () => {
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
        { isOnline: false }
      );
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return;
    }
    if (!error.message.includes("Circuit breaker")) {
      logger.error(`🐛🐛 Error updating offline grids: ${error.message}`);
    }
  }
}

async function updateGridMobileDeviceActivity(
  gridId,
  deviceId,
  time,
  circuitBreaker
) {
  try {
    await circuitBreaker.execute(async () => {
      await GridModel("airqo").updateMobileDeviceActivity(gridId, deviceId);
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return;
    }
    if (!error.message.includes("Circuit breaker")) {
      logger.error(
        `🐛🐛 Error updating grid mobile device activity: ${error.message}`
      );
    }
  }
}

// **HEAVILY OPTIMIZED**: Main function to fetch and store data
async function fetchAndStoreDataIntoReadingsModelOptimized() {
  const startTime = Date.now();
  const batchProcessor = new OptimizedBatchProcessor(BATCH_SIZE);
  let documentsProcessed = 0;
  let successfulProcesses = 0;
  let failedProcesses = 0;

  try {
    performanceMetrics.totalRuns++;
    logText(
      `🚀 Starting optimized data insertion script (Run #${performanceMetrics.totalRuns})`
    );

    const request = {
      query: {
        tenant: "airqo",
        recent: "yes",
        metadata: "site_id",
        active: "yes",
        brief: "yes",
        limit: MAX_DOCUMENTS_PER_RUN, // **OPTIMIZATION**: Limit documents per run
      },
    };

    const filter = generateFilter.fetch(request);

    let viewEventsResponse;
    try {
      // **OPTIMIZATION**: Use circuit breaker for initial fetch
      viewEventsResponse = await batchProcessor.circuitBreaker.execute(
        async () => {
          return await EventModel("airqo").fetch(filter);
        }
      );
      logText("✅ Successfully fetched data from EventModel");
    } catch (fetchError) {
      if (isDuplicateKeyError(fetchError)) {
        logText("⚠️ Ignoring duplicate key error in fetch operation");
        return;
      }
      logger.error(`🐛🐛 Error fetching events: ${stringify(fetchError)}`);
      performanceMetrics.failedRuns++;
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
      logText("ℹ️ No Events found to insert into Readings");
      return;
    }

    documentsProcessed = data.length;
    logText(
      `📊 Processing ${documentsProcessed} documents in optimized batches of ${BATCH_SIZE}`
    );

    // **OPTIMIZATION**: Process documents with better error handling
    const processingPromises = data.map(async (doc) => {
      try {
        const result = await asyncRetry(
          async (bail) => {
            try {
              return await batchProcessor.processDocument(doc);
            } catch (error) {
              if (isDuplicateKeyError(error)) {
                return false; // Skip duplicate, don't count as error
              }
              if (error.message.includes("Circuit breaker")) {
                // Don't retry circuit breaker errors
                bail(error);
                return false;
              }
              throw error; // Retry other errors
            }
          },
          {
            retries: 2, // Reduced retry attempts for better performance
            minTimeout: 500,
            factor: 1.5,
          }
        );

        if (result) {
          successfulProcesses++;
        }
        return result;
      } catch (error) {
        failedProcesses++;
        if (
          !isDuplicateKeyError(error) &&
          !error.message.includes("Circuit breaker")
        ) {
          logger.error(
            `Failed to process document after retries: ${error.message}`
          );
        }
        return false;
      }
    });

    await Promise.allSettled(processingPromises);

    // **OPTIMIZATION**: Update offline entities in parallel with circuit breaker protection
    const offlineUpdatePromises = [
      updateOfflineDevices(data, batchProcessor.circuitBreaker),
      updateOfflineSites(data, batchProcessor.circuitBreaker),
      updateOfflineGrids(data, batchProcessor.circuitBreaker),
    ];

    await Promise.allSettled(offlineUpdatePromises);

    // **OPTIMIZATION**: Grid cleanup with circuit breaker
    try {
      await batchProcessor.circuitBreaker.execute(async () => {
        await GridModel("airqo").cleanupInactiveDevices(
          INACTIVE_THRESHOLD / (60 * 60 * 1000)
        );
      });
    } catch (error) {
      if (
        !isDuplicateKeyError(error) &&
        !error.message.includes("Circuit breaker")
      ) {
        logger.error(
          `🐛🐛 Error cleaning up inactive grid devices: ${error.message}`
        );
      }
    }

    const duration = Date.now() - startTime;

    // **UPDATE PERFORMANCE METRICS**
    performanceMetrics.successfulRuns++;
    performanceMetrics.totalDocumentsProcessed += documentsProcessed;
    performanceMetrics.averageRunTime =
      (performanceMetrics.averageRunTime * (performanceMetrics.totalRuns - 1) +
        duration) /
      performanceMetrics.totalRuns;
    performanceMetrics.lastRunTime = new Date().toISOString();

    // **LOG PERFORMANCE SUMMARY**
    const stats = batchProcessor.getStats();
    logText(`✅ Job completed successfully in ${duration}ms`);
    logText(
      `📈 Processed: ${successfulProcesses}/${documentsProcessed} documents (${failedProcesses} failed)`
    );
    logText(
      `⚡ Performance: ${Math.round(
        documentsProcessed / (duration / 1000)
      )} docs/sec`
    );
    logText(
      `🏃‍♂️ Circuit Breaker: ${stats.circuitBreaker.state} (${stats.circuitBreaker.failureCount} failures)`
    );
    logText(
      `📊 Cache Performance - Sites: ${stats.cacheStats.site.hits}/${stats
        .cacheStats.site.hits + stats.cacheStats.site.misses} hits`
    );

    // **WARN ON PERFORMANCE ISSUES**
    if (duration > 60000) {
      // 1 minute
      logger.warn(`🐌 Job took longer than expected: ${duration}ms`);
    }

    if (failedProcesses > documentsProcessed * 0.1) {
      // More than 10% failures
      logger.warn(
        `⚠️ High failure rate: ${failedProcesses}/${documentsProcessed} (${Math.round(
          (failedProcesses / documentsProcessed) * 100
        )}%)`
      );
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    performanceMetrics.failedRuns++;
    performanceMetrics.errors.push({
      timestamp: new Date().toISOString(),
      error: error.message,
      duration,
      documentsProcessed,
    });

    if (isDuplicateKeyError(error)) {
      logText("⚠️ Completed with some duplicate key errors (ignored)");
      return;
    }

    logger.error(
      `🐛🐛 Internal Server Error after ${duration}ms: ${stringify(error)}`
    );

    // **KEEP ERROR HISTORY MANAGEABLE**
    if (performanceMetrics.errors.length > 50) {
      performanceMetrics.errors = performanceMetrics.errors.slice(-25);
    }
  }
}

// **NEW**: Health check and monitoring endpoint data
function getJobHealthStatus() {
  const now = Date.now();
  const lastRunTimestamp = performanceMetrics.lastRunTime
    ? new Date(performanceMetrics.lastRunTime).getTime()
    : 0;
  const timeSinceLastRun = now - lastRunTimestamp;

  const health = {
    status: "healthy",
    lastRun: performanceMetrics.lastRunTime,
    timeSinceLastRun: `${Math.round(timeSinceLastRun / 1000)}s`,
    metrics: {
      totalRuns: performanceMetrics.totalRuns,
      successRate:
        performanceMetrics.totalRuns > 0
          ? `${Math.round(
              (performanceMetrics.successfulRuns /
                performanceMetrics.totalRuns) *
                100
            )}%`
          : "N/A",
      averageRunTime: `${Math.round(performanceMetrics.averageRunTime)}ms`,
      totalDocumentsProcessed: performanceMetrics.totalDocumentsProcessed,
      recentErrors: performanceMetrics.errors.slice(-5),
      slowOperations: performanceMetrics.slowOperations.slice(-5),
    },
  };

  // Determine health status
  if (timeSinceLastRun > 20 * 60 * 1000) {
    // More than 20 minutes
    health.status = "unhealthy";
    health.reason = "Job has not run recently";
  } else if (
    performanceMetrics.failedRuns > performanceMetrics.successfulRuns
  ) {
    health.status = "degraded";
    health.reason = "More failures than successes";
  } else if (performanceMetrics.averageRunTime > 120000) {
    // More than 2 minutes
    health.status = "degraded";
    health.reason = "Job is running slowly";
  }

  return health;
}

// Create and register the job
const startJob = () => {
  // **OPTIMIZATION**: Create the cron job instance with better error handling
  const cronJobInstance = cron.schedule(
    JOB_SCHEDULE,
    async () => {
      try {
        await fetchAndStoreDataIntoReadingsModelOptimized();
      } catch (error) {
        logger.error(`🐛🐛 Unhandled error in cron job: ${error.message}`);
        performanceMetrics.failedRuns++;
        performanceMetrics.errors.push({
          timestamp: new Date().toISOString(),
          error: `Unhandled cron error: ${error.message}`,
          type: "cron_error",
        });
      }
    },
    {
      scheduled: true,
      timezone: TIMEZONE,
    }
  );

  // Initialize global registry
  if (!global.cronJobs) {
    global.cronJobs = {};
  }

  // Register for cleanup
  global.cronJobs[JOB_NAME] = {
    job: cronJobInstance,
    getHealth: getJobHealthStatus,
    getMetrics: () => performanceMetrics,
    stop: async () => {
      cronJobInstance.stop();
      if (typeof cronJobInstance.destroy === "function") {
        cronJobInstance.destroy();
      }
      delete global.cronJobs[JOB_NAME];
      logger.info(`🛑 ${JOB_NAME} stopped`);
    },
  };

  console.log(`✅ ${JOB_NAME} started with schedule: ${JOB_SCHEDULE}`);
  console.log(
    `⚙️ Configuration: ${BATCH_SIZE} batch size, ${MAX_CONCURRENT_OPERATIONS} max concurrent, ${MAX_DOCUMENTS_PER_RUN} max docs/run`
  );
};

// **GRACEFUL SHUTDOWN**
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  if (global.cronJobs && global.cronJobs[JOB_NAME]) {
    global.cronJobs[JOB_NAME].stop();
  }
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  if (global.cronJobs && global.cronJobs[JOB_NAME]) {
    global.cronJobs[JOB_NAME].stop();
  }
  process.exit(0);
});

startJob();

// Export for testing purposes
module.exports = {
  fetchAndStoreDataIntoReadingsModelOptimized,
  OptimizedBatchProcessor,
  updateEntityStatus,
  updateGridMobileDeviceActivity,
  updateOfflineGrids,
  isEntityActive,
  updateOfflineDevices,
  updateOfflineSites,
  isDuplicateKeyError,
  getJobHealthStatus,
  CircuitBreaker,
  OperationQueue,
  performanceMetrics,
};
