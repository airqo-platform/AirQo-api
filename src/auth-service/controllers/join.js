const Users = require('../models/User');
const HTTPStatus = require('http-status');

const join = {
    listAll: async (req, res) => {
        try {
            const users = await Users.find();
            return res.status(HTTPStatus.OK).json(users);
        }
        catch (e) {
            return res.status(HTTPStatus.BAD_REQUEST).json(e);
        }
    },

    listOne: async (req, res) => {
        try {
            const user = await Users.findById(req.params.id);
            return res.status(HTTPStatus.OK).json(user);
        }
        catch (e) {
            return res.status(HTTPStatus.BAD_REQUEST).json(e);
        }

    },

    register: (req, res) => {
        console.log(process.env.MLAB_URI);
        try {
            const user = new Users(req.body);
            user.save((error, savedData) => {
                if (error) {
                    return res.status(500).json(error);
                } else {
                    return res.status(201).json(savedData);
                }
            })

        } catch (e) {
            return res.status(500).json(e);
        }
    },

    login: (req, res, next) => {
        res.status(200).json(req.user.toAuthJSON());
        return next();
    },
}

module.exports = join;