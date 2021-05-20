/***
 * for the HTTP bridge, the devices must poll for configuration information.
 * The IoT core does not push configuration information directly to the devices
 */
const constants = require("./constants");
const bridge = require("./http-bridge");
//const privateKeyFile = require('../controllers/rsa_private.pem');
const request = require("retry-request", { request: require("request") });
const parentName = `projects/${process.env.PROJECT_ID}/locations/${process.env.REGION}`;

// [START iot_http_getconfig]
const getConfig = (version, deviceId) => {
  const devicePath = `projects/${process.env.PROJECT_ID}/locations/
    ${process.env.REGION}/registries/${process.env.REGISTRY_ID}/devices/${deviceId}`;

  const urlBase = `https://${constants.HTTP_BRIDGE_ADDRESS}/v1/${devicePath}`;

  console.log(`Getting config from URL: ${urlBase}`);

  const options = {
    url: `${urlBase}/config?local_version=${version}`,
    headers: {
      authorization: `Bearer ${bridge.createJwt(
        process.env.PROJECT_ID,
        privateKeyFile,
        constants.ALGORITHM
      )}`,
      "content-type": "application/json",
      "cache-control": "no-cache",
    },
    json: true,
    retries: 5,
    shouldRetryFn: function(incomingHttpMessage) {
      console.log("Retry?");
      return incomingHttpMessage.statusMessage !== "OK";
    },
  };
  console.log(JSON.stringify(request.RetryStrategies));
  request(options, (error, response, body) => {
    if (error) {
      console.error("Received error: ", error);
    } else if (response.body.error) {
      console.error(`Received error: ${JSON.stringify(response.body.error)}`);
    } else {
      console.log("Received config", JSON.stringify(body));
      return body;
    }
  });
};
// [END iot_http_getconfig]

// [START iot_http_updateConfig]
const updateConfig = async (data, deviceId) => {
  const registryName = `${parentName}/registries/${process.env.REGISTRY_ID}`;

  const binaryData = Buffer.from(data).toString("base64");

  const request = {
    name: `${registryName}/devices/${deviceId}`,
    versionToUpdate: version,
    binaryData: binaryData,
  };

  try {
    const {
      data,
    } = await client.projects.locations.registries.devices.modifyCloudToDeviceConfig(
      request
    );
    console.log("Success", data);
    return data;
  } catch (error) {
    console.log("Could not update config:", deviceId);
    console.log("Message: ", error);
    return error;
  }
};
// [END iot_http_updateConfig]

// [START iot_http_reviewConfig]
const reviewConfig = async (deviceId) => {
  const registryName = `${parentName}/registries/${process.env.REGISTRY_ID}`;
  const request = {
    name: `${registryName}/devices/${deviceId}`,
  };
  try {
    const {
      data,
    } = await client.projects.locations.registries.devices.configVersions.list(
      request
    );
    console.log("Configs:", data);
    return data;
  } catch (error) {
    console.log("Could not find device:", deviceId);
    console.log(err);
    return error;
  }
};
// [END iot_http_reviewConfig]

module.exports = {
  getConfig: getConfig,
  updateConfig: updateConfig,
  reviewConfig: reviewConfig,
};
