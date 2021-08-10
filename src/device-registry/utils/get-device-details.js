const DeviceSchema = require("../models/Device");
const iot = require("@google-cloud/iot");
// const privateKeyFile = `./rsa_private.pem`;
const { logObject, logElement, logText } = require("./log");
const { getModelByTenant } = require("./multitenancy");

const jsonify = require("./jsonify");

const generateFilter = require("./generate-filter");

const getDetail = async (
  tenant,
  name,
  chid,
  loc,
  site,
  map,
  primary,
  active,
  limitValue,
  skipValue
) => {
  try {
    const limit = parseInt(limitValue, 0);
    const skip = parseInt(skipValue, 0);
    const filter = generateFilter.devices_v0(
      name,
      chid,
      loc,
      site,
      map,
      primary,
      active
    );
    logObject("the filter object", filter);
    const devices = await getModelByTenant(
      tenant.toLowerCase(),
      "device",
      DeviceSchema
    ).list({ skip, limit, filter });
    let parsedDevices = jsonify(devices.data);
    return parsedDevices;
  } catch (error) {
    logElement("error", error);
  }
};

module.exports = getDetail;
