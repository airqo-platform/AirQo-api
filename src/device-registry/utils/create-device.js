const HTTPStatus = require("http-status");
const DeviceSchema = require("../models/Device");
const { getModelByTenant } = require("./multitenancy");
const axios = require("axios");
const { logObject, logElement, logText } = require("./log");
const deleteChannel = require("./delete-channel");

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

module.exports = { createDevice, createOnThingSpeak, createOnClarity };
