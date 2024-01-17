const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
const { logObject, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/errors");
const { getModelByTenant } = require("@config/database");

const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- site-model`);

const siteSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
      unique: true,
      required: [true, "name is required!"],
    },
    visibility: {
      type: Boolean,
      trim: true,
      default: false,
    },
    grids: {
      type: [
        {
          type: ObjectId,
          ref: "grid",
        },
      ],
    },
    share_links: {
      preview: { type: String, trim: true },
      short_link: { type: String, trim: true },
    },
    images: [
      {
        type: String,
        trim: true,
      },
    ],
    search_name: {
      type: String,
      trim: true,
    },
    network: {
      type: String,
      trim: true,
      required: [true, "network is required!"],
    },
    group: {
      type: String,
      trim: true,
    },
    data_provider: {
      type: String,
      trim: true,
    },
    location_name: {
      type: String,
      trim: true,
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
    airqlouds: [
      {
        type: ObjectId,
        ref: "airqloud",
      },
    ],
    formatted_name: {
      type: String,
      trim: true,
    },
    lat_long: {
      type: String,
      trim: true,
      unique: true,
      required: [true, "lat_long is required!"],
    },
    description: {
      type: String,
      trim: true,
      unique: true,
    },
    site_codes: [
      {
        type: String,
        trim: true,
      },
    ],
    latitude: {
      type: Number,
      required: [true, "latitude is required!"],
    },
    approximate_latitude: {
      type: Number,
      required: [true, "approximate_latitude is required!"],
    },
    longitude: {
      type: Number,
      required: [true, "longitude is required!"],
    },
    approximate_longitude: {
      type: Number,
      required: [true, "approximate_longitude is required!"],
    },
    approximate_distance_in_km: {
      type: Number,
      required: [true, "approximate_distance_in_km is required!"],
    },
    bearing_in_radians: {
      type: Number,
      required: [true, "bearing_in_radians is required!"],
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
    distance_to_capital_city_center: {
      type: Number,
      trim: true,
    },
    bearing_to_capital_city_center: {
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
    land_use: [
      {
        type: String,
        trim: true,
      },
    ],
    road_intensity: {
      type: Number,
    },
    road_status: {
      type: String,
    },
    aspect: {
      type: Number,
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
    weather_stations: [
      {
        code: {
          type: String,
          trim: true,
          default: null,
        },
        name: {
          type: String,
          trim: true,
          default: null,
        },
        country: {
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
        distance: {
          type: Number,
          trim: true,
          default: -1,
        },
      },
    ],
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

siteSchema.post("save", async function(doc) {});

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

  this.site_codes = [this._id, this.name, this.generated_name, this.lat_long];
  if (this.search_name) {
    this.site_codes.push(this.search_name);
  }
  if (this.location_name) {
    this.site_codes.push(this.location_name);
  }
  if (this.formatted_name) {
    this.site_codes.push(this.formatted_name);
  }

  // Check for duplicate values in the grids array
  const duplicateValues = this.grids.filter(
    (value, index, self) => self.indexOf(value) !== index
  );
  if (duplicateValues.length > 0) {
    const error = new Error("Duplicate values found in grids array.");
    return next(error);
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
      grids: this.grids,
      name: this.name,
      visibility: this.visibility,
      generated_name: this.generated_name,
      search_name: this.search_name,
      network: this.network,
      group: this.group,
      data_provider: this.data_provider,
      location_name: this.location_name,
      formatted_name: this.formatted_name,
      lat_long: this.lat_long,
      latitude: this.latitude,
      approximate_latitude: this.approximate_latitude,
      longitude: this.longitude,
      approximate_longitude: this.approximate_longitude,
      approximate_distance_in_km: this.approximate_distance_in_km,
      bearing_in_radians: this.bearing_in_radians,
      airqlouds: this.airqlouds,
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
      site_codes: this.site_codes,
      images: this.images,
      share_links: this.share_links,
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
      bearing_to_capital_city_center: this.bearing_to_capital_city_center,
      distance_to_capital_city_center: this.distance_to_capital_city_center,
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
  async register(args, next) {
    try {
      let modifiedArgs = args;
      modifiedArgs.description = modifiedArgs.name;

      if (isEmpty(modifiedArgs.network)) {
        modifiedArgs.network = constants.DEFAULT_NETWORK;
      }

      logObject("modifiedArgs", modifiedArgs);
      let createdSite = await this.create({
        ...modifiedArgs,
      });

      if (!isEmpty(createdSite)) {
        let data = createdSite._doc;
        delete data.geometry;
        delete data.google_place_id;
        delete data.updatedAt;
        delete data.__v;
        delete data.formatted_name;
        delete data.airqlouds;
        delete data.site_tags;
        delete data.nearest_tahmo_station;
        return {
          success: true,
          data,
          message: "site created",
          status: httpStatus.CREATED,
        };
      } else if (isEmpty(createdSite)) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "site not created despite successful operation",
            }
          )
        );
      }
    } catch (error) {
      logObject("the error", error);
      const stingifiedMessage = JSON.stringify(error ? error : "");
      logger.error(`🐛🐛 Internal Server Error -- ${stingifiedMessage}`);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      Object.entries(error.errors).forEach(([key, value]) => {
        response.message = value.message;
        response[key] = value.message;
        return response;
      });

      next(new HttpError(message, status, response));
    }
  },
  async list({ skip = 0, limit = 1000, filter = {} } = {}, next) {
    try {
      const inclusionProjection = constants.SITES_INCLUSION_PROJECTION;
      const exclusionProjection = constants.SITES_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none"
      );

      if (!isEmpty(filter.category)) {
        delete filter.category;
      }
      if (!isEmpty(filter.dashboard)) {
        delete filter.dashboard;
      }
      if (!isEmpty(filter.summary)) {
        delete filter.summary;
      }

      const pipeline = await this.aggregate()
        .match(filter)
        .lookup({
          from: "devices",
          localField: "_id",
          foreignField: "site_id",
          as: "devices",
        })
        .lookup({
          from: "grids",
          localField: "grids",
          foreignField: "_id",
          as: "grids",
        })
        .lookup({
          from: "airqlouds",
          localField: "airqlouds",
          foreignField: "_id",
          as: "airqlouds",
        })
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(
          limit ? limit : parseInt(constants.DEFAULT_LIMIT_FOR_QUERYING_SITES)
        )
        .allowDiskUse(true);

      const response = await pipeline;

      if (!isEmpty(response)) {
        return {
          success: true,
          message: "successfully retrieved the site details",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "no sites match this search",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      const stingifiedMessage = JSON.stringify(error ? error : "");
      logger.error(`🐛🐛 Internal Server Error -- ${stingifiedMessage}`);

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      let options = { new: true, useFindAndModify: false, upsert: false };
      let modifiedUpdateBody = update;
      modifiedUpdateBody["$addToSet"] = {};
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
        logText("yes, the lat_long does exist here");
        delete modifiedUpdateBody.lat_long;
      }

      if (modifiedUpdateBody.site_tags) {
        modifiedUpdateBody["$addToSet"]["site_tags"] = {};
        modifiedUpdateBody["$addToSet"]["site_tags"]["$each"] =
          modifiedUpdateBody.site_tags;
        delete modifiedUpdateBody["site_tags"];
      }

      if (modifiedUpdateBody.images) {
        modifiedUpdateBody["$addToSet"]["images"] = {};
        modifiedUpdateBody["$addToSet"]["images"]["$each"] =
          modifiedUpdateBody.images;
        delete modifiedUpdateBody["images"];
      }

      if (modifiedUpdateBody.land_use) {
        modifiedUpdateBody["$addToSet"]["land_use"] = {};
        modifiedUpdateBody["$addToSet"]["land_use"]["$each"] =
          modifiedUpdateBody.land_use;
        delete modifiedUpdateBody["land_use"];
      }

      if (modifiedUpdateBody.site_codes) {
        modifiedUpdateBody["$addToSet"]["site_codes"] = {};
        modifiedUpdateBody["$addToSet"]["site_codes"]["$each"] =
          modifiedUpdateBody.site_codes;
        delete modifiedUpdateBody["site_codes"];
      }

      if (modifiedUpdateBody.airqlouds) {
        modifiedUpdateBody["$addToSet"]["airqlouds"] = {};
        modifiedUpdateBody["$addToSet"]["airqlouds"]["$each"] =
          modifiedUpdateBody.airqlouds;
        delete modifiedUpdateBody["airqlouds"];
      }
      logObject("modifiedUpdateBody", modifiedUpdateBody);
      let updatedSite = await this.findOneAndUpdate(
        filter,
        modifiedUpdateBody,
        options
      ).exec();

      if (!isEmpty(updatedSite)) {
        return {
          success: true,
          message: "successfully modified the site",
          data: updatedSite._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedSite)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "site does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      const stingifiedMessage = JSON.stringify(error ? error : "");
      logger.error(`🐛🐛 Internal Server Error -- ${stingifiedMessage}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async remove({ filter = {} } = {}, next) {
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
      const removedSite = await this.findOneAndRemove(filter, options).exec();
      if (!isEmpty(removedSite)) {
        return {
          success: true,
          message: "successfully removed the site",
          data: removedSite._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedSite)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "site does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      const stingifiedMessage = JSON.stringify(error ? error : "");
      logger.error(`🐛🐛 Internal Server Error -- ${stingifiedMessage}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

const SiteModel = (tenant) => {
  try {
    let sites = mongoose.model("sites");
    return sites;
  } catch (error) {
    let sites = getModelByTenant(tenant, "site", siteSchema);
    return sites;
  }
};

module.exports = SiteModel;
