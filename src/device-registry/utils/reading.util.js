const ReadingModel = require("@models/Reading");
const SiteModel = require("@models/Site");
const GridModel = require("@models/Grid");
const { intelligentFetch } = require("@utils/readings/fetch.util");
const {
  logObject,
  logText,
  HttpError,
  logTextWithTimestamp,
} = require("@utils/shared");
const constants = require("@config/constants");
const {
  generateFilter,
  generateDateFormatWithoutHrs,
  addMonthsToProvideDateTime,
  formatDate,
  translate,
  stringify,
  ActivityLogger,
  throttleUtil,
  distance,
} = require("@utils/common");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- reading-util`);
const cleanDeep = require("clean-deep");
const {
  redisGetAsync,
  redisSetAsync,
  redisExpireAsync,
} = require("@config/redis");
const httpStatus = require("http-status");
const asyncRetry = require("async-retry");
const createEventUtil = require("@utils/event.util");

const CACHE_TIMEOUT_PERIOD = constants.CACHE_TIMEOUT_PERIOD || 10000;
let lastRedisWarning = 0;
const REDIS_WARNING_THROTTLE = 30 * 60 * 1000; // 30 minutes throttle (30 minutes * 60 seconds * 1000 milliseconds)

// Helper function for throttled Redis warnings
const logRedisWarning = (operation) => {
  const now = Date.now();
  if (now - lastRedisWarning > REDIS_WARNING_THROTTLE) {
    logger.warn(`Redis connection not available, skipping cache ${operation}`);
    lastRedisWarning = now;
  }
};

const createReading = {
  listFromReadings: async (request, next) => {
    try {
      let missingDataMessage = "";
      const { query } = request;
      let { limit, skip, tenant, language } = query;

      limit = Number(limit) || 30;
      skip = Number(skip) || 0;
      let page = parseInt(query.page);

      if (page) {
        skip = parseInt((page - 1) * limit);
      }

      try {
        const cacheResult = await createEventUtil.handleCacheOperation(
          "get",
          null,
          request,
          next
        );
        if (cacheResult.success === true) {
          logText("Cache hit - returning cached result from readings");
          return cacheResult.data;
        }
      } catch (error) {
        logger.warn(`Cache get operation failed: ${stringify(error)}`);
      }

      // Generate filter for Readings collection
      const filter = generateFilter.readings(request, next);

      // Use ReadingModel for optimized queries
      const responseFromListReadings = await ReadingModel(tenant).listRecent(
        {
          filter,
          skip,
          limit,
          page,
        },
        next
      );

      if (!responseFromListReadings) {
        logger.error(`🐛🐛 ReadingModel.listRecent returned null/undefined`);
        return {
          success: false,
          message: "Database model returned null response",
          errors: { message: "Model method returned null/undefined" },
          status: httpStatus.INTERNAL_SERVER_ERROR,
          isCache: false,
        };
      }

      // Handle language translation if needed
      if (
        language !== undefined &&
        responseFromListReadings.success === true &&
        !isEmpty(responseFromListReadings.data)
      ) {
        const data = responseFromListReadings.data;
        for (const event of data) {
          try {
            const translatedHealthTips = await translate.translateTips(
              { healthTips: event.health_tips, targetLanguage: language },
              next
            );
            if (translatedHealthTips.success === true) {
              event.health_tips = translatedHealthTips.data;
            }
          } catch (translationError) {
            logger.warn(`Translation failed: ${translationError.message}`);
          }
        }
      }

      if (responseFromListReadings.success === true) {
        const data = responseFromListReadings.data;

        try {
          await createEventUtil.handleCacheOperation(
            "set",
            responseFromListReadings,
            request,
            next
          );
        } catch (error) {
          logger.warn(`Cache set operation failed: ${stringify(error)}`);
        }

        return {
          success: true,
          message: !isEmpty(missingDataMessage)
            ? missingDataMessage
            : isEmpty(data)
            ? "no measurements for this search"
            : responseFromListReadings.message,
          data,
          status: responseFromListReadings.status || httpStatus.OK,
          isCache: false,
          source: "readings",
        };
      } else {
        logger.error(
          `Unable to retrieve readings --- ${stringify(
            responseFromListReadings.errors
          )}`
        );

        return {
          success: false,
          message: responseFromListReadings.message,
          errors: responseFromListReadings.errors || {
            message: "Database operation failed",
          },
          status:
            responseFromListReadings.status || httpStatus.INTERNAL_SERVER_ERROR,
          isCache: false,
        };
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error in listFromReadings: ${error.message}`
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  viewFromReadings: async (request, next) => {
    try {
      let missingDataMessage = "";
      const {
        query: { tenant, language },
      } = request;
      const filter = generateFilter.readings(request, next);

      // Try cache first
      try {
        const cacheResult = await createEventUtil.handleCacheOperation(
          "get",
          null,
          request,
          next
        );
        if (cacheResult.success === true) {
          logText("Cache hit - returning cached view result from readings");
          return cacheResult.data;
        }
      } catch (error) {
        logger.warn(`Cache get operation failed: ${stringify(error)}`);
      }

      const viewReadingsResponse = await ReadingModel(tenant).viewRecent(
        filter,
        next
      );

      // Handle language translation
      if (
        language !== undefined &&
        viewReadingsResponse.success === true &&
        Array.isArray(viewReadingsResponse.data) &&
        viewReadingsResponse.data.length > 0 &&
        !isEmpty(viewReadingsResponse.data[0].data)
      ) {
        const data = viewReadingsResponse.data[0].data;
        for (const event of data) {
          try {
            const translatedHealthTips = await translate.translateTips(
              { healthTips: event.health_tips, targetLanguage: language },
              next
            );
            if (translatedHealthTips.success === true) {
              event.health_tips = translatedHealthTips.data;
            }
          } catch (translationError) {
            logger.warn(`Translation failed: ${translationError.message}`);
          }
        }
      }

      if (viewReadingsResponse.success === true) {
        const data = viewReadingsResponse.data;

        // Set cache
        try {
          await createEventUtil.handleCacheOperation(
            "set",
            viewReadingsResponse,
            request,
            next
          );
        } catch (error) {
          logger.warn(`Cache set operation failed: ${stringify(error)}`);
        }

        return {
          success: true,
          message: !isEmpty(missingDataMessage)
            ? missingDataMessage
            : isEmpty(data[0].data)
            ? "no measurements for this search"
            : viewReadingsResponse.message,
          data,
          status: viewReadingsResponse.status || httpStatus.OK,
          isCache: false,
          source: "readings",
        };
      } else {
        logger.error(
          `Unable to retrieve readings view --- ${stringify(
            viewReadingsResponse.errors
          )}`
        );

        return {
          success: false,
          message: viewReadingsResponse.message,
          errors: viewReadingsResponse.errors || {
            message: "Database operation failed",
          },
          status:
            viewReadingsResponse.status || httpStatus.INTERNAL_SERVER_ERROR,
          isCache: false,
        };
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error in viewFromReadings: ${error.message}`
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  read: async (request, next) => {
    try {
      let missingDataMessage = "";
      const {
        query: { tenant, language, limit, skip },
      } = request;

      try {
        const cacheResult = await createEventUtil.handleCacheOperation(
          "get",
          null,
          request,
          next
        );
        if (cacheResult.success === true) {
          logText("Cache hit - returning cached result");
          return cacheResult.data;
        }
      } catch (error) {
        logger.warn(`Cache get operation failed: ${stringify(error)}`);
      }

      const readingsResponse = await ReadingModel(tenant).recent(
        {
          filter: {},
          skip: skip || 0,
          limit: limit || 1000,
        },
        next
      );

      // **STEP 3: Handle language translation (UNCHANGED - preserving existing functionality)**
      if (
        language !== undefined &&
        !isEmpty(readingsResponse) &&
        readingsResponse.success === true &&
        !isEmpty(readingsResponse.data)
      ) {
        const data = readingsResponse.data;
        for (const event of data) {
          if (event.health_tips) {
            try {
              const translatedHealthTips = await translate.translateTips(
                { healthTips: event.health_tips, targetLanguage: language },
                next
              );
              if (translatedHealthTips.success === true) {
                event.health_tips = translatedHealthTips.data;
              }
            } catch (translationError) {
              logger.warn(`Translation failed: ${translationError.message}`);
              // Continue without translation rather than failing
            }
          }
        }
      }

      if (readingsResponse.success === true) {
        const data = readingsResponse.data;

        logText("Setting cache...");

        try {
          await createEventUtil.handleCacheOperation(
            "set",
            data,
            request,
            next
          );
        } catch (error) {
          logger.warn(`Cache set operation failed: ${stringify(error)}`);
        }

        logText("Cache set completed.");

        return {
          success: true,
          message: !isEmpty(missingDataMessage)
            ? missingDataMessage
            : isEmpty(data)
            ? "no measurements for this search"
            : readingsResponse.message,
          data,
          status: readingsResponse.status || "",
          isCache: false,
        };
      } else {
        logger.error(
          `Unable to retrieve readings --- ${stringify(
            readingsResponse.errors
          )}`
        );

        return {
          success: false,
          message: readingsResponse.message,
          errors: readingsResponse.errors || { message: "" },
          status: readingsResponse.status || "",
          isCache: false,
        };
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  readRecentWithFilter: async (request, next) => {
    try {
      let missingDataMessage = "";
      const {
        query: { tenant, language, limit, skip },
      } = request;
      const filter = generateFilter.telemetry(request);

      try {
        const cacheResult = await createEventUtil.handleCacheOperation(
          "get",
          null,
          request,
          next
        );
        if (cacheResult.success === true) {
          logText("Cache hit - returning cached result");
          return cacheResult.data;
        }
      } catch (error) {
        logger.warn(`Cache get operation failed: ${stringify(error)}`);
      }

      // Proceed with database query
      const readingsResponse = await ReadingModel(tenant).recent({
        filter,
        skip,
        limit,
      });

      if (!readingsResponse) {
        logger.error(
          `🐛🐛 ReadingModel.recent returned null/undefined for tenant: ${tenant}`
        );
        return {
          success: false,
          message: "Database model returned null response",
          errors: {
            message: "Model method returned null/undefined",
            tenant: tenant,
          },
          status: httpStatus.INTERNAL_SERVER_ERROR,
          isCache: false,
        };
      }

      // Handle language translation if needed
      if (
        language !== undefined &&
        !isEmpty(readingsResponse) &&
        readingsResponse.success === true &&
        !isEmpty(readingsResponse.data)
      ) {
        const data = readingsResponse.data;
        for (const event of data) {
          try {
            const translatedHealthTips = await translate.translateTips(
              { healthTips: event.health_tips, targetLanguage: language },
              next
            );
            if (translatedHealthTips.success === true) {
              event.health_tips = translatedHealthTips.data;
            }
          } catch (translationError) {
            logger.warn(`Translation failed: ${translationError.message}`);
            // Continue without translation rather than failing
          }
        }
      }

      if (readingsResponse.success === true) {
        const data = readingsResponse.data;

        // Attempt to set cache but don't let failure affect the response
        logText("Attempting to set cache...");
        try {
          await createEventUtil.handleCacheOperation(
            "set",
            data,
            request,
            next
          );
        } catch (error) {
          logger.warn(`Cache set operation failed: ${stringify(error)}`);
        }

        logText("Cache operation completed (success or failure ignored).");

        return {
          success: true,
          message: !isEmpty(missingDataMessage)
            ? missingDataMessage
            : isEmpty(data)
            ? "no measurements for this search"
            : readingsResponse.message,
          data,
          status: readingsResponse.status || httpStatus.OK,
          isCache: false,
        };
      } else {
        logger.error(
          `Unable to retrieve events --- ${stringify(readingsResponse.errors)}`
        );

        return {
          success: false,
          message: readingsResponse.message,
          errors: readingsResponse.errors || {
            message: "Database operation failed",
          },
          status: readingsResponse.status || httpStatus.INTERNAL_SERVER_ERROR,
          isCache: false,
        };
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  getWorstReadingForSites: async (req, res, next) => {
    try {
      const siteIds = req.body.siteIds;

      const result = await ReadingModel("airqo").getWorstPm2_5Reading({
        siteIds,
        next,
      });

      if (result.success) {
        res.status(result.status).json(result);
      } else {
        // Handle errors based on result.message and result.errors
        next(result);
      }
    } catch (error) {
      // Handle unexpected errors
      next(error);
    }
  },
  getWorstReadingForDevices: async ({ deviceIds = [], next } = {}) => {
    try {
      if (isEmpty(deviceIds) || !Array.isArray(deviceIds)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "deviceIds array is required",
          })
        );
        return;
      }
      if (deviceIds.length === 0) {
        return {
          success: true,
          message: "No device_ids were provided",
          data: [],
          status: httpStatus.OK,
        };
      }

      // Validate deviceIds type
      if (!deviceIds.every((id) => typeof id === "string")) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "deviceIds must be an array of strings",
          })
        );
        return;
      }

      const formattedDeviceIds = deviceIds.map((id) => id.toString());
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const pipeline = ReadingModel("airqo")
        .aggregate([
          {
            $match: {
              device_id: { $in: formattedDeviceIds },
              time: { $gte: threeDaysAgo },
              "pm2_5.value": { $exists: true }, // Ensure pm2_5.value exists
            },
          },
          {
            $sort: { "pm2_5.value": -1, time: -1 }, // Sort by pm2_5 descending, then by time
          },
          {
            $limit: 1, // Take only the worst reading
          },
          {
            $project: {
              _id: 0, // Exclude the MongoDB-generated _id
              device_id: 1,
              time: 1,
              pm2_5: 1,
              device: 1,
              siteDetails: 1,
            },
          },
        ])
        .allowDiskUse(true);

      const worstReading = await pipeline.exec();

      if (!isEmpty(worstReading)) {
        return {
          success: true,
          message: "Successfully retrieved the worst pm2_5 reading.",
          data: worstReading[0],
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message:
            "No pm2_5 readings found for the specified device_ids in the last three days.",
          data: {},
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },
  listReadingAverages: async (request, next) => {
    try {
      let missingDataMessage = "";
      const { tenant, language, site_id } = {
        ...request.query,
        ...request.params,
      };

      try {
        const cacheResult = await createEventUtil.handleCacheOperation(
          "get",
          null,
          request,
          next
        );
        if (cacheResult.success === true) {
          logText("Cache hit - returning cached result");
          return cacheResult.data;
        }
      } catch (error) {
        logger.warn(`Cache get operation failed: ${stringify(error)}`);
      }

      const readingsResponse = await ReadingModel(
        tenant
      ).getAirQualityAnalytics(site_id, next);

      if (
        language !== undefined &&
        !isEmpty(readingsResponse) &&
        readingsResponse.success === true &&
        !isEmpty(readingsResponse.data)
      ) {
        const data = readingsResponse.data;
        for (const event of data) {
          const translatedHealthTips = await translate.translateTips(
            { healthTips: event.health_tips, targetLanguage: language },
            next
          );
          if (translatedHealthTips.success === true) {
            event.health_tips = translatedHealthTips.data;
          }
        }
      }

      if (readingsResponse.success === true) {
        const data = readingsResponse.data;

        logText("Setting cache...");

        try {
          await createEventUtil.handleCacheOperation(
            "set",
            data,
            request,
            next
          );
        } catch (error) {
          logger.warn(`Cache set operation failed: ${stringify(error)}`);
        }

        logText("Cache set.");

        return {
          success: true,
          message: !isEmpty(missingDataMessage)
            ? missingDataMessage
            : isEmpty(data)
            ? "no measurements for this search"
            : readingsResponse.message,
          data,
          status: readingsResponse.status || "",
          isCache: false,
        };
      } else {
        logger.error(
          `Unable to retrieve events --- ${stringify(readingsResponse.errors)}`
        );

        return {
          success: false,
          message: readingsResponse.message,
          errors: readingsResponse.errors || { message: "" },
          status: readingsResponse.status || "",
          isCache: false,
        };
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  getBestAirQuality: async (request, next) => {
    try {
      const {
        query: { tenant, threshold, pollutant, language, limit, skip },
      } = request;

      try {
        const cacheResult = await createEventUtil.handleCacheOperation(
          "get",
          null,
          request,
          next
        );
        if (cacheResult.success === true) {
          logText("Cache hit - returning cached result");
          return cacheResult.data;
        }
      } catch (error) {
        logger.warn(`Cache get operation failed: ${stringify(error)}`);
      }

      const readingsResponse = await ReadingModel(
        tenant
      ).getBestAirQualityLocations({ threshold, pollutant, limit, skip }, next);
      const data = readingsResponse.data;

      // Handle language translation for health tips if applicable
      if (
        language !== undefined &&
        readingsResponse.success === true &&
        !isEmpty(readingsResponse.data)
      ) {
        for (const event of data) {
          const translatedHealthTips = await translate.translateTips(
            { healthTips: event.health_tips, targetLanguage: language },
            next
          );
          if (translatedHealthTips.success === true) {
            event.health_tips = translatedHealthTips.data;
          }
        }
      }

      try {
        await createEventUtil.handleCacheOperation("set", data, request, next);
      } catch (error) {
        logger.warn(`Cache set operation failed: ${stringify(error)}`);
      }

      return {
        success: true,
        message:
          readingsResponse.message ||
          "Successfully retrieved air quality data.",
        data: readingsResponse.data,
        status: readingsResponse.status || "",
        isCache: false,
      };
    } catch (error) {
      logObject("error", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  getNearestReadings: async (request, next) => {
    try {
      const {
        latitude,
        longitude,
        radius = 15,
        limit = 5,
        tenant = "airqo",
      } = {
        ...request.query,
        ...request.params,
      };

      // Step 1: Find the nearest sites within the specified radius
      const sites = await SiteModel(tenant)
        .find({})
        .lean();

      // Calculate and filter sites by distance
      const sitesWithDistance = sites
        .map((site) => {
          const distanceInKm = distance.distanceBtnTwoPoints(
            {
              latitude1: parseFloat(latitude),
              longitude1: parseFloat(longitude),
              latitude2: site.latitude,
              longitude2: site.longitude,
            },
            next
          );

          return {
            ...site,
            distance: distanceInKm,
          };
        })
        .filter((site) => site.distance <= radius)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);

      if (sitesWithDistance.length === 0) {
        // Fallback: Find the nearest city using the Grid model
        const nearestCityReading = await createReading.findNearestCityReading(
          latitude,
          longitude,
          tenant,
          next
        );

        if (nearestCityReading.success) {
          return {
            success: true,
            message: `No sites found within ${radius}km radius. Showing readings from the nearest city.`,
            data: nearestCityReading.data,
            fromNearestCity: true,
            nearestCityInfo: nearestCityReading.cityInfo,
            status: httpStatus.OK,
          };
        } else {
          return {
            success: false,
            message:
              "No sites found within radius and no nearby city readings available",
            errors: {
              message: "No air quality data available for your location",
            },
            status: httpStatus.NOT_FOUND,
          };
        }
      }

      // Step 2: Get readings for these sites
      const siteIds = sitesWithDistance.map((site) => site._id.toString());

      const filter = {
        site_id: { $in: siteIds },
      };

      const readings = await ReadingModel(tenant).recent(
        { filter, limit: 100 },
        next
      );

      if (!readings.success || isEmpty(readings.data)) {
        return {
          success: false,
          message: "No recent readings found for nearby sites",
          errors: { message: "No air quality data available for nearby sites" },
          status: httpStatus.NOT_FOUND,
        };
      }

      // Step 3: Match readings with site distances and sort
      const readingsWithDistance = readings.data
        .map((reading) => {
          const site = sitesWithDistance.find(
            (site) => site._id.toString() === reading.site_id.toString()
          );

          return {
            ...reading,
            distance: site ? site.distance : Infinity,
          };
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);

      return {
        success: true,
        message: "Successfully retrieved the nearest readings",
        data: readingsWithDistance,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },
  findNearestCityReading: async (latitude, longitude, tenant, next) => {
    try {
      // Step 1: Find all grids with admin_level that would represent cities
      // Typically admin_level could be 'city', 'town', 'district', depending on your system
      const cityGrids = await GridModel(tenant)
        .find({
          admin_level: { $in: ["city", "town", "district", "division"] },
        })
        .lean();

      if (isEmpty(cityGrids)) {
        return {
          success: false,
          message: "No city grids found in the system",
          status: httpStatus.NOT_FOUND,
        };
      }

      // Step 2: Find the nearest city grid
      let nearestCity = null;
      let minDistance = Infinity;

      cityGrids.forEach((grid) => {
        // For each grid, calculate distance to each center point
        if (grid.centers && grid.centers.length > 0) {
          grid.centers.forEach((center) => {
            const distanceToCenter = distance.distanceBtnTwoPoints(
              {
                latitude1: parseFloat(latitude),
                longitude1: parseFloat(longitude),
                latitude2: center.latitude,
                longitude2: center.longitude,
              },
              next
            );

            if (distanceToCenter < minDistance) {
              minDistance = distanceToCenter;
              nearestCity = {
                ...grid,
                distanceToUser: distanceToCenter,
              };
            }
          });
        }
      });

      if (!nearestCity) {
        return {
          success: false,
          message: "No city found with valid center coordinates",
          status: httpStatus.NOT_FOUND,
        };
      }

      // Step 3: Find sites within this city grid
      const sitesInCity = await SiteModel(tenant)
        .find({
          grids: nearestCity._id,
        })
        .lean();

      if (isEmpty(sitesInCity)) {
        return {
          success: false,
          message: `No sites found in the nearest city (${nearestCity.name})`,
          status: httpStatus.NOT_FOUND,
        };
      }

      // Step 4: Get readings for these sites
      const siteIds = sitesInCity.map((site) => site._id.toString());

      const filter = {
        site_id: { $in: siteIds },
      };

      const readings = await ReadingModel(tenant).recent(
        { filter, limit: 5 },
        next
      );

      if (!readings.success || isEmpty(readings.data)) {
        return {
          success: false,
          message: `No recent readings found for sites in ${nearestCity.name}`,
          status: httpStatus.NOT_FOUND,
        };
      }

      // Add city information to each reading
      readings.data = readings.data.map((reading) => ({
        ...reading,
        isNearestCity: true,
        distanceToUser: minDistance,
      }));

      return {
        success: true,
        message: `Successfully retrieved readings from nearest city (${nearestCity.name})`,
        data: readings.data,
        cityInfo: {
          name: nearestCity.name,
          long_name: nearestCity.long_name,
          distance: minDistance,
          admin_level: nearestCity.admin_level,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return {
        success: false,
        message: "Failed to retrieve nearest city readings",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = createReading;
