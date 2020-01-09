const mqtt = require('mqtt');
const messageType = `events`;
const fs = require('fs');
// const privateKeyFile = fs.readFileSync('../controllers/rsa_private.pem', 'utf8');
const privateKeyFile = "";
const jwt = require('jsonwebtoken');
const constants = require('../config/constants');

const publishAsync = (
    mqttTopic,
    client,
    iatTime,
    messagesSent,
    numMessages,
    connectionArgs
) => {
    //whether to wait with exponential backoff before publishing.
    let shouldBackoff = false;
    //the current backoff time
    let backoffTime = 1;
    //whether an asynchronous publish chain is in progress
    let publishChainInProgress = false;
    // If we have published enough messages or backed off too many times, stop.
    if (messagesSent > constants.NUM_MESSAGES || backoffTime >= constants.MAXIMUM_BACKOFF_TIME) {
        if (backoffTime >= constants.MAXIMUM_BACKOFF_TIME) {
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
                backoffTime = constants.MINIMUM_BACKOFF_TIME;
            }
        });

        const schedulePublishDelayMs = 5000; //messageType === 'events' ? 1000 : 2000;
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
}

module.exports = { publishAsync: publishAsync };