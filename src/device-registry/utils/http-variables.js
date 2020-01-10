
const variables = (deviceId) => {

    // [START iot_http_variables]
    let iatTime = parseInt(Date.now() / 1000);

    const authToken = createJwt(
        projectId,
        privateKeyFile,
        algorithm
    );

    const devicePath = `projects/${process.env.PROJECT_ID}/locations/
    ${process.env.REGION}/registries/${process.env.REGISTRY_ID}/devices/${deviceId}`;

    // The request path, set accordingly depending on the message type.
    const pathSuffix = messageType === 'events' ? ':publishEvent' : ':setState';
    const urlBase = `https://${httpBridgeAddress}/v1/${devicePath}`;
    const url = `${urlBase}${pathSuffix}`;
    // [END iot_http_variables]

    return url;

}

module.exports = variables;