const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const isEmpty = require("is-empty");
const { logObject, logText } = require("@utils/shared");
const logger = log4js.getLogger(`${this.ENVIRONMENT} -- constants-config`);
const envs = require("./envs");

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

// Centralized sensor/pollutant configuration
const SENSOR_FIELDS = [
  "pm2_5",
  "pm10",
  "no2",
  "pm1",
  "s1_pm2_5",
  "s2_pm2_5",
  "s1_pm10",
  "s2_pm10",
  "s1_pm1",
  "s2_pm1",
  "average_pm2_5",
  "average_pm10",
  "average_no2",
  "latitude",
  "longitude",
  "battery",
  "speed",
  "altitude",
  "satellites",
  "hdop",
  "internalTemperature",
  "externalTemperature",
  "internalHumidity",
  "externalHumidity",
  "externalPressure",
  "externalAltitude",
  "tvoc",
  "co2",
  "hcho",
  "intaketemperature",
  "intakehumidity",
  "rtc_adc",
  "rtc_v",
  "rtc",
  "stc_adc",
  "stc_v",
  "stc",
];

const V2_EVENT_MAPPINGS = {
  item: {},
  remove: [],
  defaults: {},
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

    mappings.mapPollutantFields.call(mappings, item); // Call with correct context

    return item;
  },
  pollutants: SENSOR_FIELDS.filter(
    (field) =>
      field.startsWith("average_") ||
      field.startsWith("s1_") ||
      field.startsWith("s2_") ||
      field === "pm2_5" ||
      field === "pm10" ||
      field === "no2" ||
      field === "pm1"
  ), // Add pollutants that match the naming pattern average_*, s1_*, s2_*, pm2_5, pm10, pm1, no2

  mapPollutantFields: function(item) {
    this.pollutants.forEach((pollutant) => {
      item[`${pollutant}.value`] = item[`${pollutant}_raw_value`] ?? null;
      item[`${pollutant}.calibratedValue`] =
        item[`${pollutant}_calibrated_value`] ?? null;
      item[`${pollutant}.uncertaintyValue`] =
        item[`${pollutant}_uncertainty_value`] ?? null;
      item[`${pollutant}.standardDeviationValue`] =
        item[`${pollutant}_standard_deviation_value`] ?? null;

      delete item[`${pollutant}_raw_value`];
      delete item[`${pollutant}_calibrated_value`];
      delete item[`${pollutant}_uncertainty_value`];
      delete item[`${pollutant}_standard_deviation_value`];
    });

    return item;
  },
};

// Dynamically generate 'item' and 'defaults'
SENSOR_FIELDS.forEach((field) => {
  //handle the mapping of the pollutants in the item section
  if (
    field.startsWith("average_") ||
    field.startsWith("s1_") ||
    field.startsWith("s2_") ||
    field === "pm2_5" ||
    field === "pm10" ||
    field === "no2" ||
    field === "pm1"
  ) {
    V2_EVENT_MAPPINGS.item[`${field}.value`] = `${field}_raw_value`;
  } else {
    V2_EVENT_MAPPINGS.item[`${field}.value`] = field;
  }

  if (!field.includes(".")) {
    // Exclude fields with . like "location.latitude.value" as they are handled separately
    V2_EVENT_MAPPINGS.item[field] = field; // Direct mapping for simple fields
  }
  //handle the defaults for the pollutants
  V2_EVENT_MAPPINGS.defaults[`${field}.value`] = null;
  V2_EVENT_MAPPINGS.defaults[`${field}.calibratedValue`] = null;
  V2_EVENT_MAPPINGS.defaults[`${field}.uncertaintyValue`] = null;
  V2_EVENT_MAPPINGS.defaults[`${field}.standardDeviationValue`] = null;
  V2_EVENT_MAPPINGS.item.time = "timestamp";
  V2_EVENT_MAPPINGS.item.day = "timestamp";
  V2_EVENT_MAPPINGS.item.frequency = "frequency";
  V2_EVENT_MAPPINGS.item.device = "device_name";
  V2_EVENT_MAPPINGS.item.device_number = "device_number";
  V2_EVENT_MAPPINGS.item.site = "site";
  V2_EVENT_MAPPINGS.item.site_id = "site_id";
  V2_EVENT_MAPPINGS.item.device_id = "device_id";
  V2_EVENT_MAPPINGS.item.tenant = "tenant";
  V2_EVENT_MAPPINGS.item.network = "network";
  V2_EVENT_MAPPINGS.item.is_test_data = "is_test_data";
  V2_EVENT_MAPPINGS.item.is_device_primary = "is_device_primary";
});

// Add other mappings to V2_EVENT_MAPPINGS.item as needed (e.g., time, device, etc.)

const mappings = {
  AQI_INDEX: {
    good: { min: 0, max: 9.0 },
    moderate: { min: 9.1, max: 35.4 },
    u4sg: { min: 35.5, max: 55.4 },
    unhealthy: { min: 55.5, max: 125.4 },
    very_unhealthy: { min: 125.5, max: 225.4 },
    hazardous: { min: 225.5, max: null },
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
  THINGSPEAK_GAS_FIELD_DESCRIPTIONS: {
    field1: "PM2.5",
    field2: "TVOC",
    field3: "HCHO",
    field4: "CO2",
    field5: "Intake Temperature",
    field6: "Intake Humidity",
    field7: "Battery Voltage",
    field8: "ExtraData",
  },
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
      "location.latitude.value": "latitude",
      "location.longitude.value": "longitude",
      "battery.value": "battery",
      "speed.value": "wind_speed",
      "altitude.value": "altitude",
      "satellites.value": "satellites",
      "hdop.value": "hdop",
      "internalTemperature.value": "internalTemperature",
      "externalTemperature.value": "externalTemperature",
      "internalHumidity.value": "internalHumidity",
      "externalHumidity.value": "externalHumidity",
      "externalPressure.value": "externalPressure",
      "externalAltitude.value": "externalAltitude",
      "tvoc.value": "tvoc",
      "co2.value": "co2",
      "hcho.value": "hcho",
      "intaketemperature.value": "intaketemperature",
      "intakehumidity.value": "intakehumidity",

      "rtc_adc.value": "rtc_adc",
      "rtc_v.value": "rtc_v",
      "rtc.value": "rtc",
      "stc_adc.value": "stc_adc",
      "stc_v.value": "stc_v",
      "stc.value": "stc",
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

      "tvoc.value": null,
      "hcho.value": null,
      "co2.value": null,
      "intaketemperature.value": null,
      "intakehumidity.value": null,
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

    pollutants: [
      // Array to hold pollutant configurations
      "pm2_5",
      "pm10",
      "no2",
      "pm1",
      "s1_pm2_5",
      "s2_pm2_5",
      "s1_pm10",
      "s2_pm10",
      "s1_pm1",
      "s2_pm1",
      "average_pm2_5",
      "average_pm10",
      "average_no2",
    ],

    mapPollutantFields: function(item) {
      // Function to map pollutant fields
      this.pollutants.forEach((pollutant) => {
        item[`$pollutant.value`] = `$pollutant_raw_value`;
        item[`$pollutant.calibratedValue`] = `$pollutant_calibrated_value`;
        item[`$pollutant.uncertaintyValue`] = `$pollutant_uncertainty_value`;
        item[
          `$pollutant.standardDeviationValue`
        ] = `$pollutant_standard_deviation_value`;
      });
      return item;
    },
  },
  V2_EVENT_MAPPINGS,
};
module.exports = mappings;
