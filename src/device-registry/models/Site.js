const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");

const siteSchema = new mongoose.Schema(
  {
    loc_ref: {
      type: String,
      trim: true,
    },
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    location_name: {
      type: String,
      trim: true,
    },
    host: {
      type: String,
      trim: true,
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
    road_status: {
      type: String,
      trim: true,
    },
    distance_from_nearest_road: {
      type: Number,
    },
    road_intensity: {
      type: Number,
    },

    distance_from_motorway: {
      type: Number,
    },
    distance_from_residential: {
      type: Number,
    },
    distance_from_city: {
      type: Number,
    },
    local_activities: {
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
    landform_90: {
      type: String,
    },
    landform_270: {
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
