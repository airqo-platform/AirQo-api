const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const { isEmpty } = require("underscore");
const logger = log4js.getLogger(`${this.ENVIRONMENT} -- constants-config`);

const devConfig = {
  MONGO_URI: `mongodb://localhost/`,
  DB_NAME: process.env.MONGO_DEV,
  REDIS_SERVER: process.env.REDIS_SERVER_DEV,
  REDIS_PORT: process.env.REDIS_PORT,
  KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS_DEV.split(","),
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
  MONGO_URI: process.env.MONGO_GCE_URI,
  DB_NAME: process.env.MONGO_PROD,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
  KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS_PROD.split(","),
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
  MONGO_URI: process.env.MONGO_GCE_URI,
  DB_NAME: process.env.MONGO_STAGE,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
  KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS_STAGE.split(","),
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
  NETWORKS: process.env.NETWORKS.split(","),
  ACTIVITY_TYPES: process.env.ACTIVITY_TYPES.split(","),
  AQI_CATEGORIES: "good,moderate,u4sg,unhealthy,very_unhealthy,hazardous".split(
    ","
  ),
  MAINTENANCE_TYPES: process.env.MAINTENANCE_TYPES.split(","),
  DEFAULT_NETWORK: process.env.DEFAULT_NETWORK,
  DEFAULT_NEAREST_SITE_RADIUS: process.env.DEFAULT_NEAREST_SITE_RADIUS,
  SLACK_TOKEN: process.env.SLACK_TOKEN,
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID,
  SLACK_CHANNEL: process.env.SLACK_CHANNEL,
  SLACK_USERNAME: process.env.SLACK_USERNAME,
  DATAWAREHOUSE_RAW_DATA: process.env.DATAWAREHOUSE_RAW_DATA,
  MOESIF_APPLICATION_ID: process.env.MOESIF_APPLICATION_ID,
  DOMAIN_WHITELIST: process.env.DOMAIN_WHITELIST.split(","),
  BIG_QUERY_LOCATION: process.env.BIG_QUERY_LOCATION,
  TENANTS: process.env.TENANTS.split(","),
  SITES_TOPIC: process.env.SITES_TOPIC,
  DEVICES_TOPIC: process.env.DEVICES_TOPIC,
  LOCATIONS_TOPIC: process.env.LOCATIONS_TOPIC,
  SENSORS_TOPIC: process.env.SENSORS_TOPIC,
  AIRQLOUDS_TOPIC: process.env.AIRQLOUDS_TOPIC,
  ACTIVITIES_TOPIC: process.env.ACTIVITIES_TOPIC,
  PHOTOS_TOPIC: process.env.PHOTOS_TOPIC,
  TIPS_TOPIC: process.env.TIPS_TOPIC,
  HOURLY_MEASUREMENTS_TOPIC: process.env.HOURLY_MEASUREMENTS_TOPIC,
  PORT: process.env.PORT || 3000,
  TAHMO_API_GET_STATIONS_URL: process.env.TAHMO_API_GET_STATIONS_URL,
  TAHMO_API_CREDENTIALS_USERNAME: process.env.TAHMO_API_CREDENTIALS_USERNAME,
  TAHMO_API_CREDENTIALS_PASSWORD: process.env.TAHMO_API_CREDENTIALS_PASSWORD,
  UNIQUE_CONSUMER_GROUP: process.env.UNIQUE_CONSUMER_GROUP,
  UNIQUE_PRODUCER_GROUP: process.env.UNIQUE_PRODUCER_GROUP,
  AQI_INDEX: {
    good: [0, 50],
    moderate: [51, 100],
    u4sg: [101, 150],
    unhealthy: [151, 200],
    very_unhealthy: [201, 300],
    hazardous: [301],
  },
  GET_ROAD_METADATA_PATHS: {
    altitude: "altitude",
    greenness: "greenness",
    aspect: "aspect",
    landform_270: "landform-270",
    landform_90: "landform-90",
    bearing_to_kampala_center: "bearing",
    distance_to_kampala_center: "distance/kampala",
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
      projection[as]["bearing_to_kampala_center"] = 0;
      projection[as]["street"] = 0;
      projection[as]["village"] = 0;
      projection[as]["distance_to_nearest_secondary_road"] = 0;
      projection[as]["distance_to_kampala_center"] = 0;
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
      projection[as]["bearing_to_kampala_center"] = 0;
      projection[as]["longitude"] = 0;
      projection[as]["latitude"] = 0;
      projection[as]["land_use"] = 0;
      projection[as]["site_codes"] = 0;
      projection[as]["images"] = 0;
      projection[as]["name"] = 0;
      projection[as]["_id"] = 0;
      projection[as]["airqlouds"] = 0;
      projection[as]["description"] = 0;
      projection[as]["generated_name"] = 0;
      projection[as]["createdAt"] = 0;
      projection[as]["updatedAt"] = 0;
      projection[as]["__v"] = 0;
      projection[as]["network"] = 0;
      projection[as]["approximate_distance_in_km"] = 0;
      projection[as]["distance_to_nearest_secondary_road"] = 0;
      projection[as]["distance_to_kampala_center"] = 0;
      return projection;
    } else {
      return {};
    }
  },
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
