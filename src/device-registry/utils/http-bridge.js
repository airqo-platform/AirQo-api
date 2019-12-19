const iot = require('@google-cloud/iot');
const client = new iot.v1.DeviceManagerClient();
const device_registry = 'projects/airqo-250220/locations/europe-west1/registries/device-registry';
const uuidv1 = require('uuid/v1');
const mqtt = require('mqtt');
const projectId = 'airqo-250220';
const region = `europe-west1`;
const registryId = `device-registry`;
const algorithm = `RS256`;
const privateKeyFile = `./rsa_private.pem`;
const mqttBridgeHostname = `mqtt.googleapis.com`;
const mqttBridgePort = 8883;
const messageType = `events`;
const numMessages = 5;
const fs = require('fs');
const jwt = require('jsonwebtoken');
const tokenExpMins = 360;
const httpBridgeAddress = `cloudiotdevice.googleapis.com`;

// Create a Cloud IoT Core JWT for the given project ID, signed with the given
// private key.
// [START iot_http_jwt]
const createJwt = (projectId, privateKeyFile, algorithm) => {
    // Create a JWT to authenticate this device. The device will be disconnected
    // after the token expires, and will have to reconnect with a new token. The
    // audience field should always be set to the GCP project ID.
    const token = {
        iat: parseInt(Date.now() / 1000),
        exp: parseInt(Date.now() / 1000) + 20 * 60, // 20 minutes
        aud: projectId,
    };
    const privateKey = fs.readFileSync(privateKeyFile);
    return jwt.sign(token, privateKey, { algorithm: algorithm });
};
// [END iot_http_jwt]


// [START iot_http_variables]
let iatTime = parseInt(Date.now() / 1000);

const authToken = createJwt(
    projectId,
    privateKeyFile,
    algorithm
);

const devicePath = `projects/${projectId}/locations/${region}/registries/${registryId}/devices/${deviceId}`;

// The request path, set accordingly depending on the message type.
const pathSuffix =
    essageType === 'events' ? ':publishEvent' : ':setState';
const urlBase = `https://${httpBridgeAddress}/v1/${devicePath}`;
const url = `${urlBase}${pathSuffix}`;
// [END iot_http_variables]


const bridge = {
    publishAsync: (authToken, messageCount, numMessages) => {
        const payload = `${registryId}/${deviceId}-payload-${messageCount}`;
        console.log('Publishing message:', payload);
        const binaryData = Buffer.from(payload).toString('base64');
        const postData =
            messageType === 'events'
                ? {
                    binary_data: binaryData,
                }
                : {
                    state: {
                        binary_data: binaryData,
                    },
                };

        const options = {
            url: url,
            headers: {
                authorization: `Bearer ${authToken}`,
                'content-type': 'application/json',
                'cache-control': 'no-cache',
            },
            body: postData,
            json: true,
            method: 'POST',
            retries: 5,
            shouldRetryFn: function (incomingHttpMessage) {
                return incomingHttpMessage.statusMessage !== 'OK';
            },
        };

        // Send events for high-frequency updates, update state only occasionally.
        const delayMs = messageType === 'events' ? 1000 : 2000;
        console.log(JSON.stringify(request));
        request(options, (error, response) => {
            if (error) {
                console.error('Received error: ', error);
            } else if (response.body.error) {
                console.error(`Received error: ${JSON.stringify(response.body.error)}`);
            } else {
                console.log('Message sent.');
            }
            if (messageCount < numMessages) {
                // If we have published fewer than numMessage messages, publish payload
                // messageCount + 1.
                setTimeout(() => {
                    const secsFromIssue = parseInt(Date.now() / 1000) - iatTime;
                    if (secsFromIssue > tokenExpMins * 60) {
                        iatTime = parseInt(Date.now() / 1000);
                        console.log(`\tRefreshing token after ${secsFromIssue} seconds.`);
                        authToken = createJwt(
                            projectId,
                            privateKeyFile,
                            algorithm
                        );
                    }

                    publishAsync(authToken, messageCount + 1, numMessages);
                }, delayMs);
            }
        });
    },
    // [END iot_http_publish]

    // [START iot_http_getconfig]
    getConfig: (authToken, version) => {
        console.log(`Getting config from URL: ${urlBase}`);

        const options = {
            url: `${urlBase}/config?local_version=${version}`,
            headers: {
                authorization: `Bearer ${authToken}`,
                'content-type': 'application/json',
                'cache-control': 'no-cache',
            },
            json: true,
            retries: 5,
            shouldRetryFn: function (incomingHttpMessage) {
                console.log('Retry?');
                return incomingHttpMessage.statusMessage !== 'OK';
            },
        };
        console.log(JSON.stringify(request.RetryStrategies));
        request(options, (error, response, body) => {
            if (error) {
                console.error('Received error: ', error);
            } else if (response.body.error) {
                console.error(`Received error: ${JSON.stringify(response.body.error)}`);
            } else {
                console.log('Received config', JSON.stringify(body));
            }
        });
    },
    // [END iot_http_getconfig]


    updateConfigs: () => {

    }

}

module.exports = bridge;