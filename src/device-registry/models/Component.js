const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const ObjectId = Schema.Types.ObjectId;

const componentSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "The name is required"],
      trim: true,
      unique: true,
    },
    measurement: {
      quantityKind: {
        type: String,
        required: [true, "The quantity kind is required"],
        trim: true,
      },
      measurementUnit: {
        type: String,
        required: [true, "The unit is required"],
        trim: true,
      },
    },
    description: {
      type: String,
      required: [true, "description is required"],
      trim: true,
    },
    deviceID: {
      type: String,
      required: [true, "the device is required"],
    },
    calibration: {
      enabled: false,
      valueMax: {
        sensorValue: { type: Number, default: 0 },
        realValue: { type: Number, default: 0 },
      },
      valueMin: {
        sensorValue: { type: Number, default: 0 },
        realValue: { type: Number, default: 0 },
      },
    },
  },
  {
    timestamps: true,
  }
);

componentSchema.pre("save", function() {
  const err = new Error("something went wrong");
  next(err);
});

componentSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

componentSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      name: this.name,
      measurement: this.measurement,
      createdAt: this.createdAt,
      description: this.description,
      deviceID: this.device,
    };
  },
};

componentSchema.statics = {
  createComponent(args, device_id) {
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

const component = model("component", componentSchema);

module.exports = component;
