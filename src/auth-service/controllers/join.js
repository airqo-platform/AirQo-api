const Users = require('../models/Users');

const join = {
    list: (req, res) => {
        res.send('listing');
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