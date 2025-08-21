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

const HealthTipsSchema = new Schema(
  {
    title: String,
    description: String,
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
    device: String,
    device_id: String,
    is_reading_primary: Boolean,
    health_tips: [HealthTipsSchema],
    site_id: String,
    time: Date,
    pm2_5: { value: Number },
    pm10: { value: Number },
    frequency: String,
    no2: { value: Number },
    siteDetails: SiteDetailsSchema,
    aqi_ranges: AqiRangeSchema,
    timeDifferenceHours: Number,
    aqi_color: String,
    aqi_category: String,
    aqi_color_name: String,
    averages: { type: averagesSchema },
  },
  {
    timestamps: true,
    indexes: [
      {
        fields: { time: 1 },
        expireAfterSeconds: 60 * 60 * 24 * 30, // 1 month in seconds
      },
    ],
  }
);

ReadingsSchema.pre("save", function(next) {
  next();
});

ReadingsSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

// Unique when device_id exists
ReadingsSchema.index(
  { device_id: 1, time: 1 },
  { unique: true, partialFilterExpression: { device_id: { $exists: true } } }
);
// Unique when device string exists (only if you truly need this)
ReadingsSchema.index(
  { device: 1, time: 1 },
  {
    unique: true,
    partialFilterExpression: { device: { $exists: true, $type: "string" } },
  }
);
// Unique when site_id exists
ReadingsSchema.index(
  { site_id: 1, time: 1 },
  { unique: true, partialFilterExpression: { site_id: { $exists: true } } }
);
// TTL on time (30 days)
ReadingsSchema.index({ time: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

ReadingsSchema.methods = {
  toJSON() {
    return {
      device: this.device,
      device_id: this.device_id,
      is_reading_primary: this.is_reading_primary,
      health_tips: this.health_tips,
      site_id: this.site_id,
      time: this.time,
      pm2_5: this.pm2_5,
      pm10: this.pm10,
      frequency: this.frequency,
      no2: this.no2,
      siteDetails: this.siteDetails,
      timeDifferenceHours: this.timeDifferenceHours,
      aqi_ranges: this.aqi_ranges,
      aqi_color: this.aqi_color,
      aqi_category: this.aqi_category,
      aqi_color_name: this.aqi_color_name,
      averages: this.averages,
    };
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
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: "reading not created despite successful operation",
          }
        )
      );
      return;
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
    next(new HttpError(response.message, response.status, response.errors));
    return;
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
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
    return;
  }
};
ReadingsSchema.statics.latest = async function(
  { filter = {}, limit = 1000, skip = 0 } = {},
  next
) {
  try {
    let sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const pipeline = this.aggregate()
      .match({
        ...filter,
        time: {
          $gte: sevenDaysAgo,
        },
      })
      .sort({ time: -1 })
      .group({
        _id: "$site_id",
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
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
    return;
  }
};
ReadingsSchema.statics.recent = async function(
  { filter = {}, limit = 1000, skip = 0 } = {},
  next
) {
  try {
    let threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const pipeline = this.aggregate()
      .match({
        ...filter,
        time: {
          $gte: threeDaysAgo,
        },
      })
      .sort({ time: -1 })
      .group({
        _id: "$site_id",
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
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
    return;
  }
};
ReadingsSchema.statics.getBestAirQualityLocations = async function(
  { threshold = 10, pollutant = "pm2_5", limit = 100, skip = 0 } = {},
  next
) {
  try {
    const validPollutants = ["pm2_5", "pm10", "no2"];
    if (!validPollutants.includes(pollutant)) {
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message: `Invalid pollutant specified. Valid options are: ${validPollutants.join(
            ", "
          )}`,
        })
      );
      return;
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
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
    return;
  }
};
ReadingsSchema.statics.getAirQualityAnalytics = async function(siteId, next) {
  try {
    // Validate input
    if (!siteId) {
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message: "Site ID is required",
        })
      );
      return;
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
    const hours = Object.keys(hourlyData).length;
    const safeAvg = (arr) =>
      hours > 0 ? arr.reduce((s, v) => s + v, 0) / hours : null;
    const dailyAverages = {
      pm2_5: safeAvg(Object.values(hourlyData).map((h) => h.pm2_5 || 0)),
      pm10: safeAvg(Object.values(hourlyData).map((h) => h.pm10 || 0)),
      no2: safeAvg(Object.values(hourlyData).map((h) => h.no2 || 0)),
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
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
    return;
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
