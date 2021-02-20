const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

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
    values: [
      {
        time: { type: Date, required: [true, "the timestamp is required"] },
        frequency: {
          type: String,
          required: [true, "the frequency is required"],
        },
        device: {
          type: String,
          required: [true, "The deviceName is required"],
          trim: true,
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
        s2_pm2_5: {
          value: {
            type: Number,
            required: [true, "the raw value is required"],
          },
          calibratedValue: { type: Number },
          uncertaintyValue: { type: Number },
          standardDeviationValue: { type: Number },
        },
        battery: {
          value: {
            type: Number,
            required: [true, "the raw value is required"],
          },
        },
        location: {
          latitude: {
            value: {
              type: Number,
              required: [true, "the raw value is required"],
            },
          },
          longitude: {
            value: {
              type: Number,
              required: [true, "the raw value is required"],
            },
          },
        },
        altitude: {
          value: {
            type: Number,
            required: [true, "the raw value is required"],
          },
        },
        speed: {
          value: {
            type: Number,
            required: [true, "the raw value is required"],
          },
        },
        satellites: {
          value: {
            type: Number,
            required: [true, "the raw value is required"],
          },
        },
        hdop: {
          value: {
            type: Number,
            required: [true, "the raw value is required"],
          },
        },
        internalTemperature: {
          value: {
            type: Number,
            required: [true, "the raw value is required"],
          },
        },
        internalHumidity: {
          value: {
            type: Number,
            required: [true, "the raw value is required"],
          },
        },
        externalTemperature: {
          value: {
            type: Number,
            required: [true, "the raw value is required"],
          },
        },
        ExternalHumidity: {
          value: {
            type: Number,
            required: [true, "the raw value is required"],
          },
        },
        ExternalPressure: {
          value: {
            type: Number,
            required: [true, "the raw value is required"],
          },
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

eventSchema.index({ device: 1 });

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
