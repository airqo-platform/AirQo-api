const { Schema } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
const { logElement, logObject, logText } = require("../utils/log");
const isEmpty = require("is-empty");
const HTTPStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger("create-airqloud-model");

const polygonSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["Polygon", "Point"],
      required: true,
    },
    coordinates: {
      type: [[[Number]]],
      required: true,
    },
  },
  { _id: false }
);

const metadataSchema = new Schema(
  {
    country: { type: String },
    region: { type: String },
    county: { type: String },
    village: { type: String },
    district: { type: String },
    parish: { type: String },
    subcounty: { type: String },
    centroid: { type: Array, coordinates: [0, 0] },
    km2: { type: Number },
    population: { type: Number },
    households: { type: Number },
    population_density: { type: Number },
    household_density: { type: Number },
    charcoal_per_km2: { type: Number },
    firewood_per_km2: { type: Number },
    cowdung_per_km2: { type: Number },
    grass_per_km2: { type: Number },
    wasteburning_per_km2: { type: Number },
    kitch_outsidebuilt_per_km2: { type: Number },
    kitch_makeshift_per_km2: { type: Number },
    kitch_openspace_per_km2: { type: Number },
  },
  { _id: false }
);

const pointSchema = new Schema(
  {
    longitude: { type: Number },
    latitude: { type: Number },
  },
  {
    _id: false,
  }
);

const airqloudSchema = new Schema(
  {
    location: { type: polygonSchema },
    center_point: { type: pointSchema },
    name: {
      type: String,
      trim: true,
      required: [true, "name is required!"],
      unique: true,
    },
    sites: [
      {
        type: ObjectId,
        ref: "site",
      },
    ],
    long_name: {
      type: String,
      trim: true,
      default: null,
    },
    description: {
      type: String,
      trim: true,
    },
    admin_level: {
      type: String,
      required: [true, "admin_level is required!"],
    },
    isCustom: {
      type: Boolean,
      required: [true, "isCustom is required!"],
    },
    metadata: { type: metadataSchema },
    airqloud_tags: {
      type: Array,
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

airqloudSchema.pre("save", function(next) {
  if (this.isModified("_id")) {
    delete this._id;
  }
  return next();
});

airqloudSchema.pre("update", function(next) {
  if (this.isModified("_id")) {
    delete this._id;
  }
  return next();
});

airqloudSchema.plugin(uniqueValidator, {
  message: `{VALUE} is a duplicate value!`,
});

airqloudSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      name: this.name,
      long_name: this.long_name,
      description: this.description,
      airqloud_tags: this.airqloud_tags,
      admin_level: this.admin_level,
      isCustom: this.isCustom,
      location: this.location,
      metadata: this.metadata,
      sites: this.sites,
      center_point: this.center_point,
    };
  },
};

airqloudSchema.statics = {
  sanitiseName: (name) => {
    try {
      let nameWithoutWhiteSpaces = name.replace(/\s/g, "");
      let shortenedName = nameWithoutWhiteSpaces.substring(0, 15);
      let trimmedName = shortenedName.trim();
      return trimmedName.toLowerCase();
    } catch (error) {
      logger.error(`sanitiseName -- create airqloud model -- ${error.message}`);
    }
  },
  async register(args) {
    try {
      let body = args;
      body["name"] = this.sanitiseName(args.long_name);
      if (args.location_id && !args.isCustom) {
        body["isCustom"] = false;
      }
      if (!args.location_id && !args.isCustom) {
        body["isCustom"] = true;
      }
      let createdAirQloud = await this.create({
        ...body,
      });
      if (!isEmpty(createdAirQloud)) {
        let data = createdAirQloud._doc;
        return {
          success: true,
          data,
          message: "airqloud created",
          status: HTTPStatus.OK,
        };
      }
      if (isEmpty(createdAirQloud)) {
        return {
          success: true,
          message: "airqloud not created despite successful operation",
          status: HTTPStatus.NO_CONTENT,
        };
      }
    } catch (err) {
      let e = err;
      let response = {};
      // logObject("the err in the model", err);
      message = "validation errors for some of the provided fields";
      const status = HTTPStatus.CONFLICT;
      Object.entries(err.errors).forEach(([key, value]) => {
        return (response[value.path] = value.message);
      });

      return {
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },
  async list({ filter = {}, _limit = 1000, _skip = 0 } = {}) {
    try {
      logElement("the limit in the model", _limit);
      let data = await this.aggregate()
        .match(filter)
        .lookup({
          from: "sites",
          localField: "sites",
          foreignField: "_id",
          as: "sites",
        })
        .sort({ createdAt: -1 })
        .project({
          _id: 1,
          name: 1,
          long_name: 1,
          description: 1,
          airqloud_tags: 1,
          location: 1,
          admin_level: 1,
          isCustom: 1,
          metadata: 1,
          center_point: 1,
          sites: "$sites",
        })
        .project({
          "sites.altitude": 0,
          "sites.greenness": 0,
          "sites.landform_90": 0,
          "sites.landform_270": 0,
          "sites.aspect": 0,
          "sites.distance_to_nearest_road": 0,
          "sites.distance_to_nearest_primary_road": 0,
          "sites.distance_to_nearest_secondary_road": 0,
          "sites.distance_to_nearest_tertiary_road": 0,
          "sites.distance_to_nearest_unclassified_road": 0,
          "sites.distance_to_nearest_residential_road": 0,
          "sites.bearing_to_kampala_center": 0,
          "sites.distance_to_kampala_center": 0,
          "sites.updatedAt": 0,
          "sites.nearest_tahmo_station": 0,
          "sites.formatted_name": 0,
          "sites.geometry": 0,
          "sites.google_place_id": 0,
          "sites.site_tags": 0,
          "sites.street": 0,
          "sites.town": 0,
          "sites.village": 0,
          "sites.airqlouds": 0,
          "sites.description": 0,
          "sites.__v": 0,
          "sites.airqloud_id": 0,
          "sites.createdAt": 0,
          "sites.lat_long": 0,
        })
        .skip(_skip)
        .limit(_limit)
        .allowDiskUse(true);

      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully fetched the AirQloud(s)",
          data,
          status: HTTPStatus.OK,
        };
      }

      if (isEmpty(data)) {
        return {
          success: true,
          message: "there are no records for this search",
          data,
          status: HTTPStatus.NOT_FOUND,
        };
      }
    } catch (err) {
      let errors = { message: err.message };
      let message = "Internal Server Error";
      let status = HTTPStatus.INTERNAL_SERVER_ERROR;
      return {
        errors,
        message,
        success: false,
        status,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true, useFindAndModify: false };
      let modifiedUpdateBody = update;
      if (update._id) {
        delete modifiedUpdateBody._id;
      }
      if (update.name) {
        delete modifiedUpdateBody.name;
      }
      if (update.sites) {
        modifiedUpdateBody["$addToSet"] = {};
        modifiedUpdateBody["$addToSet"]["sites"] = {};
        modifiedUpdateBody["$addToSet"]["sites"]["$each"] = update.sites;

        delete modifiedUpdateBody["sites"];
      }
      let updatedAirQloud = await this.findOneAndUpdate(
        filter,
        modifiedUpdateBody,
        options
      ).exec();

      if (!isEmpty(updatedAirQloud)) {
        let data = updatedAirQloud._doc;
        return {
          success: true,
          message: "successfully modified the airqloud",
          data,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "airqloud does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
          errors: filter,
        };
      }
    } catch (err) {
      let errors = { message: err.message };
      let message = "Internal Server Error";
      let status = HTTPStatus.INTERNAL_SERVER_ERROR;
      return {
        errors,
        message,
        success: false,
        status,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: {
          _id: 1,
          name: 1,
          long_name: 1,
          airqloud_tags: 1,
          description: 1,
          admin_level: 1,
          isCustom: 1,
          metadata: 1,
        },
      };
      let removedAirqloud = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedAirqloud)) {
        let data = removedAirqloud._doc;
        return {
          success: true,
          message: "successfully removed the airqloud",
          data,
          status: HTTPStatus.OK,
        };
      }

      if (isEmpty(removedAirqloud)) {
        return {
          success: false,
          message: "airqloud does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
          errors: filter,
        };
      }
    } catch (err) {
      let errors = { message: err.message };
      let message = err.message;
      let status = HTTPStatus.INTERNAL_SERVER_ERROR;

      return {
        success: false,
        message,
        errors,
        status,
      };
    }
  },
};

module.exports = airqloudSchema;
