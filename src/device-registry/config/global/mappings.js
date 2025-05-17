const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const isEmpty = require("is-empty");
const { logObject, logText } = require("@utils/shared");
const logger = log4js.getLogger(`${this.ENVIRONMENT} -- constants-config`);
const envs = require("./envs");

// Import the measurement registry
const {
  MEASUREMENT_REGISTRY,
  generateEventMappings,
  generateEventDefaults,
  getThingSpeakFieldMappings,
} = require("@utils/measurement-registry");

function generateDateFormatWithoutHrs(ISODate) {
  try {
    let date = new Date(ISODate);
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getUTCDate();

    if (day < 10) {
      day = "0" + day;
    }
    if (month < 10) {
      month = "0" + month;
    }
    return `${year}-${month}-${day}`;
  } catch (e) {
    logger.error(`internal server error -- ${e.message}`);
  }
}

// Use the registry functions for field mappings
const FIELDS_AND_LABELS = getThingSpeakFieldMappings("standard");
const BAM_FIELDS_AND_LABELS = getThingSpeakFieldMappings("bam");
const THINGSPEAK_GAS_FIELD_DESCRIPTIONS = getThingSpeakFieldMappings("gas");

// Use the measurement registry for EVENT_MAPPINGS
const EVENT_MAPPINGS = {
  item: {
    time: "timestamp",
    day: "timestamp",
    frequency: "frequency",
    device: "device_name",
    device_number: "device_number",
    site: "site",
    site_id: "site_id",
    device_id: "device_id",
    tenant: "tenant",
    network: "network",
    is_test_data: "is_test_data",
    is_device_primary: "is_device_primary",

    // Include all mappings from the registry
    ...generateEventMappings(),
  },
  remove: [],
  defaults: {
    // Include default values from the registry
    ...generateEventDefaults(),
  },
  operate: [
    // Same operate functions as before
  ],
  each: function(item, index, collection, context) {
    // Same function as before
  },
};

const mappings = {
  AQI_INDEX: {
    good: { min: 0, max: 9.1 },
    moderate: { min: 9.101, max: 35.49 },
    u4sg: { min: 35.491, max: 55.49 },
    unhealthy: { min: 55.491, max: 125.49 },
    very_unhealthy: { min: 125.491, max: 225.49 },
    hazardous: { min: 225.491, max: null },
  },
  PREDEFINED_FILTER_VALUES: {
    NETWORKS: ["metone", "usembassy"],
    COMBINATIONS: {
      NETWORK_PAIRS: [
        ["metone", "usembassy", "us_embassy", "us-embassy"],
        ["kcca", "clarity"],
        ["urbanbetter", "airbeam", "urban_better"],
      ],
      GROUP_PAIRS: [
        ["us-embassy", "usembassy", "us_embassy"],
        ["kcca", "kampala"],
        ["urbanbetter", "urban_better", "urban-better"],
      ],
      STATUS_PAIRS: [
        ["active", "enabled", "running"],
        ["inactive", "disabled"],
        ["inactive", "disabled", "stopped", "halted"],
        ["pending", "processing"][("pending", "processing", "initializing")],
      ],
      LOCATION_ALIASES: [
        ["kampala", "kla", "kamp"],
        ["entebbe", "ebb", "entb"],
        ["jinja", "jja"],
      ],
    },
  },
  GET_ROAD_METADATA_PATHS: {
    altitude: "altitude",
    greenness: "greenness",
    aspect: "aspect",
    landform_270: "landform-270",
    landform_90: "landform-90",
    bearing_to_kampala_center: "bearing",
    distance_to_kampala_center: "distance/kampala",
    bearing_to_capital_city_center: "bearing",
    distance_to_capital_city_center: "distance/capital",
    distance_to_nearest_road: "distance/road",
    distance_to_nearest_residential_road: "distance/residential/road",
    distance_to_nearest_tertiary_road: "distance/tertiary/road",
    distance_to_nearest_primary_road: "distance/primary/road",
    distance_to_nearest_secondary_road: "distance/secondary/road",
    distance_to_nearest_unclassified_road: "distance/unclassified/road",
    weather_stations: "nearest-weather-stations",
  },
  BAM_THINGSPEAK_FIELD_DESCRIPTIONS: {
    field1: "Date and time ",
    field2: "ConcRt(ug/m3)",
    field3: "ConcHR(ug/m3)",
    field4: "ConcS(ug/m3)",
    field5: "Flow(LPM)",
    field6: "DeviceStatus",
    field7: "Logger Battery",
    field8: "CompleteBAM dataset Comma Separated Data",
    created_at: "created_at",
  },
  THINGSPEAK_FIELD_DESCRIPTIONS: {
    field1: "Sensor1 PM2.5_CF_1_ug/m3",
    field2: "Sensor1 PM10_CF_1_ug/m3",
    field3: "Sensor2 PM2.5_CF_1_ug/m3",
    field4: "Sensor2 PM10_CF_1_ug/m3",
    field5: "Latitude",
    field6: "Longitude",
    field7: "Battery Voltage",
    field8: "ExtraData",
  },
  THINGSPEAK_GAS_FIELD_DESCRIPTIONS: getThingSpeakFieldMappings("gas"),
  DEVICE_THINGSPEAK_MAPPINGS: {
    item: {
      name: "long_name",
      description: "description",
      elevation: "elevation",
      tags: "tags",
      latitude: "latitude",
      longitude: "longitude",
      public_flag: "visibility",
    },
    remove: [],
    defaults: {
      missingData: true,
    },
    operate: [
      {
        run: "Date.parse",
        on: "",
      },
    ],
    each: function(item, index, collection, context) {
      item.field1 = context.field1;
      item.field2 = context.field2;
      item.field3 = context.field3;
      item.field4 = context.field4;
      item.field5 = context.field5;
      item.field6 = context.field6;
      item.field7 = context.field7;
      item.field8 = context.field8;
      return item;
    },
  },
  DEVICE_MAPPINGS: {},
  SITE_MAPPINGS: {},
  PHOTO_MAPPINGS: {},
  DATA_PROVIDER_MAPPINGS: (network) => {
    switch (network) {
      case "airqo":
        return "AirQo";
        break;
      case "usembassy":
        return "US Embassy";
        break;
      default:
        return "AirQo";
    }
  },

  // Use the measurement registry to generate the mappings
  EVENT_MAPPINGS: {
    item: {
      time: "timestamp",
      day: "timestamp",
      frequency: "frequency",
      device: "device_name",
      device_number: "device_number",
      site: "site",
      site_id: "site_id",
      device_id: "device_id",
      tenant: "tenant",
      network: "network",
      is_test_data: "is_test_data",
      is_device_primary: "is_device_primary",

      // Include all mappings from the registry
      ...generateEventMappings(),
    },
    remove: [],
    defaults: {
      // Include default values from the registry
      ...generateEventDefaults(),
    },
    operate: [
      /**
       * do some sanitisation from here for:
       * Site ID
       * device ID
       * device_number
       * and other numbers, all from here
       */
      {
        run: function(time) {
          const day = generateDateFormatWithoutHrs(time);
          return day;
        },
        on: "day",
      },
      {
        run: function(time) {
          const cleanedTime = new Date(time);
          return cleanedTime;
        },
        on: "time",
      },

      {
        run: function(device_number) {
          if (!isEmpty(device_number)) {
            return parseInt(device_number);
          }
          return device_number;
        },
        on: "device_number",
      },
    ],
    each: function(item, index, collection, context) {
      item.filter = {};
      item.update = {};
      item.options = {};
      item["filter"]["device"] = item.device;
      item["filter"]["device_id"] = item.device_id;
      item["filter"]["site_id"] = item.site_id;
      item["filter"]["nValues"] = { $lt: parseInt(envs.N_VALUES || 500) };
      item["filter"]["day"] = item.day;
      item["filter"]["$or"] = [
        { "values.time": { $ne: item.time } },
        { "values.device": { $ne: item.device } },
        {
          "values.frequency": {
            $ne: item.frequency,
          },
        },
        {
          "values.device_id": {
            $ne: item.device_id,
          },
        },
        { "values.site_id": { $ne: item.site_id } },
        {
          day: {
            $ne: item.day,
          },
        },
      ];
      item["update"]["$min"] = {
        first: item.time,
      };
      item["update"]["$max"] = {
        last: item.time,
      };
      item["update"]["$inc"] = { nValues: 1 };
      item["options"]["upsert"] = true;
      return item;
    },
  },
  BAM_FIELDS_AND_DESCRIPTIONS: {
    field1: "Date and time",
    field2: "ConcRt(ug/m3)",
    field3: "ConcHR(ug/m3)",
    field4: "ConcS(ug/m3)",
    field5: "Flow(LPM)",
    field6: "DeviceStatus",
    field7: "Logger Battery",
    field8: "CompleteBAM dataset Comma Separated Data",
    created_at: "created_at",
  },
  BAM_FIELDS_AND_LABELS: getThingSpeakFieldMappings("bam"),
  BAM_POSITIONS_AND_LABELS: {
    0: "timestamp",
    1: "real_time_concentration",
    2: "hourly_concetration",
    3: "short_time_concetration",
    4: "air_flow",
    5: "wind_speed",
    6: "wind_direction",
    7: "temperature",
    8: "humidity",
    9: "barometric_pressure",
    10: "filter_temperature",
    11: "filter_humidity",
    12: "status",
  },
  FIELDS_AND_LABELS: getThingSpeakFieldMappings("standard"),
  POSITIONS_AND_LABELS: {
    0: "latitude",
    1: "longitude",
    2: "altitude",
    3: "speed",
    4: "satellites",
    5: "hdop",
    6: "internalTemperature",
    7: "internalHumidity",
    8: "externalTemperature",
    9: "ExternalHumidity",
    10: "ExternalPressure",
    11: "ExternalAltitude",
    12: "DeviceType",
  },
  THINGSPEAK_GAS_FIELD_DESCRIPTIONS: getThingSpeakFieldMappings("gas"),
  GAS_POSITIONS_AND_LABELS: {
    0: "latitude",
    1: "longitude",
    2: "altitude",
    3: "speed",
    4: "satellites",
    5: "hdop",
    6: "internalTemperature",
    7: "internalHumidity",
    8: "externalTemperature",
    9: "ExternalHumidity",
    10: "ExternalPressure",
    11: "ExternalAltitude",
    12: "DeviceType",
  },
};
module.exports = mappings;
