"use strict";
const DeviceModel = require("@models/Device");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { isValidObjectId } = require("mongoose");
const axios = require("axios");
const { logObject, logText, logElement, HttpError } = require("@utils/shared");
const { transform } = require("node-json-transform");
const constants = require("@config/constants");
const cryptoJS = require("crypto-js");
const { generateFilter, claimTokenUtil } = require("@utils/common");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- device-util`);
const qs = require("qs");
const QRCode = require("qrcode");
const { Kafka } = require("kafkajs");
const httpStatus = require("http-status");

let organizationUtil = null;
try {
  organizationUtil = require("@utils/organization.util");
  console.log("✅ Organization util loaded successfully");
} catch (error) {
  console.warn("⚠️  Organization util not available:", error.message);
  // Create a mock object with the same interface
  organizationUtil = {
    switchOrganizationContext: async () => ({
      success: false,
      message: "Organization service not available",
      status: 503,
    }),
    getUserOrganizations: async () => ({
      success: false,
      message: "Organization service not available",
      data: [],
    }),
    isAvailable: () => false,
    getStatus: () => ({ configured: false, ready: false }),
  };
}

const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const deviceUtil = {
  getDeviceById: async (req, next) => {
    try {
      const { id } = req.params;
      const { tenant } = req.query;

      const device = await DeviceModel(tenant.toLowerCase()).findById(id);

      if (!device) {
        throw new HttpError("Device not found", httpStatus.NOT_FOUND);
      }

      return {
        success: true,
        message: "Device details fetched successfully",
        data: device,
        status: httpStatus.OK,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        next(error);
        return;
      }
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  doesDeviceSearchExist: async (request, next) => {
    try {
      const { filter, tenant } = request;
      let doesSearchExist = await DeviceModel(tenant).exists(filter);
      logElement(" doesSearchExist", doesSearchExist);
      if (doesSearchExist) {
        return {
          success: true,
          message: "search exists",
          data: doesSearchExist,
        };
      } else if (!doesSearchExist) {
        return {
          success: false,
          message: "search does not exist",
          data: [],
        };
      }
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
  },
  doesDeviceExist: async (request) => {
    logText("checking device existence...");
    const responseFromList = await deviceUtil.list(request, next);
    if (responseFromList.success === true && responseFromList.data) {
      return true;
    }
    return false;
  },
  getDevicesCount: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.devices(request, next);
      const count = await DeviceModel(tenant).countDocuments(filter);
      return {
        success: true,
        message: "retrieved the number of devices",
        status: httpStatus.OK,
        data: count,
      };
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
  },
  generateQR: async (request, next) => {
    try {
      const { include_site } = request.query;
      const responseFromListDevice = await deviceUtil.list(request, next);
      logObject("responseFromListDevice", responseFromListDevice);
      if (responseFromListDevice.success === true) {
        const deviceBody = responseFromListDevice.data;
        if (isEmpty(deviceBody)) {
          return {
            success: false,
            message: "device does not exist",
          };
        }
        if (!isEmpty(include_site) && include_site === "no") {
          delete deviceBody[0].site;
        } else if (isEmpty(include_site)) {
          delete deviceBody[0].site;
        }

        const stringifiedJSON = deviceBody[0]
          ? JSON.stringify(deviceBody[0])
          : "";
        const url = await QRCode.toDataURL(stringifiedJSON);
        return {
          success: true,
          message: "successfully generated the QR Code",
          data: url,
          status: httpStatus.OK,
        };
      } else if (responseFromListDevice.success === false) {
        return responseFromListDevice;
      }
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
  },
  generateQRCode: async (request, next) => {
    try {
      const { tenant } = request.query;
      const filter = generateFilter.devices(request, next);

      // Get device with minimal fields only
      const device = await DeviceModel(tenant)
        .findOne(filter)
        .select("name long_name device_number serial_number network")
        .lean(); // Use lean() for better performance

      if (!device) {
        return {
          success: false,
          message: "Device not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "Device does not exist" },
        };
      }

      // ✅ MINIMAL QR DATA - Only essential info
      const qrData = {
        id: device._id.toString(),
        name: device.long_name || device.name,
        network: device.network || "unknown",
        url: `${constants.DEPLOYMENT_URL ||
          "https://netmanager.airqo.net"}/device/${device.name}/overview`,
      };

      // Optional: Add device number if it exists
      if (device.device_number) {
        qrData.device_number = device.device_number;
      }

      // Optional: Add serial number if it exists
      if (device.serial_number) {
        qrData.serial = device.serial_number;
      }

      const qrString = JSON.stringify(qrData);

      if (qrString.length > 2000) {
        logger.warn(`QR Code data may be too large: ${qrString.length} bytes`);
      }

      // Generate QR code with appropriate settings
      const qrCodeDataURL = await QRCode.toDataURL(qrString, {
        type: "image/png",
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "M", // Medium error correction for balance
      });

      return {
        success: true,
        message: "QR code generated successfully",
        data: {
          qr_code: qrCodeDataURL,
          device_name: device.name,
          data_size_bytes: qrString.length,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      // Handle specific QR code errors
      if (error.message && error.message.includes("too big")) {
        logger.error(`QR Code data size error: ${error.message}`);
        return {
          success: false,
          message: "QR code data is too large",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: "Device data is too large for QR code generation",
            suggestion: "Use minimal device information for QR codes",
          },
        };
      }

      logger.error(`🐛🐛 QR Code Generation Error ${error.message}`);
      next(
        new HttpError(
          "QR Code Generation Failed",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  create: async (request, next) => {
    try {
      if (request.query.tenant !== "airqo") {
        return {
          success: false,
          message: "creation is not yet possible for this organisation",
          status: httpStatus.NOT_IMPLEMENTED,
        };
      }

      if (constants.ENVIRONMENT !== "PRODUCTION ENVIRONMENT") {
        return {
          success: false,
          message: "Bad Request",
          errors: {
            message:
              "please utilise SOFT creation when operating in testing environments",
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      let responseFromCreateOnThingspeak = await deviceUtil.createOnThingSpeak(
        request,
        next
      );

      let enrichmentDataForDeviceCreation = responseFromCreateOnThingspeak.data
        ? responseFromCreateOnThingspeak.data
        : {};

      if (!isEmpty(enrichmentDataForDeviceCreation)) {
        let modifiedRequest = request;
        modifiedRequest["body"] = {
          ...request.body,
          ...enrichmentDataForDeviceCreation,
        };

        let responseFromCreateDeviceOnPlatform = await deviceUtil.createOnPlatform(
          modifiedRequest,
          next
        );
        logObject(
          "responseFromCreateDeviceOnPlatform",
          responseFromCreateDeviceOnPlatform
        );
        if (responseFromCreateDeviceOnPlatform.success === true) {
          return responseFromCreateDeviceOnPlatform;
        } else if (responseFromCreateDeviceOnPlatform.success === false) {
          let deleteRequest = {};
          deleteRequest["query"] = {};
          deleteRequest["query"]["device_number"] =
            enrichmentDataForDeviceCreation.device_number;

          let responseFromDeleteDeviceFromThingspeak = await deviceUtil.deleteOnThingspeak(
            deleteRequest,
            next
          );

          if (responseFromDeleteDeviceFromThingspeak.success === true) {
            let errorsString = responseFromCreateDeviceOnPlatform.errors
              ? JSON.stringify(responseFromCreateDeviceOnPlatform.errors)
              : "";
            try {
              logger.error(
                `creation operation failed -- successfully undid the successfull operations -- ${errorsString}`
              );
            } catch (error) {
              logger.error(`internal server error ${error.message}`);
            }
            return {
              success: false,
              message:
                "creation operation failed -- successfully undid the successfull operations",
              errors: responseFromCreateDeviceOnPlatform.errors
                ? responseFromCreateDeviceOnPlatform.errors
                : { message: "Internal Server Error" },
              status: responseFromCreateDeviceOnPlatform.status
                ? responseFromCreateDeviceOnPlatform.status
                : httpStatus.INTERNAL_SERVER_ERROR,
            };
          } else if (responseFromDeleteDeviceFromThingspeak.success === false) {
            const status = responseFromDeleteDeviceFromThingspeak.status
              ? responseFromDeleteDeviceFromThingspeak.status
              : httpStatus.INTERNAL_SERVER_ERROR;
            try {
              let errorsString = responseFromDeleteDeviceFromThingspeak.errors
                ? JSON.stringify(responseFromDeleteDeviceFromThingspeak.errors)
                : "";
              logger.error(
                `creation operation failed -- also failed to undo the successfull operations --${errorsString}`
              );
            } catch (error) {
              logger.error(`internal server error ${error.message}`);
            }
            return {
              success: false,
              message:
                "creation operation failed -- also failed to undo the successfull operations",
              errors: responseFromDeleteDeviceFromThingspeak.errors
                ? responseFromDeleteDeviceFromThingspeak.errors
                : { message: "Internal Server Error" },
              status,
            };
          }
        }
      } else if (isEmpty(enrichmentDataForDeviceCreation)) {
        try {
          let errorsString = responseFromCreateOnThingspeak.errors
            ? JSON.stringify(responseFromCreateOnThingspeak.errors)
            : "";
          logger.error(
            `unable to generate enrichment data for the device -- ${errorsString}`
          );
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }

        return {
          success: false,
          message: "unable to generate enrichment data for the device",
          errors: responseFromCreateOnThingspeak.errors
            ? responseFromCreateOnThingspeak.errors
            : { message: "Internal Server Error" },
          status: responseFromCreateOnThingspeak.status
            ? responseFromCreateOnThingspeak.status
            : "",
        };
      }
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
  },
  update: async (request, next) => {
    try {
      // logger.info(`in the update util....`);
      if (constants.ENVIRONMENT !== "PRODUCTION ENVIRONMENT") {
        return {
          success: false,
          message: "Bad Request",
          errors: {
            message:
              "please utilise SOFT update when operating in testing environments",
          },
          status: httpStatus.BAD_REQUEST,
        };
      }
      let { device_number } = request.query;
      let modifiedRequest = Object.assign({}, request);
      if (isEmpty(device_number)) {
        // logger.info(`the device_number is not present in the update request`);
        let responseFromListDevice = await deviceUtil.list(request, next);
        // logger.info(`responseFromListDevice -- ${responseFromListDevice}`);
        if (responseFromListDevice.success === false) {
          return {
            success: false,
            message: responseFromListDevice.message,
            errors: responseFromListDevice.errors
              ? responseFromListDevice.errors
              : { message: "" },
          };
        }
        device_number = responseFromListDevice.data[0].device_number;
        // logger.info(`device_number -- ${device_number}`);
        modifiedRequest["query"]["device_number"] = device_number;
      }
      // logger.info(`the modifiedRequest -- ${modifiedRequest} `);

      if (isEmpty(device_number)) {
        const responseFromUpdateDeviceOnPlatform = await deviceUtil.updateOnPlatform(
          request,
          next
        );
        return responseFromUpdateDeviceOnPlatform;
      } else if (!isEmpty(device_number)) {
        const responseFromUpdateDeviceOnThingspeak = await deviceUtil.updateOnThingspeak(
          modifiedRequest,
          next
        );
        if (responseFromUpdateDeviceOnThingspeak.success === true) {
          const responseFromUpdateDeviceOnPlatform = await deviceUtil.updateOnPlatform(
            request,
            next
          );
          return responseFromUpdateDeviceOnPlatform;
        } else if (responseFromUpdateDeviceOnThingspeak.success === false) {
          return responseFromUpdateDeviceOnThingspeak;
        }
      }
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
  },
  encryptKeys: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { body } = request;
      const update = body;
      const filter = generateFilter.devices(request, next);
      const responseFromEncryptKeys = await DeviceModel(tenant).encryptKeys({
        filter,
        update,
      });
      return responseFromEncryptKeys;
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
  },
  delete: async (request, next) => {
    try {
      return {
        success: false,
        message: "feature temporarily disabled --coming soon",
        status: httpStatus.SERVICE_UNAVAILABLE,
        errors: { message: "Service Unavailable" },
      };
      const { device_number } = request.query;
      let modifiedRequest = request;
      if (isEmpty(device_number)) {
        // logger.info(`the device_number is not present`);
        let responseFromListDevice = await deviceUtil.list(request, next);
        // logger.info(`responseFromListDevice -- ${responseFromListDevice}`);
        if (responseFromListDevice.success === false) {
          return responseFromListDevice;
        }
        let device_number = responseFromListDevice.data[0].device_number;
        // logger.info(`device_number -- ${device_number}`);
        modifiedRequest["query"]["device_number"] = device_number;
      }
      // logger.info(`the modifiedRequest -- ${modifiedRequest} `);

      let responseFromDeleteDeviceFromThingspeak = await deviceUtil.deleteOnThingspeak(
        modifiedRequest,
        next
      );

      // logger.info(
      //   `responseFromDeleteDeviceFromThingspeak -- ${responseFromDeleteDeviceFromThingspeak}`
      // );
      if (responseFromDeleteDeviceFromThingspeak.success === true) {
        let responseFromDeleteDeviceOnPlatform = await deviceUtil.deleteOnPlatform(
          modifiedRequest,
          next
        );

        // logger.info(
        //   `responseFromDeleteDeviceOnPlatform -- ${responseFromDeleteDeviceOnPlatform}`
        // );

        if (responseFromDeleteDeviceOnPlatform.success === true) {
          return responseFromDeleteDeviceOnPlatform;
        } else if (responseFromDeleteDeviceOnPlatform.success === false) {
          return responseFromDeleteDeviceOnPlatform;
        }
      } else if (responseFromDeleteDeviceFromThingspeak.success === false) {
        return {
          success: false,
          message: responseFromDeleteDeviceFromThingspeak.message,
          errors: responseFromDeleteDeviceFromThingspeak.errors
            ? responseFromDeleteDeviceFromThingspeak.errors
            : { message: "" },
          status: parseInt(
            `${
              responseFromDeleteDeviceFromThingspeak.status
                ? responseFromDeleteDeviceFromThingspeak.status
                : ""
            }`
          ),
        };
      }
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
  },
  list: async (request, next) => {
    try {
      const { tenant, path, limit, skip } = request.query;
      const filter = generateFilter.devices(request, next);
      if (!isEmpty(path)) {
        filter.path = path;
      }
      const responseFromListDevice = await DeviceModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      return responseFromListDevice;
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
  },
  clear: (request, next) => {
    return {
      success: false,
      message: "coming soon...",
      status: httpStatus.NOT_IMPLEMENTED,
      errors: { message: "coming soon" },
    };
  },
  createOnClarity: (request, next) => {
    return {
      message: "coming soon",
      success: false,
      status: httpStatus.NOT_IMPLEMENTED,
      errors: { message: "coming soon" },
    };
  },
  createOnPlatform: async (request, next) => {
    try {
      logText("createOnPlatform util....");
      const { tenant } = request.query;
      const { body } = request;

      const responseFromRegisterDevice = await DeviceModel(tenant).register(
        body,
        next
      );
      // logger.info(
      //   `the responseFromRegisterDevice --${responseFromRegisterDevice} `
      // );

      if (responseFromRegisterDevice.success === true) {
        try {
          const kafkaProducer = kafka.producer({
            groupId: constants.UNIQUE_PRODUCER_GROUP,
          });
          await kafkaProducer.connect();
          let deviceDataString = responseFromRegisterDevice.data
            ? JSON.stringify(responseFromRegisterDevice.data)
            : "";
          await kafkaProducer.send({
            topic: constants.DEVICES_TOPIC,
            messages: [
              {
                action: "create",
                value: deviceDataString,
              },
            ],
          });
          await kafkaProducer.disconnect();
        } catch (error) {
          logObject("error on kafka", error);
        }

        return responseFromRegisterDevice;
      } else if (responseFromRegisterDevice.success === false) {
        return responseFromRegisterDevice;
      }
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
  },
  createOnThingSpeak: async (request, next) => {
    try {
      const baseURL = constants.CREATE_THING_URL;
      const { body } = request;
      const { category } = body;
      let data = body;
      if (isEmpty(data.long_name) && !isEmpty(data.name)) {
        data.long_name = data.name;
      }
      const map = constants.DEVICE_THINGSPEAK_MAPPINGS;
      let context = {};
      if (category === "bam") {
        context = constants.BAM_THINGSPEAK_FIELD_DESCRIPTIONS;
      } else if (category === "gas") {
        context = constants.THINGSPEAK_GAS_FIELD_DESCRIPTIONS;
      } else {
        context = constants.THINGSPEAK_FIELD_DESCRIPTIONS;
      }

      // logger.info(`the context -- ${context}`);
      const responseFromTransformRequestBody = await deviceUtil.transform(
        {
          data,
          map,
          context,
        },
        next
      );
      // logger.info(
      //   `responseFromTransformRequestBody -- ${responseFromTransformRequestBody}`
      // );
      let transformedBody = responseFromTransformRequestBody.success
        ? responseFromTransformRequestBody.data
        : {};

      if (isEmpty(transformedBody)) {
        return {
          success: false,
          message: responseFromTransformRequestBody.message,
        };
      }
      return await axios
        .post(baseURL, transformedBody)
        .then((response) => {
          let writeKey = response.data.api_keys[0].write_flag
            ? response.data.api_keys[0].api_key
            : "";
          let readKey = !response.data.api_keys[1].write_flag
            ? response.data.api_keys[1].api_key
            : "";

          let newChannel = {
            device_number: `${response.data.id}`,
            writeKey: writeKey,
            readKey: readKey,
          };

          return {
            success: true,
            message: "successfully created the device on thingspeak",
            data: newChannel,
          };
        })
        .catch((error) => {
          if (error.response) {
            return {
              success: false,
              status: error.response.status
                ? error.response.status
                : parseInt(error.response.data.status),
              errors: {
                message: error.response.statusText
                  ? error.response.statusText
                  : error.response.data.error,
              },
            };
          } else {
            return {
              success: false,
              message: "Bad Gateway Error",
              status: httpStatus.BAD_GATEWAY,
              errors: {
                message:
                  "unable to create the device on thingspeak, crosscheck why",
              },
            };
          }
        });
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
  },
  updateOnThingspeak: async (request, next) => {
    try {
      // logger.info(`  updateOnThingspeak's request -- ${request}`);
      const { device_number } = request.query;
      logElement("device_number", device_number);
      const { body } = request;
      const config = {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      };
      const data = body;
      const map = constants.DEVICE_THINGSPEAK_MAPPINGS;
      const context = constants.THINGSPEAK_FIELD_DESCRIPTIONS;
      // logger.info(`the context -- ${context}`);
      const responseFromTransformRequestBody = await deviceUtil.transform(
        {
          data,
          map,
        },
        next
      );
      // logger.info(
      //   `responseFromTransformRequestBody -- ${responseFromTransformRequestBody}`
      // );
      let transformedBody = responseFromTransformRequestBody.success
        ? responseFromTransformRequestBody.data
        : {};

      // logger.info(`transformedBody -- ${transformedBody}`);

      const response = await axios.put(
        constants.UPDATE_THING(device_number),
        qs.stringify(transformedBody),
        config
      );

      // logger.info(`successfully updated the device on thingspeak`);
      return {
        success: true,
        message: "successfully updated the device on thingspeak",
        data: response.data,
        status: httpStatus.OK,
      };
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
  },
  updateOnClarity: (request, next) => {
    return {
      success: false,
      message: "coming soon...",
      errors: { message: "coming soon" },
      status: httpStatus.NOT_IMPLEMENTED,
    };
  },
  updateOnPlatform: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { body } = request;
      const update = body;
      const filter = generateFilter.devices(request, next);
      let opts = {};
      const responseFromModifyDevice = await DeviceModel(tenant).modify(
        {
          filter,
          update,
          opts,
        },
        next
      );
      return responseFromModifyDevice;
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
  },
  updateManyDevicesOnPlatform: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { deviceIds, updateData } = request.body;

      // Find existing devices
      const existingDevices = await DeviceModel(tenant)
        .find({
          _id: { $in: deviceIds },
        })
        .select("_id");

      // Create sets for comparison
      const existingDeviceIds = new Set(
        existingDevices.map((device) => device._id.toString())
      );
      const providedDeviceIds = new Set(deviceIds.map((id) => id.toString()));

      // Identify non-existent device IDs
      const nonExistentDeviceIds = deviceIds.filter(
        (id) => !existingDeviceIds.has(id.toString())
      );

      // If there are non-existent devices, prepare a detailed error
      if (nonExistentDeviceIds.length > 0) {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message: "Some provided device IDs do not exist",
            nonExistentDeviceIds: nonExistentDeviceIds,
            existingDeviceIds: Array.from(existingDeviceIds),
            totalProvidedDeviceIds: deviceIds.length,
            existingDeviceCount: existingDevices.length,
          })
        );
      }

      // Prepare filter
      const filter = {
        _id: { $in: deviceIds },
      };

      // Additional filtering from generateFilter if needed
      const additionalFilter = generateFilter.devices(request, next);
      Object.assign(filter, additionalFilter);

      // Optimize options for bulk update
      const opts = {
        new: true,
        multi: true,
        runValidators: true,
        context: "query",
      };

      // Perform bulk update
      const responseFromBulkModifyDevices = await DeviceModel(
        tenant
      ).bulkModify(
        {
          filter,
          update: updateData,
          opts,
        },
        next
      );

      // Attach additional metadata to the response
      return {
        ...responseFromBulkModifyDevices,
        metadata: {
          totalDevicesUpdated: responseFromBulkModifyDevices.data.modifiedCount,
          requestedDeviceIds: deviceIds,
          existingDeviceIds: Array.from(existingDeviceIds),
        },
      };
    } catch (error) {
      logger.error(`🐛🐛 Bulk Update Error: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deleteOnThingspeak: async (request, next) => {
    try {
      let device_number = parseInt(request.query.device_number, 10);
      let response = await axios
        .delete(`${constants.DELETE_THING_URL(device_number)}`)
        .catch((e) => {
          logger.error(`error.response.data -- ${e.response.data}`);
          logger.error(`error.response.status -- ${e.response.status}`);
          logger.error(`error.response.headers -- ${e.response.headers}`);
          if (e.response) {
            next(
              new HttpError("Bad Request Error", e.response.data.status, {
                message:
                  "corresponding device_number does not exist on external system, consider SOFT delete",
                error: e.response.data.error,
              })
            );
          }
        });

      if (!isEmpty(response.success) && !response.success) {
        next(
          new HttpError(`${response.message}`, `${response.status}`, {
            message: "unable to complete operation",
            error: `${response.error}`,
          })
        );
      } else if (!isEmpty(response.data)) {
        return {
          success: true,
          message: "successfully deleted the device on thingspeak",
          data: response.data,
        };
      }
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
  },
  deleteOnPlatform: async (request, next) => {
    try {
      const { tenant } = request.query;
      const filter = generateFilter.devices(request, next);
      const responseFromRemoveDevice = await DeviceModel(tenant).remove(
        {
          filter,
        },
        next
      );
      return responseFromRemoveDevice;
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
  },
  deleteOnclarity: (request, next) => {
    return {
      success: false,
      message: "coming soon",
      errors: { message: "coming soon..." },
      status: httpStatus.NOT_IMPLEMENTED,
    };
  },
  decryptManyKeys: (encryptedKeys, next) => {
    try {
      let results = [];
      function helper(helperInput) {
        if (helperInput.length === 0) {
          return;
        }
        const bytes = cryptoJS.AES.decrypt(
          helperInput[0].encrypted_key,
          constants.KEY_ENCRYPTION_KEY
        );
        const originalText = bytes.toString(cryptoJS.enc.Utf8);
        helperInput[0].decrypted_key = originalText;
        results.push(helperInput[0]);
        helper(helperInput.slice(1));
      }
      helper(encryptedKeys);
      return {
        success: true,
        message: "successfully decrypted the provided keys",
        data: results,
        status: httpStatus.OK,
      };
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
  },
  decryptKey: (encryptedKey, next) => {
    try {
      let bytes = cryptoJS.AES.decrypt(
        encryptedKey,
        constants.KEY_ENCRYPTION_KEY
      );
      let originalText = bytes.toString(cryptoJS.enc.Utf8);
      let isKeyUnknown = isEmpty(originalText);
      if (isKeyUnknown) {
        return {
          success: false,
          status: httpStatus.NOT_FOUND,
          message: "the provided encrypted key is not recognizable",
          errors: { message: "the provided encrypted key is not recognizable" },
        };
      } else {
        return {
          success: true,
          message: "successfully decrypted the text",
          data: originalText,
          status: httpStatus.OK,
        };
      }
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
  },
  transform: ({ data = {}, map = {}, context = {} } = {}, next) => {
    try {
      const result = transform(data, map, context);
      if (!isEmpty(result)) {
        return {
          success: true,
          message: "successfully transformed the json request",
          data: result,
        };
      } else {
        logger.warn(
          `the request body for the external system is empty after transformation`
        );
        return {
          success: true,
          message:
            "the request body for the external system is empty after transformation",
          data: result,
        };
      }
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
  },
  refresh: async (request, next) => {
    try {
      return {
        success: false,
        message: "feature temporarily disabled --coming soon",
        status: httpStatus.SERVICE_UNAVAILABLE,
        errors: { message: "Service Unavailable" },
      };

      let modifiedRequest = Object.assign({}, request);

      const filter = generateFilter.devices(request, next);
      const { tenant } = modifiedRequest.query;
      logObject("the filter being used to filter", filter);

      const responseFromListDevice = await DeviceModel(tenant).list(
        {
          filter,
        },
        next
      );

      if (responseFromListDevice.success === true) {
        let deviceDetails = { ...responseFromListDevice.data[0] };
        modifiedRequest["body"] = deviceDetails;
        delete modifiedRequest.body._id;
        delete modifiedRequest.body.sites;
      } else if (responseFromListDevice.success === false) {
        return responseFromListDevice;
      }

      if (
        !isEmpty(modifiedRequest["body"]["device_codes"]) &&
        modifiedRequest["body"]["device_codes"].length < 7
      ) {
        const deviceCodeValues = ["name_id", "name", "_id", "device_number"];

        for (const deviceCode of deviceCodeValues) {
          modifiedRequest["body"]["device_codes"].push(deviceCode);
          logObject("modifiedRequest is here baby", modifiedRequest);
        }
      }

      delete modifiedRequest["body"]["device_number"];

      const update = modifiedRequest["body"];
      const opts = {};

      const responseFromModifyDevice = await DeviceModel(tenant).modify(
        {
          filter,
          update,
          opts,
        },
        next
      );

      if (responseFromModifyDevice.success === true) {
        return {
          success: true,
          message: "Device Details Successfully Refreshed",
          data: responseFromModifyDevice.data,
        };
      } else if (responseFromModifyDevice.success === false) {
        return responseFromModifyDevice;
      }
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
  },
  claimDevice: async (request, next) => {
    try {
      const { device_name, claim_token, user_id } = request.body;
      const { tenant } = request.query;

      // Validate user_id
      if (!user_id || !isValidObjectId(user_id)) {
        return {
          success: false,
          message: "Invalid user_id",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "user_id must be a valid MongoDB ObjectId" },
        };
      }

      // Find unclaimed device
      const device = await DeviceModel(tenant).findOne({
        name: device_name,
        claim_status: "unclaimed",
      });

      if (!device) {
        return {
          success: false,
          message: "Device not found or already claimed",
          status: httpStatus.NOT_FOUND,
          errors: { message: "Device not available for claiming" },
        };
      }

      // Optional: Verify claim token if provided
      if (device.claim_token && device.claim_token !== claim_token) {
        return {
          success: false,
          message: "Invalid claim token",
          status: httpStatus.FORBIDDEN,
          errors: { message: "Claim token does not match" },
        };
      }

      // Claim the device - Use proper ObjectId creation
      const updatedDevice = await DeviceModel(tenant).findOneAndUpdate(
        { name: device_name, claim_status: "unclaimed" },
        {
          owner_id: new ObjectId(user_id), // Fixed ObjectId usage
          claim_status: "claimed",
          claimed_at: new Date(),
        },
        { new: true }
      );

      if (!updatedDevice) {
        return {
          success: false,
          message: "Failed to claim device",
          status: httpStatus.CONFLICT,
          errors: { message: "Device may have been claimed by another user" },
        };
      }

      return {
        success: true,
        message: "Device claimed successfully!",
        data: {
          name: updatedDevice.name,
          long_name: updatedDevice.long_name,
          status: updatedDevice.status,
          claim_status: updatedDevice.claim_status,
          claimed_at: updatedDevice.claimed_at,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Claim Device Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  getMyDevices: async (request, next) => {
    try {
      const { user_id, organization_id } = request.query;
      const { tenant } = request.query;

      // Step 1: Validate user_id
      if (!user_id) {
        return {
          success: false,
          message: "user_id is required",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "user_id parameter is missing" },
        };
      }

      if (!isValidObjectId(user_id)) {
        return {
          success: false,
          message: "Invalid user_id format",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "user_id must be a valid MongoDB ObjectId" },
        };
      }

      // Step 2: Validate organization_id if provided
      if (organization_id && !isValidObjectId(organization_id)) {
        return {
          success: false,
          message: "Invalid organization_id format",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: "organization_id must be a valid MongoDB ObjectId",
          },
        };
      }

      // Step 3: Build filter with proper ObjectId creation
      let filter = {};

      if (organization_id) {
        // Get devices assigned to organization OR owned by user
        filter = {
          $or: [
            { owner_id: new ObjectId(user_id) },
            {
              assigned_organization_id: new ObjectId(organization_id),
            },
          ],
        };
      } else {
        // Get only user's personal devices
        filter = { owner_id: new ObjectId(user_id) };
      }

      // Step 4: Query devices with error handling
      const devices = await DeviceModel(tenant)
        .find(filter)
        .select(
          "name long_name status isActive deployment_date latitude longitude claim_status owner_id assigned_organization_id claimed_at"
        )
        .populate("assigned_organization_id", "grp_title")
        .sort({ claimed_at: -1 })
        .lean(); // Use lean() for better performance

      return {
        success: true,
        message: "Devices retrieved successfully",
        data: devices || [],
        status: httpStatus.OK,
      };
    } catch (error) {
      logObject("Get My Devices Error Details:", error);
      logger.error(`🐛🐛 Get My Devices Error ${error.message}`);

      // Handle specific MongoDB errors
      if (error.name === "CastError") {
        return {
          success: false,
          message: "Invalid ObjectId format",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "One or more IDs have invalid format" },
        };
      }

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  checkDeviceAvailability: async (request, next) => {
    try {
      const { deviceName } = request.params;
      const { tenant } = request.query;

      const device = await DeviceModel(tenant)
        .findOne({
          name: deviceName,
        })
        .select("claim_status owner_id");

      if (!device) {
        return {
          success: false,
          message: "Device not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "Device does not exist" },
        };
      }

      const isAvailable = device.claim_status === "unclaimed";

      return {
        success: true,
        message: isAvailable
          ? "Device available for claiming"
          : "Device already claimed",
        data: {
          available: isAvailable,
          status: device.claim_status,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Check Device Availability Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  assignDeviceToOrganization: async (request, next) => {
    try {
      const { device_name, organization_id, user_id } = request.body;
      const { tenant } = request.query;

      // Validate IDs
      if (!user_id || !isValidObjectId(user_id)) {
        return {
          success: false,
          message: "Invalid user_id",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "user_id must be a valid MongoDB ObjectId" },
        };
      }

      if (!organization_id || !isValidObjectId(organization_id)) {
        return {
          success: false,
          message: "Invalid organization_id",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: "organization_id must be a valid MongoDB ObjectId",
          },
        };
      }

      // Verify user owns the device
      const device = await DeviceModel(tenant).findOne({
        name: device_name,
        owner_id: new ObjectId(user_id), // Fixed ObjectId usage
      });

      if (!device) {
        return {
          success: false,
          message: "Device not found or not owned by user",
          status: httpStatus.FORBIDDEN,
          errors: { message: "Cannot assign device you don't own" },
        };
      }

      // Update device assignment
      const updatedDevice = await DeviceModel(tenant).findOneAndUpdate(
        { name: device_name, owner_id: new ObjectId(user_id) },
        {
          assigned_organization_id: new ObjectId(organization_id), // Fixed ObjectId usage
          organization_assigned_at: new Date(),
        },
        { new: true }
      );

      return {
        success: true,
        message: "Device assigned to organization successfully",
        data: {
          name: updatedDevice.name,
          assigned_organization_id: updatedDevice.assigned_organization_id,
          organization_assigned_at: updatedDevice.organization_assigned_at,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Assign Device Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  generateClaimQRCode: async (request, next) => {
    try {
      const { deviceName } = request.params;
      const { tenant } = request.query;
      const { include_token = false } = request.query;

      // Verify device exists
      const device = await DeviceModel(tenant)
        .findOne({
          name: deviceName,
        })
        .select("name long_name claim_status claim_token");

      if (!device) {
        return {
          success: false,
          message: "Device not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "Device does not exist" },
        };
      }

      // Generate QR code data
      const baseUrl = constants.DEPLOYMENT_URL || "https://platform.airqo.net";
      const qrData = {
        device_id: device.name,
        device_name: device.long_name || device.name,
        claim_url: `${baseUrl}/claim-device?id=${device.name}`,
        platform: "AirQo",
        tenant: tenant,
        generated_at: new Date().toISOString(),
      };

      // Include claim token if requested and device has one
      if (include_token === "true" && device.claim_token) {
        qrData.token = device.claim_token;
        qrData.claim_url += `&token=${device.claim_token}`;
      }

      const qrDataString = JSON.stringify(qrData);

      // Generate QR code image buffer
      const qrImageBuffer = await QRCode.toBuffer(qrDataString, {
        type: "png",
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      return {
        success: true,
        message: "QR code generated successfully",
        data: {
          device_name: device.name,
          qr_code_data: qrData,
          qr_code_url: qrData.claim_url,
        },
        qr_image_buffer: qrImageBuffer,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Generate QR Code Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  migrateDevicesForClaiming: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { dry_run = false, batch_size = 100 } = request.body;

      logger.info(`Starting device migration for tenant: ${tenant}`);

      if (dry_run) {
        // Just count how many devices would be updated
        const devicesNeedingMigration = await DeviceModel(
          tenant
        ).countDocuments({
          claim_status: { $exists: false },
        });

        return {
          success: true,
          message: "Dry run completed",
          data: {
            devices_needing_migration: devicesNeedingMigration,
            would_be_updated: devicesNeedingMigration,
            dry_run: true,
          },
          status: httpStatus.OK,
        };
      }

      // Actual migration
      const migrationResult = await DeviceModel(tenant).updateMany(
        {
          claim_status: { $exists: false }, // Devices without claim_status
        },
        {
          $set: {
            claim_status: "unclaimed",
            owner_id: null,
            claimed_at: null,
            claim_token: null,
            assigned_organization_id: null,
            organization_assigned_at: null,
          },
        }
      );

      // Optional: Generate claim tokens for devices that need them
      const { generate_tokens = false } = request.body;
      let tokenGenerationResult = null;

      if (generate_tokens) {
        const devicesNeedingTokens = await DeviceModel(tenant)
          .find({
            claim_token: null,
            claim_status: "unclaimed",
          })
          .limit(batch_size);

        let tokensGenerated = 0;
        for (const device of devicesNeedingTokens) {
          const claimToken = claimTokenUtil.generateClaimToken();
          await DeviceModel(tenant).updateOne(
            { _id: device._id },
            { $set: { claim_token: claimToken } }
          );
          tokensGenerated++;
        }

        tokenGenerationResult = {
          tokens_generated: tokensGenerated,
          batch_processed: devicesNeedingTokens.length,
        };
      }

      logger.info(
        `Migration completed. Updated ${migrationResult.modifiedCount} devices.`
      );

      return {
        success: true,
        message: "Device migration completed successfully",
        data: {
          devices_updated: migrationResult.modifiedCount,
          devices_matched: migrationResult.matchedCount,
          token_generation: tokenGenerationResult,
          tenant: tenant,
          migration_completed_at: new Date(),
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Migration Error ${error.message}`);
      next(
        new HttpError("Migration Failed", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },
  switchOrganizationContext: async (request, next) => {
    try {
      const { organization_id } = request.params;
      const { user_id } = request.body;

      // Use organization utility for validation and context switching
      const result = await organizationUtil.switchOrganizationContext(
        {
          user_id,
          organization_id,
        },
        next
      );

      return result;
    } catch (error) {
      logger.error(`🐛🐛 Switch Context Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  getUserOrganizations: async (request, next) => {
    try {
      const { user_id } = request.query;

      const result = await organizationUtil.getUserOrganizations(user_id);

      return {
        success: result.success,
        message: result.message,
        data: result.data,
        status: result.success ? httpStatus.OK : httpStatus.BAD_REQUEST,
      };
    } catch (error) {
      logger.error(`🐛🐛 Get User Organizations Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  prepareDeviceForShipping: async (request, next) => {
    try {
      const { device_name, token_type = "hex" } = request.body;
      const { tenant } = request.query;

      // Check if device exists
      const device = await DeviceModel(tenant).findOne({ name: device_name });

      if (!device) {
        return {
          success: false,
          message: "Device not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: `Device ${device_name} does not exist` },
        };
      }

      // Generate claim token based on type
      const claimToken =
        token_type === "readable"
          ? claimTokenUtil.generateReadableToken()
          : claimTokenUtil.generateClaimToken();

      // Update device with claim token and shipping status
      const updatedDevice = await DeviceModel(tenant).findOneAndUpdate(
        { name: device_name },
        {
          $set: {
            claim_status: "unclaimed",
            claim_token: claimToken,
            owner_id: null,
            claimed_at: null,
            shipping_prepared_at: new Date(),
          },
        },
        { new: true }
      );

      // Generate QR code data
      const qrCodeData = claimTokenUtil.generateQRCodeData(
        device_name,
        claimToken,
        constants.DEPLOYMENT_URL
      );

      // Generate QR code image
      const qrCodeImage = await QRCode.toDataURL(JSON.stringify(qrCodeData), {
        type: "image/png",
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      // Generate printable label data
      const labelData = claimTokenUtil.generateDeviceLabelData(
        device_name,
        claimToken,
        qrCodeData
      );

      return {
        success: true,
        message: "Device prepared for shipping successfully",
        data: {
          device_name: device_name,
          claim_token: claimToken,
          token_type: token_type,
          qr_code_data: qrCodeData,
          qr_code_image: qrCodeImage,
          label_data: labelData,
          shipping_prepared_at: updatedDevice.shipping_prepared_at,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Prepare Device Shipping Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  prepareBulkDevicesForShipping: async (request, next) => {
    try {
      const { device_names, token_type = "hex" } = request.body;
      const { tenant } = request.query;

      if (!Array.isArray(device_names) || device_names.length === 0) {
        return {
          success: false,
          message: "device_names must be a non-empty array",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "Provide array of device names to prepare" },
        };
      }

      const results = [];
      const successful = [];
      const failed = [];

      for (const deviceName of device_names) {
        try {
          // Prepare each device individually
          const deviceRequest = {
            body: { device_name: deviceName, token_type },
            query: { tenant },
          };

          const result = await deviceUtil.prepareDeviceForShipping(
            deviceRequest,
            next
          );

          if (result.success) {
            successful.push(result.data);
          } else {
            failed.push({
              device_name: deviceName,
              error: result.message || result.errors?.message,
            });
          }
        } catch (error) {
          failed.push({
            device_name: deviceName,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        message: `Bulk preparation completed: ${successful.length} successful, ${failed.length} failed`,
        data: {
          successful_preparations: successful,
          failed_preparations: failed,
          summary: {
            total_requested: device_names.length,
            successful_count: successful.length,
            failed_count: failed.length,
          },
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Bulk Prepare Devices Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  getShippingPreparationStatus: async (request, next) => {
    try {
      const { device_names } = request.query;
      const { tenant } = request.query;

      let filter = {};

      if (device_names) {
        // Check specific devices
        const deviceNameArray = Array.isArray(device_names)
          ? device_names
          : device_names.split(",");
        filter.name = { $in: deviceNameArray };
      } else {
        // Get all devices with shipping preparation
        filter.shipping_prepared_at = { $exists: true };
      }

      const devices = await DeviceModel(tenant)
        .find(filter)
        .select(
          "name long_name claim_status claim_token shipping_prepared_at owner_id claimed_at"
        )
        .sort({ shipping_prepared_at: -1 })
        .lean();

      // Categorize devices by status
      const prepared = devices.filter(
        (d) => d.claim_status === "unclaimed" && d.claim_token
      );
      const claimed = devices.filter((d) => d.claim_status === "claimed");
      const deployed = devices.filter((d) => d.claim_status === "deployed");

      return {
        success: true,
        message: "Shipping preparation status retrieved successfully",
        data: {
          devices: devices,
          summary: {
            total_devices: devices.length,
            prepared_for_shipping: prepared.length,
            claimed_devices: claimed.length,
            deployed_devices: deployed.length,
          },
          categorized: {
            prepared_for_shipping: prepared,
            claimed_devices: claimed,
            deployed_devices: deployed,
          },
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Get Shipping Status Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  generateShippingLabels: async (request, next) => {
    try {
      const { device_names } = request.body;
      const { tenant } = request.query;

      const devices = await DeviceModel(tenant)
        .find({
          name: { $in: device_names },
          claim_token: { $exists: true, $ne: null },
        })
        .select("name long_name claim_token")
        .lean();

      if (devices.length === 0) {
        return {
          success: false,
          message: "No prepared devices found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "Devices not found or not prepared for shipping" },
        };
      }

      const labels = [];

      for (const device of devices) {
        const qrCodeData = claimTokenUtil.generateQRCodeData(
          device.name,
          device.claim_token,
          constants.DEPLOYMENT_URL
        );

        const labelData = claimTokenUtil.generateDeviceLabelData(
          device.name,
          device.claim_token,
          qrCodeData
        );

        // Generate QR code image for printing
        const qrCodeImage = await QRCode.toDataURL(JSON.stringify(qrCodeData), {
          width: 200,
          margin: 1,
        });

        labels.push({
          ...labelData,
          qr_code_image: qrCodeImage,
          device_long_name: device.long_name,
        });
      }

      return {
        success: true,
        message: "Shipping labels generated successfully",
        data: {
          labels: labels,
          total_labels: labels.length,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Generate Shipping Labels Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = deviceUtil;
