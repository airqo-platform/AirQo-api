const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const eventSchema = new Schema(
  {
    deviceName: {
      type: String,
      required: [true, "The deviceName is required"],
      trim: true,
    },
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
        sensor: {
          type: String,
          required: [true, "the sensor name is required"],
          trim: true,
        },
        raw: { type: Number, required: [true, "the raw value is required"] },
        calibratedValue: { type: Number },
        uncertaintyValue: { type: Number },
        standardDeviationValue: { type: Number },
        weight: { type: Number },
        frequency: {
          type: String,
          required: [true, "the frequency is required"],
        },
        time: { type: Date, required: [true, "the timestamp is required"] },
        quantityKind: {
          type: String,
          required: [true, "The quantity kind is required"],
        },
        measurementUnit: {
          type: String,
          required: [true, "The measurement unit is required"],
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

eventSchema.index({ deviceName: 1, componentName: 1 });

eventSchema.index({ componentName: 1 });

eventSchema.index({ deviceName: 1 });

eventSchema.index({ values: 1 });

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
      _id: this._id,
      createdAt: this.createdAt,
      deviceName: this.deviceName,
      values: this.values,
      day: this.day,
      first: this.first,
      last: this.last,
      quantityKind: this.quantityKind,
      measurementUnit: this.measurementUnit,
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
