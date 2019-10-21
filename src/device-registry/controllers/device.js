const Device = require('../models/Device');
const HTTPStatus = require('http-status');

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

}

module.exports = device;