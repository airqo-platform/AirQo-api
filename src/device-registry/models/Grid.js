const mongoose = require("mongoose");
const { Schema } = mongoose;
const isEmpty = require("is-empty");
const ObjectId = Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
const { logElement, logObject, logText } = require("@utils/log");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- grid-model`
);
const { getModelByTenant } = require("@config/database");
const shapeSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["Polygon", "MultiPolygon"],
      required: true,
    },
    coordinates: {
      type: Schema.Types.Mixed,
      required: true,
    },
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

const gridSchema = new Schema(
  {
    network: {
      type: String,
      trim: true,
      required: [true, "the network is required!"],
    },
    geoHash: {
      type: String,
      index: true,
    },
    centers: [centerPointSchema],
    long_name: {
      type: String,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    grid_tags: {
      type: Array,
      default: [],
    },
    admin_level: {
      type: String,
      required: [true, "admin_level is required!"],
    },
    name: {
      type: String,
      trim: true,
      required: [true, "name is required!"],
      unique: true,
    },
    visibility: {
      type: Boolean,
      trim: true,
      default: false,
    },
    grid_codes: [
      {
        type: String,
        trim: true,
      },
    ],
    shape: {
      type: shapeSchema,
      required: [true, "shape is required!"],
    },
  },
  { timestamps: true }
);

gridSchema.post("save", async function(doc) {});

gridSchema.pre("save", function(next) {
  if (this.isModified("_id")) {
    delete this._id;
  }
  this.grid_codes = [this._id, this.name];
  return next();
});

gridSchema.pre("update", function(next) {
  if (this.isModified("_id")) {
    delete this._id;
  }
  return next();
});

gridSchema.plugin(uniqueValidator, {
  message: `{VALUE} is a duplicate value!`,
});

// gridSchema.index({ geoHash: 1 });

gridSchema.methods.toJSON = function() {
  const {
    _id,
    name,
    long_name,
    network,
    visibility,
    description,
    grid_tags,
    admin_level,
    grid_codes,
    centers,
    shape,
    geoHash,
  } = this;
  return {
    _id,
    name,
    visibility,
    long_name,
    description,
    grid_tags,
    network,
    admin_level,
    grid_codes,
    centers,
    shape,
    geoHash,
  };
};

gridSchema.statics.register = async function(args) {
  try {
    let modifiedArgs = { ...args };

    if (isEmpty(modifiedArgs.network)) {
      modifiedArgs.network = constants.DEFAULT_NETWORK;
    }

    if (!isEmpty(modifiedArgs.long_name && isEmpty(modifiedArgs.name))) {
      modifiedArgs.name = modifiedArgs.long_name
        .replace(/[^a-zA-Z0-9]/g, "_")
        .slice(0, 41)
        .trim()
        .toLowerCase();
    }

    if (isEmpty(modifiedArgs.long_name && !isEmpty(modifiedArgs.name))) {
      modifiedArgs.long_name = modifiedArgs.name;
    }

    if (!isEmpty(modifiedArgs.name) && !isEmpty(modifiedArgs.long_name)) {
      modifiedArgs.name = modifiedArgs.name
        .replace(/[^a-zA-Z0-9]/g, "_")
        .slice(0, 41)
        .trim()
        .toLowerCase();
    }

    const createdGrid = await this.create(modifiedArgs);

    if (!isEmpty(createdGrid)) {
      return {
        success: true,
        data: createdGrid._doc,
        message: "grid created",
        status: httpStatus.OK,
      };
    } else {
      return {
        success: false,
        message: "grid not created despite successful operation",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: "grid not created despite successful operation",
        },
      };
    }
  } catch (error) {
    logObject("error", error);
    let response = {
      message: "validation errors for some of the provided fields",
      success: false,
      status: httpStatus.CONFLICT,
      errors: { message: error.message },
    };

    if (!isEmpty(error.errors)) {
      response.errors = {};

      Object.entries(error.errors).forEach(([key, value]) => {
        response.errors.message = value.message;
        response.errors[value.path] = value.message;
      });
    } else {
      response.errors = { message: error.message };
    }

    return response;
  }
};

gridSchema.statics.list = async function({
  filter = {},
  limit = 1000,
  skip = 0,
} = {}) {
  try {
    logText("we are inside model's list....");
    const inclusionProjection = constants.GRIDS_INCLUSION_PROJECTION;
    const exclusionProjection = constants.GRIDS_EXCLUSION_PROJECTION(
      filter.category ? filter.category : "none"
    );
    if (!isEmpty(filter.category)) {
      delete filter.category;
    }
    const pipeline = this.aggregate()
      .match(filter)
      .lookup({
        from: "sites",
        localField: "_id",
        foreignField: "grids",
        as: "sites",
      })
      .sort({ createdAt: -1 })
      .project(inclusionProjection)
      .project(exclusionProjection)
      .skip(skip ? skip : 0)
      .limit(limit ? limit : 1000)
      .allowDiskUse(true);

    const data = await pipeline;
    if (!isEmpty(data)) {
      return {
        success: true,
        message: "Successfull Operation",
        data,
        status: httpStatus.OK,
      };
    } else {
      return {
        success: true,
        message: "There are no records for this search",
        data: [],
        status: httpStatus.OK,
      };
    }
  } catch (error) {
    return {
      errors: { message: error.message },
      message: "Internal Server Error",
      success: false,
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

gridSchema.statics.modify = async function({ filter = {}, update = {} } = {}) {
  try {
    const options = {
      new: true,
      useFindAndModify: false,
      projection: { shape: 0, __v: 0 },
    };

    const modifiedUpdateBody = { ...update };
    delete modifiedUpdateBody._id;
    delete modifiedUpdateBody.name;
    delete modifiedUpdateBody.long_name;
    delete modifiedUpdateBody.grid_codes;
    delete modifiedUpdateBody.centers;
    delete modifiedUpdateBody.shape;
    delete modifiedUpdateBody.geoHash;

    const updatedGrid = await this.findOneAndUpdate(
      filter,
      modifiedUpdateBody,
      options
    ).exec();

    if (!isEmpty(updatedGrid)) {
      return {
        success: true,
        message: "successfully modified the grid",
        data: updatedGrid._doc,
        status: httpStatus.OK,
      };
    } else {
      return {
        success: false,
        message: "grid does not exist, please crosscheck",
        status: httpStatus.BAD_REQUEST,
        errors: filter,
      };
    }
  } catch (error) {
    return {
      errors: { message: error.message },
      message: "Internal Server Error",
      success: false,
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

gridSchema.statics.remove = async function({ filter = {} } = {}) {
  try {
    const options = {
      projection: {
        _id: 1,
        name: 1,
        admin_level: 1,
      },
    };

    const removedGrid = await this.findOneAndRemove(filter, options).exec();

    if (!isEmpty(removedGrid)) {
      return {
        success: true,
        message: "successfully removed the grid",
        data: removedGrid._doc,
        status: httpStatus.OK,
      };
    } else {
      return {
        success: false,
        message: "grid does not exist, please crosscheck",
        status: httpStatus.BAD_REQUEST,
        errors: filter,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

const GridModel = (tenant) => {
  try {
    const grids = mongoose.model("grids");
    return grids;
  } catch (error) {
    const grids = getModelByTenant(tenant, "grid", gridSchema);
    return grids;
  }
};

module.exports = GridModel;
