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
const UPTIME_CHECK_THRESHOLD = 168;
const moment = require("moment-timezone");
const TIMEZONE = moment.tz.guess();

const AQI_COLORS = constants.AQI_COLORS;
const AQI_CATEGORIES = constants.AQI_CATEGORIES;
const AQI_COLOR_NAMES = constants.AQI_COLOR_NAMES;
const AQI_RANGES = constants.AQI_RANGES;

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
  is_device_primary: {
    type: Boolean,
    trim: true,
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
      },
    },
    longitude: {
      value: {
        type: Number,
        default: null,
      },
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
    "values.frequency": 1,
    day: 1,
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

eventSchema.pre("save", function() {
  const err = new Error("something went wrong");
  next(err);
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
  } = filter;

  if (typeof limit !== "number" || isNaN(limit)) {
    limit = DEFAULT_LIMIT;
  }

  if (typeof page !== "number" || isNaN(page)) {
    page = DEFAULT_PAGE;
  }

  if (page) {
    skip = parseInt((page - 1) * limit);
  }

  logObject("filter BABY", filter);

  const startTime = filter["values.time"]["$gte"];
  const endTime = filter["values.time"]["$lte"];
  let idField;
  // const visibilityFilter = true;

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
  let meta = {
    total: { $arrayElemAt: ["$total.device", 0] },
    skip: { $literal: skip },
    limit: { $literal: limit },
    page: {
      $trunc: {
        $literal: skip / limit + 1,
      },
    },
    pages: {
      $ifNull: [
        {
          $ceil: {
            $divide: [{ $arrayElemAt: ["$total.device", 0] }, limit],
          },
        },
        1,
      ],
    },
    startTime,
    endTime,
  };
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

  /**
   * The Alternative Flows present in this Events entity:
   * 1. Based on tenant, which PM values should we showcase?
   * 2. Which metadata should we show? Sites or Devices? etc....
   * 3. Should we show recent or historical measurements?
   */
  if (tenant !== "airqo") {
    pm2_5 = "$pm2_5";
    pm10 = "$pm10";
  }

  if (external === "yes" || brief === "yes") {
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
  }

  if (!metadata || metadata === "device" || metadata === "device_id") {
    idField = "$device";
    groupId = "$" + metadata ? metadata : groupId;
    localField = metadata ? metadata : localField;
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

  if (running === "yes") {
    delete projection["pm2_5.uncertaintyValue"];
    delete projection["pm2_5.standardDeviationValue"];
    delete projection["pm2_5.calibratedValue"];

    Object.assign(projection, {
      site_image: 0,
      is_reading_primary: 0,
      deviceDetails: 0,
      aqi_color: 0,
      aqi_category: 0,
      aqi_color_name: 0,
      pm2_5: 0,
      average_pm10: 0,
      average_pm2_5: 0,
      pm10: 0,
      frequency: 0,
      network: 0,
      location: 0,
      altitude: 0,
      speed: 0,
      satellites: 0,
      hdop: 0,
      intaketemperature: 0,
      tvoc: 0,
      hcho: 0,
      co2: 0,
      intakehumidity: 0,
      internalTemperature: 0,
      externalTemperature: 0,
      internalHumidity: 0,
      externalHumidity: 0,
      externalAltitude: 0,
      pm1: 0,
      no2: 0,
      site: 0,
      site_id: 0,
      health_tips: 0,
      s1_pm2_5: 0,
      s2_pm2_5: 0,
      s1_pm10: 0,
      s2_pm10: 0,
      battery: 0,
      rtc_adc: 0,
      rtc_v: 0,
      rtc: 0,
      stc_adc: 0,
      stc_v: 0,
      stc: 0,
      siteDetails: 0,
    });
  }

  if (!isEmpty(index)) {
    sort = { "pm2_5.value": 1 };
  }

  logObject("the query for this request", search);

  if (!recent || recent === "yes") {
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
      })
      // .match({ "device_details.visibility": visibilityFilter })
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
          $divide: [
            { $subtract: [new Date(), "$time"] },
            1000 * 60 * 60, // milliseconds to hours
          ],
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
      .facet({
        total: [{ $count: "device" }],
        data: [
          {
            $addFields: {
              device: "$device",
              aqi_color: {
                $switch: {
                  branches: [
                    {
                      case: {
                        $and: [
                          { $gte: ["$pm2_5.value", "$aqi_ranges.good.min"] },
                          { $lte: ["$pm2_5.value", "$aqi_ranges.good.max"] },
                        ],
                      },
                      then: "00e400",
                    },
                    {
                      case: {
                        $and: [
                          {
                            $gte: ["$pm2_5.value", "$aqi_ranges.moderate.min"],
                          },
                          {
                            $lte: ["$pm2_5.value", "$aqi_ranges.moderate.max"],
                          },
                        ],
                      },
                      then: "ffff00",
                    },
                    {
                      case: {
                        $and: [
                          { $gte: ["$pm2_5.value", "$aqi_ranges.u4sg.min"] },
                          { $lte: ["$pm2_5.value", "$aqi_ranges.u4sg.max"] },
                        ],
                      },
                      then: "ff7e00",
                    },
                    {
                      case: {
                        $and: [
                          {
                            $gte: ["$pm2_5.value", "$aqi_ranges.unhealthy.min"],
                          },
                          {
                            $lte: ["$pm2_5.value", "$aqi_ranges.unhealthy.max"],
                          },
                        ],
                      },
                      then: "ff0000",
                    },
                    {
                      case: {
                        $and: [
                          {
                            $gte: [
                              "$pm2_5.value",
                              "$aqi_ranges.very_unhealthy.min",
                            ],
                          },
                          {
                            $lte: [
                              "$pm2_5.value",
                              "$aqi_ranges.very_unhealthy.max",
                            ],
                          },
                        ],
                      },
                      then: "8f3f97",
                    },
                    {
                      case: {
                        $gte: ["$pm2_5.value", "$aqi_ranges.hazardous.min"],
                      },
                      then: "7e0023",
                    },
                  ],
                  default: "Unknown",
                },
              },

              aqi_category: {
                $switch: {
                  branches: [
                    {
                      case: {
                        $and: [
                          { $gte: ["$pm2_5.value", "$aqi_ranges.good.min"] },
                          { $lte: ["$pm2_5.value", "$aqi_ranges.good.max"] },
                        ],
                      },
                      then: "Good",
                    },
                    {
                      case: {
                        $and: [
                          {
                            $gte: ["$pm2_5.value", "$aqi_ranges.moderate.min"],
                          },
                          {
                            $lte: ["$pm2_5.value", "$aqi_ranges.moderate.max"],
                          },
                        ],
                      },
                      then: "Moderate",
                    },
                    {
                      case: {
                        $and: [
                          { $gte: ["$pm2_5.value", "$aqi_ranges.u4sg.min"] },
                          { $lte: ["$pm2_5.value", "$aqi_ranges.u4sg.max"] },
                        ],
                      },
                      then: "Unhealthy for Sensitive Groups",
                    },
                    {
                      case: {
                        $and: [
                          {
                            $gte: ["$pm2_5.value", "$aqi_ranges.unhealthy.min"],
                          },
                          {
                            $lte: ["$pm2_5.value", "$aqi_ranges.unhealthy.max"],
                          },
                        ],
                      },
                      then: "Unhealthy",
                    },
                    {
                      case: {
                        $and: [
                          {
                            $gte: [
                              "$pm2_5.value",
                              "$aqi_ranges.very_unhealthy.min",
                            ],
                          },
                          {
                            $lte: [
                              "$pm2_5.value",
                              "$aqi_ranges.very_unhealthy.max",
                            ],
                          },
                        ],
                      },
                      then: "Very Unhealthy",
                    },
                    {
                      case: {
                        $and: [
                          {
                            $gte: ["$pm2_5.value", "$aqi_ranges.hazardous.min"],
                          },
                        ],
                      },
                      then: "Hazardous",
                    },
                  ],
                  default: "Unknown",
                },
              },
              aqi_color_name: {
                $switch: {
                  branches: [
                    {
                      case: {
                        $and: [
                          { $gte: ["$pm2_5.value", "$aqi_ranges.good.min"] },
                          { $lte: ["$pm2_5.value", "$aqi_ranges.good.max"] },
                        ],
                      },
                      then: "Green",
                    },
                    {
                      case: {
                        $and: [
                          {
                            $gte: ["$pm2_5.value", "$aqi_ranges.moderate.min"],
                          },
                          {
                            $lte: ["$pm2_5.value", "$aqi_ranges.moderate.max"],
                          },
                        ],
                      },
                      then: "Yellow",
                    },
                    {
                      case: {
                        $and: [
                          { $gte: ["$pm2_5.value", "$aqi_ranges.u4sg.min"] },
                          { $lte: ["$pm2_5.value", "$aqi_ranges.u4sg.max"] },
                        ],
                      },
                      then: "Orange",
                    },
                    {
                      case: {
                        $and: [
                          {
                            $gte: ["$pm2_5.value", "$aqi_ranges.unhealthy.min"],
                          },
                          {
                            $lte: ["$pm2_5.value", "$aqi_ranges.unhealthy.max"],
                          },
                        ],
                      },
                      then: "Red",
                    },
                    {
                      case: {
                        $and: [
                          {
                            $gte: [
                              "$pm2_5.value",
                              "$aqi_ranges.very_unhealthy.min",
                            ],
                          },
                          {
                            $lte: [
                              "$pm2_5.value",
                              "$aqi_ranges.very_unhealthy.max",
                            ],
                          },
                        ],
                      },
                      then: "Purple",
                    },
                    {
                      case: {
                        $and: [
                          {
                            $gte: ["$pm2_5.value", "$aqi_ranges.hazardous.min"],
                          },
                        ],
                      },
                      then: "Maroon",
                    },
                  ],
                  default: "Unknown",
                },
              },
              aqi_ranges: "$aqi_ranges",
            },
          },
        ],
      })
      .project({
        meta,
        data: {
          $slice: [
            "$data",
            skip,
            {
              $ifNull: [limit, { $arrayElemAt: ["$total.device", 0] }],
            },
          ],
        },
      })
      .allowDiskUse(true);

    return data;
  }

  if (recent === "no") {
    let data = await model
      .aggregate()
      .unwind("values")
      .match(search)
      .replaceRoot("values")
      .lookup({
        from,
        localField,
        foreignField,
        as,
      })
      .sort(sort)
      .addFields({
        timeDifferenceHours: {
          $divide: [
            { $subtract: [new Date(), "$time"] },
            1000 * 60 * 60, // milliseconds to hours
          ],
        },
      })
      .project({
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

        _site_id: "$site_id",
        _device_id: "$device_id",
        _site: "$site",
        _device_number: "$device_number",
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
        [_as]: elementAtIndex0,
      })
      .project({
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
        [as]: "$" + _as,
      })
      .project(projection)
      .facet({
        total: [{ $count: "device" }],
        data: [
          {
            $addFields: { device: "$device" },
          },
        ],
      })
      .project({
        meta,
        data: {
          $slice: [
            "$data",
            skip,
            {
              $ifNull: [limit, { $arrayElemAt: ["$total.device", 0] }],
            },
          ],
        },
      })
      .allowDiskUse(true);

    return data;
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
  // const visibilityFilter = true;

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
  let meta = {
    total: { $arrayElemAt: ["$total.device", 0] },
    skip: { $literal: skip },
    limit: { $literal: limit },
    page: {
      $trunc: {
        $literal: skip / limit + 1,
      },
    },
    pages: {
      $ifNull: [
        {
          $ceil: {
            $divide: [{ $arrayElemAt: ["$total.device", 0] }, limit],
          },
        },
        1,
      ],
    },
    startTime,
    endTime,
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
    // .match({ "device_details.visibility": visibilityFilter })
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
        $divide: [
          { $subtract: [new Date(), "$time"] },
          1000 * 60 * 60, // milliseconds to hours
        ],
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
    .facet({
      total: [{ $count: "device" }],
      data: [
        {
          $addFields: {
            device: "$device",
            aqi_color: {
              $switch: {
                branches: [
                  {
                    case: {
                      $and: [
                        { $gte: ["$pm2_5.value", "$aqi_ranges.good.min"] },
                        { $lte: ["$pm2_5.value", "$aqi_ranges.good.max"] },
                      ],
                    },
                    then: "00e400",
                  },
                  {
                    case: {
                      $and: [
                        { $gte: ["$pm2_5.value", "$aqi_ranges.moderate.min"] },
                        { $lte: ["$pm2_5.value", "$aqi_ranges.moderate.max"] },
                      ],
                    },
                    then: "ffff00",
                  },
                  {
                    case: {
                      $and: [
                        { $gte: ["$pm2_5.value", "$aqi_ranges.u4sg.min"] },
                        { $lte: ["$pm2_5.value", "$aqi_ranges.u4sg.max"] },
                      ],
                    },
                    then: "ff7e00",
                  },
                  {
                    case: {
                      $and: [
                        { $gte: ["$pm2_5.value", "$aqi_ranges.unhealthy.min"] },
                        { $lte: ["$pm2_5.value", "$aqi_ranges.unhealthy.max"] },
                      ],
                    },
                    then: "ff0000",
                  },
                  {
                    case: {
                      $and: [
                        {
                          $gte: [
                            "$pm2_5.value",
                            "$aqi_ranges.very_unhealthy.min",
                          ],
                        },
                        {
                          $lte: [
                            "$pm2_5.value",
                            "$aqi_ranges.very_unhealthy.max",
                          ],
                        },
                      ],
                    },
                    then: "8f3f97",
                  },
                  {
                    case: {
                      $gte: ["$pm2_5.value", "$aqi_ranges.hazardous.min"],
                    },
                    then: "7e0023",
                  },
                ],
                default: "Unknown",
              },
            },

            aqi_category: {
              $switch: {
                branches: [
                  {
                    case: {
                      $and: [
                        { $gte: ["$pm2_5.value", "$aqi_ranges.good.min"] },
                        { $lte: ["$pm2_5.value", "$aqi_ranges.good.max"] },
                      ],
                    },
                    then: "Good",
                  },
                  {
                    case: {
                      $and: [
                        { $gte: ["$pm2_5.value", "$aqi_ranges.moderate.min"] },
                        { $lte: ["$pm2_5.value", "$aqi_ranges.moderate.max"] },
                      ],
                    },
                    then: "Moderate",
                  },
                  {
                    case: {
                      $and: [
                        { $gte: ["$pm2_5.value", "$aqi_ranges.u4sg.min"] },
                        { $lte: ["$pm2_5.value", "$aqi_ranges.u4sg.max"] },
                      ],
                    },
                    then: "Unhealthy for Sensitive Groups",
                  },
                  {
                    case: {
                      $and: [
                        { $gte: ["$pm2_5.value", "$aqi_ranges.unhealthy.min"] },
                        { $lte: ["$pm2_5.value", "$aqi_ranges.unhealthy.max"] },
                      ],
                    },
                    then: "Unhealthy",
                  },
                  {
                    case: {
                      $and: [
                        {
                          $gte: [
                            "$pm2_5.value",
                            "$aqi_ranges.very_unhealthy.min",
                          ],
                        },
                        {
                          $lte: [
                            "$pm2_5.value",
                            "$aqi_ranges.very_unhealthy.max",
                          ],
                        },
                      ],
                    },
                    then: "Very Unhealthy",
                  },
                  {
                    case: {
                      $and: [
                        { $gte: ["$pm2_5.value", "$aqi_ranges.hazardous.min"] },
                      ],
                    },
                    then: "Hazardous",
                  },
                ],
                default: "Unknown",
              },
            },
            aqi_color_name: {
              $switch: {
                branches: [
                  {
                    case: {
                      $and: [
                        { $gte: ["$pm2_5.value", "$aqi_ranges.good.min"] },
                        { $lte: ["$pm2_5.value", "$aqi_ranges.good.max"] },
                      ],
                    },
                    then: "Green",
                  },
                  {
                    case: {
                      $and: [
                        { $gte: ["$pm2_5.value", "$aqi_ranges.moderate.min"] },
                        { $lte: ["$pm2_5.value", "$aqi_ranges.moderate.max"] },
                      ],
                    },
                    then: "Yellow",
                  },
                  {
                    case: {
                      $and: [
                        { $gte: ["$pm2_5.value", "$aqi_ranges.u4sg.min"] },
                        { $lte: ["$pm2_5.value", "$aqi_ranges.u4sg.max"] },
                      ],
                    },
                    then: "Orange",
                  },
                  {
                    case: {
                      $and: [
                        { $gte: ["$pm2_5.value", "$aqi_ranges.unhealthy.min"] },
                        { $lte: ["$pm2_5.value", "$aqi_ranges.unhealthy.max"] },
                      ],
                    },
                    then: "Red",
                  },
                  {
                    case: {
                      $and: [
                        {
                          $gte: [
                            "$pm2_5.value",
                            "$aqi_ranges.very_unhealthy.min",
                          ],
                        },
                        {
                          $lte: [
                            "$pm2_5.value",
                            "$aqi_ranges.very_unhealthy.max",
                          ],
                        },
                      ],
                    },
                    then: "Purple",
                  },
                  {
                    case: {
                      $and: [
                        { $gte: ["$pm2_5.value", "$aqi_ranges.hazardous.min"] },
                      ],
                    },
                    then: "Maroon",
                  },
                ],
                default: "Unknown",
              },
            },
            aqi_ranges: "$aqi_ranges",
          },
        },
      ],
    })
    .project({
      meta,
      data: {
        $slice: [
          "$data",
          skip,
          {
            $ifNull: [limit, { $arrayElemAt: ["$total.device", 0] }],
          },
        ],
      },
    })
    .allowDiskUse(true);

  return data;
}
function filterNullAndReportOffDevices(data) {
  data.forEach((record) => {
    if (record.timeDifferenceHours > UPTIME_CHECK_THRESHOLD) {
      logObject(
        `🪫🪫 Last refreshed time difference exceeds ${UPTIME_CHECK_THRESHOLD} hours for device: ${
          record.device ? record.device : ""
        }, frequency ${record.frequency ? record.frequency : ""}, time ${
          record.time ? record.time : ""
        } and site ${record.siteDetails ? record.siteDetails.name : ""}`
      );
      if (constants.ENVIRONMENT === "PRODUCTION ENVIRONMENT") {
        logger.info(
          `🪫🪫 Last refreshed time difference exceeds ${UPTIME_CHECK_THRESHOLD} hours for device: ${
            record.device ? record.device : ""
          }, Frequency: ${record.frequency ? record.frequency : ""}, Time: ${
            record.time ? record.time : ""
          }, Site Name: ${record.siteDetails ? record.siteDetails.name : ""}`
        );
      }
    }

    if (record.pm2_5 === null) {
      logObject(
        `😲😲 Null pm2_5 value for device: ${
          record.device ? record.device : ""
        }, frequency ${record.frequency ? record.frequency : ""}, time ${
          record.time ? record.time : ""
        } and site ${record.siteDetails ? record.siteDetails.name : ""}`
      );

      if (constants.ENVIRONMENT === "PRODUCTION ENVIRONMENT") {
        logger.info(
          `😲😲 Null pm2_5 value for device: ${
            record.device ? record.device : ""
          }, Frequency: ${record.frequency ? record.frequency : ""}, Time: ${
            record.time ? record.time : ""
          }, Site Name: ${record.siteDetails ? record.siteDetails.name : ""}`
        );
      }
    }
  });

  data = data.filter((record) => record.pm2_5 !== null);

  return data;
}
function filterNull(data) {
  data = data.filter((record) => record.pm2_5 !== null);
  return data;
}
function computeAveragePm2_5(transformedData) {
  let total = 0;
  transformedData.forEach((record) => {
    total += record.pm2_5.value;
  });
  const average = total / transformedData.length;
  return average;
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
    const {
      metadata,
      external,
      tenant,
      running,
      recent,
      brief,
      index,
    } = filter;

    logObject("filter", filter);

    const startTime = filter["values.time"]["$gte"];
    const endTime = filter["values.time"]["$lte"];

    let idField;
    // const visibilityFilter = true;

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
    let meta = {
      total: { $arrayElemAt: ["$total.device", 0] },
      skip: { $literal: skip },
      limit: { $literal: limit },
      page: {
        $trunc: {
          $literal: skip / limit + 1,
        },
      },
      pages: {
        $ifNull: [
          {
            $ceil: {
              $divide: [{ $arrayElemAt: ["$total.device", 0] }, limit],
            },
          },
          1,
        ],
      },
      startTime,
      endTime,
    };
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

    /**
     * The Alternative Flows present in this Events entity:
     * 1. Based on tenant, which PM values should we showcase?
     * 2. Which metadata should we show? Sites or Devices? etc....
     * 3. Should we show recent or historical measurements?
     */
    if (tenant !== "airqo") {
      pm2_5 = "$pm2_5";
      pm10 = "$pm10";
    }

    if (external === "yes" || brief === "yes") {
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
    }

    if (!metadata || metadata === "device" || metadata === "device_id") {
      idField = "$device";
      groupId = "$" + metadata ? metadata : groupId;
      localField = metadata ? metadata : localField;
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

    if (running === "yes") {
      delete projection["pm2_5.uncertaintyValue"];
      delete projection["pm2_5.standardDeviationValue"];
      delete projection["pm2_5.calibratedValue"];

      Object.assign(projection, {
        site_image: 0,
        is_reading_primary: 0,
        deviceDetails: 0,
        aqi_color: 0,
        aqi_category: 0,
        aqi_color_name: 0,
        pm2_5: 0,
        average_pm10: 0,
        average_pm2_5: 0,
        pm10: 0,
        frequency: 0,
        network: 0,
        location: 0,
        altitude: 0,
        speed: 0,
        satellites: 0,
        hdop: 0,

        intaketemperature: 0,
        tvoc: 0,
        hcho: 0,
        co2: 0,
        intakehumidity: 0,

        internalTemperature: 0,
        externalTemperature: 0,
        internalHumidity: 0,
        externalHumidity: 0,
        externalAltitude: 0,
        pm1: 0,
        no2: 0,
        site: 0,
        site_id: 0,
        health_tips: 0,
        s1_pm2_5: 0,
        s2_pm2_5: 0,
        s1_pm10: 0,
        s2_pm10: 0,
        battery: 0,
        rtc_adc: 0,
        rtc_v: 0,
        rtc: 0,
        stc_adc: 0,
        stc_v: 0,
        stc: 0,
        siteDetails: 0,
      });
    }

    if (!isEmpty(index)) {
      sort = { "pm2_5.value": 1 };
    }

    logObject("the query for this request", search);
    if (!recent || recent === "yes") {
      const data = await this.aggregate()
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
        })
        // .match({ "device_details.visibility": visibilityFilter })
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
            $divide: [
              { $subtract: [new Date(), "$time"] },
              1000 * 60 * 60, // milliseconds to hours
            ],
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
        .facet({
          total: [{ $count: "device" }],
          data: [
            {
              $addFields: {
                device: "$device",
                aqi_color: {
                  $switch: {
                    branches: [
                      {
                        case: {
                          $and: [
                            { $gte: ["$pm2_5.value", "$aqi_ranges.good.min"] },
                            { $lte: ["$pm2_5.value", "$aqi_ranges.good.max"] },
                          ],
                        },
                        then: "00e400",
                      },
                      {
                        case: {
                          $and: [
                            {
                              $gte: [
                                "$pm2_5.value",
                                "$aqi_ranges.moderate.min",
                              ],
                            },
                            {
                              $lte: [
                                "$pm2_5.value",
                                "$aqi_ranges.moderate.max",
                              ],
                            },
                          ],
                        },
                        then: "ffff00",
                      },
                      {
                        case: {
                          $and: [
                            { $gte: ["$pm2_5.value", "$aqi_ranges.u4sg.min"] },
                            { $lte: ["$pm2_5.value", "$aqi_ranges.u4sg.max"] },
                          ],
                        },
                        then: "ff7e00",
                      },
                      {
                        case: {
                          $and: [
                            {
                              $gte: [
                                "$pm2_5.value",
                                "$aqi_ranges.unhealthy.min",
                              ],
                            },
                            {
                              $lte: [
                                "$pm2_5.value",
                                "$aqi_ranges.unhealthy.max",
                              ],
                            },
                          ],
                        },
                        then: "ff0000",
                      },
                      {
                        case: {
                          $and: [
                            {
                              $gte: [
                                "$pm2_5.value",
                                "$aqi_ranges.very_unhealthy.min",
                              ],
                            },
                            {
                              $lte: [
                                "$pm2_5.value",
                                "$aqi_ranges.very_unhealthy.max",
                              ],
                            },
                          ],
                        },
                        then: "8f3f97",
                      },
                      {
                        case: {
                          $gte: ["$pm2_5.value", "$aqi_ranges.hazardous.min"],
                        },
                        then: "7e0023",
                      },
                    ],
                    default: "Unknown",
                  },
                },
                aqi_category: {
                  $switch: {
                    branches: [
                      {
                        case: {
                          $and: [
                            { $gte: ["$pm2_5.value", "$aqi_ranges.good.min"] },
                            { $lte: ["$pm2_5.value", "$aqi_ranges.good.max"] },
                          ],
                        },
                        then: "Good",
                      },
                      {
                        case: {
                          $and: [
                            {
                              $gte: [
                                "$pm2_5.value",
                                "$aqi_ranges.moderate.min",
                              ],
                            },
                            {
                              $lte: [
                                "$pm2_5.value",
                                "$aqi_ranges.moderate.max",
                              ],
                            },
                          ],
                        },
                        then: "Moderate",
                      },
                      {
                        case: {
                          $and: [
                            { $gte: ["$pm2_5.value", "$aqi_ranges.u4sg.min"] },
                            { $lte: ["$pm2_5.value", "$aqi_ranges.u4sg.max"] },
                          ],
                        },
                        then: "Unhealthy for Sensitive Groups",
                      },
                      {
                        case: {
                          $and: [
                            {
                              $gte: [
                                "$pm2_5.value",
                                "$aqi_ranges.unhealthy.min",
                              ],
                            },
                            {
                              $lte: [
                                "$pm2_5.value",
                                "$aqi_ranges.unhealthy.max",
                              ],
                            },
                          ],
                        },
                        then: "Unhealthy",
                      },
                      {
                        case: {
                          $and: [
                            {
                              $gte: [
                                "$pm2_5.value",
                                "$aqi_ranges.very_unhealthy.min",
                              ],
                            },
                            {
                              $lte: [
                                "$pm2_5.value",
                                "$aqi_ranges.very_unhealthy.max",
                              ],
                            },
                          ],
                        },
                        then: "Very Unhealthy",
                      },
                      {
                        case: {
                          $and: [
                            {
                              $gte: [
                                "$pm2_5.value",
                                "$aqi_ranges.hazardous.min",
                              ],
                            },
                          ],
                        },
                        then: "Hazardous",
                      },
                    ],
                    default: "Unknown",
                  },
                },
                aqi_color_name: {
                  $switch: {
                    branches: [
                      {
                        case: {
                          $and: [
                            { $gte: ["$pm2_5.value", "$aqi_ranges.good.min"] },
                            { $lte: ["$pm2_5.value", "$aqi_ranges.good.max"] },
                          ],
                        },
                        then: "Green",
                      },
                      {
                        case: {
                          $and: [
                            {
                              $gte: [
                                "$pm2_5.value",
                                "$aqi_ranges.moderate.min",
                              ],
                            },
                            {
                              $lte: [
                                "$pm2_5.value",
                                "$aqi_ranges.moderate.max",
                              ],
                            },
                          ],
                        },
                        then: "Yellow",
                      },
                      {
                        case: {
                          $and: [
                            { $gte: ["$pm2_5.value", "$aqi_ranges.u4sg.min"] },
                            { $lte: ["$pm2_5.value", "$aqi_ranges.u4sg.max"] },
                          ],
                        },
                        then: "Orange",
                      },
                      {
                        case: {
                          $and: [
                            {
                              $gte: [
                                "$pm2_5.value",
                                "$aqi_ranges.unhealthy.min",
                              ],
                            },
                            {
                              $lte: [
                                "$pm2_5.value",
                                "$aqi_ranges.unhealthy.max",
                              ],
                            },
                          ],
                        },
                        then: "Red",
                      },
                      {
                        case: {
                          $and: [
                            {
                              $gte: [
                                "$pm2_5.value",
                                "$aqi_ranges.very_unhealthy.min",
                              ],
                            },
                            {
                              $lte: [
                                "$pm2_5.value",
                                "$aqi_ranges.very_unhealthy.max",
                              ],
                            },
                          ],
                        },
                        then: "Purple",
                      },
                      {
                        case: {
                          $and: [
                            {
                              $gte: [
                                "$pm2_5.value",
                                "$aqi_ranges.hazardous.min",
                              ],
                            },
                          ],
                        },
                        then: "Maroon",
                      },
                    ],
                    default: "Unknown",
                  },
                },
                aqi_ranges: "$aqi_ranges",
              },
            },
          ],
        })
        .project({
          meta,
          data: {
            $slice: [
              "$data",
              skip,
              {
                $ifNull: [limit, { $arrayElemAt: ["$total.device", 0] }],
              },
            ],
          },
        })
        .allowDiskUse(true);

      data[0].data = data[0].data.filter((record) => record.pm2_5 !== null);

      return {
        success: true,
        data,
        message: "successfully returned the measurements",
        status: httpStatus.OK,
      };
    }

    if (recent === "no") {
      let data = await this.aggregate()
        .unwind("values")
        .match(search)
        .replaceRoot("values")
        .lookup({
          from,
          localField,
          foreignField,
          as,
        })
        .sort(sort)
        .addFields({
          timeDifferenceHours: {
            $divide: [
              { $subtract: [new Date(), "$time"] },
              1000 * 60 * 60, // milliseconds to hours
            ],
          },
        })
        .project({
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

          _site_id: "$site_id",
          _device_id: "$device_id",
          _site: "$site",
          _device_number: "$device_number",
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
          [_as]: elementAtIndex0,
        })
        .project({
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
          [as]: "$" + _as,
        })
        .project(projection)
        .facet({
          total: [{ $count: "device" }],
          data: [
            {
              $addFields: { device: "$device" },
            },
          ],
        })
        .project({
          meta,
          data: {
            $slice: [
              "$data",
              skip,
              {
                $ifNull: [limit, { $arrayElemAt: ["$total.device", 0] }],
              },
            ],
          },
        })
        .allowDiskUse(true);

      data[0].data = data[0].data.filter((record) => record.pm2_5 !== null);
      return {
        success: true,
        message: "successfully returned the measurements",
        data,
        status: httpStatus.OK,
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

eventSchema.statics.getAirQualityAverages = async function(siteId, next) {
  try {
    const testDate = "2022-12-20T11:43:18.595Z";
    const now = moment()
      .tz(TIMEZONE)
      .toDate(); // Convert back to Date object
    const today = moment()
      .tz(TIMEZONE)
      .startOf("day")
      .toDate();
    const twoWeeksAgo = moment()
      .tz(TIMEZONE)
      .startOf("day")
      .subtract(14, "days")
      .toDate();

    logText("Debug Info:");
    logObject("TIMEZONE", TIMEZONE);
    logObject("now", now);
    logObject("today", today);
    logObject("twoWeeksAgo", twoWeeksAgo);

    const result = await this.aggregate([
      // Initial match to reduce documents early
      {
        $match: {
          "values.site_id": mongoose.Types.ObjectId(siteId),
          "values.time": { $gte: twoWeeksAgo, $lte: now },
        },
      },

      // Unwind with preservation to handle empty arrays
      {
        $unwind: {
          path: "$values",
          preserveNullAndEmptyArrays: false,
        },
      },

      // Secondary match to filter unwound documents
      {
        $match: {
          "values.time": { $gte: twoWeeksAgo, $lte: now },
          "values.pm2_5.value": { $exists: true, $ne: null },
        },
      },

      // Optimized projection
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

      // First group by day
      {
        $group: {
          _id: "$dayOfYear",
          dailyAverage: { $avg: "$pm2_5" },
          yearWeek: { $first: "$yearWeek" },
        },
      },

      // Then group by week
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

      // Sort and limit
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
    logObject("Current Week days", currentWeek.days);
    const todayStr = moment(today)
      .tz(TIMEZONE)
      .format("YYYY-MM-DD");

    logObject("todayStr", todayStr);
    const todayAverage = currentWeek.days.find((day) => day.date === todayStr)
      ?.average;

    logObject("Found todayAverage", todayAverage);
    logObject(
      "Matching day",
      currentWeek.days.find((day) => day.date === todayStr)
    );

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

eventSchema.statics.v2_getAirQualityAverages = async function(siteId, next) {
  try {
    const TIMEZONE = "Africa/Kampala";
    const MIN_READINGS_PER_DAY = 12; // Minimum readings per day for validity

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

    logText("Debug Info:");
    logObject("TIMEZONE", TIMEZONE);
    logObject("now", now);
    logObject("today", today);
    logObject("twoWeeksAgo", twoWeeksAgo);

    const result = await this.aggregate([
      // Initial match
      {
        $match: {
          "values.site_id": mongoose.Types.ObjectId(siteId),
          "values.time": { $gte: twoWeeksAgo, $lte: now },
        },
      },

      // Unwind values
      {
        $unwind: {
          path: "$values",
          preserveNullAndEmptyArrays: false,
        },
      },

      // Data quality filtering
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

      // Project fields
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

      // Group by day with data quality metrics
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

      // Add data quality indicators
      {
        $addFields: {
          dataQuality: {
            hasMinReadings: { $gte: ["$readingCount", MIN_READINGS_PER_DAY] },
            hoursCovered: { $size: "$uniqueHours" },
            readingSpread: { $subtract: ["$maxReading", "$minReading"] },
          },
        },
      },

      // Group by week with quality metrics
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

      // Sort and limit to 2 weeks
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

    // Calculate percentage difference without capping
    const percentageDifference =
      previousWeek.weeklyAverage !== 0
        ? ((currentWeek.weeklyAverage - previousWeek.weeklyAverage) /
            previousWeek.weeklyAverage) *
          100
        : 0;

    // Calculate data quality score
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

eventSchema.statics.v3_getAirQualityAverages = async function(siteId, next) {
  try {
    const TIMEZONE = "Africa/Kampala"; // Using a consistent timezone
    const MIN_READINGS_PER_WEEK = 7 * 12; // Minimum 12 readings/day * 7 days/week
    const EPSILON = 0.1; // Minimum divisor for percentage change

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
      // Initial match and unwind
      {
        $match: {
          "values.site_id": mongoose.Types.ObjectId(siteId),
          "values.time": { $gte: twoWeeksAgo, $lte: now },
        },
      },
      { $unwind: { path: "$values", preserveNullAndEmptyArrays: false } },

      // Filter for valid pm2_5 values and time range
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
      }, // Reasonable range check

      // Project necessary fields
      {
        $project: {
          _id: 0,
          time: "$values.time",
          pm2_5: "$values.pm2_5.value",
          yearWeek: { $week: { date: "$values.time", timezone: TIMEZONE } }, // Use $week for simplification if your MongoDB version supports it. Otherwise, use the $let approach.
          dayOfYear: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$values.time",
              timezone: TIMEZONE,
            },
          },
        },
      },

      // Group by day and calculate daily average
      {
        $group: {
          _id: "$dayOfYear",
          dailyAverage: { $avg: "$pm2_5" },
          yearWeek: { $first: "$yearWeek" },
          dailyReadingCount: { $sum: 1 },
        },
      },

      // Group by week and calculate weekly metrics
      {
        $group: {
          _id: "$yearWeek",
          weeklyAverage: { $avg: "$dailyAverage" },
          weeklyReadingCount: { $sum: "$dailyReadingCount" }, // Count readings for the week
          days: {
            $push: {
              date: "$_id",
              average: "$dailyAverage",
            },
          },
        },
      },

      // Sort by week descending (most recent first)
      { $sort: { _id: -1 } },

      // Limit to the last two weeks
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

    // Check data quality for both weeks.
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

    let percentageDifference = null; // Initialize as null, calculate only if sufficient data quality

    if (previousWeek.weeklyAverage > EPSILON) {
      //Calculate % diff only if divisor large enough
      percentageDifference =
        ((currentWeek.weeklyAverage - previousWeek.weeklyAverage) /
          previousWeek.weeklyAverage) *
        100;
    } else if (previousWeek.weeklyAverage < -1 * EPSILON) {
      percentageDifference =
        ((currentWeek.weeklyAverage - previousWeek.weeklyAverage) /
          Math.abs(previousWeek.weeklyAverage)) *
        100;
    } // if previousWeek.weeklyAverage is close to 0, no percentage difference will be returned

    return {
      success: true,
      data: {
        dailyAverage: todayAverage ? parseFloat(todayAverage.toFixed(2)) : null,
        percentageDifference:
          percentageDifference !== null
            ? parseFloat(percentageDifference.toFixed(2))
            : null, // Return null or formatted value
        weeklyAverages: {
          currentWeek: parseFloat(currentWeek.weeklyAverage.toFixed(2)),
          previousWeek: parseFloat(previousWeek.weeklyAverage.toFixed(2)),
        },
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
