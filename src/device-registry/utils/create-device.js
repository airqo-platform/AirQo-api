const HTTPStatus = require("http-status");
const DeviceSchema = require("../models/Device");
const EventSchema = require("../models/Event");
const { getModelByTenant } = require("./multitenancy");
const axios = require("axios");
const { logObject, logElement, logText } = require("./log");
const deleteChannel = require("./delete-channel");
var { transform } = require("node-json-transform");
const Cryptr = require("cryptr");
const constants = require("../config/constants");
const mongoose = require("mongoose");
const cryptr = new Cryptr(constants.KEY_ENCRYPTION_KEY);
const generateFilter = require("./generate-filter");
const { logger_v2 } = require("./errors");
const jsonify = require("./jsonify");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger("create-device-util");

const DeviceModel = async (tenant) => {
  try {
    return await getModelByTenant(tenant, "device", DeviceSchema);
  } catch (error) {
    // devices = await getModelByTenant(tenant, "device", DeviceSchema);
    // return devices;
  }
};

const EventModel = (tenant) => {
  try {
    let events;
    events = mongoose.model("events");
    return events;
  } catch (error) {
    events = getModelByTenant(tenant, "event", EventSchema);
    return events;
  }
};

const registerDeviceUtil = {
  create: async (req) => {
    let responseFromTransform = await preOperation.transform(req);
    let responseFromCreateOnThingSpeak = await createOnThingSpeak(
      responseFromTransform.data.thingspeak
    );
    if (
      responseFromTransform.success == true ||
      responseFromCreateOnThingSpeak.success == true
    ) {
      let { plaformBody } = responseFromTransform.data;
      let thingspeakResponse = responseFromCreateOnThingSpeak.data;
      let writeKey = thingspeakResponse.api_keys[0].write_flag
        ? thingspeakResponse.api_keys[0].api_key
        : "";
      let readKey = !thingspeakResponse.api_keys[1].write_flag
        ? thingspeakResponse.api_keys[1].api_key
        : "";
      let device_number = thingspeakResponse.id;
      let enrichedPlaformBody = {
        ...plaformBody,
        device_number,
        writeKey,
        readKey,
      };
      let responseFromCreateOnPlatform = await createOnPlatform(
        enrichedPlaformBody
      );

      if (responseFromCreateOnPlatform.success == true) {
        return {
          success: true,
          message: responseFromCreateOnPlatform.message,
          data: responseFromCreateOnPlatform.data,
        };
      }
      if (responseFromCreateOnPlatform.success == false) {
        responseFromDeleteOnThingspeak = await registerDeviceUtil.deleteOnThingspeak(
          device_number
        );
        if (responseFromDeleteOnThingspeak.success == true) {
          return {
            success: false,
            message:
              "unable to create device, successfully deleted device on external system",
          };
        }
        return {
          success: false,
          message: "unable to successfully cancel device creation process",
        };
      }
    }
    if (responseFromCreateOnThingSpeak.success == false) {
      let error = responseFromCreateOnThingSpeak.error
        ? responseFromCreateOnThingSpeak.error
        : "";
      return {
        success: false,
        message: responseFromCreateOnThingSpeak.message,
        error,
      };
    }
  },
  update: async (req) => {
    try {
      let { tenant } = req.query;
      let filter = {};
      let update = req.body;
      let responseFromFilter = generateFilter.devices(req);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success == true) {
        filter = responseFromFilter.data;
      }

      if (responseFromFilter.success == false) {
        let error = responseFromFilter.error ? responseFromFilter.error : "";
        return {
          success: false,
          message: responseFromFilter.message,
          error,
        };
      }
      // logObject("the filter sent to DB", filter);
      // logObject("the update sent to DB", update);
      let responseFromModifyDevice = await DeviceModel(
        tenant.toLowerCase()
      ).modify({
        filter,
        update,
      });
      // logObject("responseFromModifyDevice", responseFromModifyDevice);
      if (responseFromModifyDevice.success == true) {
        let device = responseFromModifyDevice.data;
        let responseFromSendEmail = await mailer.update(
          device.email,
          device.firstName,
          device.lastName
        );
        // logObject("responseFromSendEmail", responseFromSendEmail);
        if (responseFromSendEmail.success == true) {
          return {
            success: true,
            message: responseFromModifyDevice.message,
            data: responseFromModifyDevice.data,
          };
        } else if (responseFromSendEmail.success == false) {
          if (responseFromSendEmail.error) {
            return {
              success: false,
              message: responseFromSendEmail.message,
              error: responseFromSendEmail.error,
            };
          } else {
            return {
              success: false,
              message: responseFromSendEmail.message,
            };
          }
        }
      } else if (responseFromModifyDevice.success == false) {
        if (responseFromModifyDevice.error) {
          return {
            success: false,
            message: responseFromModifyDevice.message,
            error: responseFromModifyDevice.error,
          };
        } else {
          return {
            success: false,
            message: responseFromModifyDevice.message,
          };
        }
      }
    } catch (e) {
      logElement("update devices util", e.message);
      return {
        success: false,
        message: "util server error",
        error: e.message,
      };
    }
  },
  delete: async (req) => {
    try {
      let { tenant } = req.query;
      let filter = {};
      let responseFromFilter = generateFilter.devices(req);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success == true) {
        filter = responseFromFilter.data;
      }

      if (responseFromFilter.success == false) {
        let error = responseFromFilter.error ? responseFromFilter.error : "";
        return {
          success: false,
          message: responseFromFilter.message,
          error,
        };
      }
      let responseFromRemoveDevice = await DeviceModel(
        tenant.toLowerCase()
      ).remove({
        filter,
      });
      if (responseFromRemoveDevice.success == true) {
        return {
          success: true,
          message: responseFromRemoveDevice.message,
          data: responseFromRemoveDevice.data,
        };
      } else if (responseFromRemoveDevice.success == false) {
        if (responseFromRemoveDevice.error) {
          return {
            success: false,
            message: responseFromRemoveDevice.message,
            error: responseFromRemoveDevice.error,
          };
        } else {
          return {
            success: false,
            message: responseFromRemoveDevice.message,
          };
        }
      }
    } catch (e) {
      logElement("delete devices util", e.message);
      return {
        success: false,
        message: "util server error",
        error: e.message,
      };
    }
  },
  list: async (req) => {
    try {
      let { tenant } = req.query;
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      let filter = {};
      let responseFromFilter = generateFilter.devices(req);
      logElement(
        "is responseFromFilter in util a success?",
        responseFromFilter.success
      );

      logObject("the filter", responseFromFilter.data);

      if (responseFromFilter.success == true) {
        logObject("the filter", responseFromFilter.data);
        filter = responseFromFilter.data;
      }

      if (responseFromFilter.success == false) {
        let error = responseFromFilter.error ? responseFromFilter.error : "";
        return {
          success: false,
          message: responseFromFilter.message,
          error,
        };
      }

      let responseFromListDevice = await getModelByTenant(
        tenant,
        "device",
        DeviceSchema
      ).list({
        filter,
        limit,
        skip,
      });

      logElement(
        "is responseFromListDevice in util a success",
        !responseFromListDevice.success
      );

      if (responseFromListDevice.success == false) {
        let error = responseFromListDevice.error
          ? responseFromListDevice.error
          : "";

        return {
          success: false,
          message: responseFromListDevice.message,
          error,
        };
      } else {
        let message = !isEmpty(responseFromListDevice)
          ? "successfully listed the device(s)"
          : "no device(s) data available for this request";
        return {
          success: true,
          message: message,
          data: responseFromListDevice,
        };
      }
    } catch (e) {
      logElement("error for list devices util", e.message);
      return {
        success: false,
        message: "list devices util - server error",
        error: e.message,
      };
    }
  },
  clear: (req) => {
    /**
     * This requires the Events collection
     * clear on ThingSpeak
     * And then clear on platform
     * In case
     */
  },

  createOnClarity: (tenant, req, res) => {
    return {
      message: `temporary redirect, device creation for this organisation (${tenant}) not yet enabled/integrated`,
      success: false,
    };
  },

  createOnPlatform: async (request) => {
    try {
      const { tenant, body } = request;
      if (!tenant || !body) {
        logger.error("required params are missing -- createOnPlatform util");
        logger_v2.badRequest(
          "required params are missing",
          "createOnPlatform util"
        );
        return {
          success: false,
          message: "required params are missing -- createOnPlatform util",
        };
      }
      const responseFromRegisterDevice = await getModelByTenant(
        tenant,
        "device",
        DeviceSchema
      ).register(body);

      logger.info(
        `the responseFromRegisterDevice --${JSON.stringify(
          responseFromRegisterDevice
        )} `
      );

      if (responseFromRegisterDevice.success == true) {
        return {
          success: true,
          data: responseFromRegisterDevice.data,
          message: responseFromRegisterDevice.message,
        };
      }

      if (responseFromRegisterDevice.success == false) {
        let error = responseFromRegisterDevice.error
          ? responseFromRegisterDevice.error
          : "";

        return {
          success: false,
          message: responseFromRegisterDevice.message,
          error,
        };
      }
    } catch (error) {
      logger.error("server error - createOnPlatform util");
      logger_v2.tryCatchErrors(error, "server error - createOnPlatform util");
    }
  },

  createOnThingSpeak: async (
    req,
    res,
    baseUrl,
    prepBodyTS,
    channel,
    device,
    deviceBody,
    tenant
  ) => {
    await axios
      .post(baseUrl, prepBodyTS)
      .then(async (response) => {
        channel = response.data.id;
        logText("device successfully created on TS.");
        let writeKey = response.data.api_keys[0].write_flag
          ? response.data.api_keys[0].api_key
          : "";
        let readKey = !response.data.api_keys[1].write_flag
          ? response.data.api_keys[1].api_key
          : "";
        let prepBodyDeviceModel = {
          ...deviceBody,
          channelID: `${response.data.id}`,
          writeKey: writeKey,
          readKey: readKey,
        };
        logText("adding the device to the platform...");
        await createDevice(tenant, prepBodyDeviceModel, req, res);
      })
      .catch(async (e) => {
        logElement(
          "unable to create device on the platform, attempting to delete it from TS",
          e.message
        );
        let error = e.message;
        await deleteChannel(channel, device, error, req, res);
      });
  },
  createOnThingSpeak: async (body, device_id) => {
    await axios
      .post(constants.THINGSPEAK_BASE_URL, body)
      .then(async (response) => {
        return {
          success: true,
          message: "successfully created device",
          data: response.data,
        };
      })
      .catch(async (e) => {
        return {
          success: false,
          message: "server error, unable to create on ts",
          error: e.message,
        };
      });
  },
  updateOnThingspeak: (body, device_id) => {},
  updateOnClarity: (body, device_id) => {},
  updateOnPlatform: async (request) => {
    try {
      const { id, device_number, name, tenant, body } = request.query;
      logObject("The request", request);
      let update = body;
      let filter = {};
      let responseFromFilter = generateFilter.devices(request);
      logElement(
        "is responseFromFilter in util a success?",
        responseFromFilter.success
      );
      logger.info(`the filter ${JSON.stringify(responseFromFilter.data)}`);
      if (responseFromFilter.success == true) {
        logObject("the filter", responseFromFilter.data);
        filter = responseFromFilter.data;
      }

      if (responseFromFilter.success == false) {
        let error = responseFromFilter.error ? responseFromFilter.error : "";
        logger.error(
          `responseFromFilter.error in create-device util--${responseFromFilter.error}`
        );
        return {
          success: false,
          message: responseFromFilter.message,
          error,
        };
      }
      let responseFromModifyDevice = await getModelByTenant(
        tenant,
        "device",
        DeviceSchema
      ).modify({ filter, update });

      if (responseFromModifyDevice.success == true) {
        return {
          success: true,
          message: responseFromModifyDevice.message,
          data: responseFromModifyDevice.data,
        };
      }

      if (responseFromModifyDevice.success == false) {
        let error = responseFromModifyDevice.error
          ? responseFromModifyDevice.error
          : "";
        return {
          success: false,
          message: responseFromModifyDevice.message,
          error,
        };
      }
    } catch (error) {
      logger.error(`updateOnPlatform util -- ${error.message}`);
      logger_v2.badRequest("updateOnPlatform util", error.message);
    }
  },
  deleteOnThingspeak: (body, device_id) => {},
  deleteOnPlatform: async (request) => {
    try {
      const { tenant } = request.query;
      logger.info(
        `the requesting coming into deleteOnPlatform util --${request}`
      );

      let filter = {};
      let responseFromFilter = generateFilter.devices(request);
      if (responseFromFilter.success == true) {
        logger.info(`the filter ${JSON.stringify(responseFromFilter.data)}`);
        filter = responseFromFilter.data;
      }

      if (responseFromFilter.success == false) {
        let error = responseFromFilter.error ? responseFromFilter.error : "";
        logger.error(
          `responseFromFilter.error in create-device util--${responseFromFilter.error}`
        );
        return {
          success: false,
          message: responseFromFilter.message,
          error,
        };
      }
      let responseFromRemoveDevice = await getModelByTenant(
        tenant,
        "device",
        DeviceSchema
      ).remove({ filter });

      logger.info(
        `responseFromRemoveDevice --- ${JSON.stringify(
          responseFromRemoveDevice
        )}`
      );
      if (responseFromRemoveDevice.success == true) {
        return {
          success: true,
          message: responseFromRemoveDevice.message,
          data: responseFromRemoveDevice.data,
        };
      }

      if (responseFromRemoveDevice.success == false) {
        let error = responseFromRemoveDevice.error
          ? responseFromRemoveDevice.error
          : "";
        return {
          success: false,
          message: responseFromRemoveDevice.message,
          error,
        };
      }
    } catch (error) {
      logger.error(`updateOnPlatform util -- ${error.message}`);
      logger_v2.badRequest("updateOnPlatform util", error.message);
    }
  },
  deleteOnclarity: (body, device_id) => {},
  clearOnThingspeak: async (req, body, device_id) => {
    try {
      const { device, tenant } = req.query;

      if (tenant) {
        if (!device) {
          return {
            message:
              "please use the correct query parameter, check API documentation",
            success: false,
          };
        }
        const deviceDetails = await getDetail(tenant, device);
        const doesDeviceExist = !isEmpty(deviceDetails);
        logElement("isDevicePresent ?", doesDeviceExist);
        if (doesDeviceExist) {
          const channelID = await getChannelID(
            req,
            res,
            device,
            tenant.toLowerCase()
          );
          logText("...................................");
          logText("clearing the Thing....");
          logElement("url", constants.CLEAR_THING_URL(channelID));
          await axios
            .delete(constants.CLEAR_THING_URL(channelID))
            .then(async (response) => {
              logText("successfully cleared the device in TS");
              logObject("response from TS", response.data);
              return {
                message: `successfully cleared the data for device ${device}`,
                success: true,
                updatedDevice,
              };
            })
            .catch(function(error) {
              console.log(error);
              return {
                message: `unable to clear the device data, device ${device} does not exist`,
                success: false,
              };
            });
        } else {
          logText(`device ${device} does not exist in the system`);
          return {
            message: `device ${device} does not exist in the system`,
            success: false,
          };
        }
      } else {
        return {
          success: false,
          message: "missing query params, please check documentation",
        };
      }
    } catch (e) {
      logText(`unable to clear device ${device}`);
      logger_v2.tryCatchErrors(e, "create-device util server error");
    }
  },
  clearOnClarity: (body, device_id) => {
    return {
      success: false,
      message: "coming soon - unavailable option",
    };
  },
  clearOnPlatform: async (req) => {
    try {
      /**
       * clear events for a device
       */
      let { tenant } = req.query;
      let filter = {};
      let responseFromFilter = generateFilter.events(req);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success == true) {
        filter = responseFromFilter.data;
      }

      if (responseFromFilter.success == false) {
        let error = responseFromFilter.error ? responseFromFilter.error : "";
        return {
          success: false,
          message: responseFromFilter.message,
          error,
        };
      }

      let responseFromClearDevice = await EventModel(
        tenant.toLowerCase()
      ).removeMany({
        filter,
      });
      if (responseFromClearDevice.success == true) {
        return {
          success: true,
          message: responseFromClearDevice.message,
          data: responseFromClearDevice.data,
        };
      } else if (responseFromClearDevice.success == false) {
        if (responseFromClearDevice.error) {
          return {
            success: false,
            message: responseFromClearDevice.message,
            error: responseFromClearDevice.error,
          };
        } else {
          return {
            success: false,
            message: responseFromClearDevice.message,
          };
        }
      }
    } catch (e) {
      logElement("delete devices util", e.message);
      return {
        success: false,
        message: "util server error",
        error: e.message,
      };
    }
  },
  decryptKey: (encryptedKey) => {
    let decryptedKey = cryptr.decrypt(encryptedKey);
    return decryptedKey;
  },
};

const preOperation = {
  generate_name: async (generationVersion, generationCount) => {
    return `aq_g${generationVersion}_${generationCount}`;
  },
  transform_v0: (req, res) => {
    let {
      name,
      latitude,
      longitude,
      description,
      public_flag,
      readKey,
      writeKey,
      mobility,
      height,
      mountType,
      visibility,
      ISP,
      phoneNumber,
      device_manufacturer,
      product_name,
      powerType,
      locationID,
      host,
      isPrimaryInLocation,
      isUsedForCollocation,
      nextMaintenance,
      channelID,
      isActive,
      tags,
      elevation,
      pictures,
      siteName,
      locationName,
      photos,
    } = req.body;

    let deviceBody = {
      ...(!isEmpty(name) && { name: name }),
      ...(!isEmpty(readKey) && { readKey: readKey }),
      ...(!isEmpty(writeKey) && { writeKey: writeKey }),
      ...(!isEmpty(host) && { host: host }),
      ...(!isEmpty(isActive) && { isActive: isActive }),
      ...(!isEmpty(latitude) && { latitude: latitude }),
      ...(!isEmpty(longitude) && { longitude: longitude }),
      ...(!isEmpty(description) && { description: description }),
      ...(!isEmpty(visibility) && { visibility: visibility }),
      ...(!isEmpty(product_name) && { product_name: product_name }),
      ...(!isEmpty(powerType) && { powerType: powerType }),
      ...(!isEmpty(mountType) && { mountType: mountType }),
      ...(!isEmpty(device_manufacturer) && {
        device_manufacturer: device_manufacturer,
      }),
      ...(!isEmpty(phoneNumber) && { phoneNumber: phoneNumber }),
      ...(!isEmpty(channelID) && { channelID: channelID }),
      ...(!isEmpty(isPrimaryInLocation) && {
        isPrimaryInLocation: isPrimaryInLocation,
      }),
      ...(!isEmpty(isUsedForCollocation) && {
        isUsedForCollocation: isUsedForCollocation,
      }),
      ...(!isEmpty(ISP) && { ISP: ISP }),
      ...(!isEmpty(height) && { height: height }),
      ...(!isEmpty(mobility) && { mobility: mobility }),
      ...(!isEmpty(locationID) && { locationID: locationID }),
      ...(!isEmpty(nextMaintenance) && { nextMaintenance: nextMaintenance }),
      ...(!isEmpty(siteName) && { siteName }),
      ...(!isEmpty(locationName) && { locationName }),
      ...(!isEmpty(pictures) && { $addToSet: { pictures: pictures } }),
    };

    if (photos) {
      delete deviceBody.pictures;
      deviceBody = {
        ...deviceBody,
        ...(!isEmpty(photos) && {
          $pullAll: { pictures: photos },
        }),
      };
    }

    let options = {
      new: true,
      upsert: true,
    };

    // let transformedName = tranformDeviceName(name);

    let tsBody = {
      ...(!isEmpty(name) && { name: name }),
      ...(!isEmpty(elevation) && { elevation: elevation }),
      ...(!isEmpty(tags) && { tags: tags }),
      ...(!isEmpty(latitude) && { latitude: latitude }),
      ...(!isEmpty(longitude) && { longitude: longitude }),
      ...(!isEmpty(description) && { description: description }),
      ...(!isEmpty(visibility) && { public_flag: visibility }),
    };

    return { deviceBody, tsBody, options };
  },
  transform_v1: (data, map) => {
    try {
      let result = transform(data, map);
      if (result) {
        return {
          success: true,
          message: "successfully transformed the json request",
          data: result,
        };
      } else {
        return {
          success: false,
          message: "unable to transform the json request",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "server error - trasform util",
      };
    }
  },
  deviceMappings: {
    thingspeak: {
      name: "name",
      elevation: "elevation",
      tags: "tags",
      latitude: "latitude",
      longitude: "longitude",
      description: "description",
      public_flag: "visibility",
    },
    platform: {
      pictures: { $pullAll: { pictures: "remove_pictures" } },
      pictures: { $addToSet: { pictures: "add_pictures" } },
    },
    clarity: {},
  },
};

const createOnThingSpeak = async (
  req,
  res,
  baseUrl,
  prepBodyTS,
  channel,
  device,
  deviceBody,
  tenant
) => {
  await axios
    .post(baseUrl, prepBodyTS)
    .then(async (response) => {
      channel = response.data.id;
      logText("device successfully created on TS.");
      let writeKey = response.data.api_keys[0].write_flag
        ? response.data.api_keys[0].api_key
        : "";
      let readKey = !response.data.api_keys[1].write_flag
        ? response.data.api_keys[1].api_key
        : "";
      let prepBodyDeviceModel = {
        ...deviceBody,
        channelID: `${response.data.id}`,
        writeKey: writeKey,
        readKey: readKey,
      };
      logText("adding the device to the platform...");
      await createDevice(tenant, prepBodyDeviceModel, req, res);
    })
    .catch(async (e) => {
      logElement(
        "unable to create device on the platform, attempting to delete it from TS",
        e.message
      );
      let error = e.message;
      await deleteChannel(channel, device, error, req, res);
    });
};

const createOnClarity = (tenant, req, res) => {
  return res.status(HTTPStatus.TEMPORARY_REDIRECT).json({
    message: `temporary redirect, device creation for this organisation (${tenant}) not yet enabled/integrated`,
    success: false,
  });
};

const createDevice = async (tenant, prepBodyDeviceModel, req, res) => {
  const device = await getModelByTenant(
    tenant,
    "device",
    DeviceSchema
  ).createDevice(prepBodyDeviceModel);
  logElement("DB addition response", device);
  return res.status(HTTPStatus.CREATED).json({
    success: true,
    message: "successfully created the device",
    device,
  });
};

module.exports = {
  createDevice,
  createOnThingSpeak,
  createOnClarity,
  registerDeviceUtil,
};
