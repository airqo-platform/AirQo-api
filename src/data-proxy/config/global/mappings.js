const mongoose = require("mongoose");

const mappings = {
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
};
module.exports = mappings;
