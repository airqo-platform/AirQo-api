// Configuration object for default values and field definitions
const constants = require("@config/constants");
const { HttpError } = require("@utils/errors");
const log4js = require("log4js");
const httpStatus = require("http-status");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- utils/cache-id-generator`
);
const { generateDateFormatWithoutHrs } = require("@utils/date");

const CACHE_CONFIG = {
  prefix: "list_events",
  fields: {
    device: { default: "noDevice" },
    tenant: { default: "airqo" },
    skip: { default: 0 },
    limit: { default: 0 },
    recent: { default: "noRecent" },
    frequency: { default: "noFrequency" },
    endTime: { default: "noEndTime" },
    startTime: { default: "noStartTime" },
    device_id: { default: "noDeviceId" },
    site: { default: "noSite" },
    site_id: { default: "noSiteId" },
    device_number: { default: "noDeviceNumber" },
    metadata: { default: "noMetadata" },
    external: { default: "noExternal" },
    airqloud: { default: "noAirQloud" },
    airqloud_id: { default: "noAirQloudID" },
    lat_long: { default: "noLatLong" },
    page: { default: "noPage" },
    running: { default: "noRunning" },
    index: { default: "noIndex" },
    brief: { default: "noBrief" },
    latitude: { default: "noLatitude" },
    longitude: { default: "noLongitude" },
    network: { default: "noNetwork" },
    language: { default: "noLanguage" },
    averages: { default: "noAverages" },
    threshold: { default: "noThreshold" },
    pollutant: { default: "noPollutant" },
  },
};

class CacheIDGenerator {
  constructor(config = CACHE_CONFIG) {
    this.config = config;
  }

  /**
   * Validates required fields in the request data
   * @param {Object} data - The request data
   * @throws {HttpError} If required fields are missing
   */
  validateRequiredFields(data) {
    const missingRequired = Object.entries(this.config.fields)
      .filter(([_, config]) => config.required && !data[_])
      .map(([field]) => field);

    if (missingRequired.length > 0) {
      throw new HttpError("Missing Required Fields", httpStatus.BAD_REQUEST, {
        message: `Missing required fields: ${missingRequired.join(", ")}`,
      });
    }
  }

  /**
   * Gets the value for a field, using default if necessary
   * @param {Object} data - The request data
   * @param {string} field - The field name
   * @returns {string} The field value or default
   */
  getFieldValue(data, field) {
    const fieldConfig = this.config.fields[field];
    return data[field] || fieldConfig.default;
  }

  /**
   * Generates a day string from the current time
   * @returns {string} The formatted day string
   */
  getCurrentDay() {
    const currentTime = new Date().toISOString();
    return generateDateFormatWithoutHrs(currentTime);
  }

  /**
   * Formats all fields into the cache ID string
   * @param {Object} data - The processed request data
   * @returns {string} The formatted cache ID
   */
  formatCacheID(data) {
    const day = this.getCurrentDay();
    const fieldStrings = Object.keys(this.config.fields)
      .map((field) => `_${this.getFieldValue(data, field)}`)
      .join("");

    return `${this.config.prefix}_${day}${fieldStrings}`;
  }

  /**
   * Main function to generate the cache ID
   * @param {Object} request - The request object
   * @param {Function} next - Express next middleware function
   * @returns {string} The generated cache ID
   */
  generateCacheID(request, next) {
    try {
      // Combine query parameters and route parameters
      const requestData = { ...request.query, ...request.params };

      // Validate required fields
      this.validateRequiredFields(requestData);

      // Generate and return the cache ID
      return this.formatCacheID(requestData);
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  }

  /**
   * Adds a new field to the cache ID configuration
   * @param {string} fieldName - Name of the new field
   * @param {Object} fieldConfig - Configuration for the new field
   */
  addField(fieldName, fieldConfig) {
    this.config.fields[fieldName] = {
      default:
        fieldConfig.default ||
        `no${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`,
      required: fieldConfig.required || false,
    };
  }

  /**
   * Updates configuration for an existing field
   * @param {string} fieldName - Name of the field to update
   * @param {Object} fieldConfig - New configuration for the field
   */
  updateField(fieldName, fieldConfig) {
    if (!this.config.fields[fieldName]) {
      throw new Error(`Field ${fieldName} does not exist`);
    }
    this.config.fields[fieldName] = {
      ...this.config.fields[fieldName],
      ...fieldConfig,
    };
  }
}

// Usage example:
const cacheGenerator = new CacheIDGenerator();

// To add a new field:
// cacheGenerator.addField('new_field', { default: 'noNewField', required: false });

// Export the generator instance
module.exports = cacheGenerator;
