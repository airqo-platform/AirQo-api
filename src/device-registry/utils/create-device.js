"use strict";
const DeviceModel = require("@models/Device");
const axios = require("axios");
const { logObject, logElement, logText } = require("./log");
const { transform } = require("node-json-transform");
const constants = require("@config/constants");
const cryptoJS = require("crypto-js");
const generateFilter = require("./generate-filter");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-device-util`
);
const { HttpError } = require("@utils/errors");
const qs = require("qs");
const QRCode = require("qrcode");
const { Kafka } = require("kafkajs");
const httpStatus = require("http-status");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const createDevice = {
  getVisibleDevices: async (request) => {
    try {
      const { deviceIds, userId } = request;
      const user = await UserModel.findById(userId);
      const userGroup = user ? user.group : null;

      const aggregationPipeline = [
        {
          $match: {
            _id: {
              $in: deviceIds.map((deviceId) => ObjectId(deviceId)),
            },
          },
        },
        {
          $lookup: {
            from: "cohorts",
            localField: "cohorts",
            foreignField: "_id",
            as: "cohortDetails",
          },
        },
        {
          $match: {
            $or: [
              { "cohortDetails.visibility": { $exists: false } }, // Include devices not in any cohort
              { "cohortDetails.visibility": true }, // Include devices in cohorts with visibility true
              {
                $and: [
                  // Include devices in PRIVATE Cohort if the user belongs to the owning group
                  { "cohortDetails.name": "PRIVATE" },
                  { "cohortDetails.group": userGroup },
                ],
              },
            ],
          },
        },
        {
          $project: {
            _id: 1,
          },
        },
      ];

      const result = await DeviceModel.aggregate(aggregationPipeline);

      const visibleDeviceIds = result.map((device) => device._id.toString());
      return {
        success: true,
        data: { visibleDeviceIds },
        message: "performed device ID preprocessing",
      };
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
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
      logger.error(`Internal Server Error ${error.message}`);
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
    const responseFromList = await createDevice.list(request, next);
    if (responseFromList.success === true && responseFromList.data) {
      return true;
    }
    return false;
  },
  getDevicesCount: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const count = await DeviceModel(tenant).countDocuments({});
      return {
        success: true,
        message: "retrieved the number of devices",
        status: httpStatus.OK,
        data: count,
      };
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
      const responseFromListDevice = await createDevice.list(request, next);
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
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
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

      let responseFromCreateOnThingspeak = await createDevice.createOnThingSpeak(
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

        let responseFromCreateDeviceOnPlatform = await createDevice.createOnPlatform(
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

          let responseFromDeleteDeviceFromThingspeak = await createDevice.deleteOnThingspeak(
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
      logger.error(`Internal Server Error ${error.message}`);
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
        let responseFromListDevice = await createDevice.list(request, next);
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
        const responseFromUpdateDeviceOnPlatform = await createDevice.updateOnPlatform(
          request,
          next
        );
        return responseFromUpdateDeviceOnPlatform;
      } else if (!isEmpty(device_number)) {
        const responseFromUpdateDeviceOnThingspeak = await createDevice.updateOnThingspeak(
          modifiedRequest,
          next
        );
        if (responseFromUpdateDeviceOnThingspeak.success === true) {
          const responseFromUpdateDeviceOnPlatform = await createDevice.updateOnPlatform(
            request,
            next
          );
          return responseFromUpdateDeviceOnPlatform;
        } else if (responseFromUpdateDeviceOnThingspeak.success === false) {
          return responseFromUpdateDeviceOnThingspeak;
        }
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
      logger.error(`Internal Server Error ${error.message}`);
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
        let responseFromListDevice = await createDevice.list(request, next);
        // logger.info(`responseFromListDevice -- ${responseFromListDevice}`);
        if (responseFromListDevice.success === false) {
          return responseFromListDevice;
        }
        let device_number = responseFromListDevice.data[0].device_number;
        // logger.info(`device_number -- ${device_number}`);
        modifiedRequest["query"]["device_number"] = device_number;
      }
      // logger.info(`the modifiedRequest -- ${modifiedRequest} `);

      let responseFromDeleteDeviceFromThingspeak = await createDevice.deleteOnThingspeak(
        modifiedRequest,
        next
      );

      // logger.info(
      //   `responseFromDeleteDeviceFromThingspeak -- ${responseFromDeleteDeviceFromThingspeak}`
      // );
      if (responseFromDeleteDeviceFromThingspeak.success === true) {
        let responseFromDeleteDeviceOnPlatform = await createDevice.deleteOnPlatform(
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
      logger.error(`Internal Server Error ${error.message}`);
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
      const { tenant, category, limit, skip } = request.query;
      const filter = generateFilter.devices(request, next);
      if (!isEmpty(category)) {
        filter.category = category;
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
      logger.error(`Internal Server Error ${error.message}`);
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
      logger.error(`Internal Server Error ${error.message}`);
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
      } else {
        context = constants.THINGSPEAK_FIELD_DESCRIPTIONS;
      }

      // logger.info(`the context -- ${context}`);
      const responseFromTransformRequestBody = await createDevice.transform(
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
      logger.error(`Internal Server Error ${error.message}`);
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
      const responseFromTransformRequestBody = await createDevice.transform(
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
      logger.error(`Internal Server Error ${error.message}`);
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
      logger.error(`Internal Server Error ${error.message}`);
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
      logger.error(`Internal Server Error ${error.message}`);
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
      logger.error(`Internal Server Error ${error.message}`);
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
      logger.error(`Internal Server Error ${error.message}`);
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
      logger.error(`Internal Server Error ${error.message}`);
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
      logger.error(`Internal Server Error ${error.message}`);
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
      logger.error(`Internal Server Error ${error.message}`);
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

module.exports = createDevice;
