const HTTPStatus = require("http-status");
const DeviceSchema = require("../models/Device");
const { getModelByTenant } = require("./multitenancy");
const axios = require("axios");
const { logObject, logElement, logText } = require("./log");
const deleteChannel = require("./delete-channel");
var { transform } = require("node-json-transform");

const registerDevice = {
  create: async (req) => {
    let responseFromTransform = await registerDevice.transform(req);
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
        responseFromDeleteOnThingspeak = await registerDevice.deleteOnThingspeak(
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
  update: (req) => {},
  delete: (req) => {},
  view: (req) => {},
  clear: (req) => {},
  transformBodies: (req, res) => {
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
  transform: (data, map) => {
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

  createOnClarity: (tenant, req, res) => {
    return res.status(HTTPStatus.TEMPORARY_REDIRECT).json({
      message: `temporary redirect, device creation for this organisation (${tenant}) not yet enabled/integrated`,
      success: false,
    });
  },

  createOnPlatform: async (req) => {
    try {
      let { tenant } = req.query;
      let { platformBody } = await registerDevice.transform(req);
      const device = await getModelByTenant(
        tenant,
        "device",
        DeviceSchema
      ).register(platformBody);
      logElement("the added device", device);
      return {
        success: true,
        message: "successfully created the device",
        device,
      };
    } catch (error) {
      return {
        success: false,
        message: "server error - create on platform util",
        error: error.message,
      };
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
  updateOnPlatform: (body, device_id) => {},
  deleteOnThingspeak: (body, device_id) => {},
  deleteOnclarity: (body, device_id) => {},
  clearOnThingspeak: (body, device_id) => {},
  clearOnClarity: (body, device_id) => {},
  clearOnPlatform: (body, device_id) => {},
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
  registerDevice,
};
