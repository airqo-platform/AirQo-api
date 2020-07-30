const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const ObjectId = Schema.Types.ObjectId;

const sensorSchema = new Schema(
  {
    deviceID: {
      type: String,
      required: [true, "The quantity kind is required"],
      trim: true,
    },
    sensorID: {
      type: String,
      required: [true, "The quantity kind is required"],
      trim: true,
    },
    nvalues: {
      type: Number,
    },
    day: { type: Date, default: Date.now() },
    first: {},
    last: {},
    values: { type: Array, default: [] },
  },
  {
    timestamps: true,
  }
);

sensorSchema.pre("save", function() {
  const err = new Error("something went wrong");
  next(err);
});

sensorSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

sensorSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      createdAt: this.createdAt,
      deviceID: this.deviceID,
      sensorID: this.sensorID,
      nvalues: this.nvalues,
      values: this.values,
    };
  },
};

sensorSchema.statics = {
  createSensor(args, device_id) {
    return this.create({
      ...args,
      device: device_id,
    });
  },
  list({ skip = 0, limit = 5 } = {}) {
    return this.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  },
};

const sensor = model("sensor", sensorSchema);

module.exports = sensor;
