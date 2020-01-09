const privateKeyFile = require('../controllers/rsa_private.pem');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const constants = require('../config/constants');
const request = require('retry-request', { request: require('request') });


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
        aud: projectId
    };
    const privateKey = fs.readFileSync(privateKeyFile);
    return jwt.sign(token, privateKey, { algorithm: algorithm });
}
// [END iot_http_jwt]

const httpVariables = (messageType, deviceId) => {
    const devicePath = `projects/${process.env.PROJECT_ID}/locations/
        ${process.env.REGION}/registries/${process.env.REGISTRY_ID}/devices/${deviceId}`;
    //request path depending on the message type
    const pathSuffix = messageType === 'events' ? ':publishEvent' : ':setState';
    const urlBase = `https://${constants.HTTP_BRIDGE_ADDRESS}/v1/${devicePath}`;
    const url = `${urlBase}${pathSuffix}`;
    return url;
}

//publish numMessages message asynchronously, starting from message
//messageCount. Telemetry events are published at a rate of 1 per second and states at a rate of 1 every 2 seconds.
// [START iot_http_publish]
const publishAsync = (messageCount, deviceId, messageType) => {
    const url = httpVariables(messageType, deviceId);
    let iatTime = parseInt(Date.now() / 1000);
    const authToken = createJwt(
        process.env.PROJECT_ID,
        privateKeyFile,
        constants.ALGORITHM
    );
    const payload = `${process.env.REGISTRY_ID}/${deviceId}-payload-${messageCount}`;
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
        if (messageCount < constants.NUM_MESSAGES) {
            // If we have published fewer than numMessage messages, publish payload
            // messageCount + 1.
            setTimeout(() => {
                const secsFromIssue = parseInt(Date.now() / 1000) - iatTime;
                if (secsFromIssue > constants.TOKEN_EXP_MINS * 60) {
                    iatTime = parseInt(Date.now() / 1000);
                    console.log(`\tRefreshing token after ${secsFromIssue} seconds.`);
                    authToken = createJwt(
                        process.env.PROJECT_ID,
                        privateKeyFile,
                        constants.ALGORITHM
                    );
                }

                publishAsync(authToken, messageCount + 1, constants.NUM_MESSAGES);
            }, delayMs);
        }
    });
}
// [END iot_http_publish]


module.exports = { publishAsync: publishAsync, createJwt: createJwt };