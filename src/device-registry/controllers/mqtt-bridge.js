const mqtt = require('mqtt');
const fs = require('fs');
const mqtt_bridge = require('../utils/mqtt-bridge');
const constants = require('../config/constants');
// const privateKeyFile = fs.readFileSync('./rsa_private.pem', 'utf8');
const privateKeyFile = "";

const bridge = {
    publish: (req, res) => {
        const deviceId = req.body.id;
        const messageType = req.body.type;

        //identifying the device
        const mqttClientId = `projects/${process.env.PROJECT_ID}/locations/
        ${process.env.REGION}/registries/${process.env.REGISTRY_ID}/devices/${deviceId}`;

        const connectionArgs = {
            host: constants.MQTT_BRIDGE_HOST_NAME,
            port: constants.MQTT_BRIDGE_PORT,
            clientId: mqttClientId,
            username: 'unused',
            password: mqtt_bridge.createJwt(process.env.PROJECT_ID, privateKeyFile, constants.ALGORITHM),
            protocol: 'mqtts',
            secureProtocol: 'TLSv1_2_method'
        };

        //creating a client
        const iatTime = parseInt(Date.now() / 1000);
        const client = mqtt.connect(connectionArgs);

        //making subscriptions
        //config updates
        client.subscribe(`/devices/${deviceId}/config/`, { qos: 1 });
        //command updates
        client.subscribe(`/devices/${deviceId}/commands/#`, { qos: 0 });

        // MQTT topic [state or events]
        const mqttTopic = `/devices/${deviceId}/${messageType}`;

        client.on('connect', success => {
            console.log('connect');
            if (!success) {
                console.log('client not connected')
            }
            else if (!publishChainInProgress) {
                mqtt_bridge.publishAsync(
                    mqttTopic,
                    client,
                    iatTime,
                    1,
                    constants.NUM_MESSAGES,
                    connectionArgs);
                res.send("Data has been published").status(200);
            }
        });

        client.on('close', () => {
            console.log('close');
            shouldBackoff = true;
        });

        client.on('message', (topic, message) => {
            let messageStr = 'Message received: ';
            if (topic === `/devices/${deviceId}/config`) {
                messageStr = 'Config message received: ';
            }
            else if (topic.startsWith(`/devices/${deviceId}/commands`)) {
                messageStr = 'Command message received: ';
            }

            messageStr += Buffer.from(message, 'base64').toString('ascii');
            console.log(messageStr);
        });

    },

    updateConfigs: async (req, res) => {
        const deviceId = req.body.id;
        const data = req.body.data;
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

    reviewConfigs: async (req, res) => {
        const deviceId = req.body.id;
        const parentName = `projects/${process.env.PROJECT_ID}/locations/${process.env.REGION}`;
        const registryName = `${parentName}/registries/${process.env.REGISTRY_ID}`;
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