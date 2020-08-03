const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const ObjectId = Schema.Types.ObjectId;

const eventSchema = new Schema(
  {
    deviceID: {
      type: String,
      required: [true, "The deviceID is required"],
      trim: true,
    },
    sensorID: {
      type: String,
      required: [true, "The sensorID is required"],
      trim: true,
    },
    nvalues: {
      type: Number,
      default: 50,
    },
    day: { type: Date, default: Date.now() },
    first: {},
    last: {},
    values: [{ value: { type: Number }, timestamp: { type: String } }],
    frequency: {
      type: String,
      required: [true, "The frequency is required"],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

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
      deviceID: this.deviceID,
      sensorID: this.sensorID,
      nvalues: this.nvalues,
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

const event = model("event", eventSchema);

module.exports = event;
