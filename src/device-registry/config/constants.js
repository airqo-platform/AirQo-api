const { logElement } = require("../utils/log");
const isEmpty = require("is-empty");
const { Schema, model } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const {
  generateDateFormatWithoutHrs,
  monthsInfront,
} = require("../utils/date");

const devConfig = {
  MONGO_URI: `mongodb://localhost/`,
  DB_NAME: process.env.MONGO_DEV,
  REDIS_SERVER: process.env.REDIS_SERVER_DEV,
  REDIS_PORT: process.env.REDIS_PORT,
  KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS_DEV,
  KAFKA_TOPICS: process.env.KAFKA_TOPICS_DEV,
  SCHEMA_REGISTRY: process.env.SCHEMA_REGISTRY_DEV,
  KAFKA_RAW_MEASUREMENTS_TOPICS: process.env.KAFKA_RAW_MEASUREMENTS_TOPICS_DEV,
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID_DEV,
  KAFKA_CLIENT_GROUP: process.env.KAFKA_CLIENT_GROUP_DEV,
};
const prodConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  DB_NAME: process.env.MONGO_PROD,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
  KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS_PROD,
  KAFKA_TOPICS: process.env.KAFKA_TOPICS_PROD,
  SCHEMA_REGISTRY: process.env.SCHEMA_REGISTRY_PROD,
  KAFKA_RAW_MEASUREMENTS_TOPICS: process.env.KAFKA_RAW_MEASUREMENTS_TOPICS_PROD,
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID_PROD,
  KAFKA_CLIENT_GROUP: process.env.KAFKA_CLIENT_GROUP_PROD,
};

const stageConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  DB_NAME: process.env.MONGO_STAGE,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
  KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS_STAGE,
  KAFKA_TOPICS: process.env.KAFKA_TOPICS_STAGE,
  SCHEMA_REGISTRY: process.env.SCHEMA_REGISTRY_STAGE,
  KAFKA_RAW_MEASUREMENTS_TOPICS:
    process.env.KAFKA_RAW_MEASUREMENTS_TOPICS_STAGE,
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID_STAGE,
  KAFKA_CLIENT_GROUP: process.env.KAFKA_CLIENT_GROUP_STAGE,
};

const defaultConfig = {
  PORT: process.env.PORT || 3000,
  GET_ROAD_METADATA_PATHS: {
    altitude: "altitude",
    greenness: "greenness",
    aspect: "aspect",
    landform_270: "landform270",
    landform_90: "landform90",
    bearing_to_kampala_center: "bearing",
    distance_to_kampala_center: "distance/kampala",
    distance_to_nearest_road: "distance/road",
    distance_to_nearest_residential_road: "distance/residential/road",
    distance_to_nearest_tertiary_road: "distance/tertiary/road",
    distance_to_nearest_primary_road: "distance/primary/road",
    distance_to_nearest_secondary_road: "distance/secondary/road",
    distance_to_nearest_unclassified_road: "distance/unclassified/road",
  },
  KEY_ENCRYPTION_KEY: process.env.KEY_ENCRYPTION_KEY,
  GET_ROAD_METADATA: ({ path, latitude, longitude } = {}) => {
    let today = monthsInfront(0);
    let endDate = generateDateFormatWithoutHrs(today);
    let startDate = generateDateFormatWithoutHrs(today);
    if (path === "greenness") {
      return `https://platform.airqo.net/api/v1/datawarehouse/${path}?lat=${latitude}&lon=${longitude}&startDate=${startDate}&endDate=${endDate}`;
    }
    return `https://platform.airqo.net/api/v1/datawarehouse/${path}?lat=${latitude}&lon=${longitude}`;
  },
  GET_ADDRESS_URL: (lat, long) => {
    return `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${long}&key=${process.env.GCP_KEY}`;
  },
  GET_ELEVATION_URL: (lat, long) => {
    return `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${long}&key=${process.env.GCP_KEY}`;
  },
  CREATE_THING_URL: `https://api.thingspeak.com/channels.json?api_key=${process.env.TS_API_KEY}`,
  DELETE_THING_URL: (device) => {
    return `https://api.thingspeak.com/channels/${device}.json?api_key=${process.env.TS_API_KEY}`;
  },
  CLEAR_THING_URL: (device) => {
    return `https://api.thingspeak.com/channels/${device}/feeds.json?api_key=${process.env.TS_API_KEY}`;
  },
  UPDATE_THING: (device) => {
    return `https://api.thingspeak.com/channels/${device}.json?api_key=${process.env.TS_API_KEY}`;
  },
  ADD_VALUE: (field, value, apiKey) => {
    return `https://api.thingspeak.com/update.json?api_key=${apiKey}&${field}=${value}`;
  },
  ADD_VALUE_JSON: `https://api.thingspeak.com/update.json`,
  BULK_ADD_VALUES_JSON: (channel) => {
    return `https://api.thingspeak.com/channels/${channel}/bulk_update.json`;
  },
  ADD_VALUES: (device) => {
    return `https://api.thingspeak.com/channels/${device}/bulk_update.json`;
  },
  JWT_SECRET: process.env.JWT_SECRET,
  REGION: "europe-west1",
  MQTT_BRIDGE_HOST_NAME: "mqtt.googleapis.com",
  MQTT_BRIDGE_PORT: 8883,
  NUM_MESSAGES: 5,
  TOKEN_EXP_MINS: 360,
  ALGORITHM: "RS256",
  HTTP_BRIDGE_ADDRESS: "cloudiotdevice.googleapis.com",
  MESSAGE_TYPE: "events",
  MINIMUM_BACKOFF_TIME: 1,
  MAXIMUM_BACKOFF_TIME: 32,
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
  N_VALUES: process.env.N_VALUES,
  LATITUDE_REGEX: /^(-?[1-8]?\d(?:\.\d{1,18})?|90(?:\.0{1,18})?)$/,
  LONGITUDE_REGEX: /^(-?(?:1[0-7]|[1-9])?\d(?:\.\d{1,18})?|180(?:\.0{1,18})?)$/,
  DEFAULT_LIMIT_FOR_QUERYING_SITES:
    process.env.DEFAULT_LIMIT_FOR_QUERYING_SITES,
  DEFAULT_LIMIT_FOR_QUERYING_PHOTOS:
    process.env.DEFAULT_LIMIT_FOR_QUERYING_PHOTOS,
  DEFAULT_LIMIT_FOR_QUERYING_AIRQLOUDS:
    process.env.DEFAULT_LIMIT_FOR_QUERYING_AIRQLOUDS,
  DEFAULT_EVENTS_LIMIT: process.env.DEFAULT_EVENTS_LIMIT,
  EVENTS_CACHE_LIMIT: process.env.EVENTS_CACHE_LIMIT,
  WHITE_SPACES_REGEX: /^\S*$/,
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
  EVENT_MAPPINGS: {
    item: {
      time: "time",
      day: "time",
      frequency: "frequency",
      tenant: "tenant",
      is_test_data: "is_test_data",
      is_device_primary: "is_device_primary",

      "pm2_5.value": "pm2_5.value",
      "pm2_5.calibratedValue": "pm2_5.calibratedValue",
      "pm2_5.uncertaintyValue": "pm2_5.uncertaintyValue",
      "pm2_5.standardDeviationValue": "pm2_5.standardDeviationValue",

      "s2_pm2_5.value": "s2_pm2_5.value",
      "s2_pm2_5.calibratedValue": "s2_pm2_5.calibratedValue",
      "s2_pm2_5.uncertaintyValue": "s2_pm2_5.uncertaintyValue",
      "s2_pm2_5.standardDeviationValue": "s2_pm2_5.standardDeviationValue",

      "pm10.value": "pm10.value",
      "pm10.calibratedValue": "pm10.calibratedValue",
      "pm10.uncertaintyValue": "pm10.uncertaintyValue",
      "pm10.standardDeviationValue": "pm10.standardDeviationValue",

      "s2_pm10.value": "s2_pm10.value",
      "s2_pm10.calibratedValue": "s2_pm10.calibratedValue",
      "s2_pm10.uncertaintyValue": "s2_pm10.uncertaintyValue",
      "s2_pm10.standardDeviationValue": "s2_pm10.standardDeviationValue",

      "pm1.value": "pm1.value",
      "pm1.calibratedValue": "pm1.calibratedValue",
      "pm1.uncertaintyValue": "pm1.uncertaintyValue",
      "pm1.standardDeviationValue": "pm1.standardDeviationValue",

      "location.latitude.value": "location.latitude.value",
      "location.longitude.value": "location.longitude.value",

      "no2.value": "no2.value",
      "no2.calibratedValue": "no2.calibratedValue",
      "no2.uncertaintyValue": "no2.uncertaintyValue",
      "no2.standardDeviationValue": "no2.standardDeviationValue",

      "pm1.value": "pm1.value",
      "pm1.calibratedValue": "pm1.calibratedValue",
      "pm1.uncertaintyValue": "pm1.uncertaintyValue",
      "pm1.standardDeviationValue": "pm1.standardDeviationValue",

      "internalTemperature.value": "internalTemperature.value",
      "externalTemperature.value": "externalTemperature.value",

      "internalHumidity.value": "internalHumidity.value",
      "externalHumidity.value": "externalHumidity.value",

      "externalPressure.value": "externalPressure.value",
      "internalPressure.value": "internalPressure.value",

      "speed.value": "speed.value",
      "altitude.value": "altitude.value",
      "battery.value": "battery.value",
      "satellites.value": "satellites.value",
      "hdop.value": "hdop.value",
    },
    remove: [],
    defaults: {
      time: null,
      tenant: null,
      device: null,
      device_id: null,
      site_id: null,
      day: null,
      frequency: null,
      site: null,
      device_number: null,
      is_test_data: null,
      is_device_primary: null,

      "pm10.value": null,
      "pm10.calibratedValue": null,
      "pm10.uncertaintyValue": null,
      "pm10.standardDeviationValue": null,

      "s2_pm10.value": null,
      "s2_pm10.calibratedValue": null,
      "s2_pm10.uncertaintyValue": null,
      "s2_pm10.standardDeviationValue": null,

      "pm2_5.value": null,
      "pm2_5.calibratedValue": null,
      "pm2_5.uncertaintyValue": null,
      "pm2_5.standardDeviationValue": null,

      "s2_pm2_5.value": null,
      "s2_pm2_5.calibratedValue": null,
      "s2_pm2_5.uncertaintyValue": null,
      "s2_pm2_5.standardDeviationValue": null,

      "location.latitude.value": null,
      "location.longitude.value": null,

      "no2.value": null,
      "no2.calibratedValue": null,
      "no2.uncertaintyValue": null,
      "no2.standardDeviationValue": null,

      "pm1.value": null,
      "pm1.calibratedValue": null,
      "pm1.uncertaintyValue": null,
      "pm1.standardDeviationValue": null,

      "internalTemperature.value": null,
      "externalTemperature.value": null,

      "internalHumidity.value": null,
      "externalHumidity.value": null,

      "externalPressure.value": null,
      "internalPressure.value": null,

      "speed.value": null,
      "altitude.value": null,
      "battery.value": null,
      "satellites.value": null,
      "hdop.value": null,
    },
    operate: [
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
    ],
    each: function(item, index, collection, context) {
      item.filter = {};
      item.update = {};
      item.options = {};
      item["filter"]["device_number"] = context.device_number
        ? context.device_number
        : null;
      item["filter"]["site"] = context.site ? context.site : null;
      item["filter"]["device_id"] = context.device_id
        ? context.device_id
        : null;
      item["filter"]["values.frequency"] = context.frequency
        ? context.frequency
        : null;
      item["filter"]["site_id"] = context.site_id ? context.site_id : null;
      item["filter"]["values.time"] = context.time ? context.time : null;
      item["filter"]["device"] = context.device ? context.device : null;
      item["filter"]["nValues"] = { $lt: defaultConfig.N_VALUES };
      item["filter"]["day"] = generateDateFormatWithoutHrs(context.time);
      item["update"]["$min"] = { first: context.time };
      item["update"]["$max"] = { last: context.time };
      item["update"]["$inc"] = { nValues: 1 };
      item["options"]["upsert"] = true;
      return item;
    },
  },
};

function envConfig(env) {
  switch (env) {
    case "development":
      return devConfig;
    case "staging":
      return stageConfig;
    default:
      return prodConfig;
  }
}

module.exports = { ...defaultConfig, ...envConfig(process.env.NODE_ENV) };
