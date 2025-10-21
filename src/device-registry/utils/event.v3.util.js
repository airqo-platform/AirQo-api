const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- event-v3-util`);
const httpStatus = require("http-status");
const { logText, logObject } = require("@utils/shared");
const isEmpty = require("is-empty");
const stringify = require("@utils/stringify");

// Import V3-specific utilities
const { isHistoricalMeasurement } = require("@utils/readings/routing.util");
const { intelligentFetch } = require("@utils/readings/fetch.util");
const {
  analyzeHistoricalQuery,
  generateAnalyticsAPIResponse,
} = require("@utils/readings/historical-handler.util");

// Import shared utilities from V2
const { generateFilter } = require("@utils/common");
const translate = require("@utils/translate");
const createEvent = require("@utils/event.util"); // For cache operations

const createEventV3 = {
  /**
   * V3: List with intelligent routing and age-based blocking
   */
  listV3: async (request, next) => {
    try {
      let missingDataMessage = "";
      const { query } = request;
      let { limit, skip, recent } = query;
      const isHistorical = isHistoricalMeasurement(request);

      limit = Number(limit);
      skip = Number(skip);

      if (Number.isNaN(limit) || limit < 0) {
        limit = 30;
      }

      if (Number.isNaN(skip) || skip < 0) {
        skip = 0;
      }

      const { tenant } = query;
      let page = parseInt(query.page);
      const language = request.query.language;

      const filter = generateFilter.events(request, next);
      filter.isHistorical = isHistorical;

      // SINGLE historical analysis - do it once upfront
      let historicalAnalysis = null;
      if (isHistorical) {
        historicalAnalysis = analyzeHistoricalQuery(filter);

        // Enhanced logging with age-based metrics
        logText(
          `[V3] 📊 Query Analysis: Age=${historicalAnalysis.dataAgeInDays}d (${(
            historicalAnalysis.dataAgeInDays / 365
          ).toFixed(1)}y) | ` +
            `Range=${historicalAnalysis.rangeInDays}d | Strategy=${historicalAnalysis.strategy} | ` +
            `Est=${historicalAnalysis.estimatedTime}`
        );

        // Block extremely old queries immediately (before cache/fetch)
        if (historicalAnalysis.strategy === "REQUIRE_ANALYTICS") {
          logText(
            `[V3] 🚫 Blocking very old query (${(
              historicalAnalysis.dataAgeInDays / 365
            ).toFixed(1)} years old) - ` + `redirecting to Analytics API`
          );
          return generateAnalyticsAPIResponse(request, historicalAnalysis);
        }

        // Warn about old data queries
        if (
          historicalAnalysis.strategy === "SUGGEST_ANALYTICS" ||
          historicalAnalysis.strategy === "PROCESS_WITH_WARNING"
        ) {
          logText(
            `[V3] ⚠️ Processing old data query (${historicalAnalysis.dataAgeInDays} days ago, ` +
              `${(historicalAnalysis.dataAgeInDays / 365).toFixed(
                1
              )} years) - ` +
              `may be slow (est: ${historicalAnalysis.estimatedTime}), recommending Analytics API`
          );
        }
      }

      logText(
        isHistorical
          ? "[V3] Using optimized historical data query"
          : "[V3] Using standard data query with intelligent routing"
      );

      // Cache check
      try {
        const cacheResult = await createEvent.handleCacheOperation(
          "get",
          null,
          request,
          next
        );
        if (cacheResult.success === true) {
          logText("[V3] Cache hit - returning cached result");
          return cacheResult.data;
        }
      } catch (error) {
        logger.warn(`[V3] Cache get operation failed: ${stringify(error)}`);
      }

      if (page) {
        skip = parseInt((page - 1) * limit);
      }

      // ✅ Track query performance
      const queryStartTime = Date.now();

      // Fetch data with intelligent routing
      const responseFromListEvents = await intelligentFetch(
        tenant,
        filter,
        limit,
        skip,
        page
      );

      // ✅ Alert if blocker failed
      if (isHistorical) {
        const queryDuration = (Date.now() - queryStartTime) / 1000;

        if (queryDuration > 10) {
          logger.error(
            `[V3] 🚨 BLOCKER BYPASS ALERT: Historical query took ${queryDuration.toFixed(
              2
            )}s! ` +
              `Age=${historicalAnalysis?.dataAgeInDays}d | ` +
              `Strategy=${historicalAnalysis?.strategy} | ` +
              `This should have been blocked!`
          );
        } else if (
          historicalAnalysis &&
          historicalAnalysis.dataAgeInDays > 90
        ) {
          logger.info(
            `[V3] ✅ Old query processed in ${queryDuration.toFixed(2)}s ` +
              `(Age=${historicalAnalysis.dataAgeInDays}d, ${(
                historicalAnalysis.dataAgeInDays / 365
              ).toFixed(1)}y)`
          );
        }
      }

      if (!responseFromListEvents) {
        logger.error(`[V3] 🐛🐛 intelligentFetch returned null or undefined`);
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: "Error retrieving events from the database" },
        };
      }

      // Translation for recent data only
      if (
        !isHistorical &&
        language !== undefined &&
        !isEmpty(responseFromListEvents) &&
        responseFromListEvents.success === true &&
        !isEmpty(responseFromListEvents.data[0].data)
      ) {
        const data = responseFromListEvents.data[0].data;
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

      if (responseFromListEvents.success === true) {
        const data = responseFromListEvents.data;
        data[0].data = !isEmpty(missingDataMessage) ? [] : data[0].data;

        // Add Analytics API recommendation for old data queries
        if (
          isHistorical &&
          historicalAnalysis &&
          (historicalAnalysis.strategy === "SUGGEST_ANALYTICS" ||
            historicalAnalysis.strategy === "PROCESS_WITH_WARNING")
        ) {
          const analyticsInfo = generateAnalyticsAPIResponse(
            request,
            historicalAnalysis
          );

          // Add recommendation to the response meta
          if (data[0].meta) {
            data[0].meta.analytics_recommendation =
              analyticsInfo.analytics_recommendation;
            data[0].meta.query_performance = {
              data_age_days: historicalAnalysis.dataAgeInDays,
              data_age_years: (historicalAnalysis.dataAgeInDays / 365).toFixed(
                1
              ),
              estimated_time: historicalAnalysis.estimatedTime,
              query_strategy: historicalAnalysis.strategy,
            };
          }
        }

        logText("[V3] Setting cache...");

        try {
          await createEvent.handleCacheOperation("set", data, request, next);
        } catch (error) {
          logger.warn(`[V3] Cache set operation failed: ${stringify(error)}`);
        }

        logText("[V3] Cache operation completed.");

        return {
          success: true,
          message: !isEmpty(missingDataMessage)
            ? missingDataMessage
            : isEmpty(data[0].data)
            ? "no measurements for this search"
            : responseFromListEvents.message,
          data,
          status: responseFromListEvents.status || "",
          isCache: false,
        };
      } else {
        logger.error(
          `[V3] Unable to retrieve events --- ${stringify(
            responseFromListEvents.errors
          )}`
        );

        return {
          success: false,
          message: responseFromListEvents.message,
          errors: responseFromListEvents.errors || { message: "" },
          status: responseFromListEvents.status || "",
          isCache: false,
        };
      }
    } catch (error) {
      logger.error(`[V3] 🐛🐛 Internal Server Error ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  // Add other V3-specific functions as needed
};

module.exports = createEventV3;
