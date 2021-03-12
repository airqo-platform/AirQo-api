const DeviceSchema = require("../models/Device");
const { getModelByTenant } = require("./multitenancy");
const { logObject, logElement, logText } = require("./log");
const isEmpty = require("is-empty");
const HTTPStatus = require("http-status");
const axios = require("axios");
const constants = require("../config/constants");

const deleteDevice = require("./delete-device");

const getApiKeys = async (deviceName, tenant) => {
  logText("...................................");
  logText("getting api keys...");
  const deviceDetails = await getModelByTenant(
    tenant.toLowerCase(),
    "device",
    DeviceSchema
  )
    .find({ name: deviceName })
    .exec();
  logElement("the write key", deviceDetails.writeKey);
  logElement("the read key", deviceDetails.readKey);
  const writeKey = deviceDetails.writeKey;
  const readKey = deviceDetails.readKey;
  return { writeKey, readKey };
};

const getChannelID = async (req, res, deviceName, tenant) => {
  try {
    logText("...................................");
    logText("getting channel ID...");
    const deviceDetails = await getModelByTenant(
      tenant.toLowerCase(),
      "device",
      DeviceSchema
    )
      .find({ name: deviceName })
      .exec();
    logObject("the device details", deviceDetails);
    logElement("the channel ID", deviceDetails[0]._doc.channelID);
    let channeID = deviceDetails[0]._doc.channelID;
    return channeID;
  } catch (e) {
    deleteDevice(tenant, res, deviceName);
  }
};

const doesDeviceExist = async (deviceName, tenant) => {
  try {
    logText(".......................................");
    logText("doesDeviceExist?...");
    const device = await getModelByTenant(
      tenant.toLowerCase(),
      "device",
      DeviceSchema
    )
      .find({ name: deviceName })
      .exec();
    logElement("device element", device);
    logObject("device Object", device);
    logElement("does device exist?", !isEmpty(device));
    if (!isEmpty(device)) {
      return true;
    } else if (isEmpty(device)) {
      return false;
    }
  } catch (e) {
    logElement("unable to check device existence in system", e);
    return false;
  }
};

function threeMonthsFromNow(date) {
  d = new Date(date);
  var targetMonth = d.getMonth() + 3;
  d.setMonth(targetMonth);
  if (d.getMonth() !== targetMonth % 12) {
    d.setDate(0); // last day of previous month
  }
  return d;
}

const updateThingBodies = (req, res) => {
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
  };

  let tsBody = {
    ...(!isEmpty(name) && { name: name }),
    ...(!isEmpty(elevation) && { elevation: elevation }),
    ...(!isEmpty(tags) && { tags: tags }),
    ...(!isEmpty(latitude) && { latitude: latitude }),
    ...(!isEmpty(longitude) && { longitude: longitude }),
    ...(!isEmpty(description) && { description: description }),
    ...(!isEmpty(visibility) && { public_flag: visibility }),
  };

  return { deviceBody, tsBody };
};

const clearEventsBody = () => {
  let eventsBody = {};

  return { eventsBody, updateThingBodies };
};

module.exports = {
  clearEventsBody,
  doesDeviceExist,
  updateThingBodies,
  threeMonthsFromNow,
  getChannelID,
  getApiKeys,
};
