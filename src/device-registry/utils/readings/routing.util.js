const moment = require("moment-timezone");
const { logText } = require("@utils/shared");
const constants = require("@config/constants");

const READINGS_TTL_DAYS = 14;
const TIMEZONE = moment.tz.guess();

/**
 * Determines if a query should use the Readings collection
 * @param {Object} filter - The query filter object (Events or Readings format)
 * @returns {Object} - { useReadings: boolean, reason: string, splitQuery: boolean }
 */
function determineCollectionRoute(filter) {
  const now = moment().tz(TIMEZONE);
  const readingsCutoff = moment()
    .tz(TIMEZONE)
    .subtract(READINGS_TTL_DAYS, "days");

  // ✅ FIX: Support both Events format (values.time) and Readings format (time)
  const timeFilter = filter["values.time"] || filter["time"];

  if (!timeFilter) {
    return {
      useReadings: false,
      reason: "no_time_filter",
      splitQuery: false,
    };
  }

  // ✅ FIX: Use timezone-aware parsing
  const startTime = timeFilter.$gte
    ? moment.tz(timeFilter.$gte, TIMEZONE)
    : null;
  const endTime = timeFilter.$lte ? moment.tz(timeFilter.$lte, TIMEZONE) : now;

  // If no start time, assume recent query
  if (!startTime) {
    return {
      useReadings: true,
      reason: "no_start_time_recent_query",
      splitQuery: false,
    };
  }

  // Check if entire range is within Readings TTL
  if (startTime.isAfter(readingsCutoff)) {
    return {
      useReadings: true,
      reason: "entire_range_within_ttl",
      splitQuery: false,
      dateRange: {
        start: startTime.toDate(),
        end: endTime.toDate(),
      },
    };
  }

  // Check if entire range is before Readings TTL (historical only)
  if (endTime.isBefore(readingsCutoff)) {
    return {
      useReadings: false,
      reason: "entire_range_historical",
      splitQuery: false,
      dateRange: {
        start: startTime.toDate(),
        end: endTime.toDate(),
      },
    };
  }

  // Query spans both collections - use Events for consistency
  return {
    useReadings: false,
    reason: "query_spans_both_periods",
    splitQuery: true,
    dateRange: {
      start: startTime.toDate(),
      end: endTime.toDate(),
      cutoff: readingsCutoff.toDate(),
    },
  };
}

/**
 * Converts Events filter format to Readings filter format
 * @param {Object} eventsFilter - Filter object for Events collection
 * @returns {Object} - Filter object for Readings collection
 */
function convertEventsFilterToReadingsFilter(eventsFilter) {
  const readingsFilter = {};

  // Map values.* fields to root-level fields
  Object.keys(eventsFilter).forEach((key) => {
    if (key.startsWith("values.")) {
      // Remove 'values.' prefix
      const readingsKey = key.replace("values.", "");
      readingsFilter[readingsKey] = eventsFilter[key];
    } else if (key === "day") {
      /***
       * Skip day field - not used in Readings.
      The 'day' field is used in the Events collection for partitioning/indexing,
      but the Readings collection does not use or require this field due to differences
      in their data models and storage strategies.
       */
    } else if (
      key !== "metadata" &&
      key !== "external" &&
      key !== "tenant" &&
      key !== "recent" &&
      key !== "frequency" &&
      key !== "device" &&
      key !== "page" &&
      key !== "running" &&
      key !== "brief" &&
      key !== "index" &&
      key !== "limit" &&
      key !== "skip" &&
      key !== "active" &&
      key !== "internal" &&
      key !== "isHistorical"
    ) {
      // Copy other fields as-is
      readingsFilter[key] = eventsFilter[key];
    }
  });

  return readingsFilter;
}

module.exports = {
  determineCollectionRoute,
  convertEventsFilterToReadingsFilter,
  READINGS_TTL_DAYS,
};
