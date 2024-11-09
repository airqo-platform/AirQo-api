/*
Changes made to `valueSchema` schema may affect the format of messages 
received from the message broker (Kafka). Consider updating 
the schema `AirQo-api/kafka/schemas/transformed-device-measurements.avsc`
and following up on its deployment. :)
*/

const mongoose = require("mongoose");
const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const { logObject } = require("@utils/log");
const ObjectId = Schema.Types.ObjectId;
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const { HttpError } = require("@utils/errors");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- event-model`
);
const DEFAULT_LIMIT = 1000;
const DEFAULT_SKIP = 0;
const DEFAULT_PAGE = 1;
const UPTIME_CHECK_THRESHOLD = 168;

const generateAQIBranches = (valueType) => {
  const branches = Object.entries(constants.AQI_INDEX).map(([key, range]) => {
    const condition =
      range.max === null
        ? { $gt: ["$pm2_5.value", range.min] }
        : {
            $and: [
              { $gt: ["$pm2_5.value", range.min] },
              { $lte: ["$pm2_5.value", range.max] },
            ],
          };

    if (key === "good") {
      condition.$and = [
        { $gte: ["$pm2_5.value", range.min] },
        { $lte: ["$pm2_5.value", range.max] },
      ];
    }

    const valueMap = {
      color: {
        good: "00e400",
        moderate: "ffff00",
        u4sg: "ff7e00",
        unhealthy: "ff0000",
        very_unhealthy: "8f3f97",
        hazardous: "7e0023",
      },
      category: {
        good: "Good",
        moderate: "Moderate",
        u4sg: "Unhealthy for Sensitive Groups",
        unhealthy: "Unhealthy",
        very_unhealthy: "Very Unhealthy",
        hazardous: "Hazardous",
      },
      colorName: {
        good: "Green",
        moderate: "Yellow",
        u4sg: "Orange",
        unhealthy: "Red",
        very_unhealthy: "Purple",
        hazardous: "Maroon",
      },
    };

    return {
      case: condition,
      then: valueMap[valueType][key],
    };
  });

  return branches;
};
const aggregationPipeline = [
  { $unwind: "$values" },
  { $match: search },
  { $replaceRoot: { newRoot: "$values" } },
  {
    $lookup: {
      from: "photos",
      localField: "site_id",
      foreignField: "site_id",
      as: "site_images",
    },
  },
  {
    $lookup: {
      from: "devices",
      localField: "device_id",
      foreignField: "_id",
      as: "device_details",
    },
  },
  {
    $lookup: {
      from: "cohorts",
      localField: "device_details.cohorts",
      foreignField: "_id",
      as: "cohort_details",
    },
  },
  {
    $match: {
      "cohort_details.visibility": { $ne: false },
    },
  },
  {
    $lookup: {
      from,
      localField,
      foreignField,
      as,
    },
  },
  {
    $lookup: {
      from: "healthtips",
      let: { pollutantValue: { $toInt: "$pm2_5.value" } },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $lte: ["$aqi_category.min", "$$pollutantValue"] },
                {
                  $cond: {
                    if: { $eq: ["$aqi_category.max", null] },
                    then: true,
                    else: { $gte: ["$aqi_category.max", "$$pollutantValue"] },
                  },
                },
              ],
            },
          },
        },
      ],
      as: "healthTips",
    },
  },
  { $sort: sort },
  {
    $group: {
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
    },
  },
  {
    $addFields: {
      timeDifferenceHours: {
        $divide: [{ $subtract: [new Date(), "$time"] }, 1000 * 60 * 60],
      },
    },
  },
  {
    $project: {
      "health_tips.aqi_category": 0,
      "health_tips.value": 0,
      "health_tips.createdAt": 0,
      "health_tips.updatedAt": 0,
      "health_tips.__v": 0,
    },
  },
  {
    $project: {
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
    },
  },
  {
    $project: projection,
  },
  {
    $facet: {
      total: [{ $count: "device" }],
      data: [
        {
          $addFields: {
            device: "$device",
            aqi_color: {
              $switch: {
                branches: generateAQIBranches("color"),
                default: "Unknown",
              },
            },
            aqi_category: {
              $switch: {
                branches: generateAQIBranches("category"),
                default: "Unknown",
              },
            },
            aqi_color_name: {
              $switch: {
                branches: generateAQIBranches("colorName"),
                default: "Unknown",
              },
            },
          },
        },
      ],
    },
  },
  {
    $project: {
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
    },
  },
];
const getNonRecentPipeline = () => [
  { $unwind: "$values" },
  { $match: search },
  { $replaceRoot: { newRoot: "$values" } },
  {
    $lookup: {
      from,
      localField,
      foreignField,
      as,
    },
  },
  { $sort: sort },
  {
    $addFields: {
      timeDifferenceHours: {
        $divide: [{ $subtract: [new Date(), "$time"] }, 1000 * 60 * 60],
      },
    },
  },
  {
    $project: {
      device: 1,
      device_id: 1,
      device_number: 1,
      site: 1,
      site_id: 1,
      time: 1,
      average_pm2_5: 1,
      pm2_5,
      s1_pm2_5,
      s2_pm2_5: 1,
      average_pm10: 1,
      pm10,
      s1_pm10,
      s2_pm10: 1,
      frequency: 1,
      battery: 1,
      location: 1,
      altitude: 1,
      speed: 1,
      network: 1,
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
      no2: 1,
      rtc_adc: 1,
      rtc_v: 1,
      rtc: 1,
      stc_adc: 1,
      stc_v: 1,
      [as]: elementAtIndex0,
    },
  },
  {
    $project: projection,
  },
  {
    $facet: {
      total: [{ $count: "device" }],
      data: [
        {
          $addFields: {
            device: "$device",
            aqi_color: {
              $switch: {
                branches: generateAQIBranches("color"),
                default: "Unknown",
              },
            },
            aqi_category: {
              $switch: {
                branches: generateAQIBranches("category"),
                default: "Unknown",
              },
            },
            aqi_color_name: {
              $switch: {
                branches: generateAQIBranches("colorName"),
                default: "Unknown",
              },
            },
          },
        },
      ],
    },
  },
  {
    $project: {
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
    },
  },
];
const getData = async (model, recent) => {
  const pipeline =
    recent === "no" ? getNonRecentPipeline() : aggregationPipeline;
  const data = await model.aggregate(pipeline).allowDiskUse(true);
  return data;
};
const generateAQIFields = () => ({
  aqi_color: {
    $switch: {
      branches: generateAQIBranches("color"),
      default: "Unknown",
    },
  },
  aqi_category: {
    $switch: {
      branches: generateAQIBranches("category"),
      default: "Unknown",
    },
  },
  aqi_color_name: {
    $switch: {
      branches: generateAQIBranches("colorName"),
      default: "Unknown",
    },
  },
});
const cleanFilter = (filter) => {
  const fieldsToRemove = [
    "external",
    "frequency",
    "metadata",
    "tenant",
    "device",
    "recent",
    "page",
    "running",
    "brief",
    "index",
    "limit",
    "skip",
  ];

  const cleanedFilter = { ...filter };
  fieldsToRemove.forEach((field) => delete cleanedFilter[field]);
  return cleanedFilter;
};
// Helper function to create metadata configuration
const getMetadataConfig = (metadata) => {
  const config = {
    localField: metadata,
    from: "sites",
    foreignField: "_id",
    as: "siteDetails",
  };

  if (metadata === "site") {
    config.foreignField = "generated_name";
  }

  return config;
};
// Helper function to create base projection
const createBaseProjection = () => {
  const fieldsToExclude = [
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
    "site",
  ];

  const projection = { _id: 0 };
  fieldsToExclude.forEach((field) => (projection[field] = 0));

  // Add nested field exclusions
  ["pm2_5", "pm10", "no2"].forEach((metric) => {
    ["uncertaintyValue", "calibratedValue", "standardDeviationValue"].forEach(
      (field) => {
        projection[`${metric}.${field}`] = 0;
      }
    );
  });

  return projection;
};
// Create pipeline stages for health tips lookup
const createHealthTipsLookup = () => ({
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
async function getAQIData(recent, options = {}) {
  const {
    projection = {},
    sort = {},
    search = {},
    startTime,
    skip = 0,
    limit = 100,
    endTime,
  } = options;

  // Validate and sanitize input
  if (typeof projection !== "object" || Array.isArray(projection)) {
    throw new Error("Invalid projection object");
  }
  if (typeof sort !== "object" || Array.isArray(sort)) {
    throw new Error("Invalid sort object");
  }
  if (typeof search !== "object" || Array.isArray(search)) {
    throw new Error("Invalid search object");
  }

  // Convert string dates to Date objects if necessary
  if (startTime && typeof startTime === "string") {
    startTime = new Date(startTime);
  }
  if (endTime && typeof endTime === "string") {
    endTime = new Date(endTime);
  }

  // Prepare the query
  const query = {
    time: {
      $gte: startTime,
      $lte: endTime,
    },
    ...search,
  };

  // Apply projection
  const projectedFields = Object.keys(query).concat(Object.keys(projection));
  const fieldsToInclude = projectedFields.reduce((acc, field) => {
    if (projection[field]) {
      acc[field] = 1;
    }
    return acc;
  }, {});

  // Apply sorting
  const sortedFields = Object.keys(sort);
  const sortOptions = sortedFields.map((field) => ({
    [field]: sort[field].asc ? 1 : -1,
  }));

  // Execute the query
  const result = await db
    .collection("measurements")
    .find(query, fieldsToInclude)
    .sort(sortOptions)
    .skip(skip)
    .limit(limit);

  // Process and return the results
  const data = [];
  while (await result.hasNext()) {
    data.push(await result.next());
  }

  // Apply recent logic
  const processedData = data.map((doc) => {
    if (recent === "yes") {
      return {
        ...doc,
        data: doc.data.map((item) => ({
          ...item,
          ...generateAQIFields(),
        })),
      };
    }
    return doc;
  });

  return {
    success: true,
    data: processedData,
    message: "Successfully returned the measurements",
    status: httpStatus.OK,
  };
}
function getProjection(external, tenant, running) {
  const projection = {
    _id: 0,
    time: 1,
    pm2_5: 1,
    pm10: 1,
    aqi: 1,
    site: 1,
    device: 1,
    frequency: 1,
    network: 1,
    location: 1,
    altitude: 1,
    speed: 1,
    satellites: 1,
    hdop: 1,
    intaketemperature: 1,
    tvoc: 1,
    hcho: 1,
    co2: 1,
    intakehumidity: 1,
    internalTemperature: 1,
    externalTemperature: 1,
    internalHumidity: 1,
    externalHumidity: 1,
    externalAltitude: 1,
    pm1: 1,
    no2: 1,
    health_tips: 1,
    s1_pm2_5: 1,
    s2_pm2_5: 1,
    s1_pm10: 1,
    s2_pm10: 1,
    battery: 1,
    rtc_adc: 1,
    rtc_v: 1,
    rtc: 1,
    stc_adc: 1,
    stc_v: 1,
    stc: 1,
  };

  // Adjust projection based on external, tenant, and running
  if (external === "no") {
    delete projection.externalHumidity;
    delete projection.externalAltitude;
    delete projection.externalTemperature;
  }
  if (tenant) {
    delete projection.device;
    delete projection.frequency;
    delete projection.network;
    delete projection.location;
    delete projection.altitude;
    delete projection.speed;
    delete projection.satellites;
    delete projection.hdop;
    delete projection.intaketemperature;
    delete projection.tvoc;
    delete projection.hcho;
    delete projection.co2;
    delete projection.intakehumidity;
    delete projection.internalTemperature;
    delete projection.externalTemperature;
    delete projection.externalHumidity;
    delete projection.externalAltitude;
    delete projection.pm1;
    delete projection.no2;
    delete projection.health_tips;
    delete projection.s1_pm2_5;
    delete projection.s2_pm2_5;
    delete projection.s1_pm10;
    delete projection.s2_pm10;
    delete projection.battery;
    delete projection.rtc_adc;
    delete projection.rtc_v;
    delete projection.rtc;
    delete projection.stc_adc;
    delete projection.stc_v;
    delete projection.stc;
  }
  if (running === "no") {
    delete projection.pm2_5;
    delete projection.pm10;
    delete projection.aqi;
    delete projection.aqi_color;
    delete projection.aqi_category;
    delete projection.aqi_color_name;
    delete projection.average_pm10;
    delete projection.average_pm2_5;
  }

  return projection;
}
function getSort(index) {
  let sort = {};

  if (index) {
    switch (index) {
      case "time":
        sort = { time: -1 }; // Sort by time in descending order
        break;
      case "pm2_5":
        sort = { pm2_5: -1 }; // Sort by PM2.5 concentration in descending order
        break;
      case "pm10":
        sort = { pm10: -1 }; // Sort by PM10 concentration in descending order
      // Add more cases for other indexes as needed
      default:
        sort = {}; // Return an empty object if no valid index is provided
    }
  }

  return sort;
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
    limit,
    page,
  } = filter;

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
  return await getData(model, recent);
}
async function signalData(model, filter) {
  let { skip, limit, page } = filter;
  const metadata = "site_id";

  if (page) {
    skip = parseInt((page - 1) * limit);
  }

  const search = cleanFilter(filter);
  const metadataConfig = getMetadataConfig(metadata);
  const baseProjection = createBaseProjection();
  const startTime = filter["values.time"]["$gte"];
  const endTime = filter["values.time"]["$lte"];

  // Combine with site projection from constants
  const projection = {
    ...baseProjection,
    ...constants.EVENTS_METADATA_PROJECTION("brief_site", metadataConfig.as),
  };

  // Create metadata for pagination
  const meta = {
    total: { $arrayElemAt: ["$total.device", 0] },
    skip: { $literal: skip },
    limit: { $literal: limit },
    page: { $trunc: { $literal: skip / limit + 1 } },
    pages: {
      $ifNull: [
        { $ceil: { $divide: [{ $arrayElemAt: ["$total.device", 0] }, limit] } },
        1,
      ],
    },
    startTime,
    endTime,
  };

  const pipeline = [
    { $unwind: "$values" },
    { $match: search },
    { $replaceRoot: { newRoot: "$values" } },
    {
      $lookup: {
        from: "photos",
        localField: "site_id",
        foreignField: "site_id",
        as: "site_images",
      },
    },
    {
      $lookup: {
        from: "devices",
        localField: "device_id",
        foreignField: "_id",
        as: "device_details",
      },
    },
    {
      $lookup: {
        from: "cohorts",
        localField: "device_details.cohorts",
        foreignField: "_id",
        as: "cohort_details",
      },
    },
    {
      $match: {
        "cohort_details.visibility": { $ne: false },
        "cohort_details.name": "map",
      },
    },
    {
      $lookup: metadataConfig,
    },
    {
      $lookup: createHealthTipsLookup(),
    },
    { $sort: { time: -1 } },
    {
      $group: {
        _id: "$site_id",
        device: { $first: "$device" },
        device_id: { $first: "$device_id" },
        site_image: { $first: { $arrayElemAt: ["$site_images.image_url", 0] } },
        is_reading_primary: {
          $first: { $arrayElemAt: ["$device_details.isPrimaryInLocation", 0] },
        },
        device_number: { $first: "$device_number" },
        health_tips: { $first: "$healthTips" },
        site: { $first: "$site" },
        site_id: { $first: "$site_id" },
        time: { $first: "$time" },
        pm2_5: { $first: "$average_pm2_5" },
        pm10: { $first: "$average_pm10" },
        [metadataConfig.as]: elementAtIndexName(metadata, "yes"),
      },
    },
    {
      $addFields: {
        timeDifferenceHours: {
          $divide: [{ $subtract: [new Date(), "$time"] }, 1000 * 60 * 60],
        },
      },
    },
    {
      $project: {
        "health_tips.aqi_category": 0,
        "health_tips.value": 0,
        "health_tips.createdAt": 0,
        "health_tips.updatedAt": 0,
        "health_tips.__v": 0,
      },
    },
    {
      $project: {
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
      },
    },
    { $project: projection },
    {
      $facet: {
        total: [{ $count: "device" }],
        data: [
          {
            $addFields: {
              device: "$device",
              ...generateAQIFields(),
            },
          },
        ],
      },
    },
    {
      $project: {
        meta,
        data: {
          $slice: [
            "$data",
            skip,
            { $ifNull: [limit, { $arrayElemAt: ["$total.device", 0] }] },
          ],
        },
      },
    },
  ];

  return model.aggregate(pipeline).allowDiskUse(true);
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
eventSchema.statics.list = async function(options = {}) {
  const {
    skip = DEFAULT_SKIP,
    limit = DEFAULT_LIMIT,
    filter = {},
    page = DEFAULT_PAGE,
  } = options;

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

    const startTime = filter["values.time"]["$gte"];
    const endTime = filter["values.time"]["$lte"];

    // Create a comprehensive search object
    const search = Object.fromEntries(
      Object.entries(filter).filter(
        ([key]) => !["frequency", "device", "page"].includes(key)
      )
    );

    // Modify projection based on external, tenant, and running parameters
    const projection = getProjection(
      brief,
      metadata,
      recent,
      external,
      tenant,
      running
    );

    // Modify sort based on index parameter
    const sort = getSort(index);

    const result = await getAQIData(recent, {
      projection,
      sort,
      search,
      startTime,
      skip,
      limit,
      endTime,
    });

    // Apply additional filters based on external, tenant, and running
    const filteredData = result.data.filter(
      (item) =>
        item.external === external &&
        item.tenant === tenant &&
        (running === "yes" ? item.running : true)
    );

    return {
      success: true,
      data: filteredData,
      message: "Successfully returned the measurements",
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`Internal Server Error --- list events --- ${error.message}`);
    logObject("error", error);
    throw new HttpError(
      "Internal Server Error",
      httpStatus.INTERNAL_SERVER_ERROR,
      {
        message: error.message,
      }
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
    // Get current date and date 2 weeks ago
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(today.getDate() - 14);

    // Base query to match site and time range
    const baseMatch = {
      "values.site_id": mongoose.Types.ObjectId(siteId),
      "values.time": {
        $gte: twoWeeksAgo,
        $lte: now,
      },
    };

    const result = await this.aggregate([
      // Unwind the values array to work with individual readings
      { $unwind: "$values" },

      // Match site and time range
      { $match: baseMatch },

      // Project only needed fields and add date fields for grouping
      {
        $project: {
          time: "$values.time",
          pm2_5: "$values.pm2_5.value",
          dayOfYear: { $dayOfYear: "$values.time" },
          year: { $year: "$values.time" },
          week: { $week: "$values.time" },
        },
      },

      // Group by day to get daily averages
      {
        $group: {
          _id: {
            year: "$year",
            dayOfYear: "$dayOfYear",
          },
          dailyAverage: { $avg: "$pm2_5" },
          date: { $first: "$time" },
          week: { $first: "$week" },
        },
      },

      // Sort by date
      { $sort: { date: -1 } },

      // Group again to calculate weekly averages
      {
        $group: {
          _id: "$week",
          weeklyAverage: { $avg: "$dailyAverage" },
          days: {
            $push: {
              date: "$date",
              average: "$dailyAverage",
            },
          },
        },
      },

      // Sort by week
      { $sort: { _id: -1 } },

      // Limit to get only last 2 weeks
      { $limit: 2 },
    ]).allowDiskUse(true);

    // If we don't have enough data
    if (result.length < 2) {
      return {
        success: false,
        message: "Insufficient data for comparison",
        status: httpStatus.NOT_FOUND,
      };
    }

    // Get current week and previous week data
    const currentWeek = result[0];
    const previousWeek = result[1];

    // Calculate percentage difference

    const percentageDifference =
      previousWeek.weeklyAverage !== 0
        ? ((currentWeek.weeklyAverage - previousWeek.weeklyAverage) /
            previousWeek.weeklyAverage) *
          100
        : 0;

    // Get today's date string in YYYY-MM-DD format
    const todayStr = today.toISOString().split("T")[0];

    // Find today's average from the current week's days
    const todayAverage =
      currentWeek.days.find(
        (day) => day.date.toISOString().split("T")[0] === todayStr
      )?.average || null;

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
const eventsModel = (tenant) => {
  try {
    const events = mongoose.model("events");
    return events;
  } catch (error) {
    return getModelByTenant(tenant.toLowerCase(), "event", eventSchema);
  }
};

module.exports = eventsModel;
