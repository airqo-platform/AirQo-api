const iot = require('@google-cloud/iot');
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
const tokenExpMins = 360;

const bridge = {

    publishAsync: (
        mqttTopic,
        client,
        iatTime,
        messagesSent,
        numMessages,
        connectionArgs
    ) => {
        // If we have published enough messages or backed off too many times, stop.
        if (messagesSent > numMessages || backoffTime >= MAXIMUM_BACKOFF_TIME) {
            if (backoffTime >= MAXIMUM_BACKOFF_TIME) {
                console.log('Backoff time is too high. Giving up.');
            }
            console.log('Closing connection to MQTT. Goodbye!');
            client.end();
            publishChainInProgress = false;
            return;
        }

        // Publish and schedule the next publish.
        publishChainInProgress = true;
        let publishDelayMs = 0;
        if (shouldBackoff) {
            publishDelayMs = 1000 * (backoffTime + Math.random());
            backoffTime *= 2;
            console.log(`Backing off for ${publishDelayMs}ms before publishing.`);
        }

        setTimeout(() => {
            const payload = `${registryId}/${deviceId}-payload-${messagesSent}`;

            // Publish "payload" to the MQTT topic. qos=1 means at least once delivery.
            // Cloud IoT Core also supports qos=0 for at most once delivery.
            console.log('Publishing message:', payload);
            client.publish(mqttTopic, payload, { qos: 1 }, err => {
                if (!err) {
                    shouldBackoff = false;
                    backoffTime = MINIMUM_BACKOFF_TIME;
                }
            });

            const schedulePublishDelayMs = messageType === 'events' ? 1000 : 2000;
            setTimeout(() => {
                const secsFromIssue = parseInt(Date.now() / 1000) - iatTime;
                if (secsFromIssue > tokenExpMins * 60) {
                    iatTime = parseInt(Date.now() / 1000);
                    console.log(`\tRefreshing token after ${secsFromIssue} seconds.`);

                    client.end();
                    connectionArgs.password = createJwt(
                        projectId,
                        privateKeyFile,
                        algorithm
                    );
                    connectionArgs.protocolId = 'MQTT';
                    connectionArgs.protocolVersion = 4;
                    connectionArgs.clean = true;
                    client = mqtt.connect(connectionArgs);

                    client.on('connect', success => {
                        console.log('connect');
                        if (!success) {
                            console.log('Client not connected...');
                        } else if (!publishChainInProgress) {
                            publishAsync(
                                mqttTopic,
                                client,
                                iatTime,
                                messagesSent,
                                numMessages,
                                connectionArgs
                            );
                        }
                    });

                    client.on('close', () => {
                        console.log('close');
                        shouldBackoff = true;
                    });

                    client.on('error', err => {
                        console.log('error', err);
                    });

                    client.on('message', (topic, message) => {
                        console.log(
                            'message received: ',
                            Buffer.from(message, 'base64').toString('ascii')
                        );
                    });

                    client.on('packetsend', () => {
                        // Note: logging packet send is very verbose
                    });
                }
                publishAsync(
                    mqttTopic,
                    client,
                    iatTime,
                    messagesSent + 1,
                    numMessages,
                    connectionArgs
                );
            }, schedulePublishDelayMs);
        }, publishDelayMs);
    },

    updateConfigs: (req, res) => {
        const deviceId = req.params.id;
        const data = 'test data';
        const parentName = `projects/${projectId}/locations/${region}`;
        const registryName = `${parentName}/registries/${registryId}`;
        const binaryData = Buffer.from(data).toString('base64');

        const request = {
            name: `${registryName}/devices/${deviceId}`,
            versionToUpdate: version,
            binaryData: binaryData
        };

        try {
            const {
                data,
            } = await client.projects.locations.registries.devices.modifyCloudToDeviceConfig(request);
            console.log('Success:', data);
            res.status(200).send(data);
        }
        catch (err) {
            console.log('Could not update config: ', deviceId);
            console.log('Message:', err);
            res.status(400).send(err);
        }
    },

    reviewConfigs: (req, res) => {
        const deviceId = req.params.id;
        const parentName = `projects/${projectId}/locations/${region}`;
        const registryName = `${parentName}/registries/${registryId}`;
        const request = {
            name: `${registryName}/devices/${deviceId}`,
        };

        try {
            const { data, } = await client.projects.locations.registries.devices.configVersions.list(request);
            console.log('Configs', data);
            res.status(200).send(data);
        }
        catch (error) {
            console.log('Could not find device', deviceId);
            console.log(error);
            res.status(400).send(error);
        }
    }

}

module.exports = bridge;