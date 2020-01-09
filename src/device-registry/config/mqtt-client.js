'use strict';
// [START iot_mqtt_include]
const mqtt = require('mqtt');
const mqttBridgeHostname = `mqtt.googleapis.com`;
const messageType = `events`;
const fs = require('fs');
const jwt = require('jsonwebtoken');
const mqtt = require('mqtt');
const constants = require('./constants');
// [END iot_mqtt_include]

/**
 * The main purpose of this file is to configure the MQTT client to authenticate the device.
 */

const createJwt = (projectId, privateKeyFile, algorithm) => {
    const token = {
        iat: parseInt(Date.now() / 1000),
        exp: parseInt(Date.now() / 1000) + 20 * 60, // 20 minutes...
        aud: projectId
    };
    const privateKey = fs.readFileSync(privateKeyFile);
    return jwt.sign(token, privateKey, algorithm);
}

const connect = (deviceId) => {
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
}
const updateConfigs = async (req, res) => {
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
}

const reviewConfigs = async (req, res) => {
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


module.exports = { connect: connect, updateConfigs: updateConfigs, reviewConfigs: reviewConfigs };