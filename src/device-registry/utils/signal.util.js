const SignalModel = require("@models/Signal");
const {
  logObject,
  logText,
  HttpError,
  logTextWithTimestamp,
} = require("@utils/shared");
const constants = require("@config/constants");
const { generateFilter, translate, stringify } = require("@utils/common");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- signal-util`);
const httpStatus = require("http-status");
const createEventUtil = require("@utils/event.util");

const elementAtIndexName = (metadata, recent) => {
  if (metadata === "site" || metadata === "site_id") {
    if (!recent || recent === "yes") {
      return { $first: { $arrayElemAt: ["$siteDetails", 0] } };
    }
    if (recent === "no") {
      return { $arrayElemAt: ["$siteDetails", 0] };
    }
  }

  if (!metadata || metadata === "device" || metadata === "device_id") {
    if (!recent || recent === "yes") {
      return { $first: { $arrayElemAt: ["$deviceDetails", 0] } };
    }
    if (recent === "no") {
      return { $arrayElemAt: ["$deviceDetails", 0] };
    }
  }
};

function generateAqiAddFields() {
  return {
    $addFields: {
      device: "$device",
      aqi_color: {
        $switch: {
          branches: [
            {
              case: {
                $and: [
                  { $gte: ["$pm2_5.value", constants.AQI_RANGES.good.min] },
                  { $lte: ["$pm2_5.value", constants.AQI_RANGES.good.max] },
                ],
              },
              then: constants.AQI_COLORS.good,
            },
            {
              case: {
                $and: [
                  { $gte: ["$pm2_5.value", constants.AQI_RANGES.moderate.min] },
                  { $lte: ["$pm2_5.value", constants.AQI_RANGES.moderate.max] },
                ],
              },
              then: constants.AQI_COLORS.moderate,
            },
            {
              case: {
                $and: [
                  { $gte: ["$pm2_5.value", constants.AQI_RANGES.u4sg.min] },
                  { $lte: ["$pm2_5.value", constants.AQI_RANGES.u4sg.max] },
                ],
              },
              then: constants.AQI_COLORS.u4sg,
            },
            {
              case: {
                $and: [
                  {
                    $gte: ["$pm2_5.value", constants.AQI_RANGES.unhealthy.min],
                  },
                  {
                    $lte: ["$pm2_5.value", constants.AQI_RANGES.unhealthy.max],
                  },
                ],
              },
              then: constants.AQI_COLORS.unhealthy,
            },
            {
              case: {
                $and: [
                  {
                    $gte: [
                      "$pm2_5.value",
                      constants.AQI_RANGES.very_unhealthy.min,
                    ],
                  },
                  {
                    $lte: [
                      "$pm2_5.value",
                      constants.AQI_RANGES.very_unhealthy.max,
                    ],
                  },
                ],
              },
              then: constants.AQI_COLORS.very_unhealthy,
            },
            {
              case: {
                $gte: ["$pm2_5.value", constants.AQI_RANGES.hazardous.min],
              },
              then: constants.AQI_COLORS.hazardous,
            },
          ],
          default: constants.AQI_COLORS.unknown,
        },
      },
      aqi_category: {
        $switch: {
          branches: [
            {
              case: {
                $and: [
                  { $gte: ["$pm2_5.value", constants.AQI_RANGES.good.min] },
                  { $lte: ["$pm2_5.value", constants.AQI_RANGES.good.max] },
                ],
              },
              then: constants.AQI_CATEGORIES.good,
            },
            {
              case: {
                $and: [
                  { $gte: ["$pm2_5.value", constants.AQI_RANGES.moderate.min] },
                  { $lte: ["$pm2_5.value", constants.AQI_RANGES.moderate.max] },
                ],
              },
              then: constants.AQI_CATEGORIES.moderate,
            },
            {
              case: {
                $and: [
                  { $gte: ["$pm2_5.value", constants.AQI_RANGES.u4sg.min] },
                  { $lte: ["$pm2_5.value", constants.AQI_RANGES.u4sg.max] },
                ],
              },
              then: constants.AQI_CATEGORIES.u4sg,
            },
            {
              case: {
                $and: [
                  {
                    $gte: ["$pm2_5.value", constants.AQI_RANGES.unhealthy.min],
                  },
                  {
                    $lte: ["$pm2_5.value", constants.AQI_RANGES.unhealthy.max],
                  },
                ],
              },
              then: constants.AQI_CATEGORIES.unhealthy,
            },
            {
              case: {
                $and: [
                  {
                    $gte: [
                      "$pm2_5.value",
                      constants.AQI_RANGES.very_unhealthy.min,
                    ],
                  },
                  {
                    $lte: [
                      "$pm2_5.value",
                      constants.AQI_RANGES.very_unhealthy.max,
                    ],
                  },
                ],
              },
              then: constants.AQI_CATEGORIES.very_unhealthy,
            },
            {
              case: {
                $gte: ["$pm2_5.value", constants.AQI_RANGES.hazardous.min],
              },
              then: constants.AQI_CATEGORIES.hazardous,
            },
          ],
          default: constants.AQI_CATEGORIES.unknown,
        },
      },
      aqi_color_name: {
        $switch: {
          branches: [
            {
              case: {
                $and: [
                  { $gte: ["$pm2_5.value", constants.AQI_RANGES.good.min] },
                  { $lte: ["$pm2_5.value", constants.AQI_RANGES.good.max] },
                ],
              },
              then: constants.AQI_COLOR_NAMES.good,
            },
            {
              case: {
                $and: [
                  { $gte: ["$pm2_5.value", constants.AQI_RANGES.moderate.min] },
                  { $lte: ["$pm2_5.value", constants.AQI_RANGES.moderate.max] },
                ],
              },
              then: constants.AQI_COLOR_NAMES.moderate,
            },
            {
              case: {
                $and: [
                  { $gte: ["$pm2_5.value", constants.AQI_RANGES.u4sg.min] },
                  { $lte: ["$pm2_5.value", constants.AQI_RANGES.u4sg.max] },
                ],
              },
              then: constants.AQI_COLOR_NAMES.u4sg,
            },
            {
              case: {
                $and: [
                  {
                    $gte: ["$pm2_5.value", constants.AQI_RANGES.unhealthy.min],
                  },
                  {
                    $lte: ["$pm2_5.value", constants.AQI_RANGES.unhealthy.max],
                  },
                ],
              },
              then: constants.AQI_COLOR_NAMES.unhealthy,
            },
            {
              case: {
                $and: [
                  {
                    $gte: [
                      "$pm2_5.value",
                      constants.AQI_RANGES.very_unhealthy.min,
                    ],
                  },
                  {
                    $lte: [
                      "$pm2_5.value",
                      constants.AQI_RANGES.very_unhealthy.max,
                    ],
                  },
                ],
              },
              then: constants.AQI_COLOR_NAMES.very_unhealthy,
            },
            {
              case: {
                $gte: ["$pm2_5.value", constants.AQI_RANGES.hazardous.min],
              },
              then: constants.AQI_COLOR_NAMES.hazardous,
            },
          ],
          default: constants.AQI_COLOR_NAMES.unknown,
        },
      },
      aqi_ranges: constants.AQI_RANGES,
    },
  };
}

function filterNullAndReportOffDevices(data) {
  // Ensure data is an array and handle null/undefined input
  if (!Array.isArray(data)) return [];

  // Helper function for safe property access
  function safeGetValue(obj, path, defaultValue) {
    if (!obj) return defaultValue;
    const keys = path.split(".");
    let current = obj;
    for (let key of keys) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== "object"
      ) {
        return defaultValue;
      }
      current = current[key];
    }
    return current !== undefined ? current : defaultValue;
  }

  // Helper function to log device information
  function logDeviceInfo(message, record) {
    const device = safeGetValue(record, "device", "");
    const frequency = safeGetValue(record, "frequency", "");
    const time = safeGetValue(record, "time", "");
    const siteName = safeGetValue(record, "siteDetails.name", "");

    const logMessage = `${message} for device: ${device}, frequency ${frequency}, time ${time} and site ${siteName}`;

    logObject(logMessage);

    if (constants.ENVIRONMENT === "PRODUCTION ENVIRONMENT") {
      const prodMessage = `${message} for device: ${device}, Frequency: ${frequency}, Time: ${time}, Site Name: ${siteName}`;
      logger.info(prodMessage);
    }
  }

  // Helper function to check if pm2_5 value is valid
  function hasPm25Value(record) {
    if (!record) return false;

    // Handle case where pm2_5 is a direct value
    if (typeof record.pm2_5 === "number") {
      return record.pm2_5 !== null && !isNaN(record.pm2_5);
    }

    // Handle case where pm2_5 is an object with value property
    if (record.pm2_5 && typeof record.pm2_5 === "object") {
      return (
        record.pm2_5.value !== null &&
        record.pm2_5.value !== undefined &&
        !isNaN(record.pm2_5.value)
      );
    }

    // Handle null/undefined pm2_5
    return record.pm2_5 !== null && record.pm2_5 !== undefined;
  }

  // Process each record for logging
  data.forEach(function(record) {
    // Skip null/undefined records
    if (!record) return;

    // Check uptime threshold
    if (
      typeof record.timeDifferenceHours === "number" &&
      record.timeDifferenceHours > constants.UPTIME_CHECK_THRESHOLD
    ) {
      logDeviceInfo(
        `🪫🪫 Last refreshed time difference exceeds ${constants.UPTIME_CHECK_THRESHOLD} hours`,
        record
      );
    }

    // Check for null pm2_5 values
    if (!hasPm25Value(record)) {
      logDeviceInfo("😲😲 Null pm2_5 value", record);
    }
  });

  // Filter out records with invalid pm2_5 values
  return data.filter(function(record) {
    return record && hasPm25Value(record);
  });
}

function computeAveragePm2_5(transformedData) {
  let total = 0;
  transformedData.forEach((record) => {
    total += record.pm2_5.value;
  });
  const average = total / transformedData.length;
  return average;
}

const createSignal = {
  signal: async (request, next) => {
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

      const readingsResponse = await SignalModel(tenant).latest(
        {
          skip,
          limit,
        },
        next
      );

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
};

module.exports = createSignal;
