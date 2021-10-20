const DeviceSchema = require("../models/Device");
const { logObject, logElement, logText } = require("./log");
const { getModelByTenant } = require("./multitenancy");
const {
  tryCatchErrors,
  axiosError,
  missingQueryParams,
  callbackErrors,
} = require("./errors");
const HTTPStatus = require("http-status");
const removeDevice = async (tenant, res, device) => {
  try {
    logText("deleting device from DB.......");
    const deviceRemovedFromDB = await getModelByTenant(
      tenant.toLowerCase(),
      "device",
      DeviceSchema
    )
      .findOneAndRemove({
        name: device,
      })
      .exec();
    if (deviceRemovedFromDB) {
      // let deviceDeleted = response.data;
      logText("successfully deleted device");
      res.status(HTTPStatus.OK).json({
        message: "successfully deleted the device",
        success: true,
        device,
      });
    } else if (!deviceRemovedFromDB) {
      res.status(HTTPStatus.BAD_GATEWAY).json({
        message: "unable to delete the device",
        success: false,
        device,
      });
    }
  } catch (error) {
    tryCatchErrors(res, error);
  }
};

module.exports = removeDevice;
