const joi = require('joi');

const passwordReg = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/

module.exports = {
    passwordReg,
    register: {
        email: joi.string().email().required(),
        password: joi.string().regex(passwordReg).required(),
        firstName: joi.string().required(),
        lastName: joi.string().required(),
        userName: joi.string().required()
    }
}



