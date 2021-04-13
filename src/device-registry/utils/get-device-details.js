const DeviceSchema = require("../models/Device");
const ComponentSchema = require("../models/Component");
const LocationActivitySchema = require("../models/SiteActivity");
const Location = require("../models/Site");
const HTTPStatus = require("http-status");
const iot = require("@google-cloud/iot");
const isEmpty = require("is-empty");
const client = new iot.v1.DeviceManagerClient();
const device_registry =
  "projects/airqo-250220/locations/europe-west1/registries/device-registry";
const uuidv1 = require("uuid/v1");
const mqtt = require("mqtt");
const projectId = "airqo-250220";
const region = `europe-west1`;
const registryId = `device-registry`;
const algorithm = `RS256`;
// const privateKeyFile = `./rsa_private.pem`;
const mqttBridgeHostname = `mqtt.googleapis.com`;
const mqttBridgePort = 8883;
const messageType = `events`;
const numMessages = 5;
const fetch = require("node-fetch");
const request = require("request");
const axios = require("axios");
const constants = require("../config/constants");
const { logObject, logElement, logText } = require("./log");
const qs = require("qs");
const redis = require("../config/redis");
const { getModelByTenant } = require("./multitenancy");
const { createOnThingSpeak, createOnClarity } = require("./integrations");

const jsonify = require("./jsonify");

const {
  isDeviceNotDeployed,
  isDeviceNotRecalled,
  locationActivityRequestBodies,
  doLocationActivity,
  getGpsCoordinates,
  doesLocationExist,
  queryFilterOptions,
  bodyFilterOptions,
} = require("./site-activities");

const {
  clearEventsBody,
  doesDeviceExist,
  updateThingBodies,
  threeMonthsFromNow,
  getChannelID,
  getApiKeys,
} = require("./does-device-exist");

const {
  tryCatchErrors,
  axiosError,
  missingQueryParams,
  callbackErrors,
} = require("./errors");

const deleteDevice = require("./delete-device");
const {
  generateEventsFilter,
  generateDeviceFilter,
} = require("./generate-filter");

const getDetail = async (tenant, name, chid, loc, limitValue, skipValue) => {
  try {
    const limit = parseInt(limitValue, 0);
    const skip = parseInt(skipValue, 0);
    const filter = generateDeviceFilter(tenant.toLowerCase(), name, chid, loc);
    logObject("the filter object", filter);
    const devices = await getModelByTenant(
      tenant.toLowerCase(),
      "device",
      DeviceSchema
    ).list({ skip, limit, filter });
    let parsedDevices = jsonify(devices);
    return parsedDevices;
  } catch (error) {
    tryCatchErrors(res, error);
  }
};

module.exports = getDetail;
