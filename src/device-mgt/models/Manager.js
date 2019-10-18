const mongoose = require('mongoose');


const managerSchema = new mongoose.Schema(
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

        },
        unit: {
            type: String,
            required: [true, 'The unit is required'],
            trim: true,
        },
        sensor_kind: {
            type: String,
            required: [true, 'The sensor kind is required'],
            trim: true,
        },

        description: {
            type: String,
            required: [true, 'description is required'],
            trim: true,
        },

        created_at: {
            type: String,
            required: [true, 'The creation date is required'],
            trim: true,
        },

        updated_at: {
            type: String,
            required: [true, 'The updating date is required'],
            trim: true,
        }
    }
);

const manager = mongoose.model("manager", managerSchema);

module.exports = manager;