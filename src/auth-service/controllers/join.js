const Users = require('../models/Users');

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
        res.send('registering');
    },

    login: (req, res) => {
        res.send('login');
    },

    token: (req, res) => {
        res.send('token');
    },

    update: (req, res) => {
        res.send('update');
    }
}

module.exports = join;