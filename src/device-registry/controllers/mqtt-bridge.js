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
const mqtt_bridge = require('../utils/mqtt-bridge');

const bridge = {

    publish: (req, res) => {
        const deviceId = req.params.id;
        // MQTT topic
        const mqttTopic = `/devices/${deviceId}/${messageType}`;
        const iatTime = parseInt(Date.now() / 1000);
        const connectionArgs = {};
        client = mqtt.connect(connectionArgs);
        mqtt_bridge.publishAsync(
            mqttTopic,
            client,
            iatTime,
            messagesSent,
            numMessages,
            connectionArgs);
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