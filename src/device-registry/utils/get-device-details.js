const DeviceSchema = require("../models/Device");
const { logObject, logElement, logText } = require("./log");
const { getModelByTenant } = require("./multitenancy");
const jsonify = require("./jsonify");
const { generateDeviceFilter } = require("./generate-filter");

const getDetailsOnPlatform = async (
  tenant,
  id,
  chid,
  loc,
  site,
  map,
  limitValue,
  skipValue
) => {
  try {
    const limit = parseInt(limitValue, 0);
    const skip = parseInt(skipValue, 0);
    const filter = generateDeviceFilter(
      tenant.toLowerCase(),
      id,
      chid,
      loc,
      site,
      map
    );
    logObject("the filter object", filter);
    const devices = await getModelByTenant(
      tenant.toLowerCase(),
      "device",
      DeviceSchema
    ).list({ skip, limit, filter });
    let parsedDevices = jsonify(devices);
    return parsedDevices;
  } catch (error) {
    logElement("error", error);
  }
};

const getDetailsOnGCP = (device) => {
  const formattedName = client.devicePath(
    "airqo-250220",
    "europe-west1",
    "device-registry",
    `${device}`
  );
  if (!device) {
    const options = { autoPaginate: false };
    const callback = (responses) => {
      const resources = responses[0];
      const nextRequest = responses[1];
      for (let i = 0; i < resources.length; i += 1) {}
      if (nextRequest) {
        return client.listDeviceModels(nextRequest, options).then(callback);
      }
      let response = responses[0];
      return res.status(HTTPStatus.OK).json(response);
    };
    client
      .listDeviceModels({ parent: formattedParent }, options)
      .then(callback)
      .catch((err) => {
        console.error(err);
      });
  } else if (device) {
    client
      .getDevice({ name: formattedName })
      .then((responses) => {
        return responses[0];
      })
      .catch((err) => {
        console.error(err);
      });
  }
};

module.exports = { getDetailsOnPlatform, getDetailsOnGCP };
