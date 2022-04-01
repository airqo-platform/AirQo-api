const { Schema } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
const { logElement, logObject, logText } = require("../utils/log");
const isEmpty = require("is-empty");
const HTTPStatus = require("http-status");

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

const locationSchema = new Schema(
  {
    location: { type: polygonSchema },
    name: {
      type: String,
      trim: true,
      required: [true, "name is required!"],
    },
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
      default: false,
    },
    metadata: { type: metadataSchema },
    location_tags: {
      type: Array,
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

locationSchema.pre("save", function(next) {
  if (this.isModified("_id")) {
    delete this._id;
  }
  return next();
});

locationSchema.pre("update", function(next) {
  if (this.isModified("_id")) {
    delete this._id;
  }
  return next();
});

locationSchema.plugin(uniqueValidator, {
  message: `{VALUE} is a duplicate value!`,
});

locationSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      name: this.name,
      long_name: this.long_name,
      description: this.description,
      location_tags: this.location_tags,
      admin_level: this.admin_level,
      isCustom: this.isCustom,
      location: this.location,
      metadata: this.metadata,
    };
  },
};

locationSchema.statics = {
  async register(args) {
    try {
      let body = args;
      if (!args.isCustom) {
        body["isCustom"] = false;
      }
      let createdAirQloud = await this.create({
        ...body,
      });

      if (!isEmpty(createdAirQloud)) {
        let data = createdAirQloud._doc;
        return {
          success: true,
          data,
          message: "location created",
          status: HTTPStatus.OK,
        };
      }
      if (isEmpty(createdAirQloud)) {
        return {
          success: true,
          message: "location not created despite successful operation",
          status: HTTPStatus.NO_CONTENT,
        };
      }
    } catch (err) {
      let e = err;
      let response = {};
      logObject("the err", e);
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
          localField: "_id",
          foreignField: "location_id",
          as: "sites",
        })
        .sort({ createdAt: -1 })
        .project({
          _id: 1,
          name: 1,
          long_name: 1,
          description: 1,
          location_tags: 1,
          location: 1,
          admin_level: 1,
          isCustom: 1,
          metadata: 1,
          sites: "$sites",
        })
        .skip(_skip)
        .limit(_limit)
        .allowDiskUse(true);

      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully fetched the Location(s)",
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
      let options = { new: true };
      let modifiedUpdateBody = update;
      modifiedUpdateBody["$addToSet"] = {};
      if (modifiedUpdateBody._id) {
        delete modifiedUpdateBody._id;
      }
      if (modifiedUpdateBody.isCustom) {
        modifiedUpdateBody.isCustom = false;
      }

      if (modifiedUpdateBody.location_tags) {
        modifiedUpdateBody["$addToSet"]["location_tags"] = {};
        modifiedUpdateBody["$addToSet"]["location_tags"]["$each"] =
          modifiedUpdateBody.location_tags;
        delete modifiedUpdateBody["location_tags"];
      }
      let updatedLocation = await this.findOneAndUpdate(
        filter,
        modifiedUpdateBody,
        options
      ).exec();

      if (!isEmpty(updatedLocation)) {
        let data = updatedLocation._doc;
        return {
          success: true,
          message: "successfully modified the location",
          data,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "location does not exist, please crosscheck",
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
          location_tags: 1,
          description: 1,
          admin_level: 1,
          isCustom: 1,
          metadata: 1,
        },
      };
      let removedLocation = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedLocation)) {
        let data = removedLocation._doc;
        return {
          success: true,
          message: "successfully removed the location",
          data,
          status: HTTPStatus.OK,
        };
      }

      if (isEmpty(removedLocation)) {
        return {
          success: false,
          message: "location does not exist, please crosscheck",
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

module.exports = locationSchema;
