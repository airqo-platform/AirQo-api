const { Schema } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
const { logElement, logObject } = require("../utils/log");
const { getModelByTenant } = require("../utils/multitenancy");

const siteSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    generated_name: {
      type: String,
      trim: true,
      unique: true,
    },
    formatted_name: {
      type: String,
      trim: true,
      unique: true,
    },
    lat_long: {
      type: String,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    site_tags: [
      {
        type: String,
      },
    ],
    altitude: {
      type: Number,
    },
    distance_to_nearest_road: {
      type: String,
      trim: true,
    },
    distance_to_nearest_motorway: {
      type: String,
      trim: true,
    },
    distance_to_nearest_city: {
      type: String,
      trim: true,
    },
    distance_to_nearest_residential_area: {
      type: String,
      trim: true,
    },
    terrain: {
      type: String,
      trim: true,
    },
    land_use: {
      type: String,
      trim: true,
    },
    road_intensity: {
      type: Number,
    },
    road_status: {
      type: String,
    },
    aspect: {
      type: String,
    },
    landform_90: {
      type: Number,
    },
    landform_270: {
      type: Number,
    },
    greenness: {
      type: Number,
    },
    traffic_factor: {
      type: Number,
    },
    parish: {
      type: String,
      trim: true,
    },
    village: {
      type: String,
      trim: true,
    },
    district: {
      type: String,
      trim: true,
    },
    region: {
      type: String,
      trim: true,
    },
    town: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    street: {
      type: String,
      trim: true,
    },
    geometry: {
      type: Object,
      trim: true,
    },
    county: {
      type: String,
      trim: true,
    },
    sub_county: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
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
      generated_name: this.generated_name,
      lat_long: this.lat_long,
      latitude: this.latitude,
      longitude: this.longitude,
      createdAt: this.createdAt,
      description: this.description,
      site_tags: this.site_tags,
    };
  },
  createSite(args) {
    return this.create({
      ...args,
    });
  },
};

siteSchema.statics = {
  list({ _skip = 0, _limit = 50, filter = {} } = {}) {
    return this.aggregate()
      .match(filter)
      .lookup({
        from: "devices",
        localField: "lat_long",
        foreignField: "site_id",
        as: "devices",
      })
      .sort({ createdAt: -1 })
      .skip(_skip)
      .limit(_limit)
      .allowDiskUse(true);
  },
  deleteSite({ filter = {}, options = {} } = {}) {
    return this.findOneAndRemove(filter, options);
  },
  updateSite({ filter = {}, update = {}, options = {} } = {}) {
    return this.findOneAndUpdate(filter, update, options);
  },
};

siteSchema.methods = {};

module.exports = siteSchema;
