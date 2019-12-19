const Device = require('../models/Device');
const HTTPStatus = require('http-status');
const iot = require('@google-cloud/iot');
const client = new iot.v1.DeviceManagerClient();
const device_registry = 'projects/airqo-250220/locations/europe-west1/registries/device-registry';
const uuidv1 = require('uuid/v1');
const mqtt = require('mqtt');
const projectId = 'airqo-250220';
const region = `europe-west1`;
const registryId = `device-registry`;
const algorithm = `RS256`;
// const privateKeyFile = `./rsa_private.pem`;
const mqttBridgeHostname = `mqtt.googleapis.com`;
const mqttBridgePort = 8883;
const messageType = `events`;
const numMessages = 5;


const device = {

    listAll: async (req, res) => {
        const limit = parseInt(req.query.limit, 0);
        const skip = parseInt(req.query.skip, 0);

        try {
            const devices = await Device.list({ limit, skip });
            return res.status(HTTPStatus.OK).json(devices);
        }
        catch (e) {
            return res.status(HTTPStatus.BAD_REQUEST).json(e);
        }
    },

    listAllGcp: (req, res) => {
        const formattedParent = client.registryPath('airqo-250220', 'europe-west1', 'device-registry');
        const options = { autoPaginate: false };
        const callback = responses => {
            // The actual resources in a response.
            const resources = responses[0];
            // The next request if the response shows that there are more responses.
            const nextRequest = responses[1];
            // The actual response object, if necessary.
            // var rawResponse = responses[2];
            for (let i = 0; i < resources.length; i += 1) {
                // doThingsWith(resources[i]);
            }
            if (nextRequest) {
                // Fetch the next page.
                return client.listDevices(nextRequest, options).then(callback);
            }
            let response = responses[0];
            return res.status(HTTPStatus.OK).json(response);
        }
        client.listDevices({ parent: formattedParent }, options)
            .then(callback)
            .catch(err => {
                console.error(err);
            });

    },

    createOne: async (req, res) => {

        try {
            console.log('creating one device....')
            const device = await Device.createDevice(req.body);
            return res.status(HTTPStatus.CREATED).json(device);
        }
        catch (e) {
            return res.status(400).json(e);
        }
    },

    createOneGcp: (req, res) => {
        const formattedParent = client.registryPath('airqo-250220', 'europe-west1', 'device-registry');
        const device = {
            id: req.body.id,
            metadata: req.body.metadata,
        };
        const request = {
            parent: formattedParent,
            device: device,
        };
        client.createDevice(request)
            .then(responses => {
                const response = responses[0];
                return res.status(HTTPStatus.OK).json(response);
            })
            .catch(err => {
                console.error(err);
                return res.status(HTTPStatus.BAD_REQUEST).json(err);
            });
        //connect the device to Cloud IoT core using MQTT bridge
    },

    //getting the device by its ID:
    listOne: async (req, res) => {
        try {
            const device = await Device.findById(req.params.id);
            return res.status(HTTPStatus.OK).json(device);
        }
        catch (e) {
            return res.status(HTTPStatus.BAD_REQUEST).json(e);
        }
    },

    listOneGcp: (req, res) => {
        let device = req.params.name;
        const formattedName = client.devicePath('airqo-250220', 'europe-west1', 'device-registry', `${device}`);
        client.getDevice({ name: formattedName })
            .then(responses => {
                var response = responses[0];
                // doThingsWith(response)
                return res.status(HTTPStatus.OK).json(response);
            })
            .catch(err => {
                console.error(err);
            });
    },

    delete: async (req, res) => {
        try {
            const device = await Device.findById(req.params.id);

            if (!device.user.equals(req.user._id)) {
                return res.sendStatus(HTTPStatus.UNAUTHORIZED);
            }

            await device.remove();
            return res.sendStatus(HTTPStatus.OK);
        }
        catch (e) {
            return res.status(HTTPStatus.BAD_REQUEST).json(e);
        }
    },

    deleteGcp: (req, res) => {
        let device = req.params.name;
        const formattedName = client.devicePath('airqo-250220', 'europe-west1', 'device-registry', `${device}`);
        client.deleteDevice({ name: formattedName }).then(responses => {
            let result = {
                status: "OK",
                message: `device ${device} has successfully been deleted`
            }
            return res.status(HTTPStatus.OK).json(result);
        }).catch(err => {
            console.error(err);
            return res.status(HTTPStatus.BAD_REQUEST).json(err);
        })
    },

    updateDevice: async (req, res) => {
        try {
            const device = await Device.findById(req.params.id);
            if (!device.user.equals(req.user._id)) {
                return res.sendStatus(HTTPStatus.UNAUTHORIZED);
            }

            Object.keys(req.body).forEach(key => {
                device[key] = req.body[key];
            });

            return res.status(HTTPStatus.OK).json(await device.save());
        }
        catch (e) {
            return res.status(HTTPStatus.BAD_REQUEST).json(e);
        }
    },

    updateDeviceGcp: (req, res) => {

        let device = req.params.name;
        const formattedName = client.devicePath('airqo-250220', 'europe-west1', 'device-registry', `${device}`);

        var deviceUpdate = {
            name: req.params.name,
            blocked: req.body.blocked,
            metadata: req.body.metadata
        };
        var updateMask = {
            blocked: device.blocked,
            metadata: device.metadata
        };
        var request = {
            device: deviceUpdate,
            updateMask: updateMask,
        };
        client.updateDevice(request)
            .then(responses => {
                var response = responses[0];
                return res.status(HTTPStatus.OK).json(response);
            })
            .catch(err => {
                console.error(err);
                return res.status(HTTPStatus.BAD_REQUEST).json(err);
            });
    }

}

module.exports = device;