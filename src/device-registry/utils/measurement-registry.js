/**
 * @fileoverview Centralized Measurement Registry
 *
 * This file serves as a single source of truth for all measurement types,
 * pollutants, and sensor readings in the AirQo system. When adding a new
 * measurement type, you only need to modify this file.
 */

// Measurement type definition schema
/**
 * @typedef {Object} MeasurementDefinition
 * @property {string} name - The human-readable name of the measurement
 * @property {string} [description] - Optional description of the measurement
 * @property {Object} schema - MongoDB schema definition for this measurement
 * @property {Object} mappings - Field mapping information for transformations
 * @property {boolean} [isPollutant=false] - Whether this is considered a pollutant
 * @property {boolean} [includeInAggregation=true] - Whether to include in aggregation pipelines
 * @property {string} [unit] - The unit of measurement (e.g., 'μg/m³')
 * @property {string} [category] - Category this measurement belongs to (e.g., 'particulate', 'gas')
 */

/**
 * The registry of all measurement types in the system.
 * When adding a new measurement type, simply add a new entry here.
 */
const MEASUREMENT_REGISTRY = {
  // Particulate Matter
  pm1: {
    name: "PM1",
    description: "Particulate Matter less than 1 micron in diameter",
    schema: {
      value: { type: Number, default: null },
      calibratedValue: { type: Number, default: null },
      uncertaintyValue: { type: Number, default: null },
      standardDeviationValue: { type: Number, default: null },
    },
    mappings: {
      value: "pm1_raw_value",
      calibratedValue: "pm1_calibrated_value",
      uncertaintyValue: "pm1_uncertainty_value",
      standardDeviationValue: "pm1_standard_deviation_value",
    },
    isPollutant: true,
    includeInAggregation: true,
    unit: "μg/m³",
    category: "particulate",
  },

  s1_pm1: {
    name: "Sensor 1 PM1",
    schema: {
      value: { type: Number, default: null },
      calibratedValue: { type: Number, default: null },
      uncertaintyValue: { type: Number, default: null },
      standardDeviationValue: { type: Number, default: null },
    },
    mappings: {
      value: "s1_pm1",
      calibratedValue: "s1_pm1_calibrated_value",
      uncertaintyValue: "s1_pm1_uncertainty_value",
      standardDeviationValue: "s1_pm1_standard_deviation_value",
    },
    isPollutant: true,
    unit: "μg/m³",
    category: "particulate",
  },

  s2_pm1: {
    name: "Sensor 2 PM1",
    schema: {
      value: { type: Number, default: null },
      calibratedValue: { type: Number, default: null },
      uncertaintyValue: { type: Number, default: null },
      standardDeviationValue: { type: Number, default: null },
    },
    mappings: {
      value: "s2_pm1",
      calibratedValue: "s2_pm1_calibrated_value",
      uncertaintyValue: "s2_pm1_uncertainty_value",
      standardDeviationValue: "s2_pm1_standard_deviation_value",
    },
    isPollutant: true,
    unit: "μg/m³",
    category: "particulate",
  },

  pm2_5: {
    name: "PM2.5",
    description: "Particulate Matter less than 2.5 microns in diameter",
    schema: {
      value: { type: Number, default: null },
      calibratedValue: { type: Number, default: null },
      uncertaintyValue: { type: Number, default: null },
      standardDeviationValue: { type: Number, default: null },
    },
    mappings: {
      value: "pm2_5_raw_value",
      calibratedValue: "pm2_5_calibrated_value",
      uncertaintyValue: "pm2_5_uncertainty_value",
      standardDeviationValue: "pm2_5_standard_deviation_value",
    },
    isPollutant: true,
    includeInAggregation: true,
    unit: "μg/m³",
    category: "particulate",
  },

  s1_pm2_5: {
    name: "Sensor 1 PM2.5",
    schema: {
      value: { type: Number, default: null },
      calibratedValue: { type: Number, default: null },
      uncertaintyValue: { type: Number, default: null },
      standardDeviationValue: { type: Number, default: null },
    },
    mappings: {
      value: "s1_pm2_5",
      calibratedValue: "s1_pm2_5_calibrated_value",
      uncertaintyValue: "s1_pm2_5_uncertainty_value",
      standardDeviationValue: "s1_pm2_5_standard_deviation_value",
    },
    isPollutant: true,
    unit: "μg/m³",
    category: "particulate",
  },

  s2_pm2_5: {
    name: "Sensor 2 PM2.5",
    schema: {
      value: { type: Number, default: null },
      calibratedValue: { type: Number, default: null },
      uncertaintyValue: { type: Number, default: null },
      standardDeviationValue: { type: Number, default: null },
    },
    mappings: {
      value: "s2_pm2_5",
      calibratedValue: "s2_pm2_5_calibrated_value",
      uncertaintyValue: "s2_pm2_5_uncertainty_value",
      standardDeviationValue: "s2_pm2_5_standard_deviation_value",
    },
    isPollutant: true,
    unit: "μg/m³",
    category: "particulate",
  },

  average_pm2_5: {
    name: "Average PM2.5",
    schema: {
      value: { type: Number, trim: true, default: null },
      calibratedValue: { type: Number, default: null },
      uncertaintyValue: { type: Number, default: null },
      standardDeviationValue: { type: Number, default: null },
    },
    mappings: {
      value: "pm2_5_raw_value",
      calibratedValue: "pm2_5_calibrated_value",
      uncertaintyValue: "pm2_5_uncertainty_value",
      standardDeviationValue: "pm2_5_standard_deviation_value",
    },
    isPollutant: true,
    unit: "μg/m³",
    category: "particulate",
  },

  pm10: {
    name: "PM10",
    description: "Particulate Matter less than 10 microns in diameter",
    schema: {
      value: { type: Number, trim: true, default: null },
      calibratedValue: { type: Number, default: null },
      uncertaintyValue: { type: Number, default: null },
      standardDeviationValue: { type: Number, default: null },
    },
    mappings: {
      value: "pm10_raw_value",
      calibratedValue: "pm10_calibrated_value",
      uncertaintyValue: "pm10_uncertainty_value",
      standardDeviationValue: "pm10_standard_deviation_value",
    },
    isPollutant: true,
    includeInAggregation: true,
    unit: "μg/m³",
    category: "particulate",
  },

  s1_pm10: {
    name: "Sensor 1 PM10",
    schema: {
      value: { type: Number, trim: true, default: null },
      calibratedValue: { type: Number, default: null },
      uncertaintyValue: { type: Number, default: null },
      standardDeviationValue: { type: Number, default: null },
    },
    mappings: {
      value: "s1_pm10",
      calibratedValue: "s1_pm10_calibrated_value",
      uncertaintyValue: "s1_pm10_uncertainty_value",
      standardDeviationValue: "s1_pm10_standard_deviation_value",
    },
    isPollutant: true,
    unit: "μg/m³",
    category: "particulate",
  },

  s2_pm10: {
    name: "Sensor 2 PM10",
    schema: {
      value: { type: Number, trim: true, default: null },
      calibratedValue: { type: Number, default: null },
      uncertaintyValue: { type: Number, default: null },
      standardDeviationValue: { type: Number, default: null },
    },
    mappings: {
      value: "s2_pm10",
      calibratedValue: "s2_pm10_calibrated_value",
      uncertaintyValue: "s2_pm10_uncertainty_value",
      standardDeviationValue: "s2_pm10_standard_deviation_value",
    },
    isPollutant: true,
    unit: "μg/m³",
    category: "particulate",
  },

  average_pm10: {
    name: "Average PM10",
    schema: {
      value: { type: Number, trim: true, default: null },
      calibratedValue: { type: Number, default: null },
      uncertaintyValue: { type: Number, default: null },
      standardDeviationValue: { type: Number, default: null },
    },
    mappings: {
      value: "pm10_raw_value",
      calibratedValue: "pm10_calibrated_value",
      uncertaintyValue: "pm10_uncertainty_value",
      standardDeviationValue: "pm10_standard_deviation_value",
    },
    isPollutant: true,
    unit: "μg/m³",
    category: "particulate",
  },

  // Gases
  no2: {
    name: "NO2",
    description: "Nitrogen Dioxide",
    schema: {
      value: { type: Number, default: null },
      calibratedValue: { type: Number, default: null },
      uncertaintyValue: { type: Number, default: null },
      standardDeviationValue: { type: Number, default: null },
    },
    mappings: {
      value: "no2_raw_value",
      calibratedValue: "no2_calibrated_value",
      uncertaintyValue: "no2_uncertainty_value",
      standardDeviationValue: "no2_standard_deviation_value",
    },
    isPollutant: true,
    includeInAggregation: true,
    unit: "ppb",
    category: "gas",
  },

  co2: {
    name: "CO2",
    description: "Carbon Dioxide",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "co2",
    },
    isPollutant: true,
    includeInAggregation: true,
    unit: "ppm",
    category: "gas",
  },

  tvoc: {
    name: "TVOC",
    description: "Total Volatile Organic Compounds",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "tvoc",
    },
    isPollutant: true,
    unit: "ppb",
    category: "gas",
  },

  hcho: {
    name: "HCHO",
    description: "Formaldehyde",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "hcho",
    },
    isPollutant: true,
    unit: "ppb",
    category: "gas",
  },

  // Environmental parameters
  battery: {
    name: "Battery",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "battery",
    },
    isPollutant: false,
    category: "device",
  },

  location: {
    name: "Location",
    schema: {
      latitude: {
        value: { type: Number, default: null },
      },
      longitude: {
        value: { type: Number, default: null },
      },
    },
    mappings: {
      "latitude.value": "latitude",
      "longitude.value": "longitude",
    },
    isPollutant: false,
    category: "location",
  },

  altitude: {
    name: "Altitude",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "altitude",
    },
    isPollutant: false,
    unit: "m",
    category: "location",
  },

  speed: {
    name: "Speed",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "wind_speed",
    },
    isPollutant: false,
    unit: "m/s",
    category: "environmental",
  },

  satellites: {
    name: "Satellites",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "satellites",
    },
    isPollutant: false,
    category: "device",
  },

  hdop: {
    name: "HDOP",
    description: "Horizontal Dilution of Precision",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "hdop",
    },
    isPollutant: false,
    category: "device",
  },

  intaketemperature: {
    name: "Intake Temperature",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "intaketemperature",
    },
    isPollutant: false,
    unit: "°C",
    category: "environmental",
  },

  intakehumidity: {
    name: "Intake Humidity",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "intakehumidity",
    },
    isPollutant: false,
    unit: "%",
    category: "environmental",
  },

  internalTemperature: {
    name: "Internal Temperature",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "device_temperature",
    },
    isPollutant: false,
    unit: "°C",
    category: "device",
  },

  internalHumidity: {
    name: "Internal Humidity",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "device_humidity",
    },
    isPollutant: false,
    unit: "%",
    category: "device",
  },

  externalTemperature: {
    name: "External Temperature",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "temperature",
    },
    isPollutant: false,
    unit: "°C",
    category: "environmental",
  },

  externalHumidity: {
    name: "External Humidity",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "humidity",
    },
    isPollutant: false,
    unit: "%",
    category: "environmental",
  },

  externalPressure: {
    name: "External Pressure",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "external_pressure",
    },
    isPollutant: false,
    unit: "hPa",
    category: "environmental",
  },

  externalAltitude: {
    name: "External Altitude",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "external_altitude",
    },
    isPollutant: false,
    unit: "m",
    category: "environmental",
  },

  // BAM specific calibration factors
  rtc_adc: {
    name: "RTC ADC",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "rtc_adc",
    },
    isPollutant: false,
    category: "calibration",
  },

  rtc_v: {
    name: "RTC Voltage",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "rtc_v",
    },
    isPollutant: false,
    unit: "V",
    category: "calibration",
  },

  rtc: {
    name: "RTC",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "rtc",
    },
    isPollutant: false,
    category: "calibration",
  },

  stc_adc: {
    name: "STC ADC",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "stc_adc",
    },
    isPollutant: false,
    category: "calibration",
  },

  stc_v: {
    name: "STC Voltage",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "stc_v",
    },
    isPollutant: false,
    unit: "V",
    category: "calibration",
  },

  stc: {
    name: "STC",
    schema: {
      value: { type: Number, default: null },
    },
    mappings: {
      value: "stc",
    },
    isPollutant: false,
    category: "calibration",
  },
};

// Helper functions to extract specific information from the registry

/**
 * Generates a MongoDB schema object for all measurements
 * @returns {Object} A schema object ready to be used in Mongoose
 */
function generateValueSchema() {
  const schema = {};

  Object.entries(MEASUREMENT_REGISTRY).forEach(([key, measurement]) => {
    schema[key] = measurement.schema;
  });

  return schema;
}

/**
 * Generates mappings for the EVENT_MAPPINGS.item object
 * @returns {Object} Mappings for event transformation
 */
function generateEventMappings() {
  const mappings = {};

  Object.entries(MEASUREMENT_REGISTRY).forEach(([key, measurement]) => {
    // For measurements with nested fields like pollutants
    if (
      typeof measurement.schema === "object" &&
      Object.keys(measurement.schema).includes("value")
    ) {
      // For each field in the measurement type (value, calibratedValue, etc.)
      Object.entries(measurement.mappings).forEach(([field, mappedName]) => {
        mappings[`${key}.${field}`] = mappedName;
      });
    }
    // For complex structures like location
    else if (key === "location") {
      Object.entries(measurement.mappings).forEach(([field, mappedName]) => {
        mappings[field] = mappedName;
      });
    }
  });

  return mappings;
}

/**
 * Generates default values for EVENT_MAPPINGS.defaults
 * @returns {Object} Default values for each field
 */
function generateEventDefaults() {
  const defaults = {
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
  };

  Object.entries(MEASUREMENT_REGISTRY).forEach(([key, measurement]) => {
    // For measurements with nested fields like pollutants
    if (
      typeof measurement.schema === "object" &&
      Object.keys(measurement.schema).includes("value")
    ) {
      // For each field in the measurement type (value, calibratedValue, etc.)
      Object.keys(measurement.schema).forEach((field) => {
        defaults[`${key}.${field}`] = null;
      });
    }
    // For complex structures like location
    else if (key === "location") {
      defaults[`${key}.latitude.value`] = null;
      defaults[`${key}.longitude.value`] = null;
    }
  });

  return defaults;
}

/**
 * Gets a list of all pollutant keys
 * @returns {string[]} Array of pollutant keys
 */
function getPollutantKeys() {
  return Object.entries(MEASUREMENT_REGISTRY)
    .filter(([_, measurement]) => measurement.isPollutant)
    .map(([key, _]) => key);
}

/**
 * Gets a list of pollutants to include in aggregation pipelines
 * @returns {string[]} Array of pollutant keys for aggregation
 */
function getAggregationPollutants() {
  return Object.entries(MEASUREMENT_REGISTRY)
    .filter(
      ([_, measurement]) =>
        measurement.isPollutant && measurement.includeInAggregation !== false
    )
    .map(([key, _]) => key);
}

/**
 * Gets a list of all measurement keys by category
 * @param {string} category - The category to filter by
 * @returns {string[]} Array of measurement keys in the given category
 */
function getMeasurementsByCategory(category) {
  return Object.entries(MEASUREMENT_REGISTRY)
    .filter(([_, measurement]) => measurement.category === category)
    .map(([key, _]) => key);
}

/**
 * Gets an object mapping field names to their human-readable names
 * @returns {Object} Map of field keys to display names
 */
function getFieldNameMapping() {
  const mapping = {};

  Object.entries(MEASUREMENT_REGISTRY).forEach(([key, measurement]) => {
    mapping[key] = measurement.name;
  });

  return mapping;
}

/**
 * Gets a list of fields to include in projection for a specific view
 * @param {string} viewType - Type of view (e.g., 'brief', 'full')
 * @param {string[]} [excludeCategories] - Categories to exclude from projection
 * @returns {Object} Projection object for MongoDB query
 */
function getProjectionFields(viewType, excludeCategories = []) {
  const projection = {};

  // Define which measurements to exclude based on view type
  const excludeForViewType = {
    brief: ["calibration"],
    running: ["calibration", "device", "environmental"],
    // Add more view types as needed
  };

  // Combine exclude categories
  const categoriesExcluded = [
    ...(excludeForViewType[viewType] || []),
    ...excludeCategories,
  ];

  // Get measurements to exclude based on categories
  const measurementsToExclude = categoriesExcluded.flatMap((category) =>
    getMeasurementsByCategory(category)
  );

  // Set projection value (0 means exclude)
  measurementsToExclude.forEach((key) => {
    projection[key] = 0;
  });

  return projection;
}

/**
 * Gets an object with all pollutant field names and their raw value mappings
 * @returns {Object} Map of pollutant keys to their raw value field names
 */
function getPollutantRawFields() {
  const rawFields = {};

  Object.entries(MEASUREMENT_REGISTRY)
    .filter(([_, def]) => def.isPollutant)
    .forEach(([key, def]) => {
      rawFields[key] = def.mappings.value;
    });

  return rawFields;
}

/**
 * Gets an object with all pollutant field names and their calibrated value mappings
 * @returns {Object} Map of pollutant keys to their calibrated value field names
 */
function getPollutantCalibratedFields() {
  const calibratedFields = {};

  Object.entries(MEASUREMENT_REGISTRY)
    .filter(([_, def]) => def.isPollutant && def.mappings.calibratedValue)
    .forEach(([key, def]) => {
      calibratedFields[key] = def.mappings.calibratedValue;
    });

  return calibratedFields;
}

/**
 * Gets a list of field mappings for a specific device type
 * @param {string} deviceType - The type of device (e.g., 'bam', 'gas', 'standard')
 * @returns {Object} Mapping of ThingSpeak fields to measurement fields
 */
function getThingSpeakFieldMappings(deviceType) {
  let mappings = {};

  switch (deviceType) {
    case "bam":
      mappings = {
        field1: "date",
        field2: "real_time_concetration",
        field3: "hourly_concetration",
        field4: "short_time_concetration",
        field5: "litres_per_minute",
        field6: "device_status",
        field7: "battery_voltage",
        field8: "other_data",
      };
      break;

    case "gas":
      mappings = {
        field1: MEASUREMENT_REGISTRY.pm2_5.mappings.value.replace(
          "_raw_value",
          ""
        ),
        field2: MEASUREMENT_REGISTRY.tvoc.mappings.value,
        field3: MEASUREMENT_REGISTRY.hcho.mappings.value,
        field4: MEASUREMENT_REGISTRY.co2.mappings.value,
        field5: "intaketemperature",
        field6: "intakehumidity",
        field7: "battery",
        field8: "other_data",
      };
      break;

    default:
      // standard airqo device
      mappings = {
        field1: MEASUREMENT_REGISTRY.s1_pm2_5.mappings.value,
        field2: MEASUREMENT_REGISTRY.s1_pm10.mappings.value,
        field3: MEASUREMENT_REGISTRY.s2_pm2_5.mappings.value,
        field4: MEASUREMENT_REGISTRY.s2_pm10.mappings.value,
        field5: MEASUREMENT_REGISTRY.location.mappings["latitude.value"],
        field6: MEASUREMENT_REGISTRY.location.mappings["longitude.value"],
        field7: MEASUREMENT_REGISTRY.battery.mappings.value,
        field8: "other_data",
      };
  }

  // Add created_at mapping which is common to all types
  mappings.created_at = "created_at";

  return mappings;
}

module.exports = {
  MEASUREMENT_REGISTRY,
  generateValueSchema,
  generateEventMappings,
  generateEventDefaults,
  getPollutantRawFields,
  getPollutantCalibratedFields,
  getPollutantKeys,
  getThingSpeakFieldMappings,
  getAggregationPollutants,
  getMeasurementsByCategory,
  getFieldNameMapping,
  getProjectionFields,
};
