const mongoose = require("mongoose");
const { Schema } = mongoose;
const uniqueValidator = require("mongoose-unique-validator");
const { logObject, logText, HttpError } = require("@utils/shared");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- reading-model`);

// Helper function for safe pollutant value conversion
const createSafePollutantLookup = (
  pollutantField,
  collectionName = "healthtips"
) => ({
  $lookup: {
    from: collectionName,
    let: {
      pollutantValue: {
        $cond: {
          if: {
            $and: [
              { $ne: [pollutantField, null] },
              { $ne: [pollutantField, undefined] },
              { $isNumber: pollutantField },
              { $gte: [pollutantField, 0] },
            ],
          },
          then: { $toInt: pollutantField },
          else: null,
        },
      },
    },
    pipeline: [
      {
        $match: {
          $expr: {
            $and: [
              { $ne: ["$$pollutantValue", null] },
              { $lte: ["$aqi_category.min", "$$pollutantValue"] },
              { $gte: ["$aqi_category.max", "$$pollutantValue"] },
            ],
          },
        },
      },
    ],
    as: "health_tips",
  },
});

const HealthTipsSchema = new Schema(
  {
    title: String,
    description: String,
    tag_line: String,
    image: String,
  },
  { _id: false }
);

const categorySchema = new Schema(
  {
    area_name: { type: String },
    category: { type: String },
    highway: { type: String },
    landuse: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    natural: { type: String },
    search_radius: { type: Number },
    waterway: { type: String },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    _id: false,
  }
);

const SiteDetailsSchema = new Schema(
  {
    _id: Schema.Types.ObjectId,
    formatted_name: String,
    location_name: String,
    search_name: String,
    street: String,
    parish: String,
    village: String,
    sub_county: String,
    town: String,
    city: String,
    district: String,
    county: String,
    region: String,
    country: String,
    name: String,
    approximate_latitude: Number,
    approximate_longitude: Number,
    bearing_in_radians: Number,
    description: String,
    data_provider: String,
    site_category: { type: categorySchema },
  },
  { _id: false }
);

const GridDetailsSchema = new Schema(
  {
    _id: Schema.Types.ObjectId,
    name: String,
    long_name: String,
    admin_level: String,
    shape_area: Number,
    approximate_latitude: Number,
    approximate_longitude: Number,
    description: String,
  },
  { _id: false }
);

const AqiRangeSchema = new Schema(
  {
    good: {
      min: { type: Number },
      max: { type: Number },
    },
    moderate: {
      min: { type: Number },
      max: { type: Number },
    },
    u4sg: {
      min: { type: Number },
      max: { type: Number },
    },
    unhealthy: {
      min: { type: Number },
      max: { type: Number },
    },
    very_unhealthy: {
      min: { type: Number },
      max: { type: Number },
    },
    hazardous: {
      min: { type: Number },
      max: { type: Number }, // max can be null
    },
  },
  { _id: false }
);

const averagesSchema = new Schema(
  {
    dailyAverage: { type: Number },
    percentageDifference: { type: Number },
    weeklyAverages: {
      currentWeek: { type: Number },
      previousWeek: { type: Number },
    },
  },
  {
    _id: false,
  }
);

const ReadingsSchema = new Schema(
  {
    // **CORE IDENTIFICATION**
    device: String,
    device_id: String,
    site: String, // Site name
    site_id: {
      type: String,
      required: function() {
        return this.deployment_type === "static";
      },
    },
    grid_id: {
      type: String,
      required: function() {
        return this.deployment_type === "mobile" && !this.location;
      },
    },
    device_number: Number,

    // **TIMING**
    time: Date,
    frequency: String,
    timeDifferenceHours: Number,

    // **DEPLOYMENT CONTEXT**
    deployment_type: {
      type: String,
      enum: ["static", "mobile"],
      default: "static",
      required: true,
    },
    tenant: { type: String, default: "airqo" },
    network: { type: String, default: "airqo" },

    // **PRIMARY PM SENSORS**
    pm1: { value: Number },
    pm2_5: { value: Number },
    pm10: { value: Number },
    no2: { value: Number },

    // **DUAL SENSOR PM VALUES**
    s1_pm1: { value: Number },
    s2_pm1: { value: Number },
    s1_pm2_5: { value: Number },
    s2_pm2_5: { value: Number },
    s1_pm10: { value: Number },
    s2_pm10: { value: Number },

    // **AVERAGED VALUES**
    average_pm2_5: { value: Number },
    average_pm10: { value: Number },

    // **ENVIRONMENTAL SENSORS**
    tvoc: { value: Number },
    co2: { value: Number },
    hcho: { value: Number },
    intaketemperature: { value: Number },
    intakehumidity: { value: Number },
    internalTemperature: { value: Number },
    internalHumidity: { value: Number },
    externalTemperature: { value: Number },
    externalHumidity: { value: Number },
    externalPressure: { value: Number },
    externalAltitude: { value: Number },

    // **LOCATION DATA**
    location: {
      latitude: {
        value: { type: Number, min: -90, max: 90 },
        quality: String,
      },
      longitude: {
        value: { type: Number, min: -180, max: 180 },
        quality: String,
      },
      accuracy: Number,
      speed: Number,
      heading: Number,
    },

    // **GPS/NAVIGATION**
    speed: { value: Number },
    satellites: { value: Number },
    hdop: { value: Number },
    altitude: { value: Number },

    // **POWER & TECHNICAL**
    battery: { value: Number },
    rtc_adc: { value: Number },
    rtc_v: { value: Number },
    rtc: { value: Number },
    stc_adc: { value: Number },
    stc_v: { value: Number },
    stc: { value: Number },

    // **STATUS & FLAGS**
    is_test_data: { type: Boolean, default: false },
    is_reading_primary: Boolean,
    is_device_primary: { type: Boolean, default: false },

    // **PRE-COMPUTED LOOKUP FIELDS**
    siteDetails: SiteDetailsSchema,
    gridDetails: GridDetailsSchema,
    deviceDetails: {
      _id: Schema.Types.ObjectId,
      name: String,
      device_number: Number,
      isPrimaryInLocation: Boolean,
      network: String,
      deployment_type: String,
      mobility: String,
      isActive: Boolean,
    },

    // **PRE-COMPUTED UI FIELDS**
    site_image: String,

    // **PRE-COMPUTED AQI FIELDS**
    aqi_ranges: AqiRangeSchema,
    aqi_color: String,
    aqi_category: String,
    aqi_color_name: String,

    // **PRE-COMPUTED HEALTH & ANALYTICS**
    health_tips: [HealthTipsSchema],
    averages: averagesSchema,
  },
  {
    timestamps: true,
    indexes: [
      {
        fields: { time: 1 },
        expireAfterSeconds: 60 * 60 * 24 * 14, // 2 weeks
      },
    ],
  }
);

ReadingsSchema.pre("save", function(next) {
  // Validate deployment type consistency
  if (this.deployment_type === "static") {
    if (!this.site_id) {
      return next(new Error("Static readings require site_id"));
    }
    // Clear mobile-specific fields for static devices
    if (this.grid_id) {
      this.grid_id = undefined;
    }
  } else if (this.deployment_type === "mobile") {
    if (
      !this.grid_id &&
      (!this.location?.latitude?.value || !this.location?.longitude?.value)
    ) {
      return next(
        new Error(
          "Mobile readings require either grid_id or location coordinates"
        )
      );
    }
    // site_id is optional for mobile devices (they might be at a known site)
  }

  next();
});

ReadingsSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

ReadingsSchema.index(
  { grid_id: 1, time: 1 },
  {
    unique: true,
    partialFilterExpression: { deployment_type: "mobile" },
  }
);
ReadingsSchema.index(
  { site_id: 1, time: 1 },
  {
    unique: true,
    partialFilterExpression: { deployment_type: "static" },
  }
);
ReadingsSchema.index({ device_id: 1, time: 1 }, { unique: true });
ReadingsSchema.index({ device: 1, time: 1 }, { unique: true });
ReadingsSchema.index({ deployment_type: 1, time: -1 });
ReadingsSchema.index({ deployment_type: 1, device_id: 1, time: -1 });
ReadingsSchema.index(
  {
    "location.latitude.value": 1,
    "location.longitude.value": 1,
    time: -1,
  },
  {
    partialFilterExpression: {
      deployment_type: "mobile",
      "location.latitude.value": { $exists: true },
      "location.longitude.value": { $exists: true },
    },
  }
);

// Add after existing indexes
ReadingsSchema.index(
  { grid_id: 1, time: 1, deployment_type: 1 },
  {
    partialFilterExpression: {
      deployment_type: "mobile",
      grid_id: { $exists: true },
    },
  }
);

ReadingsSchema.index(
  { device_id: 1, time: 1, deployment_type: 1 },
  {
    partialFilterExpression: {
      deployment_type: "mobile",
      "location.latitude.value": { $exists: true },
    },
  }
);

ReadingsSchema.index(
  { site_id: 1, time: -1 },
  {
    name: "site_time_latest_idx",
    background: true,
  }
);

ReadingsSchema.index(
  { device_id: 1, time: -1 },
  {
    name: "device_time_latest_idx",
    background: true,
  }
);

ReadingsSchema.index(
  { deployment_type: 1, time: -1 },
  {
    name: "deployment_time_idx",
    background: true,
  }
);

// Better TTL index
ReadingsSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 60 * 60 * 24 * 14, //  2 weeks
    background: true,
  }
);

// Partial index for active readings only
ReadingsSchema.index(
  { time: -1, "pm2_5.value": 1 },
  {
    partialFilterExpression: {
      "pm2_5.value": { $exists: true, $ne: null },
    },
    background: true,
  }
);

// Sparse index for non-null coordinates (mobile devices)
ReadingsSchema.index(
  { "location.latitude.value": 1, "location.longitude.value": 1, time: -1 },
  {
    sparse: true,
    background: true,
  }
);

ReadingsSchema.methods = {
  toJSON() {
    const obj = {
      is_reading_primary: this.is_reading_primary,
      health_tips: this.health_tips,
      timeDifferenceHours: this.timeDifferenceHours,
      aqi_ranges: this.aqi_ranges,
      aqi_color: this.aqi_color,
      aqi_category: this.aqi_category,
      aqi_color_name: this.aqi_color_name,
      averages: this.averages,
      device: this.device,
      device_id: this.device_id,
      deployment_type: this.deployment_type,
      time: this.time,
      pm2_5: this.pm2_5,
      pm10: this.pm10,
      frequency: this.frequency,
      no2: this.no2,
    };

    // Include location-specific fields based on deployment type
    if (this.deployment_type === "static") {
      if (this.site_id) obj.site_id = this.site_id;
      if (this.siteDetails) obj.siteDetails = this.siteDetails;
    } else if (this.deployment_type === "mobile") {
      if (this.grid_id) obj.grid_id = this.grid_id;
      if (this.location) obj.location = this.location;
      if (this.gridDetails) obj.gridDetails = this.gridDetails;
      // Mobile devices can optionally be at known sites
      if (this.site_id) obj.site_id = this.site_id;
      if (this.siteDetails) obj.siteDetails = this.siteDetails;
    }

    return obj;
  },
};

ReadingsSchema.statics.register = async function(args, next) {
  try {
    const createdReading = await this.create(args);

    if (!isEmpty(createdReading)) {
      return {
        success: true,
        data: createdReading._doc,
        message: "reading created",
        status: httpStatus.OK,
      };
    } else {
      return {
        success: false,
        message: "Internal Server Error",
        errors: {
          message: "reading not created despite successful operation",
        },
        data: null,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  } catch (error) {
    logObject("error", error);
    let response = {
      message: "validation errors for some of the provided fields",
      success: false,
      status: httpStatus.CONFLICT,
      errors: { message: error.message },
    };

    if (!isEmpty(error.errors)) {
      response.errors = {};

      Object.entries(error.errors).forEach(([key, value]) => {
        response.errors.message = value.message;
        response.errors[value.path] = value.message;
      });
    } else {
      response.errors = { message: error.message };
    }
    return response;
  }
};
ReadingsSchema.statics.list = async function(
  { filter = {}, limit = 1000, skip = 0 } = {},
  next
) {
  try {
    logText("we are inside model's list....");
    const pipeline = this.aggregate()
      .match(filter)
      .sort({ createdAt: -1 })
      .skip(skip ? skip : 0)
      .limit(limit ? limit : 1000)
      .allowDiskUse(true);

    const data = await pipeline;
    if (!isEmpty(data)) {
      return {
        success: true,
        message: "Successfull Operation",
        data,
        status: httpStatus.OK,
      };
    } else {
      return {
        success: true,
        message: "There are no records for this search",
        data: [],
        status: httpStatus.OK,
      };
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    return {
      success: false,
      message: "Internal Server Error",
      errors: {
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      data: [],
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};
ReadingsSchema.statics.latest = async function(
  { filter = {}, limit = 1000, skip = 0 } = {},
  next
) {
  try {
    // Strategy: Use $lookup with pipeline to get only the latest reading per site
    // This is MUCH more efficient than scanning 7 days of data

    const pipeline = [
      // 1. Get unique site_ids first (fast operation)
      {
        $group: {
          _id: "$site_id",
        },
      },

      // 2. For each site, lookup only the latest reading
      {
        $lookup: {
          from: "readings", // Your collection name
          let: { siteId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$site_id", "$$siteId"] },
                // Only look at last 24 hours for "latest" - much faster!
                time: {
                  $gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                },
              },
            },
            { $sort: { time: -1 } },
            { $limit: 1 }, // Only get the latest reading per site
          ],
          as: "latestReading",
        },
      },

      // 3. Unwind and replace root
      {
        $unwind: {
          path: "$latestReading",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $replaceRoot: { newRoot: "$latestReading" },
      },

      // 4. Apply additional filters
      ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),

      // 5. Sort by time descending
      { $sort: { time: -1 } },

      // 6. Apply pagination
      { $skip: skip || 0 },
      { $limit: limit || 1000 },
    ];

    const data = await this.aggregate(pipeline).allowDiskUse(true);

    if (!isEmpty(data)) {
      return {
        success: true,
        message: "Successfully retrieved latest readings",
        data,
        status: httpStatus.OK,
      };
    } else {
      return {
        success: true,
        message: "No recent readings found",
        data: [],
        status: httpStatus.OK,
      };
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- latest -- ${error.message}`);
    return {
      success: false,
      message: "Internal Server Error",
      errors: {
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      data: [],
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};
ReadingsSchema.statics.latestForMap = async function(
  { filter = {}, limit = 1000, skip = 0 } = {},
  next
) {
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const pipeline = [
      // 1. Match recent readings only
      {
        $match: {
          time: { $gte: fourteenDaysAgo },
          "pm2_5.value": { $exists: true, $ne: null },
          ...filter,
        },
      },

      // 2. Sort by time descending
      { $sort: { time: -1 } },

      // 3. Group by site_id and take first (latest) reading
      {
        $group: {
          _id: "$site_id",
          latestReading: { $first: "$$ROOT" },
        },
      },

      // 4. Replace root with the latest reading
      { $replaceRoot: { newRoot: "$latestReading" } },

      // 5. Sort again by time for consistent output
      { $sort: { time: -1 } },

      // 6. Apply pagination
      { $skip: skip || 0 },
      { $limit: limit || 1000 },

      // 7. Project only necessary fields for map
      {
        $project: {
          _id: 0,
          device: 1,
          device_id: 1,
          site_id: 1,
          time: 1,
          pm2_5: 1,
          pm10: 1,
          no2: 1,
          siteDetails: 1,
          aqi_color: 1,
          aqi_category: 1,
          aqi_color_name: 1,
          health_tips: 1,
          site_image: 1,
          timeDifferenceHours: 1,
        },
      },
    ];

    const data = await this.aggregate(pipeline).allowDiskUse(true);

    return {
      success: true,
      message: "Successfully retrieved latest map readings",
      data,
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(
      `🐛🐛 Internal Server Error -- latestForMap -- ${error.message}`
    );
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
      data: [],
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};
ReadingsSchema.statics.recent = async function(
  { filter = {}, limit = 1000, skip = 0 } = {},
  next
) {
  try {
    let threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    let groupBy = "$site_id";
    if (filter.device || filter.device_id) {
      groupBy = "$device_id";
    }

    const pipeline = this.aggregate()
      .match({
        ...filter,
        time: {
          $gte: threeDaysAgo,
        },
      })
      .sort({ time: -1 })
      .group({
        _id: groupBy,
        doc: { $first: "$$ROOT" },
      })
      .replaceRoot("$doc")
      .skip(skip)
      .limit(limit)
      .allowDiskUse(true);

    const data = await pipeline;
    if (!isEmpty(data)) {
      return {
        success: true,
        message: "Successfull Operation",
        data,
        status: httpStatus.OK,
      };
    } else {
      return {
        success: true,
        message: "There are no records for this search",
        data: [],
        status: httpStatus.OK,
      };
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);

    return {
      success: false,
      message: "Internal Server Error",
      errors: {
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      data: [],
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};
ReadingsSchema.statics.getBestAirQualityLocations = async function(
  { threshold = 10, pollutant = "pm2_5", limit = 100, skip = 0 } = {},
  next
) {
  try {
    const validPollutants = ["pm2_5", "pm10", "no2"];
    if (!validPollutants.includes(pollutant)) {
      return {
        success: false,
        message: "Bad Request Error",
        errors: {
          message: `Invalid pollutant specified. Valid options are: ${validPollutants.join(
            ", "
          )}`,
          validOptions: validPollutants,
          received: pollutant,
        },
        data: [],
        status: httpStatus.BAD_REQUEST,
      };
    }

    const matchCondition = {
      [`${pollutant}.value`]: { $lt: threshold },
    };

    const pipeline = this.aggregate()
      .match(matchCondition)
      .project({
        _id: 0,
        site_id: 1,
        time: 1,
        [pollutant]: 1,
        siteDetails: 1,
      })
      .allowDiskUse(true)
      .skip(skip)
      .limit(limit);

    const data = await pipeline;

    if (!isEmpty(data)) {
      return {
        success: true,
        message: "Successfully retrieved locations with best air quality.",
        data,
        status: httpStatus.OK,
      };
    } else {
      return {
        success: true,
        message:
          "No locations found with air quality below the specified threshold.",
        data: [],
        status: httpStatus.OK,
      };
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    return {
      success: false,
      message: "Internal Server Error",
      errors: {
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      data: [],
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};
ReadingsSchema.statics.getAirQualityAnalytics = async function(siteId, next) {
  try {
    // Validate input
    if (!siteId) {
      return {
        success: false,
        message: "Bad Request Error",
        errors: {
          message: "Site ID is required",
          field: "siteId",
        },
        data: {},
        status: httpStatus.BAD_REQUEST,
      };
    }

    // Get current date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Calculate time boundaries
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const monthStart = new Date(today);
    monthStart.setDate(1);

    // WHO Air Quality Guidelines (annual mean)
    const WHO_GUIDELINES = {
      pm2_5: 5, // μg/m³
      pm10: 15, // μg/m³
      no2: 10, // μg/m³
    };

    // Define peak hours (e.g., morning and evening rush hours)
    const PEAK_HOURS = {
      morning: { start: 6, end: 9 },
      evening: { start: 16, end: 19 },
    };

    // Pipeline for daily average and hourly breakdown
    const dailyAnalysisPipeline = this.aggregate([
      {
        $match: {
          site_id: siteId,
          time: {
            $gte: today,
            $lt: tomorrow,
          },
        },
      },
      {
        $group: {
          _id: { $hour: "$time" },
          pm2_5_avg: { $avg: "$pm2_5.value" },
          pm10_avg: { $avg: "$pm10.value" },
          no2_avg: { $avg: "$no2.value" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Pipeline for monthly trend analysis
    const monthlyTrendPipeline = this.aggregate([
      {
        $match: {
          site_id: siteId,
          time: {
            $gte: monthStart,
          },
        },
      },
      {
        $group: {
          _id: { $dayOfMonth: "$time" },
          pm2_5_avg: { $avg: "$pm2_5.value" },
          pm10_avg: { $avg: "$pm10.value" },
          no2_avg: { $avg: "$no2.value" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Pipeline for weekly comparisons
    const weeklyComparisonPipeline = this.aggregate([
      {
        $match: {
          site_id: siteId,
          time: {
            $gte: lastWeekStart,
          },
        },
      },
      {
        $addFields: {
          isCurrentWeek: {
            $gte: ["$time", currentWeekStart],
          },
          isPeakHour: {
            $or: [
              {
                $and: [
                  { $gte: [{ $hour: "$time" }, PEAK_HOURS.morning.start] },
                  { $lte: [{ $hour: "$time" }, PEAK_HOURS.morning.end] },
                ],
              },
              {
                $and: [
                  { $gte: [{ $hour: "$time" }, PEAK_HOURS.evening.start] },
                  { $lte: [{ $hour: "$time" }, PEAK_HOURS.evening.end] },
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: {
            isCurrentWeek: "$isCurrentWeek",
            isPeakHour: "$isPeakHour",
          },
          pm2_5_avg: { $avg: "$pm2_5.value" },
          pm10_avg: { $avg: "$pm10.value" },
          no2_avg: { $avg: "$no2.value" },
          readings_count: { $sum: 1 },
        },
      },
    ]);

    // Execute all pipelines
    const [dailyAnalysis, monthlyTrend, weeklyComparison] = await Promise.all([
      dailyAnalysisPipeline,
      monthlyTrendPipeline,
      weeklyComparisonPipeline,
    ]);

    // Process daily averages and identify peak pollution hours
    const hourlyData = dailyAnalysis.reduce((acc, hour) => {
      acc[hour._id] = {
        pm2_5: hour.pm2_5_avg,
        pm10: hour.pm10_avg,
        no2: hour.no2_avg,
        readings_count: hour.count,
      };
      return acc;
    }, {});

    // Calculate peak pollution hours
    const findPeakHours = (hourlyData) => {
      const peaks = {
        pm2_5: { hour: 0, value: 0 },
        pm10: { hour: 0, value: 0 },
        no2: { hour: 0, value: 0 },
      };

      Object.entries(hourlyData).forEach(([hour, data]) => {
        if (data.pm2_5 > peaks.pm2_5.value) {
          peaks.pm2_5 = { hour: parseInt(hour), value: data.pm2_5 };
        }
        if (data.pm10 > peaks.pm10.value) {
          peaks.pm10 = { hour: parseInt(hour), value: data.pm10 };
        }
        if (data.no2 > peaks.no2.value) {
          peaks.no2 = { hour: parseInt(hour), value: data.no2 };
        }
      });

      return peaks;
    };

    // Calculate WHO guidelines compliance
    const calculateCompliance = (averages) => {
      return {
        pm2_5: {
          compliant: averages.pm2_5 <= WHO_GUIDELINES.pm2_5,
          percentage: (averages.pm2_5 / WHO_GUIDELINES.pm2_5) * 100,
        },
        pm10: {
          compliant: averages.pm10 <= WHO_GUIDELINES.pm10,
          percentage: (averages.pm10 / WHO_GUIDELINES.pm10) * 100,
        },
        no2: {
          compliant: averages.no2 <= WHO_GUIDELINES.no2,
          percentage: (averages.no2 / WHO_GUIDELINES.no2) * 100,
        },
      };
    };

    // Process weekly comparisons
    const processWeeklyData = (weeklyComparison) => {
      const current = {
        normal: weeklyComparison.find(
          (w) => w._id.isCurrentWeek === true && w._id.isPeakHour === false
        ) || { pm2_5_avg: 0, pm10_avg: 0, no2_avg: 0 },
        peak: weeklyComparison.find(
          (w) => w._id.isCurrentWeek === true && w._id.isPeakHour === true
        ) || { pm2_5_avg: 0, pm10_avg: 0, no2_avg: 0 },
      };

      const last = {
        normal: weeklyComparison.find(
          (w) => w._id.isCurrentWeek === false && w._id.isPeakHour === false
        ) || { pm2_5_avg: 0, pm10_avg: 0, no2_avg: 0 },
        peak: weeklyComparison.find(
          (w) => w._id.isCurrentWeek === false && w._id.isPeakHour === true
        ) || { pm2_5_avg: 0, pm10_avg: 0, no2_avg: 0 },
      };

      return { current, last };
    };

    // Calculate trends
    const calculateTrend = (data) => {
      if (data.length < 2) return "insufficient_data";

      const lastValue = data[data.length - 1];
      const previousValue = data[data.length - 2];
      const percentChange =
        previousValue === 0
          ? 0
          : ((lastValue - previousValue) / previousValue) * 100;

      if (percentChange > 5) return "increasing";
      if (percentChange < -5) return "decreasing";
      return "stable";
    };

    // Process all data
    const weeklyData = processWeeklyData(weeklyComparison);
    // Denominator: replaced 24 with Object.keys(hourlyData).length
    const dailyAverages = {
      pm2_5:
        Object.values(hourlyData).reduce((sum, hour) => sum + hour.pm2_5, 0) /
        Object.keys(hourlyData).length,
      pm10:
        Object.values(hourlyData).reduce((sum, hour) => sum + hour.pm10, 0) /
        Object.keys(hourlyData).length,
      no2:
        Object.values(hourlyData).reduce((sum, hour) => sum + hour.no2, 0) /
        Object.keys(hourlyData).length,
    };

    // Calculate percentage differences
    const calculatePercentageDiff = (current, previous) => {
      if (previous === 0) return 0;
      return ((current - previous) / previous) * 100;
    };

    const percentageDifferences = {
      normal: {
        pm2_5: calculatePercentageDiff(
          weeklyData.current.normal.pm2_5_avg,
          weeklyData.last.normal.pm2_5_avg
        ),
        pm10: calculatePercentageDiff(
          weeklyData.current.normal.pm10_avg,
          weeklyData.last.normal.pm10_avg
        ),
        no2: calculatePercentageDiff(
          weeklyData.current.normal.no2_avg,
          weeklyData.last.normal.no2_avg
        ),
      },
      peak: {
        pm2_5: calculatePercentageDiff(
          weeklyData.current.peak.pm2_5_avg,
          weeklyData.last.peak.pm2_5_avg
        ),
        pm10: calculatePercentageDiff(
          weeklyData.current.peak.pm10_avg,
          weeklyData.last.peak.pm10_avg
        ),
        no2: calculatePercentageDiff(
          weeklyData.current.peak.no2_avg,
          weeklyData.last.peak.no2_avg
        ),
      },
    };

    // Round all numeric values to 2 decimal places
    const roundObject = (obj) => {
      return Object.entries(obj).reduce((acc, [key, value]) => {
        if (typeof value === "object" && value !== null) {
          acc[key] = roundObject(value);
        } else {
          acc[key] =
            typeof value === "number" ? Number(value.toFixed(2)) : value;
        }
        return acc;
      }, {});
    };

    const response = {
      success: true,
      message: "Successfully retrieved air quality analytics",
      data: {
        dailyAverage: roundObject(dailyAverages),
        hourlyBreakdown: roundObject(hourlyData),
        peakPollutionHours: roundObject(findPeakHours(hourlyData)),
        weeklyComparison: {
          current: {
            normal: roundObject(weeklyData.current.normal),
            peak: roundObject(weeklyData.current.peak),
          },
          previous: {
            normal: roundObject(weeklyData.last.normal),
            peak: roundObject(weeklyData.last.peak),
          },
        },
        percentageChange: roundObject(percentageDifferences),
        compliance: roundObject(calculateCompliance(dailyAverages)),
        monthlyTrend: {
          data: roundObject(monthlyTrend),
          trends: {
            pm2_5: calculateTrend(monthlyTrend.map((d) => d.pm2_5_avg)),
            pm10: calculateTrend(monthlyTrend.map((d) => d.pm10_avg)),
            no2: calculateTrend(monthlyTrend.map((d) => d.no2_avg)),
          },
        },
      },
      status: httpStatus.OK,
    };
    return response;
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    return {
      success: false,
      message: "Internal Server Error",
      errors: {
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      data: [],
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};
ReadingsSchema.statics.getWorstPm2_5Reading = async function({
  siteIds = [],
  next,
} = {}) {
  try {
    if (isEmpty(siteIds) || !Array.isArray(siteIds)) {
      return {
        success: false,
        message: "siteIds array is required",
        errors: {
          message: "siteIds must be a non-empty array",
        },
        data: [],
        status: httpStatus.BAD_REQUEST,
      };
    }
    if (siteIds.length === 0) {
      return {
        success: true,
        message: "No site_ids were provided",
        data: [],
        status: httpStatus.OK,
      };
    }

    // Validate siteIds type
    if (!siteIds.every((id) => typeof id === "string")) {
      return {
        success: false,
        message: "siteIds must be an array of strings",
        errors: {
          message: "All site IDs must be strings",
        },
        data: [],
        status: httpStatus.BAD_REQUEST,
      };
    }

    const formattedSiteIds = siteIds.map((id) => id.toString());
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const pipeline = this.aggregate([
      {
        $match: {
          site_id: { $in: formattedSiteIds },
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
          site_id: 1,
          time: 1,
          pm2_5: 1,
          device: 1,
          device_id: 1,
          siteDetails: 1,
        },
      },
    ]).allowDiskUse(true);

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
          "No pm2_5 readings found for the specified site_ids in the last three days.",
        data: {},
        status: httpStatus.OK,
      };
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    return {
      success: false,
      message: "Internal Server Error",
      errors: {
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      data: [],
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};
ReadingsSchema.statics.listRecent = async function(
  { filter = {}, limit = 1000, skip = 0, page = 1 } = {},
  next
) {
  try {
    logText("Using optimized Readings collection for recent data query");

    // Build aggregation pipeline for Readings (much simpler than Events)
    const pipeline = [
      { $match: filter },
      { $sort: { time: -1 } }, // Most recent first

      // Lookup site details if needed
      {
        $lookup: {
          from: "sites",
          localField: "site_id",
          foreignField: "_id",
          as: "siteDetails",
        },
      },

      // Lookup device details if needed
      {
        $lookup: {
          from: "devices",
          localField: "device_id",
          foreignField: "_id",
          as: "deviceDetails",
        },
      },

      // Lookup grid details for mobile devices
      {
        $lookup: {
          from: "grids",
          localField: "grid_id",
          foreignField: "_id",
          as: "gridDetails",
        },
      },
      createSafePollutantLookup("$pm2_5.value"),
      {
        $project: {
          _id: 0,
          device: 1,
          device_id: 1,
          site_id: 1,
          grid_id: 1,
          deployment_type: 1,
          time: 1,
          pm2_5: 1,
          pm10: 1,
          no2: 1,
          frequency: 1,
          location: 1,
          averages: 1,
          timeDifferenceHours: 1,
          aqi_color: 1,
          aqi_category: 1,
          aqi_color_name: 1,
          aqi_ranges: 1,
          health_tips: 1,
          siteDetails: { $arrayElemAt: ["$siteDetails", 0] },
          deviceDetails: { $arrayElemAt: ["$deviceDetails", 0] },
          gridDetails: { $arrayElemAt: ["$gridDetails", 0] },
        },
      },

      // Facet for pagination
      {
        $facet: {
          total: [{ $count: "count" }],
          data: [{ $skip: skip || 0 }, { $limit: limit || 1000 }],
        },
      },

      // Final projection with metadata
      {
        $project: {
          meta: {
            total: { $arrayElemAt: ["$total.count", 0] },
            skip: { $literal: skip },
            limit: { $literal: limit },
            page: { $literal: Math.floor(skip / limit) + 1 },
            pages: {
              $ceil: {
                $divide: [{ $arrayElemAt: ["$total.count", 0] }, limit],
              },
            },
          },
          data: "$data",
        },
      },
    ];

    const result = await this.aggregate(pipeline).allowDiskUse(true);

    const response = result[0] || { meta: { total: 0 }, data: [] };

    return {
      success: true,
      message:
        "Successfully retrieved recent measurements from optimized collection",
      data: [response], // Wrap in array to match Events format
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(
      `🐛🐛 Internal Server Error -- listRecent -- ${error.message}`
    );
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};
ReadingsSchema.statics.viewRecent = async function(filter, next) {
  try {
    logText("Using optimized Readings collection for recent view query");

    const pipeline = [
      { $match: filter },
      { $sort: { time: -1 } },

      // Simplified lookup and projection for view operations
      {
        $lookup: {
          from: "sites",
          localField: "site_id",
          foreignField: "_id",
          as: "siteDetails",
        },
      },
      createSafePollutantLookup("$pm2_5.value"),
      {
        $project: {
          _id: 0,
          device: 1,
          device_id: 1,
          site_id: 1,
          grid_id: 1,
          deployment_type: 1,
          time: 1,
          pm2_5: 1,
          pm10: 1,
          no2: 1,
          frequency: 1,
          location: 1,
          siteDetails: { $arrayElemAt: ["$siteDetails", 0] },
        },
      },

      {
        $facet: {
          data: [{ $match: {} }],
          meta: [
            { $count: "total" },
            {
              $addFields: {
                pm2_5Avg: { $avg: "$pm2_5.value" },
              },
            },
          ],
        },
      },
    ];

    const result = await this.aggregate(pipeline).allowDiskUse(true);

    return {
      success: true,
      message: "Successfully retrieved recent measurements",
      data: result,
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(
      `🐛🐛 Internal Server Error -- viewRecent -- ${error.message}`
    );
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};
ReadingsSchema.statics.listRecentOptimized = async function(
  { filter = {}, limit = 1000, skip = 0, page = 1 } = {},
  next
) {
  try {
    logText(
      "Using ultra-optimized Readings collection - no aggregations needed!"
    );

    // Simple find with projection - no lookups needed!
    const totalCount = await this.countDocuments(filter);

    const data = await this.find(filter)
      .sort({ time: -1 })
      .skip(skip || 0)
      .limit(limit || 1000)
      .lean(); // Use lean() for better performance

    // Filter out null pm2_5 values
    const filteredData = data.filter((record) => record.pm2_5?.value !== null);

    // Build response matching Events format exactly
    const response = {
      meta: {
        total: totalCount,
        skip: skip || 0,
        limit: limit || 1000,
        page: Math.floor((skip || 0) / (limit || 1000)) + 1,
        pages: Math.ceil(totalCount / (limit || 1000)),
      },
      data: filteredData,
    };

    return {
      success: true,
      message:
        "Successfully retrieved recent measurements from ultra-optimized collection",
      data: [response], // Wrap to match Events format
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`🐛🐛 Ultra-optimized query error: ${error.message}`);
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};
ReadingsSchema.statics.getLatestByLocation = async function(
  { deployment_type, location_ids, limit = 100 } = {},
  next
) {
  try {
    let filter = {};

    if (deployment_type === "static" && location_ids) {
      filter.site_id = { $in: location_ids };
    } else if (deployment_type === "mobile" && location_ids) {
      filter.grid_id = { $in: location_ids };
    }

    // Simple find - all data is pre-computed!
    const data = await this.find(filter)
      .sort({ time: -1 })
      .limit(limit)
      .lean();

    return {
      success: true,
      message: "Successfully retrieved latest readings by location",
      data: data.filter((record) => record.pm2_5?.value !== null),
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`🐛🐛 Error getting latest by location: ${error.message}`);
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

const ReadingModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const readings = mongoose.model("readings");
    return readings;
  } catch (error) {
    const readings = getModelByTenant(dbTenant, "reading", ReadingsSchema);
    return readings;
  }
};

module.exports = ReadingModel;
