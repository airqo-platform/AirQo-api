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

const softUpdateDevice = async (
  res,
  device,
  deviceBody,
  deviceFilter,
  tenant,
  options
) => {
  try {
    logText(`successfully updated device ${device} in TS`);
    const updatedDevice = await getModelByTenant(
      tenant.toLowerCase(),
      "device",
      DeviceSchema
    )
      .findOneAndUpdate(deviceFilter, deviceBody, options)
      .exec();
    if (updatedDevice) {
      return res.status(HTTPStatus.OK).json({
        message: "successfully updated the device settings in DB",
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
  } catch (error) {
    tryCatchErrors(res, error);
  }
};

module.exports = softUpdateDevice;
