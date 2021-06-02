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
      formatted_name: this.formatted_name,
      site_id: this.site_id,
      latitude: this.latitude,
      longitude: this.longitude,
      createdAt: this.createdAt,
      description: this.description,
      site_tags: this.site_tags,
      county: this.county,
      sub_county: this.sub_county,
      parish: this.parish,
      village: this.village,
      region: this.region,
      district: this.district,
      road_intensity: this.road_intensity,
      distance_to_nearest_motor_way: this.distance_to_nearest_motor_way,
      distance_to_nearest_residential_area: this
        .distance_to_nearest_residential_area,
      distance_to_nearest_city: this.distance_to_nearest_city,
      distance_to_nearest_road: this.distance_to_nearest_road,
    };
  },
  create(args) {
    return this.create({
      ...args,
    });
  },
  _siteCount() {
    let query = this.find({});
    return query.length();
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
  delete({ filter = { lat_long: "23_46" } } = {}) {
    return this.deleteOne(filter);
  },
  update({ filter = {}, update = {}, options = {} } = {}) {
    return this.update(filter, update, options);
  },
};

siteSchema.methods = {};

module.exports = siteSchema;
