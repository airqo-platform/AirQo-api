const { Schema } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
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
    },
    formatted_name: {
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
    activities: [
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
      site_activities: this.site_activities,
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
};

siteSchema.statics = {
  list({ skip = 0, limit = 5, filter = {} } = {}) {
    return this.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  },
  delete({ filter = {}, options = {} } = {}) {
    let opts = options;
    opts[justOne] = true;
    return this.remove(filter, opts);
  },
  update({ filter = {}, options = {} } = {}) {
    let opts = options;
    return this.update(filter, opts);
  },
};

siteSchema.methods = {};

const siteModel = async (tenant) => {
  return await getModelByTenant(tenant.toLowerCase(), "site", siteSchema);
};

module.exports = siteModel;
