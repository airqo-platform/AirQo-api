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

const client = {
    config: (deviceId) => {
        const mqttClientId = `projects/${projectId}/locations/${region}/registries/${registryId}/devices/${deviceId}`;
        const connectionArgs = {
            host: mqttBridgeHostname,
            port: mqttBridgePort,
            clientId: mqttClientId,
            username: 'unused',
            password: createJwt(projectId, privateKeyFile, algorithm),
            protocol: 'mqtts',
            secureProtocol: 'TLSv1_2_method',
        };

        //creation of a client and connecting the Google MQTT bridge
        const iatTime = parseInt(Date.now() / 1000);
        const client = mqtt.connect(connectionArgs);

        // MQTT topic - different
        const mqttTopic = `/devices/${deviceId}/${messageType}`;

        //receive updates to config topic
        client.subscribe(`/devices/${deviceId}/config`, { qos: 1 });

        //to receive all commands
        client.subscribe(`/devices/${deviceId}/commands/#`, { qos: 0 });

        client.on('connect', success => {
            console.log('connect');
            if (!success) {
                console.log('Client not connected...');
            } else if (!publishChainInProgress) {
                publishAsync(mqttTopic, client, iatTime, 1, numMessages, connectionArgs);
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
            let messageStr = 'Message received: ';
            if (topic === `/devices/${deviceId}/config`) {
                messageStr = 'Config message received: ';
            } else if (topic.startsWith(`/devices/${deviceId}/commands`)) {
                messageStr = 'Command message received: ';
            }

            messageStr += Buffer.from(message, 'base64').toString('ascii');
            console.log(messageStr);
        });
    },

    update: () => {

    }
}

module.exports = client;