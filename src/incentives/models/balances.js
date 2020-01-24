const mongoose = require('mongoose');
const ObjectId = mongoose.Schema.Types.ObjectId;

const momoSchema = {
    desciption: {
        type: String
    },
    properties: {
        availableBalance: {
            description: { type: String }
        }
    },
    currency: {
        description: { type: String }
    },
}

const balance = mongoose.model('balance', momoSchema);

module.exports = balance;