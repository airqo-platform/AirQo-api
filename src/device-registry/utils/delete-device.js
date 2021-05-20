const DeviceSchema = require("../models/Device");
const { logObject, logElement, logText } = require("./log");
const { getModelByTenant } = require("./multitenancy");
const axios = require("axios");
const constants = require("../config/constants");
const HTTPStatus = require("http-status");
const iot = require("@google-cloud/iot");
const client = new iot.v1.DeviceManagerClient();

/**
 * we could also just search for the organisation ID of the one deleting
 * instead of checking the tenant ID
 */
const deleteOnExternalSystem = async (tenant, channel, deviceCode) => {
  if (tenant.toLowerCase() === "airqo") {
    let responseFromDeleteOnThingSpeak = await deleteOnThingSpeak(channel);
    return responseFromDeleteOnThingSpeak;
  } else if (tenant.toLowerCase() === "kcca") {
    let responseFromDeleteOnClarity = await deleteOnClarity(deviceCode);
    return responseFromDeleteOnClarity;
  }
};

const deleteDevice = async (tenant, device, channel, deviceCode) => {
  let responseFromDeleteOnExternalSystem = await deleteOnExternalSystem(
    tenant,
    channel,
    deviceCode
  );
  if (responseFromDeleteOnExternalSystem.success === true) {
    let responseFromDeleteOnPlatform = await deleteOnPlatform(tenant, device);
    if (responseFromDeleteOnPlatform.success === true) {
      return {
        success: true,
        message: responseFromDeleteOnPlatform.message,
      };
    } else if (responseFromDeleteOnPlatform.success === false) {
      if (responseFromDeleteOnPlatform.error) {
        return {
          success: false,
          message: responseFromDeleteOnPlatform.message,
          error: responseFromDeleteOnPlatform.error,
        };
      } else {
        return {
          success: false,
          message: responseFromDeleteOnPlatform.message,
        };
      }
    }
  } else if (responseFromDeleteOnExternalSystem.success === false) {
    if (responseFromDeleteOnExternalSystem.error) {
      return {
        success: false,
        message: responseFromDeleteOnExternalSystem.message,
        error: responseFromDeleteOnExternalSystem.error,
      };
    } else {
      return {
        success: false,
        message: responseFromDeleteOnExternalSystem.message,
      };
    }
  } else {
    return {
      success: false,
      message: "unable to delete device",
    };
  }
};

const deleteOnPlatform = async (tenant, device) => {
  try {
    logText("deleting device from the platform.......");
    const deviceRemovedFromPlatform = await getModelByTenant(
      tenant.toLowerCase(),
      "device",
      DeviceSchema
    )
      .findOneAndRemove({
        _id: device,
      })
      .exec();
    if (deviceRemovedFromPlatform) {
      return {
        message: "successfully deleted the device",
        success: true,
        device,
      };
    } else if (!deviceRemovedFromPlatform) {
      return {
        message: "unable to delete the device",
        success: false,
        device,
      };
    }
  } catch (error) {
    return {
      message: "server error",
      success: false,
      error: error.message,
    };
  }
};

const deleteOnThingSpeak = async (channel) => {
  try {
    logText("deleting device from ThingSpeak.......");
    logElement("the channel ID", channel);
    return await axios
      .delete(constants.DELETE_THING_URL(channel))
      .then(async (response) => {
        return {
          message: "successfully deleted the channel from ThingSpeak",
          success: true,
          channel,
        };
      })
      .catch(function(error) {
        logElement("server error", error);
        return {
          message: "server error",
          success: false,
          channel,
          error,
        };
      });
  } catch (e) {
    logElement("server error", e.message);
    return {
      message: "server error",
      success: false,
      error: e.message,
      channel,
    };
  }
};

const deleteOnClarity = (deviceCode) => {
  return {
    messsage: "coming soon",
    success: true,
  };
};

const deleteOnGCP = (req, res) => {
  let device = req.params.name;
  const formattedName = client.devicePath(
    "airqo-250220",
    "europe-west1",
    "device-registry",
    `${device}`
  );
  client
    .deleteDevice({ name: formattedName })
    .then((responses) => {
      let result = {
        status: "OK",
        message: `device ${device} has successfully been deleted`,
      };
      return res.status(HTTPStatus.OK).json(result);
    })
    .catch((err) => {
      console.error(err);
      return res.status(HTTPStatus.BAD_REQUEST).json(err);
    });
};

module.exports = {
  deleteOnExternalSystem,
  deleteOnPlatform,
  deleteOnThingSpeak,
  deleteOnClarity,
  deleteDevice,
};
