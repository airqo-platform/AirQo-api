const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");

const deviceSchema = new mongoose.Schema(
  {
    location: {
      longitude: {
        type: String,
        required: [true, "Longitude is required!"],
        trim: true,
      },
      latitude: {
        type: String,
        required: [true, "Latitude is required!"],
        trim: true,
      },
    },
    name: {
      type: String,
      required: [true, "Device name is required!"],
      trim: true,
      unique: true,
    },
    visibility: {
      type: Boolean,
      require: [true, "visibility is required"],
      trim: true,
    },
    owner: {
      type: ObjectId,
      require: [true, "owner is required"],
    },
    description: {
      type: String,
      required: [true, "Description is required!"],
      trim: true,
    },
    mobile: {
      type: Boolean,
      require: [true, "mobility is required"],
      trim: true,
    },
    height: {
      type: Number,
      default: 0,
      require: [true, "height above ground is required"],
    },
    distanceToRoad: {
      type: Number,
      default: 0,
      require: [true, "distance next to road is required"],
    },
    mountType: {
      motorbike: {
        type: Boolean,
        default: false,
        trim: true,
      },
      wall: {
        type: Boolean,
        default: false,
        trim: true,
      },
      pole: {
        type: Boolean,
        default: false,
        trim: true,
      },
    },
    sensors: [
      {
        type: ObjectId,
        ref: "sensor",
      },
    ],
  },
  {
    timestamps: true,
  }
);

deviceSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

deviceSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      name: this.name,
      location: this.location,
      mountType: this.mountType,
      createdAt: this.createdAt,
      owner: this.owner,
      height: this.height,
      description: this.description,
      mobile: this.mobile,
      distanceToRoad: this.distanceToRoad,
      sensors: this.sensors,
    };
  },
};

// I will add the check for the user after setting up the communications between services
deviceSchema.statics = {
  createDevice(args) {
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

const device = mongoose.model("device", deviceSchema);

module.exports = device;
