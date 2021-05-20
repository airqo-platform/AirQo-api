const DeviceSchema = require("../models/Device");
const { getModelByTenant } = require("./multitenancy");
const axios = require("axios");
const { logObject, logElement, logText } = require("./log");
const { deleteOnExternalSystem } = require("./delete-device");
const HTTPStatus = require("http-status");
const iot = require("@google-cloud/iot");
const client = new iot.v1.DeviceManagerClient();
const { logObject, logElement, logText } = require("../utils/log");

/**
 * check for external system to use based on tenant
 * From the auth service, shall use the organisation ID of
 * the user in future to check for the tenancy to use as
 * they access this endpoint
 * @param {*} tenant
 * @param {*} baseUrl
 * @param {*} requestBody
 */
let createOnExternalSystem = (
  tenant,
  tsURL,
  tsBody,
  clarityURL,
  clarityBody
) => {
  if (tenant.toLowerCase() === "airqo") {
    let responseFromCreateOnThingSpeak = createDeviceOnThingSpeak(
      tsURL,
      tsBody
    );
    return responseFromCreateOnThingSpeak;
  } else if (tenant.toLowerCase() === "kcca") {
    let responseFromCreateOnClarity = createDeviceOnClarity(
      clarityURL,
      clarityBody
    );
    return responseFromCreateOnClarity;
  }
};

const createDevice = async (
  tenant,
  tsURL,
  tsBody,
  clarityURL,
  clarityBody,
  platformBody
) => {
  let responseFromCreateOnExternalSystem = createOnExternalSystem(
    tenant,
    tsURL,
    tsBody,
    clarityURL,
    clarityBody
  );

  if (responseFromCreateOnExternalSystem.success === true) {
    let enrichedPlatformBody = {
      ...(platformBody ? platformBody : {}),
      ...(responseFromCreateOnExternalSystem.channelID
        ? { channelID: responseFromCreateOnExternalSystem.channelID }
        : {}),
      ...(responseFromCreateOnExternalSystem.writeKey
        ? { writeKey: responseFromCreateOnExternalSystem.writeKey }
        : {}),
      ...(responseFromCreateOnExternalSystem.readKey
        ? { readKey: responseFromCreateOnExternalSystem.readKey }
        : {}),
    };

    let responseFromCreateOnPlatform = createDeviceOnPlatform(
      tenant,
      enrichedPlatformBody
    );
    if (responseFromCreateOnPlatform.success === true) {
      return {
        success: true,
        message: responseFromCreateOnPlatform.message,
        createdDevice: responseFromCreateOnPlatform.createdDevice,
      };
    } else if (responseFromCreateOnPlatform.success === false) {
      if (responseFromCreateOnPlatform.error) {
        return {
          success: false,
          message: responseFromCreateOnPlatform.message,
          error: responseFromCreateOnPlatform.error,
        };
      } else {
        return {
          success: false,
          message: responseFromCreateOnPlatform.message,
        };
      }
    } else {
      return {
        success: false,
        message: responseFromCreateOnPlatform.message,
      };
    }
  } else if (responseFromCreateOnExternalSystem.success === false) {
    if (responseFromCreateOnExternalSystem.error) {
      return {
        success: false,
        message: responseFromCreateOnExternalSystem.message,
        error: responseFromCreateOnExternalSystem.error,
      };
    } else {
      return {
        success: false,
        message: responseFromCreateOnExternalSystem.message,
      };
    }
  } else {
    return {
      success: false,
      message: responseFromCreateOnExternalSystem.message,
    };
  }
};
const createDeviceOnThingSpeak = async (baseUrl, tsBody) => {
  return await axios
    .post(baseUrl, tsBody)
    .then(async (response) => {
      let channel = response.data.id;
      logText("device successfully created on ThingSpeak.");
      let writeKey = response.data.api_keys[0].write_flag
        ? response.data.api_keys[0].api_key
        : "";
      let readKey = !response.data.api_keys[1].write_flag
        ? response.data.api_keys[1].api_key
        : "";
      return {
        message: "",
        success: true,
        channelID: channel,
        writeKey: writeKey,
        readKey: readKey,
      };
    })
    .catch(async (e) => {
      let responseFromDeleteOnExternalSystem = await deleteOnExternalSystem(
        tenant,
        channel
      );
      if (responseFromDeleteOnExternalSystem.success === true) {
        return {
          success: false,
          message: responseFromDeleteOnExternalSystem.message,
          error: e.message,
        };
      } else if (responseFromDeleteOnExternalSystem.success === false) {
        if (responseFromDeleteOnExternalSystem.error) {
          return {
            success: false,
            message: responseFromDeleteOnExternalSystem.message,
            error: `${responseFromDeleteOnExternalSystem.error} and ${e.message}`,
          };
        } else {
          return {
            success: false,
            message: responseFromDeleteOnExternalSystem.message,
            error: e.message,
          };
        }
      }
    });
};

const createDeviceOnClarity = (url, body) => {
  return {
    message: `device creation for this organisation is not yet enabled/integrated`,
    success: false,
  };
};

const createDeviceOnPlatform = async (tenant, deviceBody) => {
  const createdDevice = await getModelByTenant(
    tenant,
    "device",
    DeviceSchema
  ).createDevice(deviceBody);
  logElement("DB addition response", createdDevice);
  return {
    success: true,
    message: "successfully created the device",
    createdDevice,
  };
};

const createDeviceOnGCP = (req, res) => {
  const formattedParent = client.registryPath(
    "airqo-250220",
    "europe-west1",
    "device-registry"
  );
  const device = {
    id: req.body.id,
    metadata: req.body.metadata,
  };
  const request = {
    parent: formattedParent,
    device: device,
  };
  client
    .createDevice(request)
    .then((responses) => {
      const response = responses[0];
      return res.status(HTTPStatus.OK).json(response);
    })
    .catch((err) => {
      console.error(err);
      return res.status(HTTPStatus.BAD_REQUEST).json(err);
    });
};

module.exports = {
  createDevice,
  createDeviceOnPlatform,
  createDeviceOnThingSpeak,
  createDeviceOnClarity,
  createDeviceOnGCP,
};
