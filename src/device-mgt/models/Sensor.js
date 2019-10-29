const { Schema, model } = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
const ObjectId = Schema.Types.ObjectId;

const sensorSchema = new Schema(
    {
        quantity_kind: {
            type: String,
            required: [true, 'The quantity kind is required'],
            trim: true,
        },
        name: {
            type: String,
            required: [true, 'The name is required'],
            trim: true,
            unique: true,
        },
        unit: {
            type: String,
            required: [true, 'The unit is required'],
            trim: true,
        },
        kind: {
            type: String,
            required: [true, 'The sensor kind is required'],
            trim: true,
        },
        description: {
            type: String,
            required: [true, 'description is required'],
            trim: true,
        },
        model: {
            type: String,
            required: [true, 'the sensor model is required']
        },
        date_manufactured: {
            type: String,
            required: [true, 'date of manufature is needed']
        },
        serial_number: {
            type: String,
            required: [true, 'this serial number is also required']
        },
        device: {
            type: ObjectId,
            required: [true, 'the device is required'],
            ref: 'device'
        },
        owner: {
            type: ObjectId,
            required: [true, 'owner is required'],
            ref: 'user'
        },
        values: {
            type: ObjectId,
            required: [true, 'the value of the sensor is required'],
            ref: 'event'
        },
        linear: {
            enabled: false,
            value_max: {
                sensor_value: { type: Number, default: 0 },
                real_value: { type: Number, default: 0 }
            },
            value_min: {
                sensor_value: { type: Number, default: 0 },
                real_value: { type: Number, default: 0 }
            }
        },
    },
    {
        timestamps: true
    }
);

sensorSchema.pre('save', function () {
    const err = new Error('something went wrong');
    next(err);
})

sensorSchema.plugin(uniqueValidator, {
    message: `{VALUE} already taken!`,
});

sensorSchema.methods = {
    toJSON() {
        return {
            _id: this._id,
            name: this.name,
            kind: this.kind,
            quantity_kind: this.quantity_kind,
            unit: this.unit,
            createdAt: this.createdAt,
            owner: this.owner,
            description: this.description,
            model: this.model,
            device: this.device,
            values: this.values
        };
    }

}

sensorSchema.statics = {
    createSensor(args, device_id) {
        return this.create({
            ...args,
            device: device_id
        })
    },
    list({ skip = 0, limit = 5 } = {}) {
        return this.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
    },
}

const sensor = model("sensor", sensorSchema);

module.exports = sensor;