const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const measurementsSchema = new Schema({
  time: {
    type: Date,
    required: [true, "the timestamp is required"],
    unique: true,
  },
  frequency: {
    type: String,
    required: [true, "the frequency is required"],
  },
  device: {
    type: String,
    required: [true, "The device name is required"],
    trim: true,
  },
  channelID: {
    type: Number,
    trim: true,
  },
  pm1: {
    value: {
      type: Number,
    },
    calibratedValue: { type: Number },
    uncertaintyValue: { type: Number },
    standardDeviationValue: { type: Number },
  },
  pm2_5: {
    value: {
      type: Number,
      required: [true, "the raw value is required"],
    },
    calibratedValue: { type: Number },
    uncertaintyValue: { type: Number },
    standardDeviationValue: { type: Number },
  },
  s2_pm2_5: {
    value: {
      type: Number,
      required: [true, "the raw value is required"],
    },
    calibratedValue: { type: Number },
    uncertaintyValue: { type: Number },
    standardDeviationValue: { type: Number },
  },
  pm10: {
    value: {
      type: Number,
      required: [true, "the raw value is required"],
    },
    calibratedValue: { type: Number },
    uncertaintyValue: { type: Number },
    standardDeviationValue: { type: Number },
  },
  s2_pm10: {
    value: {
      type: Number,
      required: [true, "the raw value is required"],
    },
    calibratedValue: { type: Number },
    uncertaintyValue: { type: Number },
    standardDeviationValue: { type: Number },
  },
  no2: {
    value: {
      type: Number,
    },
    calibratedValue: { type: Number },
    uncertaintyValue: { type: Number },
    standardDeviationValue: { type: Number },
  },
  battery: {
    value: {
      type: Number,
    },
  },
  location: {
    latitude: {
      value: {
        type: Number,
      },
    },
    longitude: {
      value: {
        type: Number,
      },
    },
  },
  altitude: {
    value: {
      type: Number,
    },
  },
  speed: {
    value: {
      type: Number,
    },
  },
  satellites: {
    value: {
      type: Number,
    },
  },
  hdop: {
    value: {
      type: Number,
    },
  },
  internalTemperature: {
    value: {
      type: Number,
    },
  },
  internalHumidity: {
    value: {
      type: Number,
    },
  },
  externalTemperature: {
    value: {
      type: Number,
    },
  },
  ExternalHumidity: {
    value: {
      type: Number,
    },
  },
  ExternalPressure: {
    value: { type: Number },
  },
});

const eventSchema = new Schema(
  {
    day: {
      type: Date,
    },
    first: { type: Date },
    last: { type: Date },
    nValues: {
      type: Number,
    },
    values: [{ type: measurementsSchema, unique: true }],
  },
  {
    timestamps: true,
  }
);

// eventSchema.index({ device: 1 });

eventSchema.pre("save", function() {
  const err = new Error("something went wrong");
  next(err);
});

eventSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

eventSchema.methods = {
  toJSON() {
    return {
      day: this.day,
      values: this.values,
    };
  },
};

eventSchema.statics = {
  createEvent(args) {
    return this.create({
      ...args,
    });
  },
  list({ skip = 0, limit = 5 } = {}) {
    return this.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  },
};

module.exports = eventSchema;
