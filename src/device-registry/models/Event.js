const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const eventSchema = new Schema(
  {
    deviceName: {
      type: String,
      required: [true, "The deviceName is required"],
      trim: true,
    },
    componentName: {
      type: String,
      required: [true, "the componentName is required"],
      trim: true,
    },
    day: {
      type: Date,
    },
    first: { type: Timestamp },
    last: { type: Timestamp },
    nValues: {
      type: Number,
    },
    values: [
      {
        value: { type: Number },
        raw: { type: Number },
        weight: { type: Number },
        frequency: { type: String },
        time: { type: Timestamp },
      },
    ],
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
      deviceName: this.deviceName,
      nValues: this.nValues,
      values: this.values,
      timestamp: this.timestamp,
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
