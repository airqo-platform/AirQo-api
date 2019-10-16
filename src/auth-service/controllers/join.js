const Users = require('../models/User');

const join = {
    //get JSON data of users...
    listAll: (req, res) => {
        Users.GetUsers().then(function (docs) {
            res.send(docs);
        }).catch(function (err) {
            res.send(err);
        });
    },

    listOne: (req, res) => {
        let id = req.body.id;
        Users.getUser(id).then(function (docs) {
            res.send(docs);
        }).catch(function (err) { res.send(err) });

    },

    register: (req, res) => {
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
        res.status(200).json(req.user);
        return next();
    },

    token: (req, res) => {
        res.send('token');
    },

    update: (req, res) => {
        res.send('update');
    }
}

module.exports = join;