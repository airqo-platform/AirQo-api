const SignalModel = require("@models/Signal");
const SiteModel = require("@models/Site");
const GridModel = require("@models/Grid");
const { intelligentFetch } = require("@utils/signals/fetch.util");
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
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- signal-util`);
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

const createSignal = {
  listFromSignals: async (request, next) => {
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
          logText("Cache hit - returning cached result from signals");
          return cacheResult.data;
        }
      } catch (error) {
        logger.warn(`Cache get operation failed: ${stringify(error)}`);
      }

      // Generate filter for Signals collection
      const filter = generateFilter.signals(request, next);

      // Use SignalModel for optimized queries
      const responseFromListSignals = await SignalModel(tenant).listRecent(
        {
          filter,
          skip,
          limit,
          page,
        },
        next
      );

      if (!responseFromListSignals) {
        logger.error(`🐛🐛 SignalModel.listRecent returned null/undefined`);
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
        responseFromListSignals.success === true &&
        !isEmpty(responseFromListSignals.data)
      ) {
        const data = responseFromListSignals.data;
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

      if (responseFromListSignals.success === true) {
        const data = responseFromListSignals.data;

        try {
          await createEventUtil.handleCacheOperation(
            "set",
            responseFromListSignals,
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
            : responseFromListSignals.message,
          data,
          status: responseFromListSignals.status || httpStatus.OK,
          isCache: false,
          source: "signals",
        };
      } else {
        logger.error(
          `Unable to retrieve signals --- ${stringify(
            responseFromListSignals.errors
          )}`
        );

        return {
          success: false,
          message: responseFromListSignals.message,
          errors: responseFromListSignals.errors || {
            message: "Database operation failed",
          },
          status:
            responseFromListSignals.status || httpStatus.INTERNAL_SERVER_ERROR,
          isCache: false,
        };
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error in listFromSignals: ${error.message}`
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
  viewFromSignals: async (request, next) => {
    try {
      let missingDataMessage = "";
      const {
        query: { tenant, language },
      } = request;
      const filter = generateFilter.signals(request, next);

      // Try cache first
      try {
        const cacheResult = await createEventUtil.handleCacheOperation(
          "get",
          null,
          request,
          next
        );
        if (cacheResult.success === true) {
          logText("Cache hit - returning cached view result from signals");
          return cacheResult.data;
        }
      } catch (error) {
        logger.warn(`Cache get operation failed: ${stringify(error)}`);
      }

      const viewSignalsResponse = await SignalModel(tenant).viewRecent(
        filter,
        next
      );

      // Handle language translation
      if (
        language !== undefined &&
        viewSignalsResponse.success === true &&
        !isEmpty(viewSignalsResponse.data[0].data)
      ) {
        const data = viewSignalsResponse.data[0].data;
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

      if (viewSignalsResponse.success === true) {
        const data = viewSignalsResponse.data;

        // Set cache
        try {
          await createEventUtil.handleCacheOperation(
            "set",
            viewSignalsResponse,
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
            : viewSignalsResponse.message,
          data,
          status: viewSignalsResponse.status || httpStatus.OK,
          isCache: false,
          source: "signals",
        };
      } else {
        logger.error(
          `Unable to retrieve signals view --- ${stringify(
            viewSignalsResponse.errors
          )}`
        );

        return {
          success: false,
          message: viewSignalsResponse.message,
          errors: viewSignalsResponse.errors || {
            message: "Database operation failed",
          },
          status:
            viewSignalsResponse.status || httpStatus.INTERNAL_SERVER_ERROR,
          isCache: false,
        };
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error in viewFromSignals: ${error.message}`
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

      const signalsResponse = await SignalModel(tenant).recent(
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
        !isEmpty(signalsResponse) &&
        signalsResponse.success === true &&
        !isEmpty(signalsResponse.data)
      ) {
        const data = signalsResponse.data;
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

      if (signalsResponse.success === true) {
        const data = signalsResponse.data;

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
            : signalsResponse.message,
          data,
          status: signalsResponse.status || "",
          isCache: false,
        };
      } else {
        logger.error(
          `Unable to retrieve signals --- ${stringify(signalsResponse.errors)}`
        );

        return {
          success: false,
          message: signalsResponse.message,
          errors: signalsResponse.errors || { message: "" },
          status: signalsResponse.status || "",
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
      const signalsResponse = await SignalModel(tenant).recent({
        filter,
        skip,
        limit,
      });

      if (!signalsResponse) {
        logger.error(
          `🐛🐛 SignalModel.recent returned null/undefined for tenant: ${tenant}`
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
        !isEmpty(signalsResponse) &&
        signalsResponse.success === true &&
        !isEmpty(signalsResponse.data)
      ) {
        const data = signalsResponse.data;
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

      if (signalsResponse.success === true) {
        const data = signalsResponse.data;

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
            : signalsResponse.message,
          data,
          status: signalsResponse.status || httpStatus.OK,
          isCache: false,
        };
      } else {
        logger.error(
          `Unable to retrieve events --- ${stringify(signalsResponse.errors)}`
        );

        return {
          success: false,
          message: signalsResponse.message,
          errors: signalsResponse.errors || {
            message: "Database operation failed",
          },
          status: signalsResponse.status || httpStatus.INTERNAL_SERVER_ERROR,
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
  getWorstSignalForSites: async (req, res, next) => {
    try {
      const siteIds = req.body.siteIds;

      const result = await SignalModel("airqo").getWorstPm2_5Signal({
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
  getWorstSignalForDevices: async ({ deviceIds = [], next } = {}) => {
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
      const pipeline = SignalModel("airqo")
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
            $limit: 1, // Take only the worst signal
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

      const worstSignal = await pipeline.exec();

      if (!isEmpty(worstSignal)) {
        return {
          success: true,
          message: "Successfully retrieved the worst pm2_5 signal.",
          data: worstSignal[0],
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message:
            "No pm2_5 signals found for the specified device_ids in the last three days.",
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
  listSignalAverages: async (request, next) => {
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

      const signalsResponse = await SignalModel(tenant).getAirQualityAnalytics(
        site_id,
        next
      );

      if (
        language !== undefined &&
        !isEmpty(signalsResponse) &&
        signalsResponse.success === true &&
        !isEmpty(signalsResponse.data)
      ) {
        const data = signalsResponse.data;
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

      if (signalsResponse.success === true) {
        const data = signalsResponse.data;

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
            : signalsResponse.message,
          data,
          status: signalsResponse.status || "",
          isCache: false,
        };
      } else {
        logger.error(
          `Unable to retrieve events --- ${stringify(signalsResponse.errors)}`
        );

        return {
          success: false,
          message: signalsResponse.message,
          errors: signalsResponse.errors || { message: "" },
          status: signalsResponse.status || "",
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

      const signalsResponse = await SignalModel(
        tenant
      ).getBestAirQualityLocations({ threshold, pollutant, limit, skip }, next);
      const data = signalsResponse.data;

      // Handle language translation for health tips if applicable
      if (
        language !== undefined &&
        signalsResponse.success === true &&
        !isEmpty(signalsResponse.data)
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
          signalsResponse.message || "Successfully retrieved air quality data.",
        data: signalsResponse.data,
        status: signalsResponse.status || "",
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
  getNearestSignals: async (request, next) => {
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
        const nearestCitySignal = await createSignal.findNearestCitySignal(
          latitude,
          longitude,
          tenant,
          next
        );

        if (nearestCitySignal.success) {
          return {
            success: true,
            message: `No sites found within ${radius}km radius. Showing signals from the nearest city.`,
            data: nearestCitySignal.data,
            fromNearestCity: true,
            nearestCityInfo: nearestCitySignal.cityInfo,
            status: httpStatus.OK,
          };
        } else {
          return {
            success: false,
            message:
              "No sites found within radius and no nearby city signals available",
            errors: {
              message: "No air quality data available for your location",
            },
            status: httpStatus.NOT_FOUND,
          };
        }
      }

      // Step 2: Get signals for these sites
      const siteIds = sitesWithDistance.map((site) => site._id.toString());

      const filter = {
        site_id: { $in: siteIds },
      };

      const signals = await SignalModel(tenant).recent(
        { filter, limit: 100 },
        next
      );

      if (!signals.success || isEmpty(signals.data)) {
        return {
          success: false,
          message: "No recent signals found for nearby sites",
          errors: { message: "No air quality data available for nearby sites" },
          status: httpStatus.NOT_FOUND,
        };
      }

      // Step 3: Match signals with site distances and sort
      const signalsWithDistance = signals.data
        .map((signal) => {
          const site = sitesWithDistance.find(
            (site) => site._id.toString() === signal.site_id.toString()
          );

          return {
            ...signal,
            distance: site ? site.distance : Infinity,
          };
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);

      return {
        success: true,
        message: "Successfully retrieved the nearest signals",
        data: signalsWithDistance,
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
  findNearestCitySignal: async (latitude, longitude, tenant, next) => {
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

      // Step 4: Get signals for these sites
      const siteIds = sitesInCity.map((site) => site._id.toString());

      const filter = {
        site_id: { $in: siteIds },
      };

      const signals = await SignalModel(tenant).recent(
        { filter, limit: 5 },
        next
      );

      if (!signals.success || isEmpty(signals.data)) {
        return {
          success: false,
          message: `No recent signals found for sites in ${nearestCity.name}`,
          status: httpStatus.NOT_FOUND,
        };
      }

      // Add city information to each signal
      signals.data = signals.data.map((signal) => ({
        ...signal,
        isNearestCity: true,
        distanceToUser: minDistance,
      }));

      return {
        success: true,
        message: `Successfully retrieved signals from nearest city (${nearestCity.name})`,
        data: signals.data,
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
        message: "Failed to retrieve nearest city signals",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = createSignal;
