const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const ObjectId = Schema.Types.ObjectId;

const sensorSchema = new Schema(
  {
    quantityKind: [
      {
        type: String,
        required: [true, "The quantity kind is required"],
        trim: true,
      },
    ],
    name: {
      type: String,
      required: [true, "The name is required"],
      trim: true,
    },
    sensorID: {
      type: String,
      required: [true, "The sensorID is required"],
      trim: true,
      unique: true,
    },
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
      name: this.name,
      sensorID: this.sensorID,
      quantityKind: this.quantityKind,
      createdAt: this.createdAt,
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
