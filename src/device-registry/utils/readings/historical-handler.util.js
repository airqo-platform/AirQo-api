const moment = require("moment-timezone");
const httpStatus = require("http-status");
const constants = require("@config/constants");

const TIMEZONE = moment.tz.guess();

// Age-based thresholds (how OLD the data is)
const HISTORICAL_AGE_THRESHOLDS = constants.HISTORICAL_AGE_THRESHOLDS;

/**
 * Analyzes query based on DATA AGE (not range)
 * @param {Object} filter - Query filter
 * @returns {Object} - Strategy decision
 */
function analyzeHistoricalQuery(filter) {
  const timeFilter = filter["values.time"] || filter["time"];

  if (!timeFilter) {
    return { strategy: "PROCESS", reason: "no_time_filter" };
  }

  const now = moment().tz(TIMEZONE);

  // Get the END time of the query (most recent point)
  const endTime = timeFilter.$lte ? moment.tz(timeFilter.$lte, TIMEZONE) : now;

  // Calculate how OLD this data is
  const dataAgeInDays = now.diff(endTime, "days");

  // Also get range for context
  const startTime = timeFilter.$gte
    ? moment.tz(timeFilter.$gte, TIMEZONE)
    : null;
  const rangeInDays = startTime ? endTime.diff(startTime, "days") : 7;

  // Decision based on DATA AGE (not range)
  if (dataAgeInDays <= HISTORICAL_AGE_THRESHOLDS.RECENT) {
    return {
      strategy: "PROCESS",
      reason: "recent_data",
      dataAgeInDays,
      rangeInDays,
      estimatedTime: "0.5-2s",
    };
  }

  if (dataAgeInDays <= HISTORICAL_AGE_THRESHOLDS.ACCEPTABLE) {
    return {
      strategy: "PROCESS",
      reason: "acceptable_age",
      dataAgeInDays,
      rangeInDays,
      estimatedTime: "5-15s",
    };
  }

  if (dataAgeInDays <= HISTORICAL_AGE_THRESHOLDS.SLOW) {
    return {
      strategy: "PROCESS_WITH_WARNING",
      reason: "old_data_slow_query",
      dataAgeInDays,
      rangeInDays,
      estimatedTime: "15-45s",
      warning: {
        message: `Querying old data (${dataAgeInDays} days ago). Consider using Analytics API for better performance.`,
        performance_impact: `Expected response time: 15-45 seconds`,
        recommendation: "Use Analytics API for historical data access",
      },
    };
  }

  if (dataAgeInDays <= HISTORICAL_AGE_THRESHOLDS.REDIRECT) {
    return {
      strategy: "SUGGEST_ANALYTICS",
      reason: "very_old_data",
      dataAgeInDays,
      rangeInDays,
      estimatedTime: "45-120s",
    };
  }

  // Data older than 2 years
  return {
    strategy: "REQUIRE_ANALYTICS",
    reason: "extremely_old_data",
    dataAgeInDays,
    rangeInDays,
    estimatedTime: "> 2 minutes",
  };
}

/**
 * Generates Analytics API recommendation details
 * @param {Object} request - Express request object
 * @param {Object} analysis - Query analysis result
 * @returns {Object} - Analytics recommendation structure
 */
function generateAnalyticsAPIResponse(request, analysis) {
  const { query, params } = request;
  const {
    startTime,
    endTime,
    site_id,
    device_id,
    tenant,
    frequency = "hourly",
  } = { ...query, ...params };

  const isSevere = analysis.strategy === "REQUIRE_ANALYTICS";
  const statusCode = isSevere ? httpStatus.BAD_REQUEST : httpStatus.OK;

  // ✅ Base response structure
  const response = {
    success: !isSevere,
    message: isSevere
      ? "Historical data query too old for this endpoint"
      : "Historical data available via Analytics API",
    status: statusCode,
    analytics_recommendation: {
      reason: `Your query accesses data from ${
        analysis.dataAgeInDays
      } days ago (${(analysis.dataAgeInDays / 365).toFixed(1)} years)`,
      performance_impact: `Current endpoint: ~${analysis.estimatedTime} response time`,
      why_slow: [
        "Old data is not in active memory/cache",
        "Requires scanning large historical collections",
        "Index performance degrades for very old data",
        "Better suited for batch/export operations",
      ],
      recommended_solution: "Use Analytics API optimized for historical data",

      endpoint_details: {
        url: `${constants.API_BASE_URL ||
          "https://api.airqo.net"}/api/v3/public/analytics/data-download`,
        method: "POST",
        description:
          "Optimized for historical data with columnar storage and pre-aggregation",
      },

      sample_request: {
        endpoint: "/api/v3/public/analytics/data-download",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer YOUR_API_KEY",
        },
        body: {
          startDateTime: startTime,
          endDateTime: endTime,
          device_category: "lowcost",
          ...(site_id ? { sites: [site_id] } : {}),
          ...(device_id ? { device_names: [device_id] } : {}),
          pollutants: ["pm2_5", "pm10"],
          frequency: frequency,
          datatype: "calibrated",
          downloadType: "json",
          outputFormat: "airqo-standard",
        },
      },

      benefits: [
        "50-100x faster for old data (columnar storage)",
        "Pre-aggregated historical data",
        "Optimized for time-series analysis",
        "Bulk export capabilities",
        "Lower server load",
      ],

      documentation: {
        full_guide:
          "https://docs.airqo.net/airqo-rest-api-documentation/analytics-api",
        video_tutorial: "https://youtu.be/LlOxshXsy7s",
        migration_guide: "https://github.com/airqo-platform/code-samples",
      },
    },
  };

  // ✅ Add blocking-specific information for severe cases
  if (isSevere) {
    response.access_information = {
      data_age: `${analysis.dataAgeInDays} days (${(
        analysis.dataAgeInDays / 365
      ).toFixed(1)} years)`,
      oldest_supported: "90 days via this endpoint",
      historical_access: "Requires Analytics API for data older than 90 days",
    };
  }

  return response;
}

module.exports = {
  analyzeHistoricalQuery,
  generateAnalyticsAPIResponse,
  HISTORICAL_AGE_THRESHOLDS,
};
