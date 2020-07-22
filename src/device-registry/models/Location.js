const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");

const locationSchema = new mongoose.Schema(
  {
    locations: [
      {
        type: ObjectId,
        ref: "location",
      },
    ],
    name: {
      type: String,
      required: [true, "Location name is required!"],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      required: [true, "Description is required!"],
      trim: true,
    },
    county: {
      type: String,
      required: [true, "County is required"],
      trim: true,
    },
    subCounty: {
      type: String,
      required: [true, "subCounty is required"],
      trim: true,
    },
    parish: {
      type: String,
      required: [true, "parish is required"],
      trim: true,
    },
    distanceToRoad: {
      type: Number,
    },
    roadIntensiity: {
      type: Number,
    },
    roadStatus: {
      type: String,
    },
    localActivities: {
      type: String,
    },
    region: {
      type: String,
    },
    district: {
      type: String,
    },
    altitude: {
      type: Number,
    },
    aspect: {
      type: String,
    },
    landform90: {
      type: String,
    },
    landform270: {
      type: String,
    },
    distanceToNearestMotorway: {
      type: Number,
    },
    distanceToNearestCity: {
      type: Number,
    },
    primaryDevice: {
      type: ObjectId,
    },
  },
  {
    timestamps: true,
  }
);

locationSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

locationSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      name: this.name,
      createdAt: this.createdAt,
      description: this.description,
      county: this.county,
      subCounty: this.subCounty,
      parish: this.parish,
      distanceToRoad: this.distanceToRoad,
      distanceToNearestCity: this.distanceToNearestCity,
      primaryDevice: this.primaryDevice,
    };
  },
};

// I will add the check for the user after setting up the communications between services
locationSchema.statics = {
  createLocation(args) {
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

const location = mongoose.model("location_registry", locationSchema);

module.exports = location;
