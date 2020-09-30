const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const ObjectId = Schema.Types.ObjectId;

const componentTypeSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "The name is required"],
      trim: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

componentTypeSchema.pre("save", function() {
  const err = new Error("something went wrong");
  next(err);
});

componentTypeSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

componentTypeSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      name: this.name,
      measurement: this.measurement,
      createdAt: this.createdAt,
      description: this.description,
      deviceID: this.deviceID,
      calibration: this.calibration,
    };
  },
};

componentTypeSchema.statics = {
  createComponentType(args, device_id) {
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

const componentType = model("componentType", componentTypeSchema);

module.exports = componentType;
