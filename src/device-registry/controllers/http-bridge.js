const http_bridge = require('../utils/http-bridge');
const http_client = require('../config/http-client');

const bridge = {

    publish: (req, res) => {
        const deviceId = req.body.id;
        const messageType = req.body.type
        try {
            http_bridge.publishAsync(1, deviceId, messageType);
            res.status(200).send(`data sent for device with the ID: ${deviceId}`);
        } catch (error) {
            res.send(`data has not be sent to the device with ID: ${deviceId}`);
        }
    },

    getConfigs: (req, res) => {
        // const version = req.body.version; // v1
        // const deviceId = req.body.id;
        // try {
        //     const data = http_client.getConfig(version, deviceId);
        //     res.status(200).send(data);
        // }
        // catch (error) {
        //     res.status(500).send(error);
        // }
    },

    updateConfigs: (req, res) => {
        // // const data = req.body.data;
        // const deviceId = req.body.id;
        // const data = http_client.updateConfig(req.body.data, deviceId);
        // res.send(data).status(200);
    },

    reviewConfigs: (req, res) => {
        // const deviceId = req.body.id;
        // data = http_client.reviewConfig(deviceId);
        // res.send(data).status(200);
    }

}

module.exports = bridge;