const { Schema } = require("mongoose");
const mongoose = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
const { logElement, logObject, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const HTTPStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-airqloud-model`
);
const { getModelByTenant } = require("@config/database");
const polygonSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Polygon"],
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

const centerPointSchema = new Schema(
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
    center_point: { type: centerPointSchema },
    name: {
      type: String,
      trim: true,
      required: [true, "name is required!"],
      unique: true,
    },
    airqloud_codes: [
      {
        type: String,
        trim: true,
      },
    ],
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
    network: {
      type: String,
      trim: true,
    },
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
  this.airqloud_codes = [this._id, this.name];
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

airqloudSchema.methods.toJSON = function() {
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
    airqloud_codes: this.airqloud_codes,
    center_point: this.center_point,
  };
};

airqloudSchema.statics.sanitiseName = function(name) {
  try {
    let nameWithoutWhiteSpaces = name.replace(/\s/g, "");
    let shortenedName = nameWithoutWhiteSpaces.substring(0, 15);
    let trimmedName = shortenedName.trim();
    return trimmedName.toLowerCase();
  } catch (error) {
    logger.error(`sanitiseName -- create airqloud model -- ${error.message}`);
  }
};

airqloudSchema.statics.register = async function(args) {
  try {
    const body = {
      ...args,
      name: this.sanitiseName(args.long_name),
    };

    if (!args.location_id) {
      body.isCustom = true;
    } else {
      body.isCustom = false;
    }

    const createdAirQloud = await this.create({ ...body });

    if (!isEmpty(createdAirQloud)) {
      const data = createdAirQloud._doc;
      return {
        success: true,
        data,
        message: "Airqloud created",
        status: HTTPStatus.OK,
      };
    }
  } catch (err) {
    let response = {};
    message = "validation errors for some of the provided fields";
    const status = HTTPStatus.CONFLICT;
    if (err.errors) {
      Object.entries(err.errors).forEach(([key, value]) => {
        response.message = value.message;
        response[value.path] = value.message;
        return response;
      });
    }

    return {
      errors: response,
      message,
      success: false,
      status,
    };
  }
};

airqloudSchema.statics.list = async function({
  filter = {},
  limit = 1000,
  skip = 0,
} = {}) {
  try {
    const inclusionProjection = constants.AIRQLOUDS_INCLUSION_PROJECTION;
    const exclusionProjection = constants.AIRQLOUDS_EXCLUSION_PROJECTION(
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

    const data = await this.aggregate()
      .match(filter)
      .lookup({
        from: "sites",
        localField: "sites",
        foreignField: "_id",
        as: "sites",
      })
      .sort({ createdAt: -1 })
      .project(inclusionProjection)
      .project(exclusionProjection)
      .skip(skip ? skip : 0)
      .limit(limit ? limit : 1000)
      .allowDiskUse(true);

    if (!isEmpty(data)) {
      return {
        success: true,
        message: "Successfull Operation",
        data,
        status: HTTPStatus.OK,
      };
    } else if (isEmpty(data)) {
      return {
        success: true,
        message: "There are no records for this search",
        data: [],
        status: HTTPStatus.OK,
      };
    }
  } catch (err) {
    return {
      errors: { message: err.message },
      message: "Internal Server Error",
      success: false,
      status: HTTPStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

airqloudSchema.statics.modify = async function({
  filter = {},
  update = {},
} = {}) {
  try {
    const options = {
      new: true,
      useFindAndModify: false,
      projection: { location: 0, __v: 0 },
    };

    if (update._id) {
      delete update._id;
    }

    if (update.name) {
      delete update.name;
    }

    if (update.sites) {
      update.$addToSet = {
        sites: { $each: update.sites },
      };
      delete update.sites;
    }

    const updatedAirQloud = await this.findOneAndUpdate(
      filter,
      update,
      options
    );

    if (!isEmpty(updatedAirQloud)) {
      return {
        success: true,
        message: "Successfully modified the airqloud",
        data: updatedAirQloud._doc,
        status: HTTPStatus.OK,
      };
    } else {
      return {
        success: false,
        message: "Airqloud does not exist, please crosscheck",
        status: HTTPStatus.BAD_REQUEST,
        errors: filter,
      };
    }
  } catch (err) {
    return {
      errors: { message: err.message },
      message: "Internal Server Error",
      success: false,
      status: HTTPStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

airqloudSchema.statics.remove = async function({ filter = {} } = {}) {
  try {
    const options = {
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

    const removedAirqloud = await this.findOneAndRemove(filter, options);

    if (!isEmpty(removedAirqloud)) {
      return {
        success: true,
        message: "Successfully removed the airqloud",
        data: removedAirqloud._doc,
        status: HTTPStatus.OK,
      };
    } else {
      return {
        success: false,
        message: "Airqloud does not exist, please crosscheck",
        status: HTTPStatus.BAD_REQUEST,
        errors: filter,
      };
    }
  } catch (err) {
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: err.message },
      status: HTTPStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

const airqloudsModel = (tenant) => {
  try {
    const airqlouds = mongoose.model("airqlouds");
    return airqlouds;
  } catch (error) {
    return getModelByTenant(tenant.toLowerCase(), "airqloud", airqloudSchema);
  }
};

module.exports = airqloudsModel;
