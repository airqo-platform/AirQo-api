const Joi = require('joi');

module.exports = {

    createDevice: {
        body: {
            name: Joi.string().min(3).required(),
            description: Joi.string().min(10),
        }
    },

    updateDevice: {
        body: {
            name: Joi.string().min(3),
            description: Joi.string().min(10),
        }
    }
}