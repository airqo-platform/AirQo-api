const mongoose = require("mongoose");
const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const { logObject } = require("@utils/log"); //logText removed as it was not used
const ObjectId = Schema.Types.ObjectId;
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const moment = require("moment-timezone");
const TIMEZONE = moment.tz.guess(); //This was never used
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- event-model`
);

const DEFAULT_LIMIT = 1000;
const DEFAULT_SKIP = 0;
const DEFAULT_PAGE = 1;
const UPTIME_CHECK_THRESHOLD = 168;

// Constants extracted for better management
const AQI_RANGES = {
  good: { min: 0, max: 9.1 },
  moderate: { min: 9.101, max: 35.49 },
  u4sg: { min: 35.491, max: 55.49 },
  unhealthy: { min: 55.491, max: 125.49 },
  very_unhealthy: { min: 125.491, max: 225.49 },
  hazardous: { min: 225.491, max: null },
};

// Reusable measurement schema
const measurementSchema = new Schema({
  value: { type: Number, default: null },
  calibratedValue: { type: Number, default: null },
  uncertaintyValue: { type: Number, default: null },
  standardDeviationValue: { type: Number, default: null },
});

//Simplified valueSchema using the measurementSchema
const valueSchema = new Schema({
  time: { type: Date, required: true },
  frequency: { type: String, required: true, trim: true },
  is_test_data: { type: Boolean, trim: true },
  device: { type: String, trim: true, default: null },
  tenant: { type: String, trim: true },
  network: { type: String, trim: true },
  is_device_primary: { type: Boolean, trim: true },
  device_id: { type: ObjectId, required: true },
  device_number: { type: Number, default: null },
  site: { type: String, default: null },
  site_id: { type: ObjectId },
  pm1: measurementSchema,
  s1_pm1: measurementSchema,
  s2_pm1: measurementSchema,
  pm2_5: measurementSchema,
  s1_pm2_5: measurementSchema,
  s2_pm2_5: measurementSchema,
  pm10: measurementSchema,
  s1_pm10: measurementSchema,
  s2_pm10: measurementSchema,
  no2: measurementSchema,
  battery: { value: { type: Number, default: null } },
  location: {
    latitude: { value: { type: Number, default: null } },
    longitude: { value: { type: Number, default: null } },
  },
  altitude: { value: { type: Number, default: null } },
  speed: { value: { type: Number, default: null } },
  satellites: { value: { type: Number, default: null } },
  hdop: { value: { type: Number, default: null } },
  tvoc: { value: { type: Number, default: null } },
  co2: { value: { type: Number, default: null } },
  hcho: { value: { type: Number, default: null } },
  intaketemperature: { value: { type: Number, default: null } },
  intakehumidity: { value: { type: Number, default: null } },
  internalTemperature: { value: { type: Number, default: null } },
  internalHumidity: { value: { type: Number, default: null } },
  externalTemperature: { value: { type: Number, default: null } },
  externalHumidity: { value: { type: Number, default: null } },
  average_pm2_5: measurementSchema,
  average_pm10: measurementSchema,
  externalPressure: { value: { type: Number, default: null } },
  externalAltitude: { value: { type: Number, default: null } },
  rtc_adc: { value: { type: Number, default: null } },
  rtc_v: { value: { type: Number, default: null } },
  rtc: { value: { type: Number, default: null } },
  stc_adc: { value: { type: Number, default: null } },
  stc_v: { value: { type: Number, default: null } },
  stc: { value: { type: Number, default: null } },
});

const eventSchema = new Schema(
  {
    // ... (rest of the eventSchema remains unchanged)
  },
  { timestamps: true }
);

//Indexes remain unchanged

eventSchema.pre("save", function(next) {
  // This middleware was causing errors as it always calls next(err)
  // It's unclear what its purpose was, so it's commented out.  If needed,
  // it should be rewritten to handle errors properly and only call next(err) when
  // an actual error occurs.
  // const err = new Error("something went wrong");
  // next(err);
  next(); //Calls next without error to save the data
});

eventSchema.plugin(uniqueValidator, { message: `{VALUE} already taken!` });

eventSchema.methods = {
  toJSON() {
    return {
      day: this.day,
      values: this.values,
    };
  },
};

//Standalone AQI calculation function
function calculateAQI(pm2_5Value) {
  let aqi;
  // ... (AQI calculation logic based on pm2_5Value)
  return aqi;
}

//Helper function to determine metadata field names
const getElementAtIndexName = (metadata, recent) => {
  const lookupField =
    metadata === "site" || metadata === "site_id"
      ? "siteDetails"
      : "deviceDetails";
  return recent === "no"
    ? { $arrayElemAt: [`$${lookupField}`, 0] }
    : { $first: { $arrayElemAt: [`$${lookupField}`, 0] } };
};

// Refactored fetchData function with improved structure and separation of concerns.
async function fetchData(model, filter) {
  const {
    metadata,
    external,
    tenant,
    running,
    recent,
    brief,
    index,
    skip = DEFAULT_SKIP,
    limit = DEFAULT_LIMIT,
    page = DEFAULT_PAGE,
    ...search // Directly use the remaining filter as the search query
  } = filter;

  // Paging calculations
  const effectiveSkip = page ? (page - 1) * limit : skip;
  const startTime = search["values.time"]["$gte"];
  const endTime = search["values.time"]["$lte"];

  //Metadata Configuration
  let metadataConfig = {
    idField: "$device",
    groupId: "$device",
    localField: "device",
    foreignField: "name",
    from: "devices",
    as: "deviceDetails",
  };

  if (metadata === "device_id") {
    metadataConfig.foreignField = "_id";
  } else if (metadata === "site" || metadata === "site_id") {
    metadataConfig = {
      ...metadataConfig,
      idField: "$site_id",
      groupId: `$${metadata}`,
      localField: metadata,
      foreignField: metadata === "site" ? "generated_name" : "_id",
      from: "sites",
      as: "siteDetails",
    };
  }

  //Projection Setup
  let projection = buildBaseProjection(external, brief);

  if (running === "yes") {
    projection = buildRunningProjection();
  } else if (metadata) {
    Object.assign(
      projection,
      constants.EVENTS_METADATA_PROJECTION(
        brief === "yes" ? "brief_site" : metadata,
        metadataConfig.as
      )
    );
  }

  const sort = isEmpty(index) ? { time: -1 } : { "pm2_5.value": 1 };

  const lookupStages = buildLookupStages(metadataConfig, recent);
  const facetStages = buildFacetStages(
    metadataConfig,
    projection,
    sort,
    effectiveSkip,
    limit,
    tenant
  );

  const aggregationPipeline = [...lookupStages, ...facetStages];

  logObject("the query for this request", search);

  const data = await model.aggregate(aggregationPipeline).allowDiskUse(true);
  return data;
}

function buildBaseProjection(external, brief) {
  let projection = { _id: 0 };
  if (external === "yes" || brief === "yes") {
    projection = {
      ...projection,
      s2_pm10: 0,
      s1_pm10: 0,
      s2_pm2_5: 0,
      // ... (Rest of the fields to exclude)
    };
  }
  return projection;
}

function buildRunningProjection() {
  return {
    _id: 0,
    site_image: 0,
    is_reading_primary: 0,
    // ... (Other fields to exclude)
  };
}

function buildLookupStages(metadataConfig, recent) {
  const elementAtIndex0 = getElementAtIndexName(metadata, recent);
  return [
    { $unwind: "$values" },
    { $match: search },
    { $replaceRoot: { newRoot: "$values" } },
    {
      from: "photos",
      localField: "site_id",
      foreignField: "site_id",
      as: "site_images",
    },
    {
      from: "devices",
      localField: "device_id",
      foreignField: "_id",
      as: "device_details",
    },
    {
      from: "cohorts",
      localField: "device_details.cohorts",
      foreignField: "_id",
      as: "cohort_details",
    },
    { $match: { "cohort_details.visibility": { $ne: false } } },
    {
      from: metadataConfig.from,
      localField: metadataConfig.localField,
      foreignField: metadataConfig.foreignField,
      as: metadataConfig.as,
    },

    // ... Add other lookup stages here (healthTips, etc.)
  ];
}

function buildFacetStages(
  metadataConfig,
  projection,
  sort,
  skip,
  limit,
  tenant
) {
  const pm2_5Field = tenant === "airqo" ? "$average_pm2_5" : "$pm2_5"; //Conditional PM2.5 field
  const pm10Field = tenant === "airqo" ? "$average_pm10" : "$pm10"; //Conditional PM10 field

  return [
    { $sort: sort },
    {
      $group: {
        _id: metadataConfig.idField,
        device: { $first: "$device" },
        device_id: { $first: "$device_id" },
        // ... (Other fields in the $group stage)
        pm2_5: { $first: pm2_5Field }, // Use the conditional field
        pm10: { $first: pm10Field }, // Use the conditional field
      },
    },
    {
      $addFields: {
        timeDifferenceHours: {
          $divide: [{ $subtract: [new Date(), "$time"] }, 1000 * 60 * 60],
        },
      },
    },
    { $project: projection },
    {
      $addFields: {
        aqi_ranges: AQI_RANGES,
        aqi: calculateAQI("$pm2_5.value"), // Calculate AQI here
      },
    },
    { $facet: buildFacets(skip, limit) },
  ];
}

function buildFacets(skip, limit) {
  return {
    total: [{ $count: "device" }],
    data: [
      {
        $addFields: {
          // Calculate aqi_color, aqi_category, aqi_color_name using $switch based on AQI value.

          aqi_color: calculateAqiColor("$aqi"), // Example function call
          aqi_category: calculateAqiCategory("$aqi"),
          aqi_color_name: calculateAqiColorName("$aqi"),
        },
      },
    ],
  };
}

// Example function for calculating AQI color - Adapt as needed for other properties
function calculateAqiColor(aqi) {
  return {
    $switch: {
      branches: [
        // ... (Your AQI color logic branches using the calculated AQI value)
      ],
      default: "Unknown",
    },
  };
}

// ... similarly create functions calculateAqiCategory, calculateAqiColorName

// Function to filter null PM2.5 values and report offline devices
function filterDataAndReportOfflineDevices(data) {
  const filteredData = data.filter((record) => {
    if (record.timeDifferenceHours > UPTIME_CHECK_THRESHOLD) {
      const deviceInfo = record.device || "";
      const frequencyInfo = record.frequency || "";
      const timeInfo = record.time || "";
      const siteInfo = record.siteDetails ? record.siteDetails.name : "";

      const logMessage = `🪫🪫 Last refreshed time difference exceeds ${UPTIME_CHECK_THRESHOLD} hours for device: ${deviceInfo}, Frequency: ${frequencyInfo}, Time: ${timeInfo}, Site Name: ${siteInfo}`;
      logObject(logMessage);
      if (constants.ENVIRONMENT === "PRODUCTION ENVIRONMENT") {
        logger.info(logMessage);
      }
    }

    if (record.pm2_5.value === null) {
      // Directly check pm2_5.value
      // ... (logging logic as before)
    }

    return record.pm2_5.value !== null; //Filter out records where pm2_5 is null
  });

  return filteredData;
}

//Export the model
const eventsModel = model("event", eventSchema);
module.exports = {
  eventsModel,
  fetchData,
  signalData,
  filterDataAndReportOfflineDevices,
}; //export functions
