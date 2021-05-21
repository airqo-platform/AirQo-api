const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");

const siteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
    },
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    description: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    county: {
      type: String,
      trim: true,
    },
    region: {
      type: String,
      trim: true,
    },
    subcounty: {
      type: String,
      trim: true,
    },
    parish: {
      type: String,
      trim: true,
    },
    roadStatus: {
      type: String,
      trim: true,
    },
    distanceFromNearestRoad: {
      type: Number,
    },
    roadIntensity: {
      type: Number,
    },

    distanceFromMotorway: {
      type: Number,
    },
    distanceFromResidential: {
      type: Number,
    },
    distanceFromCity: {
      type: Number,
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
  },
  {
    timestamps: true,
  }
);

siteSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

siteSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      name: this.name,
      createdAt: this.createdAt,
      description: this.description,
      county: this.county,
      subcounty: this.subcounty,
      parish: this.parish,
      roadIntensity: this.roadIntensity,
      distanceFromMotorway: this.distanceFromMotorway,
      distanceFromResidential: this.distanceFromResidential,
      distanceFromCity: this.distanceFromCity,
      distanceFromNearest_road: this.distanceFromNearestRoad,
      host: this.host,
      latitude: this.latitude,
      longitude: this.longitude,
    };
  },
};

// I will add the check for the user after setting up the communications between services
siteSchema.statics = {
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

module.exports = siteSchema;
