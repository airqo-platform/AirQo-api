const { Schema, model } = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
const ObjectId = Schema.Types.ObjectId;

const eventSchema = new Schema({
    deviceId: {
        type: ObjectId,
        required: true,
        ref: 'device'
    },
    sensorId: {
        type: ObjectId,
        required: true,
        ref: 'sensor'
    },
    nsamples: {
        type: Number,
        required: true,
    },
    day: { type: Date, default: Date.now() },
    first: {},
    last: {},
    samples: { type: Array, default: [] }
});

const event = model('event', eventSchema);

module.exports = event;