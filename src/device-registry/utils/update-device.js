const DeviceSchema = require("../models/Device");
const HTTPStatus = require("http-status");
const axios = require("axios");
const constants = require("../config/constants");
const { logObject, logElement, logText } = require("./log");
const qs = require("qs");
const { getModelByTenant } = require("./multitenancy");
const {
  tryCatchErrors,
  axiosError,
  missingQueryParams,
  callbackErrors,
} = require("./errors");

const updateDevice = async (
  req,
  res,
  channelID,
  device,
  deviceBody,
  tsBody,
  deviceFilter,
  tenant,
  options
) => {
  try {
    const config = {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };
    // logElement("the url", constants.UPDATE_THING(channelID));
    await axios
      .put(constants.UPDATE_THING(channelID), qs.stringify(tsBody), config)
      .then(async (response) => {
        logText(`successfully updated device ${device} in TS`);
        // logObject("response from TS", response.data);
        const updatedDevice = await getModelByTenant(
          tenant.toLowerCase(),
          "device",
          DeviceSchema
        )
          .findOneAndUpdate(deviceFilter, deviceBody, options)
          .exec();
        if (updatedDevice) {
          return res.status(HTTPStatus.OK).json({
            message: "successfully updated the device settings in the platform",
            updatedDevice,
            success: true,
          });
        } else if (!updatedDevice) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            message: "unable to update device in DB but updated in TS",
            success: false,
          });
        } else {
          logText("just unable to update device in DB but updated in TS");
        }
      })
      .catch(function(error) {
        logElement("unable to update the device settings in TS", error);
        callbackErrors(error, req, res);
      });
  } catch (error) {
    tryCatchErrors(res, error);
  }
};

module.exports = updateDevice;
