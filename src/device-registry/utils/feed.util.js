const axios = require("axios");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const redis = require("@config/redis");
const { generateDateFormatWithoutHrs, isDate } = require("@utils/common");
const cleanDeep = require("clean-deep");
const { logObject, logText, logElement } = require("@utils/shared");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- create-feed-util`);
const createDevice = require("@utils/device.util");
const NetworkModel = require("@models/Network");

const createFeed = {
  isGasDevice: (description) => {
    return description.toLowerCase().includes("gas");
  },

  categorizeOutput: (input) => {
    try {
      if (!input || typeof input !== "object") {
        throw new Error("Invalid input: expected an object");
      }

      if (!input.hasOwnProperty("description")) {
        return "lowcost";
      }

      return createFeed.isGasDevice(input.description) ? "gas" : "lowcost";
    } catch (error) {
      return {
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  fetchThingspeakData: async (request) => {
    const url = createFeed.readRecentDeviceMeasurementsFromThingspeak({
      request,
    });
    // Add a 15-second timeout to prevent hanging requests
    const response = await axios.get(url, { timeout: 15000 });
    return response.data;
  },

  handleThingspeakResponse: (data) => {
    const readings = data.feeds[0];
    if (isEmpty(readings)) {
      return {
        status: httpStatus.NOT_FOUND,
        data: {
          success: true,
          message: "No recent measurements for this device",
        },
      };
    }
    return { status: httpStatus.OK, data: { isCache: false, ...readings } };
  },

  processDeviceMeasurements: async (readings, metadata) => {
    if (isEmpty(readings)) {
      return {
        status: httpStatus.NOT_FOUND,
        data: {
          success: true,
          message: "no recent measurements for this device",
        },
      };
    }

    let cleanedDeviceMeasurements = createFeed.clean(readings);
    const fieldOneValue = cleanedDeviceMeasurements.field1 || null;

    if (isEmpty(fieldOneValue)) {
      return {
        status: httpStatus.INTERNAL_SERVER_ERROR,
        data: {
          success: false,
          message: "unable to categorise device",
          errors: {
            message:
              "please crosscheck device on thingSpeak, it is not sending field1",
          },
        },
      };
    }

    const deviceCategory = isDate(fieldOneValue)
      ? "reference"
      : createFeed.categorizeOutput(metadata);
    cleanedDeviceMeasurements.field9 = deviceCategory;

    let transformedData = await createFeed.transformMeasurement(
      cleanedDeviceMeasurements
    );
    let transformedField = {};

    if (transformedData.other_data) {
      transformedField = await createFeed.trasformFieldValues({
        otherData: transformedData.other_data,
        deviceCategory,
      });
      delete transformedData.other_data;
    }

    let cleanedFinalTransformation = createFeed.clean({
      ...transformedData,
      ...transformedField,
    });

    if (cleanedFinalTransformation.ExternalPressure) {
      const pressureConversionResult = createFeed.convertFromHectopascalsToKilopascals(
        cleanedFinalTransformation.ExternalPressure
      );
      if (pressureConversionResult.success) {
        cleanedFinalTransformation.ExternalPressure =
          pressureConversionResult.data;
      } else {
        return {
          status:
            pressureConversionResult.status || httpStatus.INTERNAL_SERVER_ERROR,
          data: pressureConversionResult,
        };
      }
    }

    return {
      status: httpStatus.OK,
      data: { isCache: false, ...cleanedFinalTransformation },
    };
  },

  readRecentDeviceMeasurementsFromThingspeak: ({ request } = {}) => {
    try {
      const { channel, api_key, start, end, path } = request;
      if (isEmpty(start) && !isEmpty(end)) {
        return `${constants.THINGSPEAK_BASE_URL}/channels/${channel}/feeds.json?results=1&metadata=true&api_key=${api_key}&end=${end}`;
      } else if (isEmpty(end) && !isEmpty(start)) {
        return `${constants.THINGSPEAK_BASE_URL}/channels/${channel}/feeds.json?results=1&metadata=true&api_key=${api_key}&start=${start}`;
      } else if (!isEmpty(end) && !isEmpty(start)) {
        return `${constants.THINGSPEAK_BASE_URL}/channels/${channel}/feeds.json?results=1&metadata=true&api_key=${api_key}&start=${start}&end=${end}`;
      } else if (!isEmpty(path) && path === "last") {
        return `${constants.THINGSPEAK_BASE_URL}/channels/${channel}/feeds.json?results=1&metadata=true&api_key=${api_key}`;
      } else {
        return `${constants.THINGSPEAK_BASE_URL}/channels/${channel}/feeds.json?results=1&metadata=true&api_key=${api_key}`;
      }
    } catch (error) {
      logElement(
        "the error for generating urls of getting Thingspeak feeds",
        error.message
      );
    }
  },

  clean: (obj) => {
    logObject("the obj", obj);
    let trimmedValues = Object.entries(obj).reduce((acc, [key, value]) => {
      acc[key] = typeof value === "string" ? value.trim() : value;
      return acc;
    }, {});

    for (var propName in trimmedValues) {
      if (
        trimmedValues[propName] === null ||
        trimmedValues[propName] === undefined
      ) {
        delete trimmedValues[propName];
      }

      if (trimmedValues["created_at"]) {
        let date = new Date(trimmedValues["created_at"]);
        if (isNaN(date)) {
          delete trimmedValues["created_at"];
        }
      }

      if (isNaN(trimmedValues["pm10"])) {
        //   delete trimmedValues["pm10"];
      }

      if (trimmedValues["pm2_5"]) {
      }

      if (trimmedValues["s2_pm10"]) {
      }

      if (trimmedValues["s2_pm2_5"]) {
      }
    }
    return trimmedValues;
  },

  // ---------------------------------------------------------------------------
  // Original getAPIKey — retained for backward compatibility with any code that
  // still calls it directly with a numeric channel ID.
  // New code should use resolveDevice() + getDeviceFeed() instead.
  // ---------------------------------------------------------------------------
  getAPIKey: async (channel, next) => {
    try {
      const tenant = "airqo";
      logText(`getAPIKey util: fetching readKey for channel: ${channel}`);

      const request = {
        query: {
          tenant,
          device_number: channel,
        },
      };
      const responseFromListDevice = await createDevice.list(request, next);

      if (!responseFromListDevice.success) {
        return {
          success: false,
          message:
            responseFromListDevice.message || "Error retrieving device details",
          errors:
            responseFromListDevice.errors ||
            "Internal server errors when listing devices",
          status:
            responseFromListDevice.status || httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      const devices = responseFromListDevice.data;

      if (isEmpty(devices)) {
        return {
          success: false,
          message: "Device does not exist",
          status: httpStatus.NOT_FOUND,
        };
      }

      const deviceDetails = devices[0];

      if (isEmpty(deviceDetails.readKey)) {
        return {
          success: false,
          message: "ReadKey unavailable, this might be an external device",
          status: httpStatus.NOT_FOUND,
        };
      }

      const decryptResponse = await createDevice.decryptKey(
        deviceDetails.readKey
      );

      if (!decryptResponse.success) {
        return {
          success: false,
          message: decryptResponse.message || "Error decrypting readKey",
          errors: decryptResponse.errors || {
            message: "Internal server errors when decrypting key",
          },
          status: decryptResponse.status || httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      return {
        success: true,
        data: decryptResponse.data,
        message: "Read key successfully retrieved",
      };
    } catch (error) {
      logger.error(`Error in getAPIKey is ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  // ---------------------------------------------------------------------------
  // New unified API — network-aware feed retrieval
  // ---------------------------------------------------------------------------

  /**
   * Look up a device by either a numeric channel/device_number (AirQo) or a
   * serial_number string (external devices).
   *
   * @param {string|number} identifier - numeric channel ID or serial_number string
   * @param {string}        tenant
   * @returns {{ success: boolean, data?: object, message?: string, status?: number }}
   */
  resolveDevice: async (identifier, tenant = "airqo") => {
    try {
      const isNumericChannel =
        typeof identifier === "number" ||
        (typeof identifier === "string" && /^\d+$/.test(identifier));

      const query = { tenant };
      if (isNumericChannel) {
        query.device_number = parseInt(identifier, 10);
      } else {
        query.serial_number = String(identifier);
      }

      const response = await createDevice.list({ query }, (error) => {
        throw error;
      });

      if (!response || !response.success) {
        return {
          success: false,
          message:
            response?.message ||
            `Unable to look up device for identifier: ${identifier}`,
          status: response?.status || httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      if (!Array.isArray(response.data) || response.data.length === 0) {
        return {
          success: false,
          message: isNumericChannel
            ? `No device found with channel ${identifier}`
            : `No device found with serial_number ${identifier}`,
          status: httpStatus.NOT_FOUND,
        };
      }

      return { success: true, data: response.data[0] };
    } catch (error) {
      logger.error(`Error in resolveDevice: ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /**
   * Retrieve the adapter configuration for a given network name.
   * Checks the Network collection in the DB first (so admins can override
   * values without redeployment), then falls back to the static NETWORK_ADAPTERS
   * constant bundled with the service.
   *
   * @param {string} networkName - value of device.network (e.g. "airgradient")
   * @param {string} tenant
   * @returns {object|null} adapter config or null if unknown network
   */
  getNetworkAdapter: async (networkName, tenant = "airqo") => {
    try {
      const record = await NetworkModel(tenant)
        .findOne({ name: networkName })
        .select("adapter")
        .lean();

      if (record?.adapter && Object.keys(record.adapter).length > 0) {
        return record.adapter;
      }
    } catch (dbError) {
      logger.warn(
        `Could not load adapter from DB for network "${networkName}": ${dbError.message}`
      );
    }

    return constants.NETWORK_ADAPTERS?.[networkName] || null;
  },

  /**
   * Decrypt the ThingSpeak readKey for an already-resolved AirQo device doc.
   * Avoids a redundant DB round-trip when the caller already holds the device.
   *
   * @param {object} device - full device document (must have readKey)
   * @returns {{ success: boolean, data?: string, ... }}
   */
  getAPIKeyFromDevice: async (device) => {
    if (isEmpty(device.readKey)) {
      return {
        success: false,
        message: "ReadKey unavailable for this AirQo device",
        status: httpStatus.NOT_FOUND,
      };
    }

    const decryptResponse = await createDevice.decryptKey(device.readKey);
    if (!decryptResponse.success) {
      return {
        success: false,
        message: decryptResponse.message || "Error decrypting readKey",
        errors: decryptResponse.errors || {
          message: "Error decrypting key",
        },
        status: decryptResponse.status || httpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    return {
      success: true,
      data: decryptResponse.data,
      message: "Read key retrieved",
    };
  },

  /**
   * Fetch the most recent measurements from an external (non-ThingSpeak) device.
   *
   * URL is constructed in priority order:
   *   1. device.api_code when adapter.api_code_is_full_url is true
   *   2. adapter.api_base_url + adapter.api_url_template with {serial_number} replaced
   *
   * Credentials (device.access_code) are attached according to adapter.auth_type.
   * If the device has no access_code, the network-level net_api_key is NOT
   * automatically fetched here (that would require an extra DB round-trip and
   * decryption); callers that need network-level auth can extend this function.
   *
   * @param {{ device: object, adapter: object, start?: string, end?: string }}
   * @returns {{ success: boolean, data?: any, message?: string, status?: number }}
   */
  fetchExternalDeviceData: async ({ device, adapter, start, end }) => {
    try {
      // ── Build the request URL ──────────────────────────────────────────────
      let url;

      if (adapter.api_code_is_full_url && device.api_code) {
        url = device.api_code;
      } else if (adapter.api_base_url && adapter.api_url_template) {
        if (!device.serial_number) {
          return {
            success: false,
            message: `Cannot construct request URL for network "${device.network}": serial_number is missing`,
            status: httpStatus.UNPROCESSABLE_ENTITY,
          };
        }
        const path = adapter.api_url_template.replace(
          "{serial_number}",
          device.serial_number
        );
        url = adapter.api_base_url + path;
      } else {
        return {
          success: false,
          message: `Cannot construct request URL for network "${device.network}": ` +
            "device.api_code is missing and no url template is configured",
          status: httpStatus.UNPROCESSABLE_ENTITY,
        };
      }

      // ── Validate URL scheme and host before making the request ────────────
      // Guards against SSRF: only http/https to the adapter's expected host is
      // allowed. When adapter.api_base_url is configured the constructed URL's
      // hostname must match it; the same rule applies to full-URL api_code.
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch {
        return {
          success: false,
          message: `Invalid URL for network "${device.network}": failed to parse constructed URL`,
          status: httpStatus.UNPROCESSABLE_ENTITY,
        };
      }
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return {
          success: false,
          message: `Refused request for network "${device.network}": unsupported scheme "${parsedUrl.protocol}"`,
          status: httpStatus.UNPROCESSABLE_ENTITY,
        };
      }
      if (adapter.api_base_url) {
        let expectedHostname;
        try { expectedHostname = new URL(adapter.api_base_url).hostname; } catch { /* skip host check */ }
        if (expectedHostname && parsedUrl.hostname !== expectedHostname) {
          return {
            success: false,
            message:
              `Refused request for network "${device.network}": ` +
              `URL hostname "${parsedUrl.hostname}" does not match expected "${expectedHostname}"`,
            status: httpStatus.UNPROCESSABLE_ENTITY,
          };
        }
      }

      // ── Attach optional date filters ───────────────────────────────────────
      // External APIs may not support start/end — include them only when the
      // adapter template already has a query string or when explicitly supported.
      // For now we append them as generic query params; adapters that don't
      // support them will simply ignore unknown params.
      const params = {};
      if (start) params.start = start;
      if (end) params.end = end;

      // ── Configure auth ─────────────────────────────────────────────────────
      const axiosConfig = { timeout: 15000, params };
      const credential = device.access_code || null;

      if (device.authRequired && adapter.auth_type !== "none" && !credential) {
        logger.debug(
          `fetchExternalDeviceData: auth expected but device.access_code is missing ` +
            `for device "${device.serial_number || device._id}" on network "${device.network}" — ` +
            `proceeding unauthenticated`
        );
      }

      if (device.authRequired && adapter.auth_type !== "none" && credential) {
        switch (adapter.auth_type) {
          case "query_param":
            if (!adapter.auth_key_param) {
              return {
                success: false,
                message:
                  `Cannot configure auth for network "${device.network}": ` +
                  `auth_type is "query_param" but auth_key_param is not set on the adapter`,
                status: httpStatus.UNPROCESSABLE_ENTITY,
              };
            }
            axiosConfig.params = {
              ...axiosConfig.params,
              [adapter.auth_key_param]: credential,
            };
            break;

          case "header_bearer":
            axiosConfig.headers = {
              [adapter.auth_key_param || "Authorization"]: `Bearer ${credential}`,
            };
            break;

          case "header_basic":
            axiosConfig.headers = {
              [adapter.auth_key_param || "Authorization"]: `Basic ${credential}`,
            };
            break;

          default:
            break;
        }
      }

      const response = await axios.get(url, axiosConfig);
      return { success: true, data: response.data };
    } catch (error) {
      const status = error.response?.status || httpStatus.BAD_GATEWAY;
      logger.error(
        `fetchExternalDeviceData failed for device ${device.serial_number}: ${error.message}`
      );
      return {
        success: false,
        message: `Upstream API error for network "${device.network}": ${error.message}`,
        status,
      };
    }
  },

  /**
   * Remap manufacturer field names to AirQo internal field names using the
   * adapter's field_map.  Fields not present in field_map are passed through
   * unchanged so no data is silently dropped.
   *
   * @param {object}      rawData  - response body from the external API
   * @param {object|null} fieldMap - { manufacturerField: airqoField, ... }
   * @returns {object} normalized data object
   */
  normalizeExternalData: (rawData, fieldMap) => {
    if (!fieldMap || !rawData || typeof rawData !== "object") {
      return rawData || {};
    }

    const normalized = {};

    // Apply known mappings
    for (const [srcField, dstField] of Object.entries(fieldMap)) {
      if (rawData[srcField] !== undefined) {
        normalized[dstField] = rawData[srcField];
      }
    }

    // Pass through any fields not covered by the map
    for (const [key, value] of Object.entries(rawData)) {
      if (!fieldMap[key]) {
        normalized[key] = value;
      }
    }

    return normalized;
  },

  /**
   * Unified feed handler.
   *
   * Resolves the device, detects its network, then routes to the appropriate
   * backend:
   *   • network === "airqo"  → ThingSpeak (existing behaviour, unchanged)
   *   • any other network    → external API via adapter config
   *
   * @param {object}  params
   * @param {string|number} params.identifier - numeric channel or serial_number string
   * @param {string}        [params.tenant="airqo"]
   * @param {string}        [params.start]
   * @param {string}        [params.end]
   * @param {boolean}       [params.transform=false]
   *   When true and network is airqo, applies processDeviceMeasurements()
   *   (field name translation, category detection, pressure conversion).
   *   External networks always return named fields so transform is a no-op for them.
   * @returns {{ status: number, data: object }}
   */
  getDeviceFeed: async (
    { identifier, tenant = "airqo", start, end, transform = false }
  ) => {
    try {
      // ── 1. Resolve the device ──────────────────────────────────────────────
      const deviceResult = await createFeed.resolveDevice(identifier, tenant);
      if (!deviceResult.success) {
        return {
          status: deviceResult.status || httpStatus.NOT_FOUND,
          data: {
            success: false,
            message: deviceResult.message,
            errors: deviceResult.errors,
          },
        };
      }
      const device = deviceResult.data;

      // ── 2. AirQo → ThingSpeak path (existing behaviour) ───────────────────
      if (device.network === "airqo") {
        const apiKeyResponse = await createFeed.getAPIKeyFromDevice(device);
        if (!apiKeyResponse.success) {
          return {
            status: apiKeyResponse.status,
            data: {
              success: false,
              message: apiKeyResponse.message,
              errors: apiKeyResponse.errors,
            },
          };
        }

        const channel = device.device_number;
        const api_key = apiKeyResponse.data;
        const thingspeakData = await createFeed.fetchThingspeakData({
          channel,
          api_key,
          start,
          end,
        });

        if (transform) {
          const { status, data } = await createFeed.processDeviceMeasurements(
            thingspeakData.feeds[0],
            thingspeakData.channel
          );
          return { status, data };
        }

        return createFeed.handleThingspeakResponse(thingspeakData);
      }

      // ── 3. External device path ────────────────────────────────────────────
      const adapter = await createFeed.getNetworkAdapter(device.network, tenant);

      if (!adapter) {
        return {
          status: httpStatus.NOT_IMPLEMENTED,
          data: {
            success: false,
            message:
              `No adapter configured for network "${device.network}". ` +
              "Add adapter config to the Network document or NETWORK_ADAPTERS constant.",
          },
        };
      }

      const externalResult = await createFeed.fetchExternalDeviceData({
        device,
        adapter,
        start,
        end,
      });

      if (!externalResult.success) {
        return {
          status: externalResult.status || httpStatus.BAD_GATEWAY,
          data: {
            success: false,
            message: externalResult.message,
          },
        };
      }

      const normalized = createFeed.normalizeExternalData(
        externalResult.data,
        adapter.field_map
      );

      if (isEmpty(normalized)) {
        return {
          status: httpStatus.NOT_FOUND,
          data: {
            success: true,
            message: "No recent measurements for this device",
          },
        };
      }

      return {
        status: httpStatus.OK,
        data: { isCache: false, ...normalized },
      };
    } catch (error) {
      logger.error(`🐛 Error in getDeviceFeed: ${error.message}`);
      return {
        status: httpStatus.INTERNAL_SERVER_ERROR,
        data: {
          success: false,
          message: "Internal Server Error",
          errors: { message: error.message },
        },
      };
    }
  },

  // ---------------------------------------------------------------------------
  // Field-label helpers (unchanged)
  // ---------------------------------------------------------------------------

  getFieldLabel: (field) => {
    try {
      return constants.FIELDS_AND_LABELS[field];
    } catch (error) {
      logElement("the getFieldLabel error", error.message);
    }
  },
  getBamFieldLabel: (field) => {
    try {
      return constants.BAM_FIELDS_AND_LABELS[field];
    } catch (error) {
      logElement("the getBamFieldLabel error", error.message);
    }
  },
  getGasFieldLabel: (field) => {
    try {
      return constants.THINGSPEAK_GAS_FIELD_DESCRIPTIONS[field];
    } catch (error) {
      logElement("the getGasFieldLabel error", error.message);
    }
  },
  getPositionLabel: ({ position = "", deviceCategory = "" } = {}) => {
    try {
      if (deviceCategory === "lowcost") {
        return constants.POSITIONS_AND_LABELS[position];
      } else if (deviceCategory === "reference") {
        return constants.BAM_POSITIONS_AND_LABELS[position];
      } else if (deviceCategory === "gas") {
        return constants.GAS_POSITIONS_AND_LABELS[position];
      } else {
        return {};
      }
    } catch (error) {
      logElement("the getPositionLabel error", error.message);
    }
  },
  getValuesFromString: (stringValues) => {
    try {
      arrayValues = stringValues.split(",");
      return arrayValues;
    } catch (error) {
      logElement("the getValuesFromString error", error.message);
    }
  },
  trasformFieldValues: async ({ otherData = "", deviceCategory = "" } = {}) => {
    try {
      let arrayValues = createFeed.getValuesFromString(otherData);
      let newObj = await Object.entries(arrayValues).reduce(
        (newObj, [position, value]) => {
          if (value) {
            let transformedPosition = createFeed.getPositionLabel({
              position,
              deviceCategory,
            });

            return { ...newObj, [transformedPosition]: value.trim() };
          }
        },
        {}
      );
      return cleanDeep(newObj);
    } catch (e) {
      logElement("the trasformFieldValues error", e.message);
    }
  },
  transformMeasurement: (measurement) => {
    try {
      const deviceCategory = measurement.field9
        ? measurement.field9
        : "lowcost";
      let response = {};
      let transformedField = "";
      for (const key in measurement) {
        if (deviceCategory === "reference") {
          logText("the device is a BAM");
          transformedField = createFeed.getBamFieldLabel(key);
          logElement("transformedField", transformedField);
        } else if (deviceCategory === "lowcost") {
          logText("the device is a lowcost one");
          transformedField = createFeed.getFieldLabel(key);
        } else if (deviceCategory === "gas") {
          logText("the device is a gas one");
          transformedField = createFeed.getGasFieldLabel(key);
        } else {
          logText("the device does not have a category/type");
          return {};
        }
        if (transformedField) {
          response[transformedField] = measurement[key];
        }
      }
      return cleanDeep(response);
    } catch (e) {
      logObject("the transformMeasurement error", e);
    }
  },
  convertFromHectopascalsToKilopascals: (number) => {
    try {
      const convertedValue = number * 0.1;
      return {
        success: true,
        message: "Successfully converted Hectopascals To Kilopascals",
        data: convertedValue,
      };
    } catch (error) {
      return {
        success: false,
        errors: { message: error.message },
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = createFeed;
