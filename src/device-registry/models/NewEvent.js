const mongoose = require("mongoose");
const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const { logObject, HttpError } = require("@utils/shared");
const ObjectId = Schema.Types.ObjectId;
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- event-model`
);
const moment = require("moment-timezone");

const DEFAULT_LIMIT = 1000;
const DEFAULT_SKIP = 0;
const DEFAULT_PAGE = 1;
const UPTIME_CHECK_THRESHOLD = 168;
const AQI_RANGES = {
  good: { min: 0, max: 9.1 },
  moderate: { min: 9.101, max: 35.49 },
  u4sg: { min: 35.491, max: 55.49 },
  unhealthy: { min: 55.491, max: 125.49 },
  very_unhealthy: { min: 125.491, max: 225.49 },
  hazardous: { min: 225.491, max: null },
};
const MIN_READINGS_PER_DAY = 12;
const TIMEZONE = "Africa/Kampala"; // Consistent timezone

const SENSOR_CONFIG = [
  { name: "pm2_5", type: Number },
  { name: "pm10", type: Number },
  { name: "no2", type: Number },
  { name: "pm1", type: Number },
  { name: "s2_pm2_5", type: Number },
  { name: "s2_pm10", type: Number },
  { name: "s2_no2", type: Number },
  { name: "longitude", type: Number },
  { name: "latitude", type: Number },
  { name: "battery", type: Number },
  { name: "altitude", type: Number },
  { name: "speed", type: Number },
  { name: "satellites", type: Number },
  { name: "hdop", type: Number },
  { name: "internalTemperature", type: Number },
  { name: "externalTemperature", type: Number },
  { name: "internalHumidity", type: Number },
  { name: "externalHumidity", type: Number },
  { name: "externalPressure", type: Number },
  { name: "externalAltitude", type: Number },
  { name: "s1_pm2_5", type: Number },
  { name: "s1_pm10", type: Number },
  { name: "s1_no2", type: Number },
  { name: "s1_pm1", type: Number },
  { name: "tvoc", type: Number },
  { name: "co2", type: Number },
  { name: "hcho", type: Number },
  { name: "intaketemperature", type: Number },
  { name: "intakehumidity", type: Number },
  { name: "rtc_adc", type: Number },
  { name: "rtc_v", type: Number },
  { name: "rtc", type: Number },
  { name: "stc_adc", type: Number },
  { name: "stc_v", type: Number },
  { name: "stc", type: Number },
];

// Reusable Schemas and Data Structures
const measurementSchema = new Schema({
  value: { type: Number, default: null },
  calibratedValue: { type: Number, default: null },
  uncertaintyValue: { type: Number, default: null },
  standardDeviationValue: { type: Number, default: null },
});

const valueSchema = new Schema(
  SENSOR_CONFIG.reduce(
    (fields, sensor) => {
      fields[sensor.name] =
        sensor.type === Number
          ? measurementSchema
          : { type: sensor.type, default: null }; //use measurementSchema if the field is a pollutant
      return fields;
    },
    {
      time: { type: Date, required: true },
    }
  )
);

const eventSchema = new Schema(
  {
    day: { type: Date, required: true },
    first: { type: Date, required: true },
    last: { type: Date, required: true },
    nValues: { type: Number, default: 0 },
    values: [valueSchema], //Use valueSchema here
    average_pm2_5: measurementSchema,
    average_pm10: measurementSchema,
    average_no2: measurementSchema,
    pm1: measurementSchema,
    device: { type: String, required: true },
    device_id: { type: ObjectId, required: true },
    site_id: { type: ObjectId, required: true },
    frequency: {
      type: String,
      required: true,
      enum: ["raw", "hourly", "daily"], //use enum for strings
    },
    is_test_data: {
      type: Boolean,
      required: true,
    },
    is_device_primary: {
      type: Boolean,
      required: true,
    },

    site: { type: String, required: true },
    device_number: { type: Number },
    tenant: { type: String, required: true },
  },
  { timestamps: true }
);
// --- Indexes ---
eventSchema.index({ day: 1, "values.time": 1, device_id: 1, site_id: 1 });
eventSchema.index({ "values.time": 1 });
eventSchema.index({ device_id: 1 });
eventSchema.index({ site_id: 1, "values.time": 1 });
eventSchema.index({ "values.time": 1, "values.pm2_5": 1 }, { sparse: true });

// Model Middleware (simplified -  removed the error)
eventSchema.pre("save", function(next) {
  next();
});

// --- Plugin and toJSON method ---
eventSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

eventSchema.methods.toJSON = function() {
  const event = this;
  const eventObject = event.toObject();

  if (eventObject.values) {
    eventObject.values = eventObject.values.map((value) => {
      // Iterate and transform 'value' objects
      const transformedValue = {};
      for (const key in value) {
        if (
          value.hasOwnProperty(key) &&
          key !== "_id" &&
          value[key] !== null &&
          typeof value[key] !== "undefined"
        ) {
          if (value[key].value) {
            //if it has value property, add it
            transformedValue[key] = value[key].value;
          } else {
            transformedValue[key] = value[key]; //add the property
          }
        }
      }
      return transformedValue;
    });
  }

  eventObject.average_pm2_5 = eventObject.average_pm2_5?.value
    ? eventObject.average_pm2_5.value
    : null;

  return eventObject;
};

function calculateAQIValue(Il, Ih, BPIl, BPIh, Cp) {
  let AQI = ((BPIh - BPIl) / (Ih - Il)) * (Cp - Il) + BPIl;

  return Math.round(AQI);
}

// --- Utility Functions ---
const calculateAQI = (pm2_5Value) => {
  /*  AQI calculation logic (refer to previous versions or AQI standards for the implementation) */
  if (pm2_5Value > 500 || pm2_5Value < 0) {
    return null;
  }

  if (!isEmpty(pm2_5Value)) {
    let AQI;
    const pm2_5 = parseFloat(pm2_5Value);

    if (pm2_5 >= 0 && pm2_5 <= 12.0) {
      AQI = calculateAQIValue(0, 12.0, 0, 50, pm2_5);
    } else if (pm2_5 > 12.0 && pm2_5 <= 35.4) {
      AQI = calculateAQIValue(12.1, 35.4, 51, 100, pm2_5);
    } else if (pm2_5 > 35.4 && pm2_5 <= 55.4) {
      AQI = calculateAQIValue(35.5, 55.4, 101, 150, pm2_5);
    } else if (pm2_5 > 55.4 && pm2_5 <= 150.4) {
      AQI = calculateAQIValue(55.5, 150.4, 151, 200, pm2_5);
    } else if (pm2_5 > 150.4 && pm2_5 <= 250.4) {
      AQI = calculateAQIValue(150.5, 250.4, 201, 300, pm2_5);
    } else if (pm2_5 > 250.4 && pm2_5 <= 350.4) {
      AQI = calculateAQIValue(250.5, 350.4, 301, 400, pm2_5);
    } else if (pm2_5 > 350.4 && pm2_5 <= 500.4) {
      AQI = calculateAQIValue(350.5, 500.4, 401, 500, pm2_5);
    } else {
      AQI = null;
    }

    return AQI;
  } else {
    return null;
  }
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
  if (recent === "yes") {
    switch (metadata) {
      case "device":
      case "device_id":
        return "deviceDetails";
      case "site":
      case "site_id":
        return "siteDetails";
      default:
        return "siteDetails";
    }
  } else if (recent === "no") {
    switch (metadata) {
      case "device":
        return "device";
      case "device_id":
        return "device_id";
      case "site":
        return "site";
      case "site_id":
        return "site_id";
      default:
        return "site";
    }
  }
};

const buildMetadataConfig = (metadata) => {
  let group = {};
  let unwind = "";
  let sort = {};
  let index = {};

  switch (metadata) {
    case "site":
    case "site_id":
      unwind = "$values";
      group = {
        _id: {
          day: "$day",
          site_id: "$site_id",
        },
      };
      sort = {
        day: 1,
      };
      index = {
        day: "day",
        site_id: "site_id",
      };

      break;

    case "device":
    case "device_id":
      unwind = "$values";
      group = {
        _id: {
          day: "$day",
          device_id: "$device_id",
        },
      };
      sort = {
        day: 1,
      };

      index = {
        day: "day",
        device_id: "device_id",
      };
      break;

    default:
      break;
  }

  const metadataConfig = {
    group,
    unwind,
    sort,
    index,
  };

  return metadataConfig;
};

const buildBaseProjection = (external, brief) => {
  let projection = {
    _id: 0,
    day: 1,
    average_pm2_5: 1,
    frequency: 1,
  };

  if (brief === "yes") {
    projection = {
      _id: 0,
      day: 1,
      average_pm2_5: 1,
    };
  }

  if (external === "yes") {
    delete projection.average_pm2_5;

    projection = {
      ...projection,
    };
  }

  return projection;
};

const buildRunningProjection = () => {
  return {
    _id: 0,
    day: 1,
    average_pm2_5: 1,
    frequency: 1,
    device: 1,
    device_id: 1,
    site_id: 1,
    is_test_data: 1,
    is_device_primary: 1,
    site: 1,
    device_number: 1,
    tenant: 1,
  };
};

const buildLookupStages = (metadataConfig, recent) => {
  let lookupStages = [];
  const { index } = metadataConfig;

  if (!isEmpty(index)) {
    lookupStages = [
      {
        $lookup: {
          from: constants.DEVICE_COLLECTION_NAME,
          localField: index.device_id,
          foreignField: "_id",
          as: "deviceDetails",
        },
      },
      {
        $unwind: "$deviceDetails",
      },
      {
        $lookup: {
          from: constants.SITES_COLLECTION_NAME,
          localField: index.site_id,
          foreignField: "_id",
          as: "siteDetails",
        },
      },
      {
        $unwind: "$siteDetails",
      },
      {
        $addFields: {
          "deviceDetails.siteDetails": "$siteDetails",
        },
      },
    ];

    if (recent === "yes") {
      lookupStages.push({
        $match: {
          "deviceDetails.isActive": true,
        },
      });
    }

    lookupStages.push({
      $replaceRoot: {
        newRoot: "$deviceDetails",
      },
    });
  }

  return lookupStages;
};

const buildFacetStages = (
  metadataConfig,
  projection,
  sort,
  skip,
  limit,
  tenant
) => {
  const { group, unwind } = metadataConfig;

  let facetStages = [
    {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [],
      },
    },
  ];

  if (
    !isEmpty(sort) &&
    !isEmpty(projection) &&
    !isEmpty(group) &&
    !isEmpty(unwind)
  ) {
    facetStages[0]["$facet"]["data"] = [
      { $sort: sort },
      { $skip: skip },
      { $limit: limit },
      { $project: projection },
    ];

    if (tenant !== "airqo") {
      facetStages[0]["$facet"]["metadata"][0] = {
        $group: {
          _id: null,
          total: { $sum: 1 },
          average: { $avg: `$average_pm2_5.${constants.PM25_VALUE_FIELD}` },
        },
      };

      facetStages[0]["$facet"]["data"].push({
        $lookup: {
          from: "devices",
          localField: "device_id",
          foreignField: "_id",
          as: "deviceDetails",
        },
      });

      facetStages[0]["$facet"]["data"].push({ $unwind: "$deviceDetails" });

      facetStages[0]["$facet"]["data"].push({
        $match: {
          [`deviceDetails.${constants.HAS_DEVICE_OWNER_FIELD}`]: true,
        },
      });
    }
  }

  return facetStages;
};

const buildFetchPipeline = (filter) => {
  const {
    external,
    recent,
    device,
    device_id,
    site,
    site_id,
    device_number,
    frequency,
    startTime,
    endTime,
    metadata,
    test,
    primary,
    active, // Add active filter
    brief,
    airqloud,
    airqloud_id,
    skip,
    limit,
    page,
    running,
    lat_long,
    tenant,
  } = filter;

  let effectiveSkip = skip ? skip : DEFAULT_SKIP;
  let effectiveLimit = limit ? limit : DEFAULT_LIMIT;
  let sort = {};

  if (page && limit) {
    effectiveSkip = parseInt((page - 1) * limit);
  }

  let projection = buildBaseProjection(external, brief);
  let metadataConfig = buildMetadataConfig(metadata);

  if (running === "yes") {
    projection = buildRunningProjection();
  }

  const lookupStages = buildLookupStages(metadataConfig, recent);
  const facetStages = buildFacetStages(
    metadataConfig,
    projection,
    sort,
    effectiveSkip,
    effectiveLimit,
    tenant
  );
  const stages = [{ $match: filter }, ...lookupStages, ...facetStages];

  const aggregationPipeline = stages;

  return {
    effectiveSkip,
    startTime,
    endTime,
    metadataConfig,
    projection,
    sort,
    lookupStages,
    facetStages,
    aggregationPipeline,
  };
};
const buildAggregatePipeline = (filter) => {
  const {
    external,
    recent,
    device,
    device_id,
    site,
    site_id,
    device_number,
    frequency,
    startTime,
    endTime,
    metadata,
    test,
    primary,
    active,
    brief,
    airqloud,
    airqloud_id,
    skip,
    limit,
    page,
    running,
    lat_long,
    tenant,
    country,
    pollutant,
    standard,
  } = filter;

  let effectiveSkip = skip ? skip : DEFAULT_SKIP;
  let effectiveLimit = limit ? limit : DEFAULT_LIMIT;

  if (page && limit) {
    effectiveSkip = parseInt((page - 1) * limit);
  }

  let generalFilter = {};

  if (device) {
    generalFilter["device"] = device;
  }

  if (device_id) {
    generalFilter["device_id"] = device_id;
  }

  if (site) {
    generalFilter["site"] = site;
  }

  if (site_id) {
    generalFilter["site_id"] = site_id;
  }

  if (device_number) {
    generalFilter["device_number"] = device_number;
  }

  if (frequency) {
    generalFilter["frequency"] = frequency;
  }

  if (test) {
    generalFilter["is_test_data"] = test;
  }

  if (primary) {
    generalFilter["is_device_primary"] = primary;
  }

  if (recent) {
    generalFilter["recent"] = recent;
  }

  if (active) {
    generalFilter["deviceDetails.isActive"] = active;
  }

  if (airqloud) {
    generalFilter["airqloud"] = airqloud;
  }

  if (airqloud_id) {
    generalFilter["airqloud_id"] = airqloud_id;
  }

  if (lat_long) {
    generalFilter["lat_long"] = lat_long;
  }

  if (country) {
    generalFilter["siteDetails.country"] = country;
  }

  if (pollutant) {
    generalFilter["pollutant"] = pollutant;
  }

  if (standard) {
    generalFilter["standard"] = standard;
  }

  if (startTime && endTime) {
    generalFilter[`values.time`] = {
      $gte: new Date(startTime),
      $lte: new Date(endTime),
    };
  } else if (startTime) {
    generalFilter[`values.time`] = { $gte: new Date(startTime) };
  } else if (endTime) {
    generalFilter[`values.time`] = { $lte: new Date(endTime) };
  }

  let projection = buildBaseProjection(external, brief);
  let metadataConfig = buildMetadataConfig(metadata);

  if (running === "yes") {
    projection = buildRunningProjection();
  }

  const lookupStages = buildLookupStages(metadataConfig, recent);
  const facetStages = buildFacetStages(
    metadataConfig,
    projection,
    sort,
    effectiveSkip,
    effectiveLimit,
    tenant
  );

  const unwindStage = { $unwind: "$values" };
  const sortStage = { $sort: { "values.time": 1 } };
  const groupStage = {
    $group: { _id: "$device_id", values: { $push: "$values" } },
  };
  const projectStage = { $project: { values: 1, _id: 0 } };

  let stages = [];

  if (isEmpty(generalFilter)) {
    stages = [
      {
        $match: {
          $or: [
            { "average_pm2_5.value": { $ne: null } },
            { average_pm2_5: { $exists: false } },
          ],
        },
      }, //filter out records where average_pm2_5 is null
      ...lookupStages,

      ...facetStages,
    ];
  } else if (!isEmpty(generalFilter)) {
    stages = [
      { $match: generalFilter },
      {
        $match: {
          $or: [
            { "average_pm2_5.value": { $ne: null } },
            { average_pm2_5: { $exists: false } },
          ],
        },
      }, //filter out records where average_pm2_5 is null
      ...lookupStages,

      ...facetStages,
    ];
  }

  let meta = {};

  if (filter.metadata) {
    const index =
      filter.metadata === "device"
        ? "device"
        : filter.metadata === "site"
        ? "site"
        : "";

    if (index) {
      meta = {
        total: 0,
        pages: 1,
        page: page || 1,
        limit: limit || 1000,
        skip: skip || 0,

        ...(recent === "yes"
          ? {}
          : {
              index,
            }),
      };
    } else {
      meta = {
        total: 0,
        pages: 1,
        page: page || 1,
        limit: limit || 1000,
        skip: skip || 0,
      };
    }
  }

  const aggregationPipeline = stages;

  return { aggregationPipeline, meta, projection };
};

// --- Data Fetching and Filtering Functions ---

const filterNullAndReportOffDevices = (data) => {
  const filteredData = data.filter(
    (record) => record.pm2_5 && record.pm2_5.value !== null
  );

  data.forEach((record) => {
    if (record.deviceDetails) {
      //check if deviceDetails exists
      const deviceUptime = record.deviceDetails.uptime;
      if (deviceUptime) {
        //check if uptime field exists
        const timeDifferenceHours =
          (new Date() - new Date(record.time)) / (1000 * 60 * 60);
        record.timeDifferenceHours = timeDifferenceHours;

        if (
          timeDifferenceHours >= UPTIME_CHECK_THRESHOLD &&
          deviceUptime < UPTIME_CHECK_THRESHOLD
        ) {
          logger.warn(
            `device ${record.device} is offline, no data in the last ${UPTIME_CHECK_THRESHOLD} hours`
          );
        }
      }
    }

    if (record.pm2_5.value === null) {
      //access value directly from measurement value
      logger.warn(`device ${record.device} has a null value for pm2_5`);
    }
  });

  return filteredData;
};

const filterNull = (data) =>
  data.filter((record) => record.pm2_5 && record.pm2_5.value !== null);

const computeAveragePm2_5 = (transformedData) => {
  let total = 0;
  let validDataPoints = 0;

  transformedData.forEach((record) => {
    if (record.pm2_5 && record.pm2_5.value !== null) {
      //check if pm2_5 exists and its value is not null

      total += record.pm2_5.value;
      validDataPoints++;
    }
  });

  return validDataPoints > 0 ? total / validDataPoints : null;
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
    const { aggregationPipeline, meta } = buildAggregatePipeline(filter);

    let data = await this.aggregate(aggregationPipeline).allowDiskUse(true);

    data = isEmpty(data[0].data) ? [] : data[0].data;
    data = filterNullAndReportOffDevices(data);
    meta.total = isEmpty(data) ? 0 : data.length;

    return {
      success: true,
      message: "Successfully returned the events",
      data: [{ meta, data }],
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`Error listing events: ${error.message}`);
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
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
    const transformedData = filterNull(result[0].data);
    result[0].data = transformedData;
    const calculatedValues = computeAveragePm2_5(transformedData);
    result[0].meta.pm2_5Avg = calculatedValues;

    return {
      success: true,
      message: isEmpty(result[0].data)
        ? "no measurements for this search"
        : "successfully retrieved the measurements",
      data: result,
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`Error viewing events: ${error.message}`);
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

eventSchema.statics.fetch = async function(filter) {
  try {
    logObject("the filter", filter);
    const modifiedFilter = { ...filter, recent: "yes", metadata: "site_id" };
    const events = await EventModel(modifiedFilter.tenant).list({
      filter: modifiedFilter,
    });
    if (events.success) {
      return events;
    } else {
      return {
        success: false,
        message: events.message,
        errors: events.errors,
        status: events.status,
      };
    }
  } catch (error) {
    logger.error(`Error fetching events: ${error.message}`);
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

eventSchema.statics.signal = async function(filter) {
  try {
    const modifiedFilter = { recent: "yes", metadata: "site_id" };
    const request = {
      ...filter,
      skip: filter.skip || DEFAULT_SKIP,
      limit: filter.limit || DEFAULT_LIMIT,
      page: filter.page || DEFAULT_PAGE,
      ...modifiedFilter,
    };

    const result = await signalData(this, request);
    const transformedData = result[0] ? filterNull(result[0].data) : []; // Use refactored filterNull and handle possible undefined result[0]
    const calculatedValues = computeAveragePm2_5(transformedData); // Use refactored computeAveragePm2_5

    if (result.length > 0) {
      result[0].data = transformedData;
      result[0].meta.pm2_5Avg = calculatedValues;
    } else {
      result.push({ meta: { pm2_5Avg: calculatedValues }, data: [] }); // Create an empty array instead of null for consistency
    }

    return {
      success: true,
      message:
        result[0].data.length > 0
          ? "successfully retrieved the measurements"
          : "no measurements for this search",
      data: result,
      status: result[0].data.length > 0 ? httpStatus.OK : httpStatus.NOT_FOUND,
    };
  } catch (error) {
    logger.error(`Error getting signal data: ${error.message}`);
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

// --- Refactored Averages functions ---

const calculateDataQuality = (
  dailyData,
  minReadings = MIN_READINGS_PER_DAY
) => {
  const uniqueHours = new Set(dailyData.map((item) => item.hourOfDay));

  const dailyStats = {
    minReading: Math.min(...dailyData.map((item) => item.pm2_5)), // Ensure correct pm2_5 access
    maxReading: Math.max(...dailyData.map((item) => item.pm2_5)),
    readingCount: dailyData.length,
    uniqueHours: Array.from(uniqueHours), // Store as an array, easier for JSON serialization
  };

  return {
    hasMinReadings: dailyStats.readingCount >= minReadings,
    hoursCovered: dailyStats.uniqueHours.length,
    readingSpread: dailyStats.maxReading - dailyStats.minReading,
  };
};

const calculateWeeklyDataQuality = (currentWeek, previousWeek) => {
  const currentWeekQuality = calculateDataQuality(currentWeek);
  const previousWeekQuality = calculateDataQuality(previousWeek);

  const quality = {
    currentWeek: currentWeekQuality,
    previousWeek: previousWeekQuality,
  };

  return quality;
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
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 12096e5); // 14 days in milliseconds

    const aggregationPipeline = [
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
      const dayOfYear = curr.dayOfYear;
      const yearWeek = curr.yearWeek;
      if (!acc[dayOfYear]) {
        acc[dayOfYear] = {
          _id: dayOfYear,
          pm2_5: [],
        };
      }
      if (!acc[yearWeek]) {
        acc[yearWeek] = {
          _id: yearWeek,
          pm2_5: [],
        };
      }
      acc[dayOfYear].pm2_5.push(curr.pm2_5);
      acc[yearWeek].pm2_5.push(curr.pm2_5);
      return acc;
    }, {});

    averages = Object.values(averages);

    if (averages.length < 2) {
      return {
        success: false,
        message: "Not enough data to compute averages",
        status: httpStatus.NOT_FOUND,
      };
    }

    const [currentWeek, previousWeek] = averages.sort(
      (a, b) => new Date(b._id) - new Date(a._id)
    );
    const today = moment()
      .tz(TIMEZONE)
      .format("YYYY-MM-DD");

    const dailyMeasurements = currentWeek.pm2_5.filter(
      (pm2_5) => pm2_5 !== null
    ); // Filter out any null values for pm2_5
    const todayAverage =
      dailyMeasurements.reduce((sum, pm2_5) => sum + pm2_5, 0) /
      (dailyMeasurements.length || 1); // Handle potential null values and avoid division by zero

    const currentWeekAverage =
      currentWeek.pm2_5.reduce((sum, measurement) => {
        return measurement !== null ? sum + measurement : sum; // consider non-null values only
      }, 0) /
      (currentWeek.pm2_5.filter((reading) => reading !== null).length || 1); // Avoid division by zero

    const previousWeekAverage =
      previousWeek.pm2_5.reduce((sum, measurement) => {
        return measurement !== null ? sum + measurement : sum; // consider non-null values only
      }, 0) /
      (previousWeek.pm2_5.filter((reading) => reading !== null).length || 1); // Avoid division by zero

    const percentageDifference =
      ((currentWeekAverage - previousWeekAverage) / previousWeekAverage || 0) *
      100; // Handle cases where previous week average is zero

    const data = {
      currentWeekAverage,
      previousWeekAverage,
      todayAverage,
      percentageDifference,
    };

    return {
      success: true,
      message: "Successfully calculated averages",
      status: httpStatus.OK,
      data,
    };
  } catch (error) {
    logger.error(`Error calculating air quality averages: ${error.message}`);
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

eventSchema.statics.v2_getAirQualityAverages = async function(siteId, next) {
  try {
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 12096e5);
    const filter = {
      site_id: siteId,
      startTime: twoWeeksAgo,
      endTime: now,
    };
    // Fetch events for the site within the last two weeks
    const events = await this.find({
      site_id: siteId,
      day: { $gte: twoWeeksAgo, $lte: now },
    }).lean();

    if (events.length === 0) {
      return {
        success: false,
        message:
          "No events found for this site within the specified time range.",
        status: httpStatus.NOT_FOUND,
      };
    }

    const transformedEvents = events
      .flatMap((event) => event.values)
      .filter((value) => value.pm2_5 && value.pm2_5.value !== null); // Filter to get pm2_5 measurements and remove nulls

    if (transformedEvents.length === 0) {
      return {
        success: false,
        message:
          "No pm2.5 values found for this siteId within the specified time range",
        status: httpStatus.NOT_FOUND,
      };
    }

    const result = computeAirQualityStatistics(transformedEvents); // Reuse the utility function

    let averages = result.reduce((acc, curr) => {
      const { dayOfYear, yearWeek } = curr;

      if (!acc[dayOfYear]) {
        acc[dayOfYear] = {
          _id: dayOfYear,
          values: [],
        };
      }

      if (!acc[yearWeek]) {
        acc[yearWeek] = {
          _id: yearWeek,
          values: [],
        };
      }

      acc[dayOfYear].values.push(curr.pm2_5);
      acc[yearWeek].values.push(curr.pm2_5);

      return acc;
    }, {});

    averages = Object.values(averages);

    if (averages.length < 2) {
      return {
        success: false,
        message: "Not enough data to compute averages",
        status: httpStatus.NOT_FOUND,
      };
    }

    const [currentWeek, previousWeek] = averages.sort(
      (a, b) => new Date(b._id) - new Date(a._id)
    );
    const today = moment()
      .tz(TIMEZONE)
      .format("YYYY-MM-DD");
    // const todayAverage = currentWeek.values.reduce((sum, pm2_5) => sum + pm2_5, 0) / (currentWeek.values.length || 1);

    const dailyMeasurements = currentWeek.values.filter(
      (pm2_5) => pm2_5 !== null
    ); // Filter out any null values for pm2_5
    const todayAverage =
      dailyMeasurements.reduce((sum, pm2_5) => sum + pm2_5, 0) /
      (dailyMeasurements.length || 1);

    const currentWeekAverage =
      currentWeek.values.reduce((sum, measurement) => {
        return measurement !== null ? sum + measurement : sum;
      }, 0) /
      (currentWeek.values.filter((reading) => reading !== null).length || 1); // Avoid division by zero

    const previousWeekAverage =
      previousWeek.values.reduce((sum, measurement) => {
        return measurement !== null ? sum + measurement : sum;
      }, 0) /
      (previousWeek.values.filter((reading) => reading !== null).length || 1); // Avoid division by zero

    const percentageDifference =
      ((currentWeekAverage - previousWeekAverage) / previousWeekAverage || 0) *
      100; // Handle cases where previous week average is zero

    const data = {
      currentWeekAverage,
      previousWeekAverage,
      todayAverage,
      percentageDifference,
    };

    return {
      success: true,
      message: "Successfully calculated averages",
      status: httpStatus.OK,
      data,
    };
  } catch (error) {
    logger.error(`Error calculating air quality averages: ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};
const calculateConfidenceScore = (currentWeek, previousWeek) => {
  const currentWeekQuality = calculateDataQuality(currentWeek.days); // Pass currentWeek.days to calculateDataQuality
  const previousWeekQuality = calculateDataQuality(previousWeek.days); // Pass previousWeek.days to calculateDataQuality

  const confidence =
    currentWeekQuality.hasMinReadings &&
    previousWeekQuality.hasMinReadings &&
    currentWeekQuality.hoursCovered >= 12 &&
    previousWeekQuality.hoursCovered >= 12
      ? 0.9
      : 0.5;

  return confidence;
};

const generateEventsBaseUrl = (tenant, req) => {
  return req.protocol + "://" + req.get("host") + `/api/v2/events`;
};

const constructEvents = (data, frequency) => {
  try {
    if (frequency === "raw") {
      return data.map((item) => {
        return {
          day: moment(item.time)
            .tz(TIMEZONE)
            .format("YYYY-MM-DD"), // Use moment-timezone for consistent formatting
          first: item.time,
          last: item.time,
          nValues: 1,
          values: [item], // Include the "item" (measurement) in the values array
          device: item.device,
          device_id: item.device_id,
          site_id: item.site_id,
          frequency: item.frequency,
          is_test_data: item.is_test_data,
          is_device_primary: item.is_device_primary,
          site: item.site,
          device_number: item.device_number,
          tenant: item.tenant,
        };
      });
    } else {
      return []; //or handle other frequencies as needed
    }
  } catch (error) {
    logObject("error", error);
    return [];
  }
};

const generatePublicUrls = (events, tenant, req) => {
  if (isEmpty(events)) {
    return {
      success: true,
      message: "no events to generate URLs from",
    };
  }

  const eventsWithUrls = events.map((event) => {
    const url = new URL(
      req.protocol + "://" + req.get("host") + `/api/v2/events`
    );
    url.searchParams.append(
      "day",
      moment(event.day)
        .tz(TIMEZONE)
        .format("YYYY-MM-DD")
    ); // Format date consistently
    url.searchParams.append("device", event.device);
    url.searchParams.append("tenant", tenant);
    return { ...event, url: url.href };
  });

  return {
    success: true,
    message: "Successfully generated public urls",
    data: eventsWithUrls,
  };
};

const eventsModel = (tenant) => {
  const model = getModelByTenant(tenant.toLowerCase(), "event", eventSchema);
  return model;
};

module.exports = eventsModel;
