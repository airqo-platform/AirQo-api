const { Schema } = require("mongoose");
const mongoose = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
const { logElement, logObject, logText } = require("../utils/log");
const jsonify = require("../utils/jsonify");
const isEmpty = require("is-empty");
const constants = require("../config/constants");
const HTTPStatus = require("http-status");

const siteSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
      required: [true, "name is required!"],
    },
    generated_name: {
      type: String,
      trim: true,
      unique: true,
      required: [true, "generated name is required!"],
    },
    airqloud_id: {
      type: ObjectId,
      trim: true,
    },
    formatted_name: {
      type: String,
      trim: true,
    },
    lat_long: {
      type: String,
      trim: true,
      unique: true,
      required: [true, "lat_long is required is required!"],
    },
    description: {
      type: String,
      trim: true,
    },
    latitude: {
      type: Number,
      required: [true, "latitude is required!"],
    },
    longitude: {
      type: Number,
      required: [true, "longitude is required!"],
    },
    site_tags: { type: Array, default: [] },
    altitude: {
      type: Number,
    },
    distance_to_nearest_road: {
      type: Number,
      trim: true,
    },
    google_place_id: {
      type: String,
    },
    distance_to_nearest_motorway: {
      type: Number,
      trim: true,
    },
    distance_to_nearest_city: {
      type: Number,
      trim: true,
    },
    distance_to_nearest_residential_road: {
      type: Number,
      trim: true,
    },
    distance_to_kampala_center: {
      type: Number,
      trim: true,
    },
    bearing_to_kampala_center: {
      type: Number,
      trim: true,
    },
    distance_to_nearest_primary_road: {
      type: Number,
      trim: true,
    },
    distance_to_nearest_secondary_road: {
      type: Number,
      trim: true,
    },
    distance_to_nearest_tertiary_road: {
      type: Number,
      trim: true,
    },
    distance_to_nearest_unclassified_road: {
      type: Number,
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
    status: {
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
    count: { type: Number },
    country: {
      type: String,
      trim: true,
    },
    nearest_tahmo_station: {
      id: {
        type: Number,
        trim: true,
        default: -1,
      },
      code: {
        type: String,
        trim: true,
        default: null,
      },
      longitude: {
        type: Number,
        trim: true,
        default: -1,
      },
      latitude: {
        type: Number,
        trim: true,
        default: -1,
      },
      timezone: {
        type: String,
        trim: true,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

siteSchema.pre("save", function(next) {
  if (this.isModified("latitude")) {
    delete this.latitude;
  }
  if (this.isModified("longitude")) {
    delete this.longitude;
  }
  if (this.isModified("_id")) {
    delete this._id;
  }
  if (this.isModified("generated_name")) {
    delete this.generated_name;
  }
  return next();
});

siteSchema.pre("update", function(next) {
  if (this.isModified("latitude")) {
    delete this.latitude;
  }
  if (this.isModified("longitude")) {
    delete this.longitude;
  }
  if (this.isModified("_id")) {
    delete this._id;
  }
  if (this.isModified("generated_name")) {
    delete this.generated_name;
  }
  return next();
});

siteSchema.index({ lat_long: 1 }, { unique: true });
siteSchema.index({ generated_name: 1 }, { unique: true });

siteSchema.plugin(uniqueValidator, {
  message: `{VALUE} must be unique!`,
});

siteSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      name: this.name,
      generated_name: this.generated_name,
      formatted_name: this.formatted_name,
      lat_long: this.lat_long,
      latitude: this.latitude,
      longitude: this.longitude,
      airqloud_id: this.airqloud_id,
      createdAt: this.createdAt,
      description: this.description,
      site_tags: this.site_tags,
      country: this.country,
      district: this.district,
      sub_county: this.sub_county,
      parish: this.parish,
      region: this.region,
      geometry: this.geometry,
      village: this.village,
      city: this.city,
      street: this.street,
      county: this.county,
      altitude: this.altitude,
      greenness: this.greenness,
      landform_270: this.landform_270,
      landform_90: this.landform_90,
      aspect: this.aspect,
      status: this.status,
      distance_to_nearest_road: this.distance_to_nearest_road,
      distance_to_nearest_primary_road: this.distance_to_nearest_primary_road,
      distance_to_nearest_secondary_road: this
        .distance_to_nearest_secondary_road,
      distance_to_nearest_tertiary_road: this.distance_to_nearest_tertiary_road,
      distance_to_nearest_unclassified_road: this
        .distance_to_nearest_unclassified_road,
      bearing_to_kampala_center: this.bearing_to_kampala_center,
      distance_to_kampala_center: this.distance_to_kampala_center,
      distance_to_nearest_residential_road: this
        .distance_to_nearest_residential_road,
      nearest_tahmo_station: this.nearest_tahmo_station,
    };
  },
  createSite(args) {
    return this.create({
      ...args,
    });
  },
};

siteSchema.statics = {
  async register(args) {
    try {
      let modifiedArgs = args;
      modifiedArgs.description = modifiedArgs.name;
      let data = await this.create({
        ...modifiedArgs,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "site created",
          status: HTTPStatus.CREATED,
        };
      } else {
        return {
          success: false,
          message: "site not create despite successful operation",
          status: HTTPStatus.ACCEPTED,
        };
      }
    } catch (err) {
      let e = jsonify(err);
      logObject("the error", e);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = HTTPStatus.CONFLICT;
      Object.entries(err.errors).forEach(([key, value]) => {
        return (response[key] = value.message);
      });

      return {
        error: response,
        message,
        success: false,
        status,
      };
    }
  },
  async list({
    _skip = 0,
    _limit = parseInt(constants.DEFAULT_LIMIT_FOR_QUERYING_SITES),
    filter = {},
  } = {}) {
    try {
      let response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "devices",
          localField: "_id",
          foreignField: "site_id",
          as: "devices",
        })
        .sort({ createdAt: -1 })
        .project({
          _id: 1,
          name: 1,
          latitude: 1,
          longitude: 1,
          description: 1,
          site_tags: 1,
          lat_long: 1,
          country: 1,
          district: 1,
          sub_county: 1,
          parish: 1,
          region: 1,
          geometry: 1,
          village: 1,
          city: 1,
          street: 1,
          generated_name: 1,
          formatted_name: 1,
          county: 1,
          altitude: 1,
          greenness: 1,
          landform_270: 1,
          landform_90: 1,
          aspect: 1,
          status: 1,
          distance_to_nearest_road: 1,
          distance_to_nearest_primary_road: 1,
          distance_to_nearest_secondary_road: 1,
          distance_to_nearest_tertiary_road: 1,
          distance_to_nearest_unclassified_road: 1,
          distance_to_nearest_residential_road: 1,
          bearing_to_kampala_center: 1,
          distance_to_kampala_center: 1,
          nearest_tahmo_station: 1,
          devices: "$devices",
        })
        .skip(_skip)
        .limit(_limit)
        .allowDiskUse(true);

      let data = jsonify(response);

      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully retrieved the site details",
          data,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "site does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Site model server error - list",
        error: error.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdateBody = update;
      if (modifiedUpdateBody._id) {
        delete modifiedUpdateBody._id;
      }
      if (modifiedUpdateBody.latitude) {
        delete modifiedUpdateBody.latitude;
      }
      if (modifiedUpdateBody.longitude) {
        delete modifiedUpdateBody.longitude;
      }
      if (modifiedUpdateBody.generated_name) {
        delete modifiedUpdateBody.generated_name;
      }
      if (modifiedUpdateBody.lat_long) {
        delete modifiedUpdateBody.lat_long;
      }
      let updatedSite = await this.findOneAndUpdate(
        filter,
        modifiedUpdateBody,
        options
      ).exec();
      let data = jsonify(updatedSite);
      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully modified the site",
          data,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "site does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Site model server error - modify",
        error: error.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: {
          _id: 1,
          name: 1,
          generated_name: 1,
          lat_long: 1,
          country: 1,
          district: 1,
        },
      };
      let removedSite = await this.findOneAndRemove(filter, options).exec();
      let data = jsonify(removedSite);
      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully removed the site",
          data,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "site does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Site model server error - remove",
        error: error.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

siteSchema.methods = {};

module.exports = siteSchema;
