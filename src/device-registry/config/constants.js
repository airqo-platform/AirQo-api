const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(`${this.ENVIRONMENT} -- constants-config`);

const devConfig = {
  DEFAULT_COHORT: process.env.DEV_DEFAULT_COHORT,
  MONGO_URI: process.env.MONGO_URI_DEV,
  DB_NAME: process.env.MONGO_DEV,
  REDIS_SERVER: process.env.REDIS_SERVER_DEV,
  REDIS_PORT: process.env.REDIS_PORT,
  KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS_DEV
    ? process.env.KAFKA_BOOTSTRAP_SERVERS_DEV.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  KAFKA_TOPICS: process.env.KAFKA_TOPICS_DEV,
  SCHEMA_REGISTRY: process.env.SCHEMA_REGISTRY_DEV,
  KAFKA_RAW_MEASUREMENTS_TOPICS: process.env.KAFKA_RAW_MEASUREMENTS_TOPICS_DEV,
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID_DEV,
  KAFKA_CLIENT_GROUP: process.env.KAFKA_CLIENT_GROUP_DEV,
  ENVIRONMENT: "DEVELOPMENT ENVIRONMENT",
  DATAWAREHOUSE_METADATA: process.env.DATAWAREHOUSE_METADATA_DEV,
  DATAWAREHOUSE_AVERAGED_DATA: process.env.DATAWAREHOUSE_AVERAGED_DATA_DEV,
};
const prodConfig = {
  DEFAULT_COHORT: process.env.PROD_DEFAULT_COHORT,
  MONGO_URI: process.env.MONGO_URI_PROD,
  DB_NAME: process.env.MONGO_PROD,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
  KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS_PROD
    ? process.env.KAFKA_BOOTSTRAP_SERVERS_PROD.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  KAFKA_TOPICS: process.env.KAFKA_TOPICS_PROD,
  SCHEMA_REGISTRY: process.env.SCHEMA_REGISTRY_PROD,
  KAFKA_RAW_MEASUREMENTS_TOPICS: process.env.KAFKA_RAW_MEASUREMENTS_TOPICS_PROD,
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID_PROD,
  KAFKA_CLIENT_GROUP: process.env.KAFKA_CLIENT_GROUP_PROD,
  ENVIRONMENT: "PRODUCTION ENVIRONMENT",
  DATAWAREHOUSE_METADATA: process.env.DATAWAREHOUSE_METADATA_PROD,
  DATAWAREHOUSE_AVERAGED_DATA: process.env.DATAWAREHOUSE_AVERAGED_DATA_PROD,
};
const stageConfig = {
  DEFAULT_COHORT: process.env.STAGE_DEFAULT_COHORT,
  MONGO_URI: process.env.MONGO_URI_STAGE,
  DB_NAME: process.env.MONGO_STAGE,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
  KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS_STAGE
    ? process.env.KAFKA_BOOTSTRAP_SERVERS_STAGE.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  KAFKA_TOPICS: process.env.KAFKA_TOPICS_STAGE,
  SCHEMA_REGISTRY: process.env.SCHEMA_REGISTRY_STAGE,
  KAFKA_RAW_MEASUREMENTS_TOPICS:
    process.env.KAFKA_RAW_MEASUREMENTS_TOPICS_STAGE,
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID_STAGE,
  KAFKA_CLIENT_GROUP: process.env.KAFKA_CLIENT_GROUP_STAGE,
  ENVIRONMENT: "STAGING ENVIRONMENT",
  DATAWAREHOUSE_METADATA: process.env.DATAWAREHOUSE_METADATA_STAGE,
  DATAWAREHOUSE_AVERAGED_DATA: process.env.DATAWAREHOUSE_AVERAGED_DATA_STAGE,
};

const defaultConfig = {
  SESSION_SECRET: process.env.SESSION_SECRET,
  NETWORKS: process.env.NETWORKS
    ? process.env.NETWORKS.split(",").filter((value) => value.trim() !== "")
    : [],
  ACTIVITY_TYPES: process.env.ACTIVITY_TYPES
    ? process.env.ACTIVITY_TYPES.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  RECALL_TYPES: process.env.RECALL_TYPES
    ? process.env.RECALL_TYPES.split(",").filter((value) => value.trim() !== "")
    : [],
  AQI_CATEGORIES: "good,moderate,u4sg,unhealthy,very_unhealthy,hazardous".split(
    ","
  ),
  MAINTENANCE_TYPES: process.env.MAINTENANCE_TYPES
    ? process.env.MAINTENANCE_TYPES.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  DEFAULT_NETWORK: process.env.DEFAULT_NETWORK,
  DEFAULT_TENANT: process.env.DEFAULT_TENANT,
  DEFAULT_NEAREST_SITE_RADIUS: process.env.DEFAULT_NEAREST_SITE_RADIUS,
  SLACK_TOKEN: process.env.SLACK_TOKEN,
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID,
  SLACK_CHANNEL: process.env.SLACK_CHANNEL,
  SLACK_USERNAME: process.env.SLACK_USERNAME,
  DATAWAREHOUSE_RAW_DATA: process.env.DATAWAREHOUSE_RAW_DATA,
  MOESIF_APPLICATION_ID: process.env.MOESIF_APPLICATION_ID,
  DOMAIN_WHITELIST: process.env.DOMAIN_WHITELIST
    ? process.env.DOMAIN_WHITELIST.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  BIG_QUERY_LOCATION: process.env.BIG_QUERY_LOCATION,
  TENANTS: process.env.TENANTS
    ? process.env.TENANTS.split(",").filter((value) => value.trim() !== "")
    : [],
  SITES_TOPIC: process.env.SITES_TOPIC,
  DEVICES_TOPIC: process.env.DEVICES_TOPIC,
  LOCATIONS_TOPIC: process.env.LOCATIONS_TOPIC,
  SENSORS_TOPIC: process.env.SENSORS_TOPIC,
  AIRQLOUDS_TOPIC: process.env.AIRQLOUDS_TOPIC,
  ACTIVITIES_TOPIC: process.env.ACTIVITIES_TOPIC,
  PHOTOS_TOPIC: process.env.PHOTOS_TOPIC,
  TIPS_TOPIC: process.env.TIPS_TOPIC,
  KYA_TOPIC: process.env.KYA_TOPIC,
  KYA_LESSON: process.env.KYA_LESSON,
  KYA_QUESTION: process.env.KYA_QUESTION,
  KYA_ANSWER: process.env.KYA_ANSWER,
  KYA_QUIZ: process.env.KYA_QUIZ,
  GRID_TOPIC: process.env.GRID_TOPIC,
  COHORT_TOPIC: process.env.COHORT_TOPIC,
  HOURLY_MEASUREMENTS_TOPIC: process.env.HOURLY_MEASUREMENTS_TOPIC,
  PORT: process.env.PORT || 3000,
  TAHMO_API_GET_STATIONS_URL: process.env.TAHMO_API_GET_STATIONS_URL,
  TAHMO_API_CREDENTIALS_USERNAME: process.env.TAHMO_API_CREDENTIALS_USERNAME,
  TAHMO_API_CREDENTIALS_PASSWORD: process.env.TAHMO_API_CREDENTIALS_PASSWORD,
  UNIQUE_CONSUMER_GROUP: process.env.UNIQUE_CONSUMER_GROUP,
  UNIQUE_PRODUCER_GROUP: process.env.UNIQUE_PRODUCER_GROUP,
  AQI_INDEX: {
    good: [0, 12],
    moderate: [12.1, 35.4],
    u4sg: [35.5, 55.4],
    unhealthy: [55.5, 150.4],
    very_unhealthy: [150.5, 250.4],
    hazardous: [250.5, 500],
  },
  GET_ROAD_METADATA_PATHS: {
    altitude: "altitude",
    greenness: "greenness",
    aspect: "aspect",
    landform_270: "landform-270",
    landform_90: "landform-90",
    bearing_to_capital_city: "bearing",
    distance_to_capital_city: "distance/capital",
    distance_to_nearest_road: "distance/road",
    distance_to_nearest_residential_road: "distance/residential/road",
    distance_to_nearest_tertiary_road: "distance/tertiary/road",
    distance_to_nearest_primary_road: "distance/primary/road",
    distance_to_nearest_secondary_road: "distance/secondary/road",
    distance_to_nearest_unclassified_road: "distance/unclassified/road",
    weather_stations: "nearest-weather-stations",
  },
  KEY_ENCRYPTION_KEY: process.env.KEY_ENCRYPTION_KEY,
  GET_ROAD_METADATA: ({
    path,
    latitude,
    longitude,
    endDate,
    startDate,
  } = {}) => {
    if (path === "greenness") {
      return `${process.env.PLATFORM_BASE_URL}/api/v1/meta-data/${path}?latitude=${latitude}&longitude=${longitude}&startDate=${startDate}&endDate=${endDate}`;
    }
    return `${process.env.PLATFORM_BASE_URL}/api/v1/meta-data/${path}?latitude=${latitude}&longitude=${longitude}`;
  },
  GET_ADDRESS_URL: (lat, long) => {
    return `${process.env.MAPS_GOOGLEAPIS_BASE_URL}/maps/api/geocode/json?latlng=${lat},${long}&key=${process.env.GCP_KEY}`;
  },
  GET_ELEVATION_URL: (lat, long) => {
    return `${process.env.MAPS_GOOGLEAPIS_BASE_URL}/maps/api/elevation/json?locations=${lat},${long}&key=${process.env.GCP_KEY}`;
  },
  CREATE_THING_URL: `${process.env.THINGSPEAK_BASE_URL}/channels.json?api_key=${process.env.TS_API_KEY}`,
  DELETE_THING_URL: (device) => {
    return `${process.env.THINGSPEAK_BASE_URL}/channels/${device}.json?api_key=${process.env.TS_API_KEY}`;
  },
  CLEAR_THING_URL: (device) => {
    return `${process.env.THINGSPEAK_BASE_URL}/channels/${device}/feeds.json?api_key=${process.env.TS_API_KEY}`;
  },
  UPDATE_THING: (device) => {
    return `${process.env.THINGSPEAK_BASE_URL}/channels/${device}.json?api_key=${process.env.TS_API_KEY}`;
  },
  ADD_VALUE: (field, value, apiKey) => {
    return `${process.env.THINGSPEAK_BASE_URL}/update.json?api_key=${apiKey}&${field}=${value}`;
  },
  ADD_VALUE_JSON: `${process.env.THINGSPEAK_BASE_URL}/update.json`,
  BULK_ADD_VALUES_JSON: (channel) => {
    return `${process.env.THINGSPEAK_BASE_URL}/channels/${channel}/bulk_update.json`;
  },
  ADD_VALUES: (device) => {
    return `${process.env.THINGSPEAK_BASE_URL}/channels/${device}/bulk_update.json`;
  },
  JWT_SECRET: process.env.JWT_SECRET,
  REGION: "europe-west1",
  MQTT_BRIDGE_HOST_NAME: "mqtt.googleapis.com",
  MQTT_BRIDGE_PORT: 8883,
  NUM_MESSAGES: 5,
  TOKEN_EXP_MINS: 360,
  MESSAGE_TYPE: "events",
  MINIMUM_BACKOFF_TIME: 1,
  MAXIMUM_BACKOFF_TIME: 32,
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
  N_VALUES: process.env.N_VALUES,
  LATITUDE_REGEX: /^(-?[1-8]?\d(?:\.\d{1,18})?|90(?:\.0{1,18})?)$/,
  LONGITUDE_REGEX: /^(-?(?:1[0-7]|[1-9])?\d(?:\.\d{1,18})?|180(?:\.0{1,18})?)$/,
  DEFAULT_LIMIT_FOR_QUERYING_SITES:
    process.env.DEFAULT_LIMIT_FOR_QUERYING_SITES,
  DEFAULT_LIMIT_FOR_QUERYING_PHOTOS:
    process.env.DEFAULT_LIMIT_FOR_QUERYING_PHOTOS,
  DEFAULT_LIMIT_FOR_QUERYING_TIPS: process.env.DEFAULT_LIMIT_FOR_QUERYING_TIPS,
  DEFAULT_LIMIT_FOR_QUERYING_KYA_TASKS:
    process.env.DEFAULT_LIMIT_FOR_QUERYING_KYA_TASKS,
  DEFAULT_LIMIT_FOR_QUERYING_KYA_LESSONS:
    process.env.DEFAULT_LIMIT_FOR_QUERYING_KYA_LESSONS,
  DEFAULT_LIMIT_FOR_QUERYING_KYA_QUESTIONS:
    process.env.DEFAULT_LIMIT_FOR_QUERYING_KYA_QUESTIONS,
  DEFAULT_LIMIT_FOR_QUERYING_KYA_ANSWERS:
    process.env.DEFAULT_LIMIT_FOR_QUERYING_KYA_ANSWERS,
  DEFAULT_LIMIT_FOR_QUERYING_KYA_QUIZZES:
    process.env.DEFAULT_LIMIT_FOR_QUERYING_KYA_QUIZZES,
  DEFAULT_LIMIT_FOR_QUERYING_AIRQLOUDS:
    process.env.DEFAULT_LIMIT_FOR_QUERYING_AIRQLOUDS,
  DEFAULT_EVENTS_LIMIT: process.env.DEFAULT_EVENTS_LIMIT,
  DEFAULT_EVENTS_SKIP: process.env.DEFAULT_EVENTS_SKIP,
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

      "pm2_5.value": "pm2_5_raw_value",
      "pm2_5.calibratedValue": "pm2_5_calibrated_value",
      "pm2_5.uncertaintyValue": "pm2_5_uncertainty_value",
      "pm2_5.standardDeviationValue": "pm2_5_standard_deviation_value",

      "average_pm2_5.value": "pm2_5_raw_value",
      "average_pm2_5.calibratedValue": "pm2_5_calibrated_value",
      "average_pm2_5.uncertaintyValue": "pm2_5_uncertainty_value",
      "average_pm2_5.standardDeviationValue": "pm2_5_standard_deviation_value",

      "average_pm10.value": "pm10_raw_value",
      "average_pm10.calibratedValue": "pm10_calibrated_value",
      "average_pm10.uncertaintyValue": "pm10_uncertainty_value",
      "average_pm10.standardDeviationValue": "pm10_standard_deviation_value",

      "s1_pm2_5.value": "s1_pm2_5",
      "s1_pm2_5.calibratedValue": "s1_pm2_5_calibrated_value",
      "s1_pm2_5.uncertaintyValue": "s1_pm2_5_uncertainty_value",
      "s1_pm2_5.standardDeviationValue": "s1_pm2_5_standard_deviation_value",

      "s2_pm2_5.value": "s2_pm2_5",
      "s2_pm2_5.calibratedValue": "s2_pm2_5_calibrated_value",
      "s2_pm2_5.uncertaintyValue": "s2_pm2_5_uncertainty_value",
      "s2_pm2_5.standardDeviationValue": "s2_pm2_5_standard_deviation_value",

      "pm10.value": "pm10_raw_value",
      "pm10.calibratedValue": "pm10_calibrated_value",
      "pm10.uncertaintyValue": "pm10_uncertainty_value",
      "pm10.standardDeviationValue": "pm10_standard_deviation_value",

      "s1_pm10.value": "s1_pm10",
      "s1_pm10.calibrated_value": "s1_pm10_calibrated_value",
      "s1_pm10.uncertainty_value": "s1_pm10_uncertainty_value",
      "s1_pm10.standard_deviation_value": "s1_pm10_standard_deviation_value",

      "s2_pm10.value": "s2_pm10",
      "s2_pm10.calibratedValue": "s2_pm10_calibrated_value",
      "s2_pm10.uncertaintyValue": "s2_pm10_uncertainty_value",
      "s2_pm10.standardDeviationValue": "s2_pm10_standard_deviation_value",

      "pm1.value": "pm1_raw_value",
      "pm1.calibratedValue": "pm1_calibrated_value",
      "pm1.uncertaintyValue": "pm1_uncertainty_value",
      "pm1.standardDeviationValue": "pm1_standard_deviation_value",

      "s1_pm1.value": "s1_pm1",
      "s1_pm1.calibratedValue": "s1_pm1_calibrated_value",
      "s1_pm1.uncertaintyValue": "s1_pm1_uncertainty_value",
      "s1_pm1.standardDeviationValue": "s1_pm1_standard_deviation_value",

      "s2_pm1.value": "s2_pm1",
      "s2_pm1.calibratedValue": "s2_pm1_calibrated_value",
      "s2_pm1.uncertaintyValue": "s2_pm1_uncertainty_value",
      "s2_pm1.standardDeviationValue": "s2_pm1_standard_deviation_value",

      "latitude.value": "latitude",
      "longitude.value": "longitude",

      "no2.value": "no2_raw_value",
      "no2.calibratedValue": "no2_calibrated_value",
      "no2.uncertaintyValue": "no2_uncertainty_value",
      "no2.standardDeviationValue": "no2_standard_deviation_value",

      "pm1.value": "pm1_raw_value",
      "pm1.calibratedValue": "pm1_calibrated_value",
      "pm1.uncertaintyValue": "pm1_uncertainty_value",
      "pm1.standardDeviationValue": "pm1_standard_deviation_value",

      "s1_pm1.value": "s1_pm1",
      "s1_pm1.calibratedValue": "s1_pm1_calibrated_value",
      "s1_pm1.uncertaintyValue": "s1_pm1_uncertainty_value",
      "s1_pm1.standardDeviationValue": "s1_pm1_standard_deviation_value",

      "rtc_adc.value": "rtc_adc",
      "rtc_adc.calibratedValue": "rtc_adc_calibrated_value",
      "rtc_adc.uncertaintyValue": "rtc_adc_uncertainty_value",
      "rtc_adc.standardDeviationValue": "rtc_adc_standard_deviation_value",

      "rtc_v.value": "rtc_v",
      "rtc_v.calibratedValue": "rtc_v_calibrated_value",
      "rtc_v.uncertaintyValue": "rtc_v_uncertainty_value",
      "rtc_v.standardDeviationValue": "rtc_v_standard_deviation_value",

      "rtc.value": "rtc",
      "rtc.calibratedValue": "rtc_calibrated_value",
      "rtc.uncertaintyValue": "rtc_uncertainty_value",
      "rtc.standardDeviationValue": "rtc_standard_deviation_value",

      "stc_adc.value": "stc_adc",
      "stc_adc.calibratedValue": "stc_adc_calibrated_value",
      "stc_adc.uncertaintyValue": "stc_adc_uncertainty_value",
      "stc_adc.standardDeviationValue": "stc_adc_standard_deviation_value",

      "stc_v.value": "stc_v",
      "stc_v.calibratedValue": "stc_v_calibrated_value",
      "stc_v.uncertaintyValue": "stc_v_uncertainty_value",
      "stc_v.standardDeviationValue": "stc_v_standard_deviation_value",

      "stc.value": "stc",
      "stc.calibratedValue": "stc_calibrated_value",
      "stc.uncertaintyValue": "stc_uncertainty_value",
      "stc.standardDeviationValue": "stc_standard_deviation_value",

      "s2_pm1.value": "s2_pm1",
      "s2_pm1.calibratedValue": "s2_pm1_calibrated_value",
      "s2_pm1.uncertaintyValue": "s2_pm1_uncertainty_value",
      "s2_pm1.standardDeviationValue": "s2_pm1_standard_deviation_value",

      "internalTemperature.value": "device_temperature",
      "externalTemperature.value": "temperature",

      "internalHumidity.value": "device_humidity",
      "externalHumidity.value": "humidity",

      "externalPressure.value": "external_pressure",
      "internalPressure.value": "internal_pressure",

      "speed.value": "wind_speed",
      "altitude.value": "altitude",
      "battery.value": "battery",
      "satellites.value": "satellites",
      "hdop.value": "hdop",
    },
    remove: [],
    defaults: {
      time: null,
      tenant: "airqo",
      network: "airqo",
      device: null,
      device_id: null,
      site_id: null,
      day: null,
      frequency: "hourly",
      site: null,
      device_number: null,
      is_test_data: null,
      is_device_primary: null,

      "pm10.value": null,
      "pm10.calibratedValue": null,
      "pm10.uncertaintyValue": null,
      "pm10.standardDeviationValue": null,

      "average_pm2_5.value": null,
      "average_pm2_5.calibratedValue": null,
      "average_pm2_5.uncertaintyValue": null,
      "average_pm2_5.standardDeviationValue": null,

      "average_pm10.value": null,
      "average_pm10.calibratedValue": null,
      "average_pm10.uncertaintyValue": null,
      "average_pm10.standardDeviationValue": null,

      "s1_pm10.value": null,
      "s1_pm10.calibratedValue": null,
      "s1_pm10.uncertaintyValue": null,
      "s1_pm10.standardDeviationValue": null,

      "s2_pm10.value": null,
      "s2_pm10.calibratedValue": null,
      "s2_pm10.uncertaintyValue": null,
      "s2_pm10.standardDeviationValue": null,

      "pm2_5.value": null,
      "pm2_5.calibratedValue": null,
      "pm2_5.uncertaintyValue": null,
      "pm2_5.standardDeviationValue": null,

      "s1_pm2_5.value": null,
      "s1_pm2_5.calibratedValue": null,
      "s1_pm2_5.uncertaintyValue": null,
      "s1_pm2_5.standardDeviationValue": null,

      "s2_pm2_5.value": null,
      "s2_pm2_5.calibratedValue": null,
      "s2_pm2_5.uncertaintyValue": null,
      "s2_pm2_5.standardDeviationValue": null,

      "latitude.value": null,
      "longitude.value": null,

      "no2.value": null,
      "no2.calibratedValue": null,
      "no2.uncertaintyValue": null,
      "no2.standardDeviationValue": null,

      "pm1.value": null,
      "pm1.calibratedValue": null,
      "pm1.uncertaintyValue": null,
      "pm1.standardDeviationValue": null,

      "s1_pm1.value": null,
      "s1_pm1.calibratedValue": null,
      "s1_pm1.uncertaintyValue": null,
      "s1_pm1.standardDeviationValue": null,

      "s2_pm1.value": null,
      "s2_pm1.calibratedValue": null,
      "s2_pm1.uncertaintyValue": null,
      "s2_pm1.standardDeviationValue": null,

      "internalTemperature.value": null,
      "externalTemperature.value": null,

      "internalHumidity.value": null,
      "externalHumidity.value": null,

      "externalPressure.value": null,
      "internalPressure.value": null,

      "rtc_adc.value": null,
      "rtc_adc.calibratedValue": null,
      "rtc_adc.uncertaintyValue": null,
      "rtc_adc.standardDeviationValue": null,

      "rtc_v.value": null,
      "rtc_v.calibratedValue": null,
      "rtc_v.uncertaintyValue": null,
      "rtc_v.standardDeviationValue": null,

      "rtc.value": null,
      "rtc.calibratedValue": null,
      "rtc.uncertaintyValue": null,
      "rtc.standardDeviationValue": null,

      "stc_adc.value": null,
      "stc_adc.calibratedValue": null,
      "stc_adc.uncertaintyValue": null,
      "stc_adc.standardDeviationValue": null,

      "stc_v.value": null,
      "stc_v.calibratedValue": null,
      "stc_v.uncertaintyValue": null,
      "stc_v.standardDeviationValue": null,

      "stc.value": null,
      "stc.calibratedValue": null,
      "stc.uncertaintyValue": null,
      "stc.standardDeviationValue": null,

      "speed.value": null,
      "altitude.value": null,
      "battery.value": null,
      "satellites.value": null,
      "hdop.value": null,
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
      item["filter"]["nValues"] = { $lt: parseInt(defaultConfig.N_VALUES) };
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
  EVENTS_METADATA_PROJECTION: (entity, as) => {
    if (entity === "device") {
      let projection = {};
      projection[as] = {};
      projection[as]["ISP"] = 0;
      projection[as]["height"] = 0;
      projection[as]["device_number"] = 0;
      projection[as]["description"] = 0;
      projection[as]["isUsedForCollocation"] = 0;
      projection[as]["powerType"] = 0;
      projection[as]["mountType"] = 0;
      projection[as]["createdAt"] = 0;
      projection[as]["updatedAt"] = 0;
      projection[as]["isActive"] = 0;
      projection[as]["site_id"] = 0;
      projection[as]["long_name"] = 0;
      projection[as]["readKey"] = 0;
      projection[as]["writeKey"] = 0;
      projection[as]["phoneNumber"] = 0;
      projection[as]["deployment_date"] = 0;
      projection[as]["nextMaintenance"] = 0;
      projection[as]["recall_date"] = 0;
      projection[as]["maintenance_date"] = 0;
      projection[as]["siteName"] = 0;
      projection[as]["locationName"] = 0;
      projection[as]["device_manufacturer"] = 0;
      projection[as]["product_name"] = 0;
      projection[as]["visibility"] = 0;
      projection[as]["owner"] = 0;
      return projection;
    } else if (entity === "site") {
      let projection = {};
      projection[as] = {};
      projection[as]["nearest_tahmo_station"] = 0;
      projection[as]["site_tags"] = 0;
      projection[as]["formatted_name"] = 0;
      projection[as]["geometry"] = 0;
      projection[as]["google_place_id"] = 0;
      projection[as]["town"] = 0;
      projection[as]["city"] = 0;
      projection[as]["county"] = 0;
      projection[as]["lat_long"] = 0;
      projection[as]["altitude"] = 0;
      projection[as]["updatedAt"] = 0;
      projection[as]["airqloud_id"] = 0;
      projection[as]["weather_stations"] = 0;
      projection[as]["sub_county"] = 0;
      projection[as]["parish"] = 0;
      projection[as]["greenness"] = 0;
      projection[as]["landform_90"] = 0;
      projection[as]["landform_270"] = 0;
      projection[as]["aspect"] = 0;
      projection[as]["distance_to_nearest_road"] = 0;
      projection[as]["distance_to_nearest_primary_road"] = 0;
      projection[as]["distance_to_nearest_tertiary_road"] = 0;
      projection[as]["distance_to_nearest_unclassified_road"] = 0;
      projection[as]["distance_to_nearest_residential_road"] = 0;
      projection[as]["bearing_to_capital_city"] = 0;
      projection[as]["street"] = 0;
      projection[as]["village"] = 0;
      projection[as]["distance_to_nearest_secondary_road"] = 0;
      projection[as]["distance_to_capital_city"] = 0;
      return projection;
    } else if (entity === "brief_site") {
      let projection = {};
      projection[as] = {};
      projection[as]["nearest_tahmo_station"] = 0;
      projection[as]["site_tags"] = 0;
      projection[as]["geometry"] = 0;
      projection[as]["google_place_id"] = 0;
      projection[as]["lat_long"] = 0;
      projection[as]["altitude"] = 0;
      projection[as]["updatedAt"] = 0;
      projection[as]["airqloud_id"] = 0;
      projection[as]["weather_stations"] = 0;
      projection[as]["greenness"] = 0;
      projection[as]["landform_90"] = 0;
      projection[as]["landform_270"] = 0;
      projection[as]["aspect"] = 0;
      projection[as]["distance_to_nearest_road"] = 0;
      projection[as]["distance_to_nearest_primary_road"] = 0;
      projection[as]["distance_to_nearest_tertiary_road"] = 0;
      projection[as]["distance_to_nearest_unclassified_road"] = 0;
      projection[as]["distance_to_nearest_residential_road"] = 0;
      projection[as]["bearing_to_capital_city"] = 0;
      projection[as]["longitude"] = 0;
      projection[as]["latitude"] = 0;
      projection[as]["land_use"] = 0;
      projection[as]["site_codes"] = 0;
      projection[as]["images"] = 0;
      projection[as]["_id"] = 0;
      projection[as]["airqlouds"] = 0;
      projection[as]["generated_name"] = 0;
      projection[as]["createdAt"] = 0;
      projection[as]["updatedAt"] = 0;
      projection[as]["__v"] = 0;
      projection[as]["network"] = 0;
      projection[as]["approximate_distance_in_km"] = 0;
      projection[as]["distance_to_nearest_secondary_road"] = 0;
      projection[as]["distance_to_capital_city"] = 0;
      return projection;
    } else {
      return {};
    }
  },
  SITES_INCLUSION_PROJECTION: {
    _id: 1,
    name: 1,
    latitude: 1,
    longitude: 1,
    grids: 1,
    approximate_latitude: 1,
    approximate_longitude: 1,
    approximate_distance_in_km: 1,
    bearing_in_radians: 1,
    description: 1,
    site_tags: 1,
    site_codes: 1,
    search_name: 1,
    location_name: 1,
    lat_long: 1,
    country: 1,
    network: 1,
    data_provider: 1,
    district: 1,
    sub_county: 1,
    parish: 1,
    region: 1,
    village: 1,
    city: 1,
    street: 1,
    generated_name: 1,
    county: 1,
    altitude: 1,
    greenness: 1,
    landform_270: 1,
    landform_90: 1,
    aspect: 1,
    status: 1,
    images: 1,
    share_links: 1,
    distance_to_nearest_road: 1,
    distance_to_nearest_primary_road: 1,
    distance_to_nearest_secondary_road: 1,
    distance_to_nearest_tertiary_road: 1,
    distance_to_nearest_unclassified_road: 1,
    distance_to_nearest_residential_road: 1,
    bearing_to_capital_city: 1,
    distance_to_capital_city: 1,
    createdAt: 1,
    nearest_tahmo_station: 1,
    devices: "$devices",
    airqlouds: "$airqlouds",
    weather_stations: 1,
  },
  SITES_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = {
      "airqlouds.location": 0,
      "airqlouds.airqloud_tags": 0,
      "airqlouds.long_name": 0,
      "airqlouds.updatedAt": 0,
      "airqlouds.sites": 0,
      "airqlouds.__v": 0,
      "devices.height": 0,
      "devices.__v": 0,
      "devices.phoneNumber": 0,
      "devices.mountType": 0,
      "devices.powerType": 0,
      "devices.generation_version": 0,
      "devices.generation_count": 0,
      "devices.pictures": 0,
      "devices.tags": 0,
      "devices.description": 0,
      "devices.isUsedForCollocation": 0,
      "devices.updatedAt": 0,
      "devices.locationName": 0,
      "devices.siteName": 0,
      "devices.site_id": 0,
      "devices.isRetired": 0,
      "devices.long_name": 0,
      "devices.nextMaintenance": 0,
      "devices.readKey": 0,
      "devices.writeKey": 0,
      "devices.deployment_date": 0,
      "devices.recall_date": 0,
      "devices.maintenance_date": 0,
      "devices.product_name": 0,
      "devices.owner": 0,
      "devices.device_manufacturer": 0,
      "devices.channelID": 0,
      "grids.network_id": 0,
      "grids.geoHash": 0,
      "grids.center_point": 0,
      "grids.long_name": 0,
      "grids.description": 0,
      "grids.grid_tags": 0,
      "grids.grid_codes": 0,
      "grids.shape": 0,
    };

    let projection = Object.assign({}, initialProjection);

    if (category === "summary") {
      projection = Object.assign(projection, {
        nearest_tahmo_station: 0,
        images: 0,
        site_codes: 0,
        site_tags: 0,
        city: 0,
        county: 0,
        latitude: 0,
        longitude: 0,
        network: 0,
        approximate_latitude: 0,
        parish: 0,
        village: 0,
        sub_county: 0,
        street: 0,
        approximate_longitude: 0,
        bearing_in_radians: 0,
        approximate_distance_in_km: 0,
        lat_long: 0,
        altitude: 0,
        distance_to_capital_city: 0,
        distance_to_nearest_primary_road: 0,
        distance_to_nearest_residential_road: 0,
        distance_to_nearest_road: 0,
        distance_to_nearest_secondary_road: 0,
        distance_to_nearest_tertiary_road: 0,
        distance_to_nearest_unclassified_road: 0,
        aspect: 0,
        bearing_to_capital_city: 0,
        landform_270: 0,
        landform_90: 0,
        location_name: 0,
        search_name: 0,
        weather_stations: 0,
        greenness: 0,
        createdAt: 0,
        "devices.visibility": 0,
        "devices.mobility": 0,
        "devices.device_codes": 0,
        "devices.status": 0,
        "devices.isPrimaryInLocation": 0,
        "devices.category": 0,
        "devices.isActive": 0,
        "devices.device_number": 0,
        "devices.network": 0,
        "devices.createdAt": 0,
        "devices.approximate_distance_in_km": 0,
        "devices.bearing_in_radians": 0,
        "devices.latitude": 0,
        "devices.longitude": 0,
        "devices.previous_sites": 0,
        "airqlouds.nearest_tahmo_station": 0,
        "airqlouds.images": 0,
        "airqlouds.site_codes": 0,
        "airqlouds.site_tags": 0,
        "airqlouds.city": 0,
        "airqlouds.district": 0,
        "airqlouds.county": 0,
        "airqlouds.region": 0,
        "airqlouds.country": 0,
        "airqlouds.latitude": 0,
        "airqlouds.longitude": 0,
        "airqlouds.network": 0,
        "airqlouds.approximate_latitude": 0,
        "airqlouds.approximate_longitude": 0,
        "airqlouds.bearing_in_radians": 0,
        "airqlouds.approximate_distance_in_km": 0,
        "airqlouds.lat_long": 0,
        "airqlouds.generated_name": 0,
        "airqlouds.altitude": 0,
        "airqlouds.description": 0,
        "airqlouds.weather_stations": 0,
        "airqlouds.createdAt": 0,
        "airqlouds.devices": 0,
      });
    }
    return projection;
  },

  DEVICES_INCLUSION_PROJECTION: {
    _id: 1,
    name: 1,
    alias: 1,
    long_name: 1,
    latitude: 1,
    longitude: 1,
    approximate_distance_in_km: 1,
    bearing_in_radians: 1,
    createdAt: 1,
    ISP: 1,
    phoneNumber: 1,
    visibility: 1,
    description: 1,
    isPrimaryInLocation: 1,
    nextMaintenance: 1,
    deployment_date: 1,
    name_id: 1,
    recall_date: 1,
    maintenance_date: 1,
    device_number: 1,
    powerType: 1,
    mountType: 1,
    isActive: 1,
    writeKey: 1,
    readKey: 1,
    access_code: 1,
    device_codes: 1,
    height: 1,
    mobility: 1,
    status: 1,
    network: 1,
    category: 1,
    cohorts: 1,
    previous_sites: 1,
    site: { $arrayElemAt: ["$site", 0] },
    host: { $arrayElemAt: ["$host", 0] },
  },
  DEVICES_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = {
      "site.lat_long": 0,
      "site.country": 0,
      "site.district": 0,
      "site.sub_county": 0,
      "site.parish": 0,
      "site.county": 0,
      "site.altitude": 0,
      "site.altitude": 0,
      "site.greenness": 0,
      "site.landform_90": 0,
      "site.landform_270": 0,
      "site.aspect": 0,
      "site.distance_to_nearest_road": 0,
      "site.distance_to_nearest_primary_road": 0,
      "site.distance_to_nearest_secondary_road": 0,
      "site.distance_to_nearest_tertiary_road": 0,
      "site.distance_to_nearest_unclassified_road": 0,
      "site.distance_to_nearest_residential_road": 0,
      "site.bearing_to_capital_city": 0,
      "site.distance_to_capital_city": 0,
      "site.generated_name": 0,
      "site.updatedAt": 0,
      "site.updatedAt": 0,
      "site.city": 0,
      "site.formatted_name": 0,
      "site.geometry": 0,
      "site.google_place_id": 0,
      "site.region": 0,
      "site.site_tags": 0,
      "site.street": 0,
      "site.town": 0,
      "site.nearest_tahmo_station": 0,
      "site.__v": 0,
      "site.images": 0,
      "site.airqlouds": 0,
      "site.site_codes": 0,
      "site.land_use": 0,
      "site.latitude": 0,
      "site.longitude": 0,
      "site.approximate_latitude": 0,
      "site.approximate_longitude": 0,
      "site.description": 0,
      "site.network": 0,
      "site.weather_stations": 0,
      "site.createdAt": 0,
      "site.bearing_in_radians": 0,
      "site.approximate_distance_in_km": 0,
      "previous_sites.lat_long": 0,
      "previous_sites.country": 0,
      "previous_sites.district": 0,
      "previous_sites.sub_county": 0,
      "previous_sites.parish": 0,
      "previous_sites.county": 0,
      "previous_sites.altitude": 0,
      "previous_sites.altitude": 0,
      "previous_sites.greenness": 0,
      "previous_sites.landform_90": 0,
      "previous_sites.landform_270": 0,
      "previous_sites.aspect": 0,
      "previous_sites.distance_to_nearest_road": 0,
      "previous_sites.distance_to_nearest_primary_road": 0,
      "previous_sites.distance_to_nearest_secondary_road": 0,
      "previous_sites.distance_to_nearest_tertiary_road": 0,
      "previous_sites.distance_to_nearest_unclassified_road": 0,
      "previous_sites.distance_to_nearest_residential_road": 0,
      "previous_sites.bearing_to_capital_city": 0,
      "previous_sites.distance_to_capital_city": 0,
      "previous_sites.generated_name": 0,
      "previous_sites.updatedAt": 0,
      "previous_sites.updatedAt": 0,
      "previous_sites.city": 0,
      "previous_sites.formatted_name": 0,
      "previous_sites.geometry": 0,
      "previous_sites.google_place_id": 0,
      "previous_sites.region": 0,
      "previous_sites.previous_sites_tags": 0,
      "previous_sites.street": 0,
      "previous_sites.town": 0,
      "previous_sites.nearest_tahmo_station": 0,
      "previous_sites.__v": 0,
      "previous_sites.weather_stations": 0,
      "previous_sites.latitude": 0,
      "previous_sites.longitude": 0,
      "previous_sites.images": 0,
      "previous_sites.airqlouds": 0,
      "previous_sites.site_codes": 0,
      "previous_sites.site_tags": 0,
      "previous_sites.land_use": 0,
      "previous_sites.approximate_latitude": 0,
      "previous_sites.approximate_longitude": 0,
      "previous_sites.bearing_in_radians": 0,
      "previous_sites.approximate_distance_in_km": 0,
      "previous_sites.description": 0,
      "previous_sites.network": 0,
      "previous_sites.createdAt": 0,
      "cohorts.network_id": 0,
      "cohorts.description": 0,
      "cohorts.cohort_tags": 0,
      "cohorts.cohort_codes": 0,
      "cohorts.visibility": 0,
      "cohorts.network": 0,
      "cohorts.createdAt": 0,
      "cohorts.updatedAt": 0,
      "cohorts.__v": 0,
    };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign(initialProjection, {
        alias: 0,
        latitude: 0,
        longitude: 0,
        approximate_distance_in_km: 0,
        bearing_in_radians: 0,
        ISP: 0,
        phoneNumber: 0,
        visibility: 0,
        description: 0,
        isPrimaryInLocation: 0,
        nextMaintenance: 0,
        deployment_date: 0,
        name_id: 0,
        recall_date: 0,
        maintenance_date: 0,
        device_number: 0,
        powerType: 0,
        mountType: 0,
        isActive: 0,
        writeKey: 0,
        readKey: 0,
        access_code: 0,
        device_codes: 0,
        height: 0,
        mobility: 0,
        network: 0,
        category: 0,
        host: 0,
      });
    }
    return projection;
  },

  GRIDS_INCLUSION_PROJECTION: {
    _id: 1,
    name: 1,
    long_name: 1,
    description: 1,
    grid_tags: 1,
    visibility: 1,
    admin_level: 1,
    grid_codes: 1,
    centers: 1,
    shape: 1,
    network: 1,
    sites: "$sites",
    numberOfSites: {
      $cond: {
        if: { $isArray: "$sites" },
        then: { $size: { $ifNull: ["$sites._id", []] } },
        else: "NA",
      },
    },
  },
  GRIDS_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = {
      "sites.altitude": 0,
      "sites.greenness": 0,
      "sites.landform_90": 0,
      "sites.landform_270": 0,
      "sites.aspect": 0,
      "sites.distance_to_nearest_road": 0,
      "sites.distance_to_nearest_primary_road": 0,
      "sites.distance_to_nearest_secondary_road": 0,
      "sites.distance_to_nearest_tertiary_road": 0,
      "sites.distance_to_nearest_unclassified_road": 0,
      "sites.distance_to_nearest_residential_road": 0,
      "sites.bearing_to_capital_city": 0,
      "sites.distance_to_capital_city": 0,
      "sites.updatedAt": 0,
      "sites.nearest_tahmo_station": 0,
      "sites.formatted_name": 0,
      "sites.geometry": 0,
      "sites.google_place_id": 0,
      "sites.site_tags": 0,
      "sites.street": 0,
      "sites.town": 0,
      "sites.village": 0,
      "sites.airqlouds": 0,
      "sites.description": 0,
      "sites.__v": 0,
      "sites.airqloud_id": 0,
      "sites.createdAt": 0,
      "sites.lat_long": 0,
      "sites.weather_stations": 0,
      "sites.site_codes": 0,
      "sites.network": 0,
      "sites.grids": 0,
    };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign(initialProjection, {
        shape: 0,
        grid_tags: 0,
        grid_codes: 0,
        centers: 0,
      });
    }
    return projection;
  },

  COHORTS_INCLUSION_PROJECTION: {
    network: 1,
    name: 1,
    description: 1,
    cohort_tags: 1,
    visibility: 1,
    cohort_codes: 1,
    devices: "$devices",
    numberOfDevices: {
      $cond: {
        if: { $isArray: "$devices" },
        then: { $size: { $ifNull: ["$devices._id", []] } },
        else: "NA",
      },
    },
  },
  COHORTS_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = {
      nothing: 0,
      "devices.ISP": 0,
      "devices.device_manufacturer": 0,
      "devices.height": 0,
      "devices.isActive": 0,
      "devices.isPrimaryInLocation": 0,
      "devices.latitude": 0,
      "devices.locationName": 0,
      "devices.longitude": 0,
      "devices.mobility": 0,
      "devices.mountType": 0,
      "devices.nextMaintenance": 0,
      "devices.owner": 0,
      "devices.phoneNumber": 0,
      "devices.powerType": 0,
      "devices.product_name": 0,
      "devices.isRetired": 0,
      "devices.updatedAt": 0,
      "devices.visibility": 0,
      "devices.site_id": 0,
      "devices.readKey": 0,
      "devices.writeKey": 0,
      "devices.deployment_date": 0,
      "devices.isUsedForCollocation": 0,
      "devices.recall_date": 0,
      "devices.siteName": 0,
      "devices.maintenance_date": 0,
      "devices.device_codes": 0,
      "devices.alias": 0,
      "devices.cohorts": 0,
      "devices.generation_version": 0,
      "devices.generation_count": 0,
      "devices.tags": 0,
      "devices.category": 0,
      "devices.pictures": 0,
      "devices.__v": 0,
      "devices.approximate_distance_in_km": 0,
      "devices.bearing_in_radians": 0,
      "devices.previous_sites": 0,
      "devices.host_id": 0,
      "devices.site.lat_long": 0,
      "devices.site.country": 0,
      "devices.site.district": 0,
      "devices.site.sub_county": 0,
      "devices.site.parish": 0,
      "devices.site.county": 0,
      "devices.site.altitude": 0,
      "devices.site.altitude": 0,
      "devices.site.greenness": 0,
      "devices.site.landform_90": 0,
      "devices.site.landform_270": 0,
      "devices.site.aspect": 0,
      "devices.site.distance_to_nearest_road": 0,
      "devices.site.distance_to_nearest_primary_road": 0,
      "devices.site.distance_to_nearest_secondary_road": 0,
      "devices.site.distance_to_nearest_tertiary_road": 0,
      "devices.site.distance_to_nearest_unclassified_road": 0,
      "devices.site.distance_to_nearest_residential_road": 0,
      "devices.site.bearing_to_capital_city": 0,
      "devices.site.distance_to_capital_city": 0,
      "devices.site.generated_name": 0,
      "devices.site.updatedAt": 0,
      "devices.site.updatedAt": 0,
      "devices.site.city": 0,
      "devices.site.formatted_name": 0,
      "devices.site.geometry": 0,
      "devices.site.google_place_id": 0,
      "devices.site.region": 0,
      "devices.site.site_tags": 0,
      "devices.site.street": 0,
      "devices.site.town": 0,
      "devices.site.nearest_tahmo_station": 0,
      "devices.site.images": 0,
      "devices.site.airqlouds": 0,
      "devices.site.site_codes": 0,
      "devices.site.land_use": 0,
      "devices.site.latitude": 0,
      "devices.site.longitude": 0,
      "devices.site.approximate_latitude": 0,
      "devices.site.approximate_longitude": 0,
      "devices.site.bearing_in_radians": 0,
      "devices.site.approximate_distance_in_km": 0,
      "devices.site.description": 0,
      "devices.site.network": 0,
      "devices.site.weather_stations": 0,
      "devices.site.createdAt": 0,
      "devices.site.__v": 0,
    };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },

  AIRQLOUDS_INCLUSION_PROJECTION: {
    _id: 1,
    name: 1,
    long_name: 1,
    admin_level: 1,
    location: 1,
    airqloud_codes: 1,
    numberOfSites: {
      $cond: {
        if: { $isArray: "$sites" },
        then: { $size: "$sites" },
        else: "NA",
      },
    },
    description: 1,
    airqloud_tags: 1,
    isCustom: 1,
    metadata: 1,
    center_point: 1,
    sites: "$sites",
  },
  AIRQLOUDS_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = {
      "sites.altitude": 0,
      "sites.greenness": 0,
      "sites.landform_90": 0,
      "sites.landform_270": 0,
      "sites.aspect": 0,
      "sites.distance_to_nearest_road": 0,
      "sites.distance_to_nearest_primary_road": 0,
      "sites.distance_to_nearest_secondary_road": 0,
      "sites.distance_to_nearest_tertiary_road": 0,
      "sites.distance_to_nearest_unclassified_road": 0,
      "sites.distance_to_nearest_residential_road": 0,
      "sites.bearing_to_capital_city": 0,
      "sites.distance_to_capital_city": 0,
      "sites.updatedAt": 0,
      "sites.nearest_tahmo_station": 0,
      "sites.formatted_name": 0,
      "sites.geometry": 0,
      "sites.google_place_id": 0,
      "sites.site_tags": 0,
      "sites.street": 0,
      "sites.town": 0,
      "sites.village": 0,
      "sites.airqlouds": 0,
      "sites.description": 0,
      "sites.__v": 0,
      "sites.airqloud_id": 0,
      "sites.createdAt": 0,
      "sites.lat_long": 0,
      "sites.weather_stations": 0,
      "sites.site_codes": 0,
      "sites.network": 0,
    };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign(initialProjection, {
        location: 0,
        isCustom: 0,
        metadata: 0,
        center_point: 0,
        airqloud_codes: 0,
        description: 0,
        airqloud_tags: 0,
      });
    }
    if (category === "dashboard") {
      projection = Object.assign(initialProjection, { location: 0 });
    }
    return projection;
  },

  KYA_TASKS_INCLUSION_PROJECTION: {
    _id: 1,
    title: 1,
    content: 1,
    image: 1,
    task_position: 1,
    kya_lesson: {
      $arrayElemAt: ["$kyalessons", 0],
    },
  },
  KYA_TASKS_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },
  KYA_QUIZ_INCLUSION_PROJECTION: {
    _id: 1,
    title: 1,
    completion_message: 1,
    description: 1,
    image: 1,
    questions: 1,
    active_question: {
      $arrayElemAt: ["$kya_user_quiz_progress.active_question", 0],
    },
    status: { $arrayElemAt: ["$kya_user_quiz_progress.status", 0] },
  },
  KYA_QUIZ_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },
  KYA_QUESTIONS_INCLUSION_PROJECTION: {
    _id: 1,
    title: 1,
    context: 1,
    question_position: 1,
    answers: 1,
    kya_quiz_id: {
      $arrayElemAt: ["$kyaquiz._id", 0],
    },
    kya_quiz_title: {
      $arrayElemAt: ["$kyaquiz.title", 0],
    },
  },
  KYA_QUESTIONS_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },
  KYA_ANSWERS_INCLUSION_PROJECTION: {
    _id: 1,
    title: 1,
    content: 1,
    kya_question_id: {
      $arrayElemAt: ["$kyaquestion._id", 0],
    },
    kya_question_title: {
      $arrayElemAt: ["$kyaquestion.title", 0],
    },
  },
  KYA_ANSWERS_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },

  KYA_LESSONS_INCLUSION_PROJECTION: {
    _id: 1,
    title: 1,
    completion_message: 1,
    image: 1,
    tasks: 1,
    active_task: { $arrayElemAt: ["$kya_user_progress.active_task", 0] },
    status: { $arrayElemAt: ["$kya_user_progress.status", 0] },
  },
  KYA_LESSONS_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },

  KYA_QUIZ_PROGRESS_INCLUSION_PROJECTION: {
    user_id: 1,
    quiz_id: 1,
    active_question: 1,
    status: 1,
    _id: 1,
  },
  KYA_QUIZ_PROGRESS_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },

  KYA_LESSONS_PROGRESS_INCLUSION_PROJECTION: {
    user_id: 1,
    lesson_id: 1,
    active_task: 1,
    status: 1,
    completed: 1,
    _id: 1,
  },
  KYA_LESSONS_PROGRESS_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },
  ADMIN_LEVEL_INCLUSION_PROJECTION: {
    description: 1,
    name: 1,
    _id: 1,
  },
  ADMIN_LEVEL_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },
  NETWORK_INCLUSION_PROJECTION: {
    description: 1,
    name: 1,
    _id: 1,
  },
  NETWORK_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },
  SITE_ACTIVITIES_INCLUSION_PROJECTION: {
    _id: 1,
    device: 1,
    date: 1,
    description: 1,
    network: 1,
    activityType: 1,
    maintenanceType: 1,
    recallType: 1,
    nextMaintenance: 1,
    createdAt: 1,
    updatedAt: 1,
    activity_codes: 1,
    tags: 1,
    site_id: 1,
    firstName: 1,
    lastName: 1,
    userName: 1,
    email: 1,
  },
  SITE_ACTIVITIES_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },
  GRID_SHAPE_FIELDS_TO_EXCLUDE: ["coordinates"],
  SITE_FIELDS_TO_EXCLUDE: [
    "altitude",
    "greenness",
    "landform_90",
    "landform_270",
    "aspect",
    "altitude",
    "greenness",
    "landform_90",
    "landform_270",
    "aspect",
    "distance_to_nearest_road",
    "distance_to_nearest_primary_road",
    "distance_to_nearest_secondary_road",
    "distance_to_nearest_tertiary_road",
    "distance_to_nearest_unclassified_road",
    "distance_to_nearest_residential_road",
    "bearing_to_capital_city",
    "distance_to_capital_city",
    "updatedAt",
    "nearest_tahmo_station",
    "formatted_name",
    "geometry",
    "google_place_id",
    "site_tags",
    "street",
    "town",
    "village",
    "airqlouds",
    "description",
    "__v",
    "airqloud_id",
    "createdAt",
    "lat_long",
    "weather_stations",
    "site_codes",
    "network",
    "grids",
    "approximate_latitude",
    "approximate_longitude",
    "bearing_in_radians",
    "approximate_distance_in_km",
    "generated_name",
    "location_name",
    "search_name",
    "sub_county",
    "city",
    "district",
    "county",
    "region",
    "country",
    "latitude",
    "longitude",
    "images",
    "land_use",
  ],
  DEVICE_FIELDS_TO_EXCLUDE: [
    "ISP",
    "device_manufacturer",
    "height",
    "isActive",
    "isPrimaryInLocation",
    "latitude",
    "locationName",
    "longitude",
    "mobility",
    "mountType",
    "nextMaintenance",
    "owner",
    "phoneNumber",
    "powerType",
    "product_name",
    "siteName",
    "isRetired",
    "updatedAt",
    "visibility",
    "site_id",
    "readKey",
    "writeKey",
    "deployment_date",
    "isUsedForCollocation",
    "recall_date",
    "maintenance_date",
    "status",
    "device_codes",
    "alias",
    "cohorts",
    "generation_version",
    "generation_count",
    "tags",
    "category",
    "pictures",
    "__v",
    "approximate_distance_in_km",
    "bearing_in_radians",
    "previous_sites",
    "long_name",
    "network",
    "device_number",
    "createdAt",
    "description",
  ],
};

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
