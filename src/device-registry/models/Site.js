const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");

const siteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    altitude: {
      type: Number,
    },
    roadDistance: {
      type: String,
      trim: true,
    },
    terrain: {
      type: String,
      trim: true,
    },
    landUse: {
      type: String,
      trim: true,
    },
    roadIntensity: {
      type: Number,
    },
    roadStatus: {
      type: String,
    },
    siteActivities: {
      type: String,
    },
    aspect: {
      type: String,
    },
    landform90: {
      type: Number,
    },
    landform270: {
      type: Number,
    },
    greeness: {
      type: Number,
    },
    trafficFactor: {
      type: Number,
    },
    locationID: {
      type: ObjectId,
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
      road_intensity: this.road_intensity,
      distance_from_motorway: this.distance_from_motorway,
      distance_from_residential: this.distance_from_residential,
      distance_from_city: this.distance_from_city,
      distance_from_nearest_road: this.distance_from_nearest_road,
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
