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

const mappings = {
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

      "tvoc.value": "tvoc",
      "hcho.value": "hcho",
      "co2.value": "co2",
      "intaketemperature.value": "intaketemperature",
      "intakehumidity.value": "intakehumidity",
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

  BAM_FIELDS_AND_LABELS: {
    field1: "date",
    field2: "real_time_concetration",
    field3: "hourly_concetration",
    field4: "short_time_concetration",
    field5: "litres_per_minute",
    field6: "device_status",
    field7: "battery_voltage",
    field8: "other_data",
    created_at: "created_at",
  },

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

  FIELDS_AND_LABELS: {
    field1: "pm2_5",
    field2: "pm10",
    field3: "s2_pm2_5",
    field4: "s2_pm10",
    field5: "latitude",
    field6: "longitude",
    field7: "battery",
    field8: "other_data",
    created_at: "created_at",
  },

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
  THINGSPEAK_GAS_FIELD_DESCRIPTIONS: {
    field1: "pm2_5",
    field2: "TVOC",
    field3: "HCHO",
    field4: "CO2",
    field5: "IntakeTemperature",
    field6: "IntakeHumidity",
    field7: "BatteryVoltage",
    field8: "other_data",
    created_at: "created_at",
  },
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
