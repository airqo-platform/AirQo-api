const mongoose = require("mongoose");
const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const { logObject } = require("@utils/log"); //Removed unused logText
const ObjectId = Schema.Types.ObjectId;
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const { HttpError } = require("@utils/errors");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- event-model`
);
const moment = require("moment-timezone");

// Constants
const DEFAULT_LIMIT = 1000;
const DEFAULT_SKIP = 0;
const DEFAULT_PAGE = 1;
const UPTIME_CHECK_THRESHOLD = 168;
const AQI_RANGES = {
  /* ... (Unchanged AQI_RANGES) */
};
const MIN_READINGS_PER_DAY = 12;
const TIMEZONE = "Africa/Kampala"; // Consistent timezone

// Reusable Schemas and Data Structures
const measurementSchema = new Schema({
  value: { type: Number, default: null },
  calibratedValue: { type: Number, default: null },
  uncertaintyValue: { type: Number, default: null },
  standardDeviationValue: { type: Number, default: null },
});

const valueSchema = new Schema({
  /* ... (Existing valueSchema fields) */
  pm1: measurementSchema,
  s1_pm1: measurementSchema,
  // ... other pollutants using measurementSchema
});

const eventSchema = new Schema(
  {
    /* ... (Unchanged eventSchema) */
  },
  { timestamps: true }
);

// ... (Unchanged indexes)

// Model Middleware (simplified -  removed the error)
eventSchema.pre("save", function(next) {
  next();
});

// ... (Unchanged plugin and toJSON method)

// --- Utility Functions ---
const calculateAQI = (pm2_5Value) => {
  /* ... (AQI calculation logic) ... */
};

const aqiCategory = (pm2_5Value) => {
  const breaks = AQI_RANGES;
  if (pm2_5Value <= breaks.good.max) {
    return "Good";
  } else if (
    pm2_5Value > breaks.moderate.min &&
    pm2_5Value <= breaks.moderate.max
  ) {
    return "Moderate";
  } else if (pm2_5Value > breaks.u4sg.min && pm2_5Value <= breaks.u4sg.max) {
    return "Unhealthy for Sensitive Groups";
  } else if (
    pm2_5Value > breaks.unhealthy.min &&
    pm2_5Value <= breaks.unhealthy.max
  ) {
    return "Unhealthy";
  } else if (
    pm2_5Value > breaks.very_unhealthy.min &&
    pm2_5Value <= breaks.very_unhealthy.max
  ) {
    return "Very Unhealthy";
  } else if (pm2_5Value > breaks.hazardous.min) {
    return "Hazardous";
  } else {
    return "Unknown";
  }
};

const aqiColor = (pm2_5Value) => {
  const breaks = AQI_RANGES;
  if (pm2_5Value <= breaks.good.max) {
    return "00e400"; // Green
  } else if (
    pm2_5Value > breaks.moderate.min &&
    pm2_5Value <= breaks.moderate.max
  ) {
    return "ffff00"; // Yellow
  } else if (pm2_5Value > breaks.u4sg.min && pm2_5Value <= breaks.u4sg.max) {
    return "ff7e00"; // Orange
  } else if (
    pm2_5Value > breaks.unhealthy.min &&
    pm2_5Value <= breaks.unhealthy.max
  ) {
    return "ff0000"; // Red
  } else if (
    pm2_5Value > breaks.very_unhealthy.min &&
    pm2_5Value <= breaks.very_unhealthy.max
  ) {
    return "8f3f97"; // Purple
  } else if (pm2_5Value > breaks.hazardous.min) {
    return "7e0023"; // Maroon
  } else {
    return "Unknown"; // or some default color
  }
};

const aqiColorName = (pm2_5Value) => {
  const breaks = AQI_RANGES;
  if (pm2_5Value <= breaks.good.max) {
    return "Green";
  } else if (
    pm2_5Value > breaks.moderate.min &&
    pm2_5Value <= breaks.moderate.max
  ) {
    return "Yellow";
  } else if (pm2_5Value > breaks.u4sg.min && pm2_5Value <= breaks.u4sg.max) {
    return "Orange";
  } else if (
    pm2_5Value > breaks.unhealthy.min &&
    pm2_5Value <= breaks.unhealthy.max
  ) {
    return "Red";
  } else if (
    pm2_5Value > breaks.very_unhealthy.min &&
    pm2_5Value <= breaks.very_unhealthy.max
  ) {
    return "Purple";
  } else if (pm2_5Value > breaks.hazardous.min) {
    return "Maroon";
  } else {
    return "Unknown";
  }
};

const getElementAtIndexName = (metadata, recent) => {
  // ... (Unchanged logic)
};

const buildMetadataConfig = (metadata) => {
  // ... (Logic to build metadataConfig based on 'metadata' parameter)
};

const buildBaseProjection = (external, brief) => {
  // ... (Projection logic for external and brief filters)
};

const buildRunningProjection = () => {
  // ... (Projection logic for running filter)
};

const buildLookupStages = (metadataConfig, recent) => {
  // ... (Lookup stages logic)
};

const buildFacetStages = (
  metadataConfig,
  projection,
  sort,
  skip,
  limit,
  tenant
) => {
  // ... (Facet stages logic)
};

const buildFetchPipeline = (filter) => {
  // ... (Logic to construct the aggregation pipeline)
};

const buildAggregatePipeline = (filter, projection, sort, metadataConfig) => {
  // ... (logic to dynamically build Aggregation Pipeline)
};

// --- Data Fetching and Filtering Functions ---

const filterNullAndReportOffDevices = (data) => {
  const filteredData = data.filter((record) => record.pm2_5?.value !== null); // Using optional chaining

  data.forEach((record) => {
    // ... (Offline device reporting logic using record.timeDifferenceHours)

    if (record.pm2_5?.value === null) {
      // Using optional chaining
      // ... (Null pm2_5 reporting logic)
    }
  });

  return filteredData;
};

const filterNull = (data) =>
  data.filter((record) => record.pm2_5?.value !== null); //Using optional chaining

const computeAveragePm2_5 = (transformedData) => {
  let total = 0;
  let validDataPoints = 0; // Keep track of non-null values

  transformedData.forEach((record) => {
    if (record.pm2_5?.value !== null) {
      //Handle potential null values
      total += record.pm2_5.value;
      validDataPoints++;
    }
  });

  return validDataPoints > 0 ? total / validDataPoints : null; // Avoid division by zero
};

const fetchData = async (model, filter) => {
  const {
    effectiveSkip,
    startTime,
    endTime,
    metadataConfig,
    projection,
    sort,
    lookupStages,
    facetStages,
    aggregationPipeline,
  } = buildFetchPipeline(filter);
  const data = await model.aggregate(aggregationPipeline).allowDiskUse(true);

  return data;
};

const signalData = async (model, filter) => {
  const modifiedFilter = { ...filter, recent: "yes", metadata: "site_id" };

  const { aggregationPipeline } = buildFetchPipeline(modifiedFilter);
  const data = await model.aggregate(aggregationPipeline).allowDiskUse(true);

  return data;
};

// --- Static Methods ---
eventSchema.statics.createEvent = async function(args) {
  return this.create({ ...args });
};

eventSchema.statics.list = async function(
  {
    skip = DEFAULT_SKIP,
    limit = DEFAULT_LIMIT,
    filter = {},
    page = DEFAULT_PAGE,
  } = {},
  next
) {
  try {
    const { aggregationPipeline, meta, projection } = buildAggregatePipeline(
      filter
    ); // construct pipeline

    const data = await this.aggregate(aggregationPipeline).allowDiskUse(true);

    data[0].data = data[0].data.filter((record) => record.pm2_5 !== null);

    return {
      success: true,
      data,
      message: "Successfully returned the measurements",
      status: httpStatus.OK,
    };
  } catch (error) {
    // ... (Error handling)
  }
};

eventSchema.statics.view = async function(filter, next) {
  try {
    const request = {
      ...filter,
      skip: filter.skip || DEFAULT_SKIP,
      limit: filter.limit || DEFAULT_LIMIT,
      page: filter.page || DEFAULT_PAGE,
    };

    const result = await fetchData(this, request);
    const transformedData = filterNull(result[0].data); // Use refactored filterNull
    result[0].data = transformedData;
    const calculatedValues = computeAveragePm2_5(transformedData); // Use refactored computeAveragePm2_5
    result[0].meta.pm2_5Avg = calculatedValues;

    return {
      // ... (success response)
    };
  } catch (error) {
    // ... (Error handling)
  }
};

eventSchema.statics.fetch = async function(filter) {
  // Very similar to 'view' - consider consolidating if logic is identical.
  // ... similar logic as 'view' ...
};

eventSchema.statics.signal = async function(filter) {
  // Very similar to 'view' - consider consolidating if logic is identical.
  // ... similar logic as 'view' ...
};

// --- Refactored Averages functions ---

const calculateDataQuality = (
  dailyData,
  minReadings = MIN_READINGS_PER_DAY
) => {
  return {
    hasMinReadings: dailyData.readingCount >= minReadings,
    hoursCovered: dailyData.uniqueHours.length, // Use Set length directly
    readingSpread: dailyData.maxReading - dailyData.minReading,
  };
};

const calculateWeeklyDataQuality = (currentWeek, previousWeek) => {
  // ... (Unchanged logic)
};

const computeAirQualityStatistics = (data, timezone = TIMEZONE) => {
  return data.map((item) => ({
    time: item.time,
    pm2_5: item.pm2_5.value, // Corrected:  Access pm2_5.value
    yearWeek: moment(item.time)
      .tz(timezone)
      .format("GGGG-WW"),
    dayOfYear: moment(item.time)
      .tz(timezone)
      .format("YYYY-MM-DD"),
    hourOfDay: moment(item.time)
      .tz(timezone)
      .hour(),
  }));
};

eventSchema.statics.getAirQualityAverages = async function(siteId, next) {
  try {
    // ... (Date calculations using TIMEZONE constant)

    const aggregationPipeline = [
      //Match Stage
      {
        $match: {
          "values.site_id": mongoose.Types.ObjectId(siteId),
          "values.time": { $gte: twoWeeksAgo, $lte: now },
        },
      },
      //Unwind stage
      {
        $unwind: {
          path: "$values",
          preserveNullAndEmptyArrays: false,
        },
      },
      //Project Stage
      {
        $project: {
          _id: 0,
          time: "$values.time",
          pm2_5: "$values.pm2_5",
        },
      },
    ];

    let result = await this.aggregate(aggregationPipeline).allowDiskUse(true);
    result = computeAirQualityStatistics(result);

    let averages = result.reduce((acc, curr) => {
      // ... (grouping and averaging logic by dayOfYear and yearWeek)
    }, {});

    averages = Object.values(averages);

    if (averages.length < 2) {
      // ... (handle insufficient data)
    }

    const [currentWeek, previousWeek] = averages.sort(
      (a, b) => new Date(b._id) - new Date(a._id)
    );

    // ... (rest of the logic to compute todayAverage and percentageDifference )
  } catch (error) {
    // ... (Error handling)
  }
};

eventSchema.statics.v2_getAirQualityAverages = async function(siteId, next) {
  //Implementation will be very similar to getAirQualityAverages leveraging the utility functions created
};

// ... (Helper functions calculateConfidenceScore remain unchanged)

const eventsModel = (tenant) => {
  /* ... (Unchanged model creation logic) */
};

module.exports = eventsModel;
