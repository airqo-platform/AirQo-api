const DeviceSchema = require("../models/Device");
const HTTPStatus = require("http-status");
const axios = require("axios");
const constants = require("../config/constants");
const { logObject, logElement, logText } = require("./log");
const qs = require("qs");
const { getModelByTenant } = require("./multitenancy");

const updateOnExternalSystem = async (
  tenant,
  channelID,
  tsBody,
  clarityID,
  clarityBody
) => {
  if (tenant.toLowerCase() === "airqo") {
    let responseFromUpdateOnThingSpeak = await updateDeviceOnThingSpeak(
      channelID,
      tsBody
    );
    if (responseFromUpdateOnThingSpeak.success === true) {
    } else if (responseFromUpdateOnThingSpeak.success === false) {
      if (responseFromUpdateOnThingSpeak.error) {
        return {
          success: false,
          message: responseFromUpdateOnThingSpeak.message,
          error: responseFromUpdateOnThingSpeak.error,
        };
      } else {
        return {
          success: false,
          message: responseFromUpdateOnThingSpeak.message,
        };
      }
    }
  } else if (tenant.toLowerCase() === "kcca") {
    let responseFromUpdateOnClarity = await updateDeviceOnClarity(
      clarityID,
      clarityBody
    );

    if (responseFromUpdateOnClarity.success === true) {
      return {
        success: true,
        message: responseFromUpdateOnClarity.message,
      };
    } else if (responseFromUpdateOnClarity.success === false) {
      if (responseFromUpdateOnClarity.error) {
        return {
          success: false,
          message: responseFromUpdateOnClarity.message,
          error: responseFromUpdateOnClarity.error,
        };
      } else {
        return {
          success: false,
          message: responseFromUpdateOnClarity.message,
        };
      }
    }
  }
};

const updateDevice = async (
  channelID,
  deviceBody,
  tsBody,
  deviceFilter,
  tenant,
  options
) => {
  try {
    let responseFromUpdateOnExternalSystem = await updateOnExternalSystem(
      tenant,
      channelID,
      tsBody,
      clarityID,
      clarityBody
    );
    if (responseFromUpdateOnExternalSystem.success === true) {
      let responseFromPlatform = await updateDeviceOnPlatform(
        deviceBody,
        deviceFilter,
        tenant,
        options
      );
      // logObject("the response from platform", responseFromPlatform);
      if (responseFromPlatform.success === true) {
        return {
          message: responseFromPlatform.message,
          success: true,
          updatedDevice: responseFromPlatform.updatedDevice,
        };
      } else if (responseFromPlatform.success === false) {
        if (responseFromPlatform.error) {
          return {
            message: responseFromPlatform.message,
            success: false,
            error: responseFromPlatform.error,
          };
        } else {
          return {
            message: responseFromPlatform.message,
            success: false,
          };
        }
      }
    } else if (responseFromUpdateOnExternalSystem.success === false) {
      if (responseFromUpdateOnExternalSystem.error) {
        return {
          message: responseFromUpdateOnExternalSystem.message,
          success: false,
          error: responseFromUpdateOnExternalSystem.error,
        };
      } else {
        return {
          message: responseFromUpdateOnExternalSystem.message,
          success: false,
        };
      }
    }
  } catch (error) {
    return {
      message: "server error",
      success: false,
      error: error.message,
    };
  }
};

const updateDeviceOnPlatform = async (
  deviceBody,
  deviceFilter,
  tenant,
  options
) => {
  try {
    const updatedDevice = await getModelByTenant(
      tenant.toLowerCase(),
      "device",
      DeviceSchema
    )
      .findByIdAndUpdate(deviceFilter, deviceBody, options)
      .exec();
    if (updatedDevice) {
      return {
        message: "successfully updated the device in the platform",
        updatedDevice,
        success: true,
      };
    } else if (!updatedDevice) {
      return {
        message: "unable to update device in the platform",
        success: false,
      };
    } else {
      return {
        message: "just unable to update device in the platform",
        success: false,
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

const updateDeviceOnClarity = async (deviceCode, clarityBody) => {
  return {
    success: true,
    message: "coming soon",
  };
};

const updateDeviceOnThingSpeak = async (channelID, tsBody) => {
  try {
    const config = {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };
    return await axios
      .put(constants.UPDATE_THING(channelID), qs.stringify(tsBody), config)
      .then((response) => {
        logObject("the response from TS in the util", response.data);
        if (response.data) {
          return {
            message: "successfully updated device in TS",
            success: true,
          };
        } else {
          return {
            message: "just unable to update in TS",
            success: false,
          };
        }
      })
      .catch(function(error) {
        return {
          message: "server error",
          success: false,
          error: error,
        };
      });
  } catch (error) {
    return {
      message: "server error",
      success: false,
      error: error.message,
    };
  }
};

const updateDeviceOnGCP = (req, res) => {
  let device = req.params.name;
  const formattedName = client.devicePath(
    "airqo-250220",
    "europe-west1",
    "device-registry",
    `${device}`
  );

  var deviceUpdate = {
    name: req.params.name,
    blocked: req.body.blocked,
    metadata: req.body.metadata,
  };
  var updateMask = {
    blocked: device.blocked,
    metadata: device.metadata,
  };
  var request = {
    device: deviceUpdate,
    updateMask: updateMask,
  };
  client
    .updateDevice(request)
    .then((responses) => {
      var response = responses[0];
      return res.status(HTTPStatus.OK).json(response);
    })
    .catch((err) => {
      console.error(err);
      return res.status(HTTPStatus.BAD_REQUEST).json(err);
    });
};

const transformDeviceName = (name) => {
  let firstElement = name.split(" ").slice(0, 1);
  let removedOnlySpaces = firstElement[0].replace(/\s+/g, "_").toLowerCase();
  let removeHyphens = removedOnlySpaces.replace(/\-+/g, "_").toLowerCase();
  let enforcedNamingConvention = removeHyphens.replace(/airqo/, "aq");
  return enforcedNamingConvention;
};

module.exports = {
  updateDevice,
  updateDeviceOnThingSpeak,
  updateDeviceOnPlatform,
  updateDeviceOnClarity,
  updateDeviceOnGCP,
  transformDeviceName,
};
