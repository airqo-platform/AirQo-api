const { logObject, logElement, logText } = require("./log");
const isEmpty = require("is-empty");

const transmitMeasurementsRequestBody = (req) => {
  let {
    api_key,
    created_at,
    pm2_5,
    pm10,
    s2_pm2_5,
    s2_pm10,
    latitude,
    longitude,
    battery,
    other_data,
    status,
  } = req.body;

  let requestBody = {
    api_key: api_key,
    created_at: created_at,
    field1: pm2_5,
    field2: pm10,
    field3: s2_pm2_5,
    field4: s2_pm10,
    field5: latitude,
    field6: longitude,
    field7: battery,
    field8: other_data,
    latitude: latitude,
    longitude: longitude,
    status: status,
  };
  return requestBody;
};

const createDeviceRequestBodies = (req, res) => {
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
    pictures,
    siteName,
    locationName,
    photos,
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
    ...(!isEmpty(siteName) && { siteName }),
    ...(!isEmpty(locationName) && { locationName }),
    ...(!isEmpty(pictures) && { $addToSet: { pictures: pictures } }),
  };

  if (photos) {
    delete deviceBody.pictures;
    deviceBody = {
      ...deviceBody,
      ...(!isEmpty(photos) && {
        $pullAll: { pictures: photos },
      }),
    };
  }

  let options = {
    new: true,
    upsert: true,
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

  return { deviceBody, tsBody, options };
};

module.exports = {
  createDeviceRequestBodies,
  transmitMeasurementsRequestBody,
};
