/*
Changes made to `valueSchema` schema may affect the format of messages 
received from the message broker (Kafka). Consider updating 
the schema `AirQo-api/kafka/schemas/transformed-device-measurements.avsc`
and following up on its deployment. :)
*/

const mongoose = require("mongoose");
const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const { logObject, logText, HttpError } = require("@utils/shared");
const ObjectId = Schema.Types.ObjectId;
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");

const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- event-model`
);
const DEFAULT_LIMIT = 1000;
const DEFAULT_SKIP = 0;
const DEFAULT_PAGE = 1;
// const UPTIME_CHECK_THRESHOLD = 168; // This constant is not used in this file
const moment = require("moment-timezone");
const TIMEZONE = moment.tz.guess();

const COUNT_TIMEOUT_MS = 15000;
const AGGREGATE_TIMEOUT_MS = 90000;
const SLOW_QUERY_THRESHOLD_MS = 15000;
const SKIP_COUNT_THRESHOLD = 500;

const AQI_COLORS = constants.AQI_COLORS;
const AQI_CATEGORIES = constants.AQI_CATEGORIES;
const AQI_COLOR_NAMES = constants.AQI_COLOR_NAMES;
const AQI_RANGES = constants.AQI_RANGES;

// Shared AQI condition branches to avoid duplication
const AQI_BRANCHES = [
  {
    case: {
      $and: [
        { $gte: ["$pm2_5.value", "$aqi_ranges.good.min"] },
        { $lte: ["$pm2_5.value", "$aqi_ranges.good.max"] },
      ],
    },
    thenColor: AQI_COLORS.good,
    thenCategory: AQI_CATEGORIES.good,
    thenColorName: AQI_COLOR_NAMES.good,
  },
  {
    case: {
      $and: [
        { $gte: ["$pm2_5.value", "$aqi_ranges.moderate.min"] },
        { $lte: ["$pm2_5.value", "$aqi_ranges.moderate.max"] },
      ],
    },
    thenColor: AQI_COLORS.moderate,
    thenCategory: AQI_CATEGORIES.moderate,
    thenColorName: AQI_COLOR_NAMES.moderate,
  },
  {
    case: {
      $and: [
        { $gte: ["$pm2_5.value", "$aqi_ranges.u4sg.min"] },
        { $lte: ["$pm2_5.value", "$aqi_ranges.u4sg.max"] },
      ],
    },
    thenColor: AQI_COLORS.u4sg,
    thenCategory: AQI_CATEGORIES.u4sg,
    thenColorName: AQI_COLOR_NAMES.u4sg,
  },
  {
    case: {
      $and: [
        { $gte: ["$pm2_5.value", "$aqi_ranges.unhealthy.min"] },
        { $lte: ["$pm2_5.value", "$aqi_ranges.unhealthy.max"] },
      ],
    },
    thenColor: AQI_COLORS.unhealthy,
    thenCategory: AQI_CATEGORIES.unhealthy,
    thenColorName: AQI_COLOR_NAMES.unhealthy,
  },
  {
    case: {
      $and: [
        { $gte: ["$pm2_5.value", "$aqi_ranges.very_unhealthy.min"] },
        { $lte: ["$pm2_5.value", "$aqi_ranges.very_unhealthy.max"] },
      ],
    },
    thenColor: AQI_COLORS.very_unhealthy,
    thenCategory: AQI_CATEGORIES.very_unhealthy,
    thenColorName: AQI_COLOR_NAMES.very_unhealthy,
  },
  {
    case: { $gte: ["$pm2_5.value", "$aqi_ranges.hazardous.min"] },
    thenColor: AQI_COLORS.hazardous,
    thenCategory: AQI_CATEGORIES.hazardous,
    thenColorName: AQI_COLOR_NAMES.hazardous,
  },
];

// Helper function to build MongoDB $switch expressions
// from the shared AQI branches using a specific "then" property
const buildSwitchExpression = (thenProperty) => ({
  $switch: {
    branches: AQI_BRANCHES.map((branch) => ({
      case: branch.case,
      then: branch[thenProperty],
    })),
    default: {
      thenColor: AQI_COLORS.unknown,
      thenCategory: AQI_CATEGORIES.unknown,
      thenColorName: AQI_COLOR_NAMES.unknown,
    }[thenProperty],
  },
});

// MongoDB switch case expression for AQI color
const getAqiColorExpression = () => buildSwitchExpression("thenColor");

// MongoDB switch case expression for AQI category
const getAqiCategoryExpression = () => buildSwitchExpression("thenCategory");

// MongoDB switch case expression for AQI color name
const getAqiColorNameExpression = () => buildSwitchExpression("thenColorName");

// Function to generate the AQI addFields for MongoDB aggregation pipelines
function generateAqiAddFields() {
  return {
    $addFields: {
      device: "$device",
      aqi_color: getAqiColorExpression(),
      aqi_category: getAqiCategoryExpression(),
      aqi_color_name: getAqiColorNameExpression(),
      aqi_ranges: AQI_RANGES,
    },
  };
}

const valueSchema = new Schema({
  time: {
    type: Date,
    required: [true, "the timestamp is required"],
  },
  frequency: {
    type: String,
    required: [true, "the frequency is required"],
    trim: true,
  },
  is_test_data: {
    type: Boolean,
    trim: true,
  },
  /**** */
  device: {
    type: String,
    trim: true,
    default: null,
  },
  tenant: {
    type: String,
    trim: true,
  },
  network: {
    type: String,
    trim: true,
  },
  grid_id: {
    type: ObjectId,
    ref: "grid",
    required: false,
  },
  is_device_primary: {
    type: Boolean,
    trim: true,
  },
  deployment_type: {
    type: String,
    enum: ["static", "mobile"],
    default: "static",
    trim: true,
    lowercase: true,
  },
  device_id: {
    type: ObjectId,
    required: [true, "The device ID is required"],
  },
  device_number: {
    type: Number,
    default: null,
  },
  site: {
    type: String,
    default: null,
  },
  site_id: {
    type: ObjectId,
    required: false,
  },
  /**** */
  pm1: {
    value: {
      type: Number,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  s1_pm1: {
    value: {
      type: Number,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  s2_pm1: {
    value: {
      type: Number,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  pm2_5: {
    value: {
      type: Number,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  s1_pm2_5: {
    value: {
      type: Number,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  s2_pm2_5: {
    value: {
      type: Number,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  pm10: {
    value: {
      type: Number,
      trim: true,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  s1_pm10: {
    value: {
      type: Number,
      trim: true,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  s2_pm10: {
    value: {
      type: Number,
      trim: true,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  no2: {
    value: {
      type: Number,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  battery: {
    value: {
      type: Number,
      default: null,
    },
  },
  location: {
    latitude: {
      value: {
        type: Number,
        default: null,
        min: -90,
        max: 90,
        validate: {
          validator: function(v) {
            // For mobile devices, latitude is required
            if (
              this.parent().deployment_type === "mobile" &&
              (v === null || v === undefined)
            ) {
              return false;
            }
            return true;
          },
          message: "Mobile devices require valid latitude coordinates",
        },
      },
    },
    longitude: {
      value: {
        type: Number,
        default: null,
        min: -180,
        max: 180,
        validate: {
          validator: function(v) {
            // For mobile devices, longitude is required
            if (
              this.parent().deployment_type === "mobile" &&
              (v === null || v === undefined)
            ) {
              return false;
            }
            return true;
          },
          message: "Mobile devices require valid longitude coordinates",
        },
      },
    },
    accuracy: {
      type: Number,
      default: null,
    },
    speed: {
      type: Number,
      default: null,
    },
    heading: {
      type: Number,
      default: null,
    },
  },
  altitude: {
    value: {
      type: Number,
      default: null,
    },
  },
  speed: {
    value: {
      type: Number,
      default: null,
    },
  },
  satellites: {
    value: {
      type: Number,
      default: null,
    },
  },
  hdop: {
    value: {
      type: Number,
      default: null,
    },
  },

  tvoc: {
    value: {
      type: Number,
      default: null,
    },
  },

  co2: {
    value: {
      type: Number,
      default: null,
    },
  },

  hcho: {
    value: {
      type: Number,
      default: null,
    },
  },

  intaketemperature: {
    value: {
      type: Number,
      default: null,
    },
  },

  intakehumidity: {
    value: {
      type: Number,
      default: null,
    },
  },

  internalTemperature: {
    value: {
      type: Number,
      default: null,
    },
  },
  internalHumidity: {
    value: {
      type: Number,
      default: null,
    },
  },
  externalTemperature: {
    value: {
      type: Number,
      default: null,
    },
  },
  externalHumidity: {
    value: {
      type: Number,
      default: null,
    },
  },
  average_pm2_5: {
    value: {
      type: Number,
      trim: true,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  average_pm10: {
    value: {
      type: Number,
      trim: true,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  externalPressure: {
    value: { type: Number, default: null },
  },
  externalAltitude: {
    value: {
      type: Number,
      default: null,
    },
  },
  rtc_adc: {
    value: {
      type: Number,
      default: null,
    },
  },
  rtc_v: {
    value: {
      type: Number,
      default: null,
    },
  },
  rtc: {
    value: {
      type: Number,
      default: null,
    },
  },
  stc_adc: {
    value: {
      type: Number,
      default: null,
    },
  },
  stc_v: {
    value: {
      type: Number,
      default: null,
    },
  },
  stc: {
    value: {
      type: Number,
      default: null,
    },
  },
});

const eventSchema = new Schema(
  {
    day: {
      type: String,
      required: [true, "the day is required"],
    },
    device: {
      type: String,
      trim: true,
      default: null,
    },
    network: {
      type: String,
      trim: true,
      default: "airqo",
    },
    tenant: {
      type: String,
      trim: true,
      default: "airqo",
    },
    is_device_primary: {
      type: Boolean,
      trim: true,
    },
    device_id: {
      type: ObjectId,
    },
    device_number: {
      type: Number,
      default: null,
    },
    site: {
      type: String,
      default: null,
    },
    site_id: {
      type: ObjectId,
      required: false,
    },
    grid_id: {
      type: ObjectId,
      ref: "grid",
      required: false,
    },
    deployment_type: {
      type: String,
      enum: ["static", "mobile"],
      default: "static",
      trim: true,
      lowercase: true,
    },
    first: {
      type: Date,
      required: [true, "the first day's event is required"],
    },
    last: {
      type: Date,
      required: [true, "the last day's event is required"],
    },
    nValues: {
      type: Number,
      required: [true, "the nValues is required"],
    },
    values: [valueSchema],
  },
  {
    timestamps: true,
  }
);

eventSchema.index(
  {
    "values.time": 1,
    device_id: 1,
    site_id: 1,
    grid_id: 1,
    "values.frequency": 1,
    day: 1,
    deployment_type: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      nValues: { $lt: parseInt(constants.N_VALUES || 500) },
      $or: [
        { deployment_type: "static", site_id: { $exists: true } },
        { deployment_type: "mobile", grid_id: { $exists: true } },
      ],
    },
  }
);

//mobile device location queries
eventSchema.index({
  "values.location.latitude.value": 1,
  "values.location.longitude.value": 1,
  "values.time": 1,
  deployment_type: 1,
});

//for grid-based queries
eventSchema.index({
  grid_id: 1,
  "values.time": 1,
  deployment_type: 1,
});

eventSchema.index(
  {
    "values.time": 1,
    "values.device": 1,
    "values.device_id": 1,
    "values.site_id": 1,
    day: 1,
    "values.frequency": 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      nValues: { $lt: parseInt(constants.N_VALUES || 500) },
    },
  }
);

eventSchema.index(
  {
    "values.time": 1,
    "values.site_id": 1,
    day: 1,
    "values.frequency": 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      nValues: { $lt: parseInt(constants.N_VALUES || 500) },
    },
  }
);

eventSchema.index({ "values.time": 1, "values.site_id": 1 });

eventSchema.index(
  {
    deployment_type: 1,
    "values.location.latitude.value": 1,
    "values.location.longitude.value": 1,
    "values.time": -1,
  },
  {
    partialFilterExpression: {
      deployment_type: "mobile",
      "values.location.latitude.value": { $exists: true, $ne: null },
      "values.location.longitude.value": { $exists: true, $ne: null },
    },
  }
);

eventSchema.index(
  {
    "values.time": 1,
    "values.site_id": 1,
    "values.device_id": 1,
    nValues: 1,
  },
  {
    name: "online_status_query_idx",
  }
);

eventSchema.index(
  {
    "values.time": 1,
    "values.site_id": 1,
  },
  {
    name: "recent_status_idx",
    partialFilterExpression: {
      nValues: { $gt: 0, $lt: parseInt(constants.N_VALUES || 500) },
    },
  }
);

eventSchema.pre("save", function(next) {
  // Validate deployment type consistency
  if (this.deployment_type === "static") {
    if (!this.site_id) {
      return next(new Error("Static deployments require site_id"));
    }
  } else if (this.deployment_type === "mobile") {
    if (!this.grid_id) {
      return next(new Error("Mobile deployments require grid_id"));
    }
    // site_id is optional for mobile - device might be at a known site
  }

  next();
});

eventSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

eventSchema.methods = {
  toJSON() {
    return {
      day: this.day,
      values: this.values,
    };
  },
};
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

function getHistoricalComputedFieldsExclusion(isHistorical) {
  let exclusions = {};

  if (isHistorical) {
    // Only exclude expensive computed fields for historical measurements
    const expensiveComputedFields = [
      "timeDifferenceHours", // Expensive time calculation
      "aqi_ranges", // Static AQI ranges (not needed for historical)
      "aqi_color", // AQI color computation
      "aqi_category", // AQI category computation
      "aqi_color_name", // AQI color name computation
      "health_tips", // Health tips lookup (expensive)
      "site_image", // Image lookups (expensive)
      "is_reading_primary", // Device status check
    ];

    expensiveComputedFields.forEach((field) => (exclusions[field] = 0));
  }

  return exclusions;
}

function buildEarlyProjection(isHistorical) {
  const baseProjection = {
    time: 1,
    device: 1,
    device_id: 1,
    device_number: 1,
    site: 1,
    site_id: 1,
    frequency: 1,
    pm2_5: 1,
    pm10: 1,
    average_pm2_5: 1,
    average_pm10: 1,
    s1_pm2_5: 1,
    s2_pm2_5: 1,
    s1_pm10: 1,
    s2_pm10: 1,
    no2: 1,
  };

  if (isHistorical) {
    return baseProjection;
  }

  return {
    ...baseProjection,
    battery: 1,
    location: 1,
    network: 1,
    altitude: 1,
    speed: 1,
    satellites: 1,
    hdop: 1,
    tvoc: 1,
    hcho: 1,
    co2: 1,
    intaketemperature: 1,
    intakehumidity: 1,
    internalTemperature: 1,
    externalTemperature: 1,
    internalHumidity: 1,
    externalHumidity: 1,
    externalAltitude: 1,
    pm1: 1,
    rtc_adc: 1,
    rtc_v: 1,
    rtc: 1,
    stc_adc: 1,
    stc_v: 1,
    stc: 1,
  };
}

function logSlowQuery(queryType, duration, metadata, isHistorical, limit) {
  if (duration > SLOW_QUERY_THRESHOLD_MS) {
    logger.warn(
      `⏱️ Slow ${queryType} query: ${(duration / 1000).toFixed(2)}s | ` +
        `Metadata: ${metadata || "device"} | ` +
        `Historical: ${isHistorical} | ` +
        `Limit: ${limit}`
    );
  }
}

function isTimeoutError(error) {
  if (!error) return false;

  return (
    error.code === 50 ||
    error.codeName === "MaxTimeMSExpired" ||
    (error.message && error.message.includes("time limit")) ||
    (error.message && error.message.includes("exceeded")) ||
    (error.message && error.message.includes("PlanExecutor error"))
  );
}

function buildTimeoutErrorResponse(
  skip,
  limit,
  startTime,
  endTime,
  isHistorical,
  metadata
) {
  logger.error(
    `⏱️ Query timeout (${AGGREGATE_TIMEOUT_MS}ms) | ` +
      `Metadata: ${metadata || "device"} | ` +
      `Historical: ${isHistorical} | ` +
      `Limit: ${limit} | ` +
      `Suggestion: Use isHistorical=true or reduce date range`
  );

  return [
    {
      meta: {
        total: 0,
        skip: skip,
        limit: limit,
        page: 1,
        pages: 1,
        startTime,
        endTime,
        error:
          "Query timeout - try using historical mode or reducing date range",
        optimized: isHistorical,
        timeoutMs: AGGREGATE_TIMEOUT_MS,
      },
      data: [],
    },
  ];
}

function shouldSkipCount(limit, skip) {
  return limit <= SKIP_COUNT_THRESHOLD && skip === 0;
}

function getGroupFieldsForMetadata(metadata) {
  let groupKeyBeforeReplace = "$values.device_id";
  let groupKeyAfterReplace = "$device_id";

  if (metadata === "site_id") {
    groupKeyBeforeReplace = "$values.site_id";
    groupKeyAfterReplace = "$site_id";
  } else if (metadata === "site") {
    groupKeyBeforeReplace = "$values.site";
    groupKeyAfterReplace = "$site";
  } else if (metadata === "device") {
    groupKeyBeforeReplace = "$values.device";
    groupKeyAfterReplace = "$device";
  } else if (metadata === "device_id") {
    groupKeyBeforeReplace = "$values.device_id";
    groupKeyAfterReplace = "$device_id";
  }

  return { groupKeyBeforeReplace, groupKeyAfterReplace };
}

function buildValuesMatch(search) {
  const valuesMatch = {};
  for (const key in search) {
    if (key.startsWith("values.") && key !== "values.time") {
      valuesMatch[key] = search[key];
    }
  }
  return valuesMatch;
}

function buildSimplifiedCountPipeline(search, active, internal, metadata) {
  const {
    groupKeyBeforeReplace,
    groupKeyAfterReplace,
  } = getGroupFieldsForMetadata(metadata);

  const valuesMatch = buildValuesMatch(search);
  const hasValuesFilters = Object.keys(valuesMatch).length > 0;

  const pipeline = [
    { $match: search },
    { $unwind: "$values" },
    { $match: { "values.time": search["values.time"] } },
  ];

  if (hasValuesFilters) {
    pipeline.push({ $match: valuesMatch });
  }

  if (active !== "yes" && internal === "yes") {
    pipeline.push(
      { $group: { _id: groupKeyBeforeReplace } },
      { $count: "device" }
    );
    return pipeline;
  }

  pipeline.push({ $replaceRoot: { newRoot: "$values" } });

  let hasDeviceLookup = false;

  if (active === "yes") {
    pipeline.push({
      $lookup: {
        from: "devices",
        localField: "device_id",
        foreignField: "_id",
        as: "device_details",
      },
    });
    hasDeviceLookup = true;
    pipeline.push({
      $match: { "device_details.isActive": true },
    });
  }

  if (internal !== "yes") {
    if (!hasDeviceLookup) {
      pipeline.push({
        $lookup: {
          from: "devices",
          localField: "device_id",
          foreignField: "_id",
          as: "device_details",
        },
      });
    }
    pipeline.push(
      {
        $lookup: {
          from: "cohorts",
          localField: "device_details.cohorts",
          foreignField: "_id",
          as: "cohort_details",
        },
      },
      { $match: { "cohort_details.visibility": { $ne: false } } }
    );
  }

  pipeline.push(
    { $group: { _id: groupKeyAfterReplace } },
    { $count: "device" }
  );

  return pipeline;
}

async function performCount(
  model,
  search,
  active,
  internal,
  metadata,
  limit,
  skip,
  isHistorical
) {
  let totalCount = 0;
  let countSkipped = false;

  if (shouldSkipCount(limit, skip)) {
    countSkipped = true;
    logText(
      `Skipping count query for small result set (limit: ${limit}, skip: ${skip})`
    );
  } else {
    const countStartTime = Date.now();

    const countPipeline = buildSimplifiedCountPipeline(
      search,
      active,
      internal,
      metadata
    );

    const totalCountResult = await model
      .aggregate(countPipeline)
      .option({ allowDiskUse: true, maxTimeMS: COUNT_TIMEOUT_MS })
      .exec();

    const countDuration = Date.now() - countStartTime;
    logSlowQuery("count", countDuration, metadata, isHistorical, limit);

    totalCount = totalCountResult.length > 0 ? totalCountResult[0].device : 0;
  }

  return { totalCount, countSkipped };
}

async function fetchData(model, filter) {
  let {
    metadata,
    external,
    tenant,
    running,
    recent,
    brief,
    index,
    skip,
    limit = DEFAULT_LIMIT,
    page,
    active,
    internal,
    isHistorical = false,
  } = filter;

  if (typeof limit !== "number" || isNaN(limit) || limit < 0) {
    limit = DEFAULT_LIMIT;
  }

  const MAX_LIMIT = 10000;
  if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }

  if (typeof page !== "number" || isNaN(page) || page < 1) {
    page = DEFAULT_PAGE;
  }

  if (page) {
    skip = parseInt((page - 1) * limit);
  }

  const startTime = filter["values.time"]["$gte"];
  const endTime = filter["values.time"]["$lte"];
  let idField;

  let search = filter;
  let groupId = "$device";
  let localField = "device";
  let foreignField = "name";
  let from = "devices";
  let _as = "_deviceDetails";
  let as = "deviceDetails";
  let pm2_5 = "$average_pm2_5";
  let pm10 = "$average_pm10";
  let s1_pm2_5 = "$pm2_5";
  let s1_pm10 = "$pm10";
  let elementAtIndex0 = elementAtIndexName(metadata, recent);

  let projection = { _id: 0 };
  let siteProjection = {};
  let deviceProjection = {};
  let sort = { time: -1 };

  delete search["external"];
  delete search["frequency"];
  delete search["metadata"];
  delete search["tenant"];
  delete search["device"];
  delete search["recent"];
  delete search["page"];
  delete search["running"];
  delete search["brief"];
  delete search["index"];
  delete search["limit"];
  delete search["skip"];
  delete search["active"];
  delete search["internal"];
  delete search["isHistorical"];

  if (tenant !== "airqo") {
    pm2_5 = "$pm2_5";
    pm10 = "$pm10";
  }

  if (external === "yes" || brief === "yes") {
    const excludeFields = [
      "s2_pm10",
      "s1_pm10",
      "s2_pm2_5",
      "s1_pm2_5",
      "rtc_adc",
      "rtc_v",
      "rtc",
      "stc_adc",
      "stc_v",
      "stc",
      "pm1",
      "externalHumidity",
      "externalAltitude",
      "internalHumidity",
      "externalTemperature",
      "internalTemperature",
      "hdop",
      "tvoc",
      "hcho",
      "co2",
      "intaketemperature",
      "intakehumidity",
      "satellites",
      "speed",
      "altitude",
      "site_image",
      "location",
      "network",
      "battery",
      "average_pm10",
      "average_pm2_5",
      "device_number",
      "pm2_5.uncertaintyValue",
      "pm2_5.calibratedValue",
      "pm2_5.standardDeviationValue",
      "pm10.uncertaintyValue",
      "pm10.calibratedValue",
      "pm10.standardDeviationValue",
      "no2.uncertaintyValue",
      "no2.standardDeviationValue",
      "no2.calibratedValue",
      "site",
      as,
    ];

    excludeFields.forEach((field) => (projection[field] = 0));
  }

  if (!metadata || metadata === "device" || metadata === "device_id") {
    idField = "$device";
    groupId = "$" + (metadata || "device");
    localField = metadata || localField;
    if (metadata === "device_id") {
      foreignField = "_id";
    }
    if (metadata === "device" || !metadata) {
      foreignField = "name";
    }
    from = "devices";
    _as = "_deviceDetails";
    as = "deviceDetails";
    elementAtIndex0 = elementAtIndexName(metadata, recent);

    deviceProjection = constants.EVENTS_METADATA_PROJECTION("device", as);
    Object.assign(projection, deviceProjection);
  }

  if (metadata === "site_id" || metadata === "site") {
    idField = "$site_id";
    groupId = "$" + metadata;
    localField = metadata;
    if (metadata === "site") {
      foreignField = "generated_name";
    }
    if (metadata === "site_id") {
      foreignField = "_id";
    }
    from = "sites";
    _as = "_siteDetails";
    as = "siteDetails";
    elementAtIndex0 = elementAtIndexName(metadata, recent);

    if (brief === "yes") {
      siteProjection = constants.EVENTS_METADATA_PROJECTION("brief_site", as);
    } else {
      siteProjection = constants.EVENTS_METADATA_PROJECTION("site", as);
    }
    Object.assign(projection, siteProjection);
  }

  if (isHistorical) {
    const historicalExclusions = getHistoricalComputedFieldsExclusion(
      isHistorical
    );
    Object.assign(projection, historicalExclusions);
  }

  if (running === "yes" && !isHistorical) {
    const runningFields = [
      "site_image",
      "is_reading_primary",
      "deviceDetails",
      "aqi_color",
      "aqi_category",
      "aqi_color_name",
      "pm2_5",
      "average_pm10",
      "average_pm2_5",
      "pm10",
      "frequency",
      "network",
      "location",
      "altitude",
      "speed",
      "satellites",
      "hdop",
      "intaketemperature",
      "tvoc",
      "hcho",
      "co2",
      "intakehumidity",
      "internalTemperature",
      "externalTemperature",
      "internalHumidity",
      "externalHumidity",
      "externalAltitude",
      "pm1",
      "no2",
      "site",
      "site_id",
      "health_tips",
      "s1_pm2_5",
      "s2_pm2_5",
      "s1_pm10",
      "s2_pm10",
      "battery",
      "rtc_adc",
      "rtc_v",
      "rtc",
      "stc_adc",
      "stc_v",
      "stc",
      "siteDetails",
    ];
    runningFields.forEach((field) => (projection[field] = 0));
  }

  if (!isEmpty(index)) {
    sort = { "pm2_5.value": 1 };
  }

  logObject("the query for this request", search);
  logText(
    `Using ${isHistorical ? "historical" : "current"} measurement optimization`
  );

  if (!recent || recent === "yes") {
    try {
      const { totalCount, countSkipped } = await performCount(
        model,
        search,
        active,
        internal,
        metadata,
        limit,
        skip,
        isHistorical
      );

      const pipelineStartTime = Date.now();

      let pipeline = model.aggregate([
        { $match: search },
        { $unwind: "$values" },
        { $match: { "values.time": search["values.time"] } },
        { $replaceRoot: { newRoot: "$values" } },
      ]);

      const earlyProjection = buildEarlyProjection(isHistorical);
      pipeline = pipeline.append([{ $project: earlyProjection }]);

      if (!isHistorical) {
        pipeline = pipeline.append([
          {
            $lookup: {
              from: "photos",
              localField: "site_id",
              foreignField: "site_id",
              as: "site_images",
            },
          },
        ]);
      }

      pipeline = pipeline.append([
        {
          $lookup: {
            from: "devices",
            localField: "device_id",
            foreignField: "_id",
            as: "device_details",
          },
        },
      ]);

      if (active === "yes") {
        pipeline = pipeline.append([
          { $match: { "device_details.isActive": true } },
        ]);
      }

      pipeline = pipeline.append([
        {
          $lookup: {
            from: "cohorts",
            localField: "device_details.cohorts",
            foreignField: "_id",
            as: "cohort_details",
          },
        },
      ]);

      if (internal !== "yes") {
        pipeline = pipeline.append([
          { $match: { "cohort_details.visibility": { $ne: false } } },
        ]);
      }

      pipeline = pipeline.lookup({
        from,
        localField,
        foreignField,
        as,
      });

      if (!isHistorical) {
        pipeline = pipeline.lookup({
          from: "healthtips",
          let: { pollutantValue: { $toInt: "$pm2_5.value" } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $lte: ["$aqi_category.min", "$$pollutantValue"] },
                    { $gte: ["$aqi_category.max", "$$pollutantValue"] },
                  ],
                },
              },
            },
          ],
          as: "healthTips",
        });
      }

      let groupStage = {
        _id: idField,
        device: { $first: "$device" },
        device_id: { $first: "$device_id" },
        device_number: { $first: "$device_number" },
        site: { $first: "$site" },
        site_id: { $first: "$site_id" },
        time: { $first: "$time" },
        average_pm2_5: { $first: "$average_pm2_5" },
        pm2_5: { $first: pm2_5 },
        s1_pm2_5: { $first: s1_pm2_5 },
        s2_pm2_5: { $first: "$s2_pm2_5" },
        average_pm10: { $first: "$average_pm10" },
        pm10: { $first: pm10 },
        s1_pm10: { $first: s1_pm10 },
        s2_pm10: { $first: "$s2_pm10" },
        frequency: { $first: "$frequency" },
        battery: { $first: "$battery" },
        network: { $first: "$network" },
        location: { $first: "$location" },
        altitude: { $first: "$altitude" },
        speed: { $first: "$speed" },
        satellites: { $first: "$satellites" },
        hdop: { $first: "$hdop" },
        intaketemperature: { $first: "$intaketemperature" },
        tvoc: { $first: "$tvoc" },
        hcho: { $first: "$hcho" },
        co2: { $first: "$co2" },
        intakehumidity: { $first: "$intakehumidity" },
        internalTemperature: { $first: "$internalTemperature" },
        externalTemperature: { $first: "$externalTemperature" },
        internalHumidity: { $first: "$internalHumidity" },
        externalHumidity: { $first: "$externalHumidity" },
        externalAltitude: { $first: "$externalAltitude" },
        pm1: { $first: "$pm1" },
        no2: { $first: "$no2" },
        rtc_adc: { $first: "$rtc_adc" },
        rtc_v: { $first: "$rtc_v" },
        rtc: { $first: "$rtc" },
        stc_adc: { $first: "$stc_adc" },
        stc_v: { $first: "$stc_v" },
        stc: { $first: "$stc" },
        [as]: elementAtIndex0,
      };

      if (!isHistorical) {
        groupStage.site_image = {
          $first: { $arrayElemAt: ["$site_images.image_url", 0] },
        };
        groupStage.is_reading_primary = {
          $first: {
            $arrayElemAt: ["$device_details.isPrimaryInLocation", 0],
          },
        };
        groupStage.health_tips = { $first: "$healthTips" };
      }

      pipeline = pipeline.sort(sort).group(groupStage);

      if (!isHistorical) {
        pipeline = pipeline.addFields({
          timeDifferenceHours: {
            $divide: [{ $subtract: [new Date(), "$time"] }, 1000 * 60 * 60],
          },
        });
      }

      if (!isHistorical) {
        pipeline = pipeline
          .project({
            "health_tips.aqi_category": 0,
            "health_tips.value": 0,
            "health_tips.createdAt": 0,
            "health_tips.updatedAt": 0,
            "health_tips.__v": 0,
          })
          .project({
            "site_image.createdAt": 0,
            "site_image.updatedAt": 0,
            "site_image.metadata": 0,
            "site_image.__v": 0,
            "site_image.device_name": 0,
            "site_image.device_id": 0,
            "site_image._id": 0,
            "site_image.tags": 0,
            "site_image.image_code": 0,
            "site_image.site_id": 0,
            "site_image.airqloud_id": 0,
          });
      }

      pipeline = pipeline.project(projection);

      if (!isHistorical) {
        pipeline = pipeline
          .addFields({
            aqi_ranges: AQI_RANGES,
          })
          .addFields(generateAqiAddFields().$addFields);
      }

      const data = await pipeline
        .skip(skip)
        .limit(limit)
        .option({ allowDiskUse: true, maxTimeMS: AGGREGATE_TIMEOUT_MS })
        .exec();

      const pipelineDuration = Date.now() - pipelineStartTime;
      logSlowQuery(
        "aggregate",
        pipelineDuration,
        metadata,
        isHistorical,
        limit
      );

      const actualTotal = countSkipped ? data.length : totalCount;

      const meta = {
        total: actualTotal,
        skip: skip,
        limit: limit,
        page: Math.trunc(skip / limit + 1),
        pages: countSkipped ? 1 : Math.ceil(totalCount / limit) || 1,
        startTime,
        endTime,
        optimized: isHistorical,
        countSkipped: countSkipped || undefined,
      };

      return [{ meta, data }];
    } catch (error) {
      if (isTimeoutError(error)) {
        return buildTimeoutErrorResponse(
          skip,
          limit,
          startTime,
          endTime,
          isHistorical,
          metadata
        );
      }

      logger.error(
        `Error in fetchData ${isHistorical ? "historical" : "current"} query: ${
          error.message
        }`
      );
      return [
        {
          meta: {
            total: 0,
            skip: skip,
            limit: limit,
            page: 1,
            pages: 1,
            startTime,
            endTime,
            error: error.message,
            optimized: isHistorical,
          },
          data: [],
        },
      ];
    }
  }

  if (recent === "no") {
    try {
      const { totalCount, countSkipped } = await performCount(
        model,
        search,
        active,
        internal,
        metadata,
        limit,
        skip,
        isHistorical
      );

      const pipelineStartTime = Date.now();

      const earlyProjection = buildEarlyProjection(isHistorical);

      let histPipeline = [
        { $match: search },
        { $unwind: "$values" },
        { $match: { "values.time": search["values.time"] } },
        { $replaceRoot: { newRoot: "$values" } },
        { $project: earlyProjection },
        {
          $lookup: {
            from,
            localField,
            foreignField,
            as,
          },
        },
        { $sort: sort },
      ];

      if (!isHistorical) {
        histPipeline.push({
          $addFields: {
            timeDifferenceHours: {
              $divide: [{ $subtract: [new Date(), "$time"] }, 1000 * 60 * 60],
            },
          },
        });
      }

      histPipeline.push({
        $project: {
          _device: "$device",
          _time: "$time",
          _average_pm2_5: "$average_pm2_5",
          _pm2_5: pm2_5,
          _s1_pm2_5: s1_pm2_5,
          _s2_pm2_5: "$s2_pm2_5",
          _average_pm10: "$average_pm10",
          _pm10: pm10,
          _s1_pm10: s1_pm10,
          _s2_pm10: "$s2_pm10",
          _frequency: "$frequency",
          _site_id: "$site_id",
          _device_id: "$device_id",
          _site: "$site",
          _device_number: "$device_number",
          [_as]: elementAtIndex0,
          ...(isHistorical
            ? {}
            : {
                _battery: "$battery",
                _location: "$location",
                _altitude: "$altitude",
                _speed: "$speed",
                _network: "$network",
                _satellites: "$satellites",
                _hdop: "$hdop",
                _tvoc: "$tvoc",
                _hcho: "$hcho",
                _co2: "$co2",
                _intaketemperature: "$intaketemperature",
                _intakehumidity: "$intakehumidity",
                _internalTemperature: "$internalTemperature",
                _externalTemperature: "$externalTemperature",
                _internalHumidity: "$internalHumidity",
                _externalHumidity: "$externalHumidity",
                _externalAltitude: "$externalAltitude",
                _pm1: "$pm1",
                _no2: "$no2",
                _rtc_adc: "$rtc_adc",
                _rtc_v: "$rtc_v",
                _rtc: "$rtc",
                _stc_adc: "$stc_adc",
                _stc_v: "$stc_v",
                _stc: "$stc",
              }),
        },
      });

      histPipeline.push({
        $project: {
          device: "$_device",
          device_id: "$_device_id",
          device_number: "$_device_number",
          site: "$_site",
          site_id: "$_site_id",
          time: "$_time",
          average_pm2_5: "$_average_pm2_5",
          pm2_5: "$_pm2_5",
          s1_pm2_5: "$_s1_pm2_5",
          s2_pm2_5: "$_s2_pm2_5",
          average_pm10: "$_average_pm10",
          pm10: "$_pm10",
          s1_pm10: "$_s1_pm10",
          s2_pm10: "$_s2_pm10",
          frequency: "$_frequency",
          [as]: "$" + _as,
          ...(isHistorical
            ? {}
            : {
                battery: "$_battery",
                location: "$_location",
                altitude: "$_altitude",
                speed: "$_speed",
                network: "$_network",
                satellites: "$_satellites",
                hdop: "$_hdop",
                intaketemperature: "$_intaketemperature",
                tvoc: "$_tvoc",
                hcho: "$_hcho",
                co2: "$_co2",
                intakehumidity: "$_intakehumidity",
                internalTemperature: "$_internalTemperature",
                externalTemperature: "$_externalTemperature",
                internalHumidity: "$_internalHumidity",
                externalHumidity: "$_externalHumidity",
                externalAltitude: "$_externalAltitude",
                pm1: "$_pm1",
                no2: "$_no2",
                rtc_adc: "$_rtc_adc",
                rtc_v: "$_rtc_v",
                rtc: "$_rtc",
                stc_adc: "$_stc_adc",
                stc_v: "$_stc_v",
                stc: "$_stc",
              }),
        },
      });

      histPipeline.push(
        { $project: projection },
        { $skip: skip },
        { $limit: limit }
      );

      const data = await model
        .aggregate(histPipeline)
        .option({ allowDiskUse: true, maxTimeMS: AGGREGATE_TIMEOUT_MS })
        .exec();

      const pipelineDuration = Date.now() - pipelineStartTime;
      logSlowQuery(
        "aggregate",
        pipelineDuration,
        metadata,
        isHistorical,
        limit
      );

      const actualTotal = countSkipped ? data.length : totalCount;

      const meta = {
        total: actualTotal,
        skip: skip,
        limit: limit,
        page: Math.trunc(skip / limit + 1),
        pages: countSkipped ? 1 : Math.ceil(totalCount / limit) || 1,
        startTime,
        endTime,
        optimized: isHistorical,
        countSkipped: countSkipped || undefined,
      };

      return [{ meta, data }];
    } catch (error) {
      if (isTimeoutError(error)) {
        return buildTimeoutErrorResponse(
          skip,
          limit,
          startTime,
          endTime,
          isHistorical,
          metadata
        );
      }

      logger.error(`Error in fetchData historical query: ${error.message}`);
      return [
        {
          meta: {
            total: 0,
            skip: skip,
            limit: limit,
            page: 1,
            pages: 1,
            startTime,
            endTime,
            error: error.message,
            optimized: isHistorical,
          },
          data: [],
        },
      ];
    }
  }
}

async function signalData(model, filter) {
  let { skip, limit, page } = filter;
  const recent = "yes";
  const metadata = "site_id";

  if (page) {
    skip = parseInt((page - 1) * limit);
  }

  const startTime = filter["values.time"]["$gte"];
  const endTime = filter["values.time"]["$lte"];
  let idField;

  let search = filter;
  let groupId = "$device";
  let localField = "device";
  let foreignField = "name";
  let from = "devices";
  let _as = "_deviceDetails";
  let as = "deviceDetails";
  let pm2_5 = "$average_pm2_5";
  let pm10 = "$average_pm10";
  let s1_pm2_5 = "$pm2_5";
  let s1_pm10 = "$pm10";
  let elementAtIndex0 = elementAtIndexName(metadata, recent);
  let projection = {
    _id: 0,
  };
  let siteProjection = {};
  let sort = { time: -1 };

  delete search["external"];
  delete search["frequency"];
  delete search["metadata"];
  delete search["tenant"];
  delete search["device"];
  delete search["recent"];
  delete search["page"];
  delete search["running"];
  delete search["brief"];
  delete search["index"];
  delete search["limit"];
  delete search["skip"];

  projection["s2_pm10"] = 0;
  projection["s1_pm10"] = 0;
  projection["s2_pm2_5"] = 0;
  projection["s1_pm2_5"] = 0;
  projection["rtc_adc"] = 0;
  projection["rtc_v"] = 0;
  projection["rtc"] = 0;
  projection["stc_adc"] = 0;
  projection["stc_v"] = 0;
  projection["stc"] = 0;
  projection["pm1"] = 0;
  projection["externalHumidity"] = 0;
  projection["externalAltitude"] = 0;
  projection["internalHumidity"] = 0;
  projection["externalTemperature"] = 0;
  projection["internalTemperature"] = 0;
  projection["hdop"] = 0;
  projection["tvoc"] = 0;
  projection["hcho"] = 0;
  projection["co2"] = 0;
  projection["intaketemperature"] = 0;
  projection["intakehumidity"] = 0;
  projection["satellites"] = 0;
  projection["speed"] = 0;
  projection["altitude"] = 0;
  projection["site_image"] = 0;
  projection["location"] = 0;
  projection["network"] = 0;
  projection["battery"] = 0;
  projection["average_pm10"] = 0;
  projection["average_pm2_5"] = 0;
  projection["device_number"] = 0;
  projection["pm2_5.uncertaintyValue"] = 0;
  projection["pm2_5.calibratedValue"] = 0;
  projection["pm2_5.standardDeviationValue"] = 0;
  projection["pm10.uncertaintyValue"] = 0;
  projection["pm10.calibratedValue"] = 0;
  projection["pm10.standardDeviationValue"] = 0;
  projection["no2.uncertaintyValue"] = 0;
  projection["no2.standardDeviationValue"] = 0;
  projection["no2.calibratedValue"] = 0;
  projection["site"] = 0;
  projection[as] = 0;

  idField = "$site_id";
  groupId = "$" + metadata;
  localField = metadata;
  if (metadata === "site") {
    foreignField = "generated_name";
  }
  if (metadata === "site_id") {
    foreignField = "_id";
  }
  from = "sites";
  _as = "_siteDetails";
  as = "siteDetails";
  elementAtIndex0 = elementAtIndexName(metadata, recent);

  siteProjection = constants.EVENTS_METADATA_PROJECTION("brief_site", as);
  Object.assign(projection, siteProjection);

  logObject("the query for this request", search);

  // Get total count first with lightweight aggregation
  const totalCountResult = await model
    .aggregate()
    .unwind("values")
    .match(search)
    .replaceRoot("values")
    .lookup({
      from: "devices",
      localField: "device_id",
      foreignField: "_id",
      as: "device_details",
    })
    .lookup({
      from: "cohorts",
      localField: "device_details.cohorts",
      foreignField: "_id",
      as: "cohort_details",
    })
    .match({
      "cohort_details.visibility": { $ne: false },
      "cohort_details.name": "map",
    })
    .group({
      _id: idField,
    })
    .count("device")
    .allowDiskUse(true);

  const totalCount =
    totalCountResult.length > 0 ? totalCountResult[0].device : 0;

  // Get paginated data
  const data = await model
    .aggregate()
    .unwind("values")
    .match(search)
    .replaceRoot("values")
    .lookup({
      from: "photos",
      localField: "site_id",
      foreignField: "site_id",
      as: "site_images",
    })
    .lookup({
      from: "devices",
      localField: "device_id",
      foreignField: "_id",
      as: "device_details",
    })
    .lookup({
      from: "cohorts",
      localField: "device_details.cohorts",
      foreignField: "_id",
      as: "cohort_details",
    })
    .match({
      "cohort_details.visibility": { $ne: false },
      "cohort_details.name": "map",
    })
    .lookup({
      from,
      localField,
      foreignField,
      as,
    })
    .lookup({
      from: "healthtips",
      let: { pollutantValue: { $toInt: "$pm2_5.value" } },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                {
                  $lte: ["$aqi_category.min", "$$pollutantValue"],
                },
                {
                  $gte: ["$aqi_category.max", "$$pollutantValue"],
                },
              ],
            },
          },
        },
      ],
      as: "healthTips",
    })
    .sort(sort)
    .group({
      _id: idField,
      device: { $first: "$device" },
      device_id: { $first: "$device_id" },
      site_image: {
        $first: { $arrayElemAt: ["$site_images.image_url", 0] },
      },
      is_reading_primary: {
        $first: {
          $arrayElemAt: ["$device_details.isPrimaryInLocation", 0],
        },
      },
      device_number: { $first: "$device_number" },
      health_tips: { $first: "$healthTips" },
      site: { $first: "$site" },
      site_id: { $first: "$site_id" },
      time: { $first: "$time" },
      average_pm2_5: { $first: "$average_pm2_5" },
      pm2_5: { $first: pm2_5 },
      s1_pm2_5: { $first: s1_pm2_5 },
      s2_pm2_5: { $first: "$s2_pm2_5" },
      average_pm10: { $first: "$average_pm10" },
      pm10: { $first: pm10 },
      s1_pm10: { $first: s1_pm10 },
      s2_pm10: { $first: "$s2_pm10" },
      frequency: { $first: "$frequency" },
      battery: { $first: "$battery" },
      network: { $first: "$network" },
      location: { $first: "$location" },
      altitude: { $first: "$altitude" },
      speed: { $first: "$speed" },
      satellites: { $first: "$satellites" },
      hdop: { $first: "$hdop" },
      intaketemperature: { $first: "$intaketemperature" },
      tvoc: { $first: "$tvoc" },
      hcho: { $first: "$hcho" },
      co2: { $first: "$co2" },
      intakehumidity: { $first: "$intakehumidity" },
      internalTemperature: { $first: "$internalTemperature" },
      externalTemperature: { $first: "$externalTemperature" },
      internalHumidity: { $first: "$internalHumidity" },
      externalHumidity: { $first: "$externalHumidity" },
      externalAltitude: { $first: "$externalAltitude" },
      pm1: { $first: "$pm1" },
      no2: { $first: "$no2" },
      rtc_adc: { $first: "$rtc_adc" },
      rtc_v: { $first: "$rtc_v" },
      rtc: { $first: "$rtc" },
      stc_adc: { $first: "$stc_adc" },
      stc_v: { $first: "$stc_v" },
      stc: { $first: "$stc" },
      [as]: elementAtIndex0,
    })
    .addFields({
      timeDifferenceHours: {
        $divide: [{ $subtract: [new Date(), "$time"] }, 1000 * 60 * 60],
      },
    })
    .project({
      "health_tips.aqi_category": 0,
      "health_tips.value": 0,
      "health_tips.createdAt": 0,
      "health_tips.updatedAt": 0,
      "health_tips.__v": 0,
    })
    .project({
      "site_image.createdAt": 0,
      "site_image.updatedAt": 0,
      "site_image.metadata": 0,
      "site_image.__v": 0,
      "site_image.device_name": 0,
      "site_image.device_id": 0,
      "site_image._id": 0,
      "site_image.tags": 0,
      "site_image.image_code": 0,
      "site_image.site_id": 0,
      "site_image.airqloud_id": 0,
    })
    .project(projection)
    .addFields({
      aqi_ranges: AQI_RANGES,
    })
    .addFields(generateAqiAddFields().$addFields)
    // Apply pagination here to prevent memory overflow
    .skip(skip)
    .limit(limit)
    .allowDiskUse(true);

  const meta = {
    total: totalCount,
    skip: skip,
    limit: limit,
    page: Math.trunc(skip / limit + 1),
    pages: Math.ceil(totalCount / limit) || 1,
    startTime,
    endTime,
  };

  // Return in the exact same format as original
  return [{ meta, data }];
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
      record.timeDifferenceHours > UPTIME_CHECK_THRESHOLD
    ) {
      logDeviceInfo(
        `🪫🪫 Last refreshed time difference exceeds ${UPTIME_CHECK_THRESHOLD} hours`,
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

function filterNull(data) {
  if (!Array.isArray(data)) return [];
  return data.filter(function(r) {
    return (
      r && r.pm2_5 && r.pm2_5.value !== null && r.pm2_5.value !== undefined
    );
  });
}

eventSchema.statics.createEvent = async function(args) {
  return this.create({
    ...args,
  });
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
    const newFilter = { ...filter, skip, limit, page };
    const responseFromFetchData = await fetchData(this, newFilter);

    if (!isEmpty(responseFromFetchData)) {
      const data = responseFromFetchData;
      if (data && data[0] && Array.isArray(data[0].data)) {
        data[0].data = filterNull(data[0].data);
      }
      return {
        success: true,
        data,
        message: "successfully returned the measurements",
        status: httpStatus.OK,
      };
    } else {
      return {
        success: false,
        message: "no measurements for this search",
        status: httpStatus.NOT_FOUND,
        data: [],
      };
    }
  } catch (error) {
    logger.error(`Internal Server Error --- list events --- ${error.message}`);
    logObject("error", error);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

eventSchema.statics.view = async function(filter, next) {
  try {
    const request = filter;
    request.skip = filter.skip ? filter.skip : DEFAULT_SKIP;
    request.limit = filter.limit ? filter.limit : DEFAULT_LIMIT;
    request.page = filter.page ? filter.page : DEFAULT_PAGE;

    const result = await fetchData(this, request);
    const transformedData = filterNull(result[0].data);
    result[0].data = transformedData;

    // Only calculate average if we have data
    if (transformedData.length > 0) {
      const calculatedValues = computeAveragePm2_5(transformedData);
      result[0].meta.pm2_5Avg = calculatedValues;
    }

    return {
      success: true,
      data: result,
      message: "successfully returned the measurements",
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(
      `🐛🐛 Internal Server Error --- view events -- ${error.message}`
    );
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
    return;
  }
};
eventSchema.statics.fetch = async function(filter) {
  try {
    const request = filter;
    request.skip = filter.skip ? filter.skip : DEFAULT_SKIP;
    request.limit = filter.limit ? filter.limit : DEFAULT_LIMIT;
    request.page = filter.page ? filter.page : DEFAULT_PAGE;

    const result = await fetchData(this, request);
    const transformedData = filterNullAndReportOffDevices(result[0].data);
    result[0].data = transformedData;

    // Only calculate average if we have data
    if (transformedData.length > 0) {
      const calculatedValues = computeAveragePm2_5(transformedData);
      result[0].meta.pm2_5Avg = calculatedValues;
    }

    return {
      success: true,
      data: result,
      message: "successfully returned the measurements",
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(
      `🐛🐛 Internal Server Error --- fetch events -- ${error.message}`
    );
    return;
  }
};
eventSchema.statics.signal = async function(filter) {
  try {
    const request = filter;
    request.skip = filter.skip ? filter.skip : DEFAULT_SKIP;
    request.limit = filter.limit ? filter.limit : DEFAULT_LIMIT;
    request.page = filter.page ? filter.page : DEFAULT_PAGE;
    const result = await signalData(this, request);
    const transformedData = filterNullAndReportOffDevices(result[0].data);
    result[0].data = transformedData;
    const calculatedValues = computeAveragePm2_5(transformedData);
    result[0].meta.pm2_5Avg = calculatedValues;
    return {
      success: true,
      data: result,
      message: "successfully returned the measurements",
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(
      `🐛🐛 Internal Server Error --- view events -- ${error.message}`
    );
    return;
  }
};

eventSchema.statics.getAirQualityAverages = async function(
  siteId,
  next,
  options = {}
) {
  try {
    // eslint-disable-next-line no-unused-vars
    const { isHistorical = false } = options;
    const TIMEZONE = moment.tz.guess();

    const now = moment()
      .tz(TIMEZONE)
      .toDate();
    const today = moment()
      .tz(TIMEZONE)
      .startOf("day")
      .toDate();
    const twoWeeksAgo = moment()
      .tz(TIMEZONE)
      .startOf("day")
      .subtract(14, "days")
      .toDate();

    // For historical measurements, use simplified aggregation
    // For historical measurements, use simplified aggregation
    if (isHistorical) {
      const result = await this.aggregate([
        {
          $match: {
            "values.site_id": mongoose.Types.ObjectId(siteId),
            "values.time": { $gte: twoWeeksAgo, $lte: now },
          },
        },
        {
          $unwind: {
            path: "$values",
            preserveNullAndEmptyArrays: false,
          },
        },
        {
          $match: {
            "values.time": { $gte: twoWeeksAgo, $lte: now },
            "values.pm2_5.value": { $exists: true, $ne: null },
          },
        },
        {
          $project: {
            _id: 0,
            time: "$values.time",
            pm2_5: "$values.pm2_5.value",
            dayOfYear: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$values.time",
                timezone: TIMEZONE,
              },
            },
          },
        },
        {
          $group: {
            _id: "$dayOfYear",
            dailyAverage: { $avg: "$pm2_5" },
          },
        },
        {
          $group: {
            _id: null,
            overallAverage: { $avg: "$dailyAverage" },
            days: { $push: { date: "$_id", average: "$dailyAverage" } },
          },
        },
      ]).allowDiskUse(true);

      if (result.length === 0) {
        return {
          success: false,
          message: "No data available for the specified period",
          status: httpStatus.NOT_FOUND,
        };
      }

      const todayStr = moment(today)
        .tz(TIMEZONE)
        .format("YYYY-MM-DD");
      const todayAverage = result[0].days.find((day) => day.date === todayStr)
        ?.average;

      return {
        success: true,
        data: {
          dailyAverage: todayAverage
            ? parseFloat(todayAverage.toFixed(2))
            : null,
          overallAverage: parseFloat(result[0].overallAverage.toFixed(2)),
          // Simplified response for historical data - no percentage difference
          isHistorical: true,
        },
        message: "Successfully retrieved air quality averages (historical)",
        status: httpStatus.OK,
      };
    }

    // Full calculation for current data (existing implementation)
    const result = await this.aggregate([
      {
        $match: {
          "values.site_id": mongoose.Types.ObjectId(siteId),
          "values.time": { $gte: twoWeeksAgo, $lte: now },
        },
      },
      {
        $unwind: {
          path: "$values",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: {
          "values.time": { $gte: twoWeeksAgo, $lte: now },
          "values.pm2_5.value": { $exists: true, $ne: null },
        },
      },
      {
        $project: {
          _id: 0,
          time: "$values.time",
          pm2_5: "$values.pm2_5.value",
          yearWeek: {
            $let: {
              vars: {
                dateParts: {
                  $dateToParts: {
                    date: "$values.time",
                    timezone: TIMEZONE,
                    iso8601: true,
                  },
                },
              },
              in: {
                $concat: [
                  { $toString: "$$dateParts.isoWeekYear" },
                  "-",
                  {
                    $cond: [
                      { $lt: ["$$dateParts.isoWeek", 10] },
                      {
                        $concat: ["0", { $toString: "$$dateParts.isoWeek" }],
                      },
                      { $toString: "$$dateParts.isoWeek" },
                    ],
                  },
                ],
              },
            },
          },
          dayOfYear: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$values.time",
              timezone: TIMEZONE,
            },
          },
        },
      },
      {
        $group: {
          _id: "$dayOfYear",
          dailyAverage: { $avg: "$pm2_5" },
          yearWeek: { $first: "$yearWeek" },
        },
      },
      {
        $group: {
          _id: "$yearWeek",
          weeklyAverage: { $avg: "$dailyAverage" },
          days: {
            $push: {
              date: "$_id",
              average: "$dailyAverage",
            },
          },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 2 },
    ]).allowDiskUse(true);

    if (result.length < 2) {
      return {
        success: false,
        message: "Insufficient data for comparison",
        status: httpStatus.NOT_FOUND,
      };
    }

    const [currentWeek, previousWeek] = result;
    const todayStr = moment(today)
      .tz(TIMEZONE)
      .format("YYYY-MM-DD");
    const todayAverage = currentWeek.days.find((day) => day.date === todayStr)
      ?.average;

    const percentageDifference =
      previousWeek.weeklyAverage !== 0
        ? ((currentWeek.weeklyAverage - previousWeek.weeklyAverage) /
            previousWeek.weeklyAverage) *
          100
        : 0;

    return {
      success: true,
      data: {
        dailyAverage: todayAverage ? parseFloat(todayAverage.toFixed(2)) : null,
        percentageDifference: parseFloat(percentageDifference.toFixed(2)),
        weeklyAverages: {
          currentWeek: parseFloat(currentWeek.weeklyAverage.toFixed(2)),
          previousWeek: parseFloat(previousWeek.weeklyAverage.toFixed(2)),
        },
        isHistorical: false,
      },
      message: "Successfully retrieved air quality averages",
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(
      `Internal Server Error --- getAirQualityAverages --- ${error.message}`
    );
    logObject("error", error);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

eventSchema.statics.v2_getAirQualityAverages = async function(
  siteId,
  next,
  options = {}
) {
  try {
    // eslint-disable-next-line no-unused-vars
    const { isHistorical = false } = options;

    // For historical data, use the simplified version from v1
    if (isHistorical) {
      return this.getAirQualityAverages(siteId, next, { isHistorical: true });
    }

    const MIN_READINGS_PER_DAY = 12;

    const now = moment()
      .tz(TIMEZONE)
      .toDate();
    const today = moment()
      .tz(TIMEZONE)
      .startOf("day")
      .toDate();
    const twoWeeksAgo = moment()
      .tz(TIMEZONE)
      .startOf("day")
      .subtract(14, "days")
      .toDate();

    const result = await this.aggregate([
      {
        $match: {
          "values.site_id": mongoose.Types.ObjectId(siteId),
          "values.time": { $gte: twoWeeksAgo, $lte: now },
        },
      },
      {
        $unwind: {
          path: "$values",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: {
          "values.time": { $gte: twoWeeksAgo, $lte: now },
          "values.pm2_5.value": {
            $exists: true,
            $ne: null,
            $gte: 0,
            $lte: 1000,
          },
        },
      },
      {
        $project: {
          _id: 0,
          time: "$values.time",
          pm2_5: "$values.pm2_5.value",
          yearWeek: {
            $let: {
              vars: {
                dateParts: {
                  $dateToParts: {
                    date: "$values.time",
                    timezone: TIMEZONE,
                    iso8601: true,
                  },
                },
              },
              in: {
                $concat: [
                  { $toString: "$$dateParts.isoWeekYear" },
                  "-",
                  {
                    $cond: [
                      { $lt: ["$$dateParts.isoWeek", 10] },
                      { $concat: ["0", { $toString: "$$dateParts.isoWeek" }] },
                      { $toString: "$$dateParts.isoWeek" },
                    ],
                  },
                ],
              },
            },
          },
          dayOfYear: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$values.time",
              timezone: TIMEZONE,
            },
          },
          hourOfDay: {
            $hour: {
              date: "$values.time",
              timezone: TIMEZONE,
            },
          },
        },
      },
      {
        $group: {
          _id: "$dayOfYear",
          dailyAverage: { $avg: "$pm2_5" },
          readingCount: { $sum: 1 },
          uniqueHours: { $addToSet: "$hourOfDay" },
          yearWeek: { $first: "$yearWeek" },
          minReading: { $min: "$pm2_5" },
          maxReading: { $max: "$pm2_5" },
        },
      },
      {
        $addFields: {
          dataQuality: {
            hasMinReadings: { $gte: ["$readingCount", MIN_READINGS_PER_DAY] },
            hoursCovered: { $size: "$uniqueHours" },
            readingSpread: { $subtract: ["$maxReading", "$minReading"] },
          },
        },
      },
      {
        $group: {
          _id: "$yearWeek",
          weeklyAverage: { $avg: "$dailyAverage" },
          daysWithData: { $sum: 1 },
          daysWithMinReadings: {
            $sum: { $cond: ["$dataQuality.hasMinReadings", 1, 0] },
          },
          avgHoursCovered: { $avg: "$dataQuality.hoursCovered" },
          days: {
            $push: {
              date: "$_id",
              average: "$dailyAverage",
              readingCount: "$readingCount",
              hoursCovered: "$dataQuality.hoursCovered",
              readingSpread: "$dataQuality.readingSpread",
            },
          },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 2 },
    ]).allowDiskUse(true);

    if (result.length < 2) {
      return {
        success: false,
        message: "Insufficient data for comparison",
        status: httpStatus.NOT_FOUND,
      };
    }

    const [currentWeek, previousWeek] = result;
    const todayStr = moment(today)
      .tz(TIMEZONE)
      .format("YYYY-MM-DD");
    const todayData = currentWeek.days.find((day) => day.date === todayStr);

    const percentageDifference =
      previousWeek.weeklyAverage !== 0
        ? ((currentWeek.weeklyAverage - previousWeek.weeklyAverage) /
            previousWeek.weeklyAverage) *
          100
        : 0;

    const dataQualityScore = calculateWeeklyDataQuality(
      currentWeek,
      previousWeek
    );

    return {
      success: true,
      data: {
        dailyAverage: todayData
          ? {
              value: parseFloat(todayData.average.toFixed(2)),
              readingCount: todayData.readingCount,
              hoursCovered: todayData.hoursCovered,
            }
          : null,
        percentageDifference: parseFloat(percentageDifference.toFixed(2)),
        weeklyAverages: {
          currentWeek: parseFloat(currentWeek.weeklyAverage.toFixed(2)),
          previousWeek: parseFloat(previousWeek.weeklyAverage.toFixed(2)),
        },
        dataQuality: {
          score: dataQualityScore,
          currentWeek: {
            daysWithData: currentWeek.daysWithData,
            daysWithMinReadings: currentWeek.daysWithMinReadings,
            averageHoursCovered: parseFloat(
              currentWeek.avgHoursCovered.toFixed(1)
            ),
          },
          previousWeek: {
            daysWithData: previousWeek.daysWithData,
            daysWithMinReadings: previousWeek.daysWithMinReadings,
            averageHoursCovered: parseFloat(
              previousWeek.avgHoursCovered.toFixed(1)
            ),
          },
          warning:
            dataQualityScore < 0.7
              ? "Low data quality may affect accuracy of comparison"
              : null,
        },
        isHistorical: false,
      },
      message: "Successfully retrieved air quality averages",
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(
      `Internal Server Error --- v2_getAirQualityAverages --- ${error.message}`
    );
    logObject("error", error);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

eventSchema.statics.v3_getAirQualityAverages = async function(
  siteId,
  next,
  options = {}
) {
  try {
    // eslint-disable-next-line no-unused-vars
    const { isHistorical = false } = options;

    // For historical data, use the simplified version
    if (isHistorical) {
      return this.getAirQualityAverages(siteId, next, { isHistorical: true });
    }

    const MIN_READINGS_PER_WEEK = 7 * 12;
    const EPSILON = 0.1;

    const now = moment()
      .tz(TIMEZONE)
      .toDate();
    const today = moment()
      .tz(TIMEZONE)
      .startOf("day")
      .toDate();
    const twoWeeksAgo = moment()
      .tz(TIMEZONE)
      .startOf("day")
      .subtract(14, "days")
      .toDate();

    const aggregationPipeline = [
      {
        $match: {
          "values.site_id": mongoose.Types.ObjectId(siteId),
          "values.time": { $gte: twoWeeksAgo, $lte: now },
        },
      },
      { $unwind: { path: "$values", preserveNullAndEmptyArrays: false } },
      {
        $match: {
          "values.time": { $gte: twoWeeksAgo, $lte: now },
          "values.pm2_5.value": {
            $exists: true,
            $ne: null,
            $gte: 0,
            $lte: 500,
          },
        },
      },
      {
        $project: {
          _id: 0,
          time: "$values.time",
          pm2_5: "$values.pm2_5.value",
          yearWeek: { $week: { date: "$values.time", timezone: TIMEZONE } },
          dayOfYear: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$values.time",
              timezone: TIMEZONE,
            },
          },
        },
      },
      {
        $group: {
          _id: "$dayOfYear",
          dailyAverage: { $avg: "$pm2_5" },
          yearWeek: { $first: "$yearWeek" },
          dailyReadingCount: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$yearWeek",
          weeklyAverage: { $avg: "$dailyAverage" },
          weeklyReadingCount: { $sum: "$dailyReadingCount" },
          days: {
            $push: {
              date: "$_id",
              average: "$dailyAverage",
            },
          },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 2 },
    ];

    const result = await this.aggregate(aggregationPipeline).allowDiskUse(true);

    if (result.length < 2) {
      return {
        success: false,
        message: "Insufficient data for comparison",
        status: httpStatus.NOT_FOUND,
      };
    }

    if (
      result[0].weeklyReadingCount < MIN_READINGS_PER_WEEK ||
      result[1].weeklyReadingCount < MIN_READINGS_PER_WEEK
    ) {
      return {
        success: false,
        message: "Insufficient data points for a reliable comparison",
        status: httpStatus.NOT_FOUND,
      };
    }

    const [currentWeek, previousWeek] = result;
    const todayStr = moment(today)
      .tz(TIMEZONE)
      .format("YYYY-MM-DD");
    const todayAverage = currentWeek.days.find((day) => day.date === todayStr)
      ?.average;

    let percentageDifference = null;

    if (previousWeek.weeklyAverage > EPSILON) {
      percentageDifference =
        ((currentWeek.weeklyAverage - previousWeek.weeklyAverage) /
          previousWeek.weeklyAverage) *
        100;
    } else if (previousWeek.weeklyAverage < -1 * EPSILON) {
      percentageDifference =
        ((currentWeek.weeklyAverage - previousWeek.weeklyAverage) /
          Math.abs(previousWeek.weeklyAverage)) *
        100;
    }

    return {
      success: true,
      data: {
        dailyAverage: todayAverage ? parseFloat(todayAverage.toFixed(2)) : null,
        percentageDifference:
          percentageDifference !== null
            ? parseFloat(percentageDifference.toFixed(2))
            : null,
        weeklyAverages: {
          currentWeek: parseFloat(currentWeek.weeklyAverage.toFixed(2)),
          previousWeek: parseFloat(previousWeek.weeklyAverage.toFixed(2)),
        },
        isHistorical: false,
      },
      message: "Successfully retrieved air quality averages",
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(
      `Internal Server Error --- v3_getAirQualityAverages --- ${error.message}`
    );
    logObject("error", error);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

function calculateWeeklyDataQuality(currentWeek, previousWeek) {
  const IDEAL_DAYS = 7;
  const IDEAL_HOURS = 24;

  // Calculate scores for each week
  const currentScore =
    (currentWeek.daysWithMinReadings / IDEAL_DAYS) *
    (currentWeek.avgHoursCovered / IDEAL_HOURS);

  const previousScore =
    (previousWeek.daysWithMinReadings / IDEAL_DAYS) *
    (previousWeek.avgHoursCovered / IDEAL_HOURS);

  // Return average score (0-1 range)
  return (currentScore + previousScore) / 2;
}

// Helper function to calculate confidence score
function calculateConfidenceScore(
  currentWeek,
  baselineWeeks,
  minDataPointsPerDay
) {
  const maxPossibleReadings = 24; // Assuming hourly readings
  const idealDaysPerWeek = 7;

  // Score current week data completeness
  const currentWeekScore =
    (currentWeek.daysWithData / idealDaysPerWeek) *
    (currentWeek.days.reduce(
      (acc, day) => acc + day.readingCount / maxPossibleReadings,
      0
    ) /
      currentWeek.daysWithData);

  // Score baseline weeks data completeness
  const baselineScore =
    baselineWeeks.reduce((acc, week) => {
      const weekScore =
        (week.daysWithData / idealDaysPerWeek) *
        (week.days.reduce(
          (acc, day) => acc + day.readingCount / maxPossibleReadings,
          0
        ) /
          week.daysWithData);
      return acc + weekScore;
    }, 0) / baselineWeeks.length;

  // Combine scores (giving more weight to current week)
  return (currentWeekScore * 0.6 + baselineScore * 0.4) * 100;
}

eventSchema.statics.getAirQualityAveragesForSites = async function(
  siteIds,
  next
) {
  try {
    // eslint-disable-next-line no-unused-vars
    if (!Array.isArray(siteIds) || siteIds.length === 0) {
      return {
        success: true,
        data: {},
        message: "No site IDs provided.",
        status: httpStatus.OK,
      };
    }

    // Validate, normalize, and dedupe input IDs
    const normalizedIds = Array.from(
      new Set(
        siteIds
          .map((id) => (id ? id.toString() : null))
          .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
      )
    );
    if (normalizedIds.length === 0) {
      return {
        success: true,
        data: {},
        message: "No valid site IDs provided.",
        status: httpStatus.OK,
      };
    }

    const objectSiteIds = siteIds.map((id) => mongoose.Types.ObjectId(id));
    const TIMEZONE = moment.tz.guess();
    const now = moment()
      .tz(TIMEZONE)
      .toDate();
    const twoWeeksAgo = moment()
      .tz(TIMEZONE)
      .startOf("day")
      .subtract(14, "days")
      .toDate();

    const results = await this.aggregate([
      {
        $match: {
          "values.site_id": { $in: objectSiteIds },
          "values.time": { $gte: twoWeeksAgo, $lte: now },
          "values.pm2_5.value": { $exists: true, $ne: null }, // Pre-filter for performance
        },
      },
      { $unwind: "$values" },
      {
        $match: {
          "values.site_id": { $in: objectSiteIds },
          "values.time": { $gte: twoWeeksAgo, $lte: now },
          "values.pm2_5.value": { $exists: true, $ne: null },
        },
      },
      {
        $project: {
          _id: 0,
          site_id: "$values.site_id",
          pm2_5: "$values.pm2_5.value",
          yearWeek: {
            // Robust ISO week calculation
            $let: {
              vars: {
                parts: {
                  $dateToParts: {
                    date: "$values.time",
                    timezone: TIMEZONE,
                    iso8601: true,
                  },
                },
              },
              in: {
                $concat: [
                  { $toString: "$$parts.isoWeekYear" },
                  "-",
                  {
                    $cond: [
                      { $lt: ["$$parts.isoWeek", 10] },
                      { $concat: ["0", { $toString: "$$parts.isoWeek" }] },
                      { $toString: "$$parts.isoWeek" },
                    ],
                  },
                ],
              },
            },
          },
          dayOfYear: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$values.time",
              timezone: TIMEZONE,
            },
          },
        },
      },
      {
        $group: {
          _id: { site_id: "$site_id", day: "$dayOfYear" },
          dailyAverage: { $avg: "$pm2_5" },
          yearWeek: { $first: "$yearWeek" },
        },
      },
      {
        $group: {
          _id: { site_id: "$_id.site_id", week: "$yearWeek" },
          weeklyAverage: { $avg: "$dailyAverage" },
        },
      },
      // Sort per site and by week descending to get the two most recent weeks
      { $sort: { "_id.site_id": 1, "_id.week": -1 } },
      {
        $group: {
          _id: "$_id.site_id",
          weeklyAverages: { $push: "$weeklyAverage" },
        },
      },
      { $project: { weeklyAverages: { $slice: ["$weeklyAverages", 2] } } }, // Keep only the two most recent weeks per site
    ]).allowDiskUse(true);

    const averagesBySite = {};
    results.forEach((res) => {
      const [currentWeekAvg, previousWeekAvg] = res.weeklyAverages;
      if (currentWeekAvg !== undefined && previousWeekAvg !== undefined) {
        const percentageDifference =
          previousWeekAvg !== 0
            ? ((currentWeekAvg - previousWeekAvg) / previousWeekAvg) * 100
            : 0;
        averagesBySite[res._id.toString()] = {
          percentageDifference: parseFloat(percentageDifference.toFixed(2)),
          weeklyAverages: {
            currentWeek: parseFloat(currentWeekAvg.toFixed(2)),
            previousWeek: parseFloat(previousWeekAvg.toFixed(2)),
          },
        };
      }
    });

    return {
      success: true,
      data: averagesBySite,
      message: "Successfully retrieved bulk air quality averages",
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(
      `Internal Server Error --- getAirQualityAveragesForSites --- ${error.message}`
    );
    // Do not call next() in a static method that should return a value
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

const eventsModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const events = mongoose.model("events");
    return events;
  } catch (error) {
    return getModelByTenant(dbTenant.toLowerCase(), "event", eventSchema);
  }
};

module.exports = eventsModel;
