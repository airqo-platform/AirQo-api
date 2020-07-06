const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");

const thingSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    license: {
      type: String,
    },

    writeKey: {
      type: String,
    },

    readKey: {
      type: String,
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
    createdAt: {
      type: Date,
    },
    elevation: {
      type: Number,
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
      type: String,
      default: false,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

thingSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

thingSchema.methods = {
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      latitude: this.latitude,
      longitude: this.longitude,
      mountType: this.mountType,
      createdAt: this.createdAt,
      owner: this.owner,
      elevation: this.elevation,
      height: this.height,
      description: this.description,
      mobile: this.mobile,
      distanceToRoad: this.distanceToRoad,
      sensors: this.sensors,
    };
  },
};

// I will add the check for the user after setting up the communications between services
thingSchema.statics = {
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

const thing = mongoose.model("thing", thingSchema);

module.exports = thing;
