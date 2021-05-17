const DeviceSchema = require("../models/Device");
// const privateKeyFile = `./rsa_private.pem`;
const { logObject, logElement, logText } = require("./log");
const { getModelByTenant } = require("./multitenancy");
const jsonify = require("./jsonify");

const {
  generateEventsFilter,
  generateDeviceFilter,
} = require("./generate-filter");

const getDetail = async (
  tenant,
  name,
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
      name,
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

module.exports = getDetail;
