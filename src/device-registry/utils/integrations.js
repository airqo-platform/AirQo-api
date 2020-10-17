const { createDevice } = require("./create-device");
const HTTPStatus = require("http-status");
const axios = require("axios");
const { logObject, logElement, logText } = require("./log");

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
      logObject("the response from TS", response);
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
      logText("adding the device in the DB...");
      createDevice(tenant, prepBodyDeviceModel, req, res);
      //   const device = await getModelByTenant(
      //     tenant,
      //     "device",
      //     DeviceSchema
      //   ).createDevice(prepBodyDeviceModel);
      //   logElement("DB addition response", device);
      //   return res.status(HTTPStatus.CREATED).json({
      //     success: true,
      //     message: "successfully created the device",
      //     device,
      //   });
    })
    .catch(async (e) => {
      logElement(
        "unable to create device on the platform, attempting to delete it from TS",
        e.message
      );
      device.deleteChannel(channel, req, res, e.message);
    });
};

const createOnClarity = (tenant, req, res) => {
  return res.status(HTTPStatus.BAD_GATEWAY).json({
    success: false,
    message: `device creation for this organisation (${tenant}) not yet enabled/integrated`,
  });

  //   createDevice(tenant, prepBodyDeviceModel, req, res);
};

module.exports = { createOnThingSpeak, createOnClarity };
