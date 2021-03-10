const DeviceSchema = require("../models/Device");

const removeDevice = async (tenant, device) => {
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
    let deviceDeleted = response.data;
    logText("successfully deleted device from DB");
    res.status(200).json({
      message: "successfully deleted the device from DB",
      success: true,
      deviceDeleted,
    });
  } else if (!deviceRemovedFromDB) {
    res.status(500).json({
      message: "unable to the device from DB",
      success: false,
      deviceDetails: device,
    });
  }
};

module.exports = removeDevice;
