const mongoose = require("mongoose");
const { Schema } = mongoose;
const isEmpty = require("is-empty");
const ObjectId = Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
const { logObject, HttpError } = require("@utils/shared");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- network-model`);
const { getModelByTenant } = require("@config/database");

const NetworkSchema = new Schema(
  {
    // New fields
    net_name: {
      type: String,
      trim: true,
    },
    net_acronym: {
      type: String,
      trim: true,
    },
    net_status: {
      type: String,
      default: "inactive",
    },
    net_manager: {
      type: ObjectId,
      ref: "user",
    },
    net_manager_username: { type: String },
    net_manager_firstname: { type: String },
    net_manager_lastname: { type: String },
    net_email: {
      type: String,
      trim: true,
    },
    net_website: {
      type: String,
      trim: true,
    },
    net_category: {
      type: String,
    },
    net_data_source: {
      type: String,
    },
    net_api_key: {
      type: String,
    },
    net_description: {
      type: String,
      trim: true,
    },
    net_profile_picture: {
      type: String,
      trim: true,
    },
    // Old fields for backward compatibility
    name: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook for backward compatibility
NetworkSchema.pre("save", function(next) {
  // Sync from new fields to old fields
  if (this.isModified("net_name") && !this.name) {
    this.name = this.net_name;
  }
  if (this.isModified("net_description") && !this.description) {
    this.description = this.net_description;
  }

  // Sync from old fields to new fields
  if (this.isModified("name") && !this.net_name) {
    this.net_name = this.name;
  }
  if (this.isModified("name") && !this.net_acronym) {
    this.net_acronym = this.name;
  }
  if (this.isModified("description") && !this.net_description) {
    this.net_description = this.description;
  }

  // Ensure required fields have a value
  if (!this.net_name && this.name) {
    this.net_name = this.name;
  }
  if (!this.net_acronym && this.name) {
    this.net_acronym = this.name;
  }

  next();
});

NetworkSchema.plugin(uniqueValidator, {
  message: `{VALUE} is a duplicate value!`,
});

NetworkSchema.methods.toJSON = function() {
  const {
    _id,
    net_name,
    net_acronym,
    net_status,
    net_email,
    net_website,
    net_category,
    net_description,
    net_profile_picture,
    createdAt,
    name,
    description,
  } = this.toObject();

  return {
    _id,
    // New fields
    net_name,
    net_acronym,
    net_status,
    net_email,
    net_website,
    net_category,
    net_description,
    net_profile_picture,
    // Old fields
    name,
    description,
    createdAt: new Date(createdAt)
      .toISOString()
      .slice(0, 19)
      .replace("T", " "),
  };
};

NetworkSchema.statics.register = async function(args, next) {
  try {
    let modifiedArgs = { ...args };
    const createdNetwork = await this.create(modifiedArgs);

    if (!isEmpty(createdNetwork)) {
      return {
        success: true,
        data: createdNetwork,
        message: "network created",
        status: httpStatus.CREATED,
      };
    }
    return {
      success: false,
      message: "network not created despite successful operation",
      status: httpStatus.INTERNAL_SERVER_ERROR,
      errors: {
        message: "network not created despite successful operation",
      },
    };
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    let response = {
      message: "validation errors for some of the provided fields",
      success: false,
      status: httpStatus.CONFLICT,
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
    next(new HttpError(response.message, response.status, response.errors));
  }
};

NetworkSchema.statics.list = async function(
  { filter = {}, limit = 1000, skip = 0 } = {},
  next
) {
  try {
    const inclusionProjection = constants.NETWORK_INCLUSION_PROJECTION;
    const exclusionProjection = constants.NETWORK_EXCLUSION_PROJECTION(
      filter.path ? filter.path : "none"
    );

    delete filter.path;
    delete filter.dashboard;
    delete filter.summary;

    const data = await this.aggregate()
      .match(filter)
      .sort({ createdAt: -1 })
      .project(inclusionProjection)
      .project(exclusionProjection)
      .skip(skip ? skip : 0)
      .limit(limit ? limit : 1000)
      .allowDiskUse(true);

    if (!isEmpty(data)) {
      return {
        success: true,
        message: "Successfully retrieved the network details",
        data: data,
        status: httpStatus.OK,
      };
    }
    return {
      success: true,
      message: "There are no records for this search",
      data: [],
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

NetworkSchema.statics.modify = async function(
  { filter = {}, update = {} } = {},
  next
) {
  try {
    const options = {
      new: true,
      useFindAndModify: false,
      projection: { shape: 0, __v: 0 },
    };

    const modifiedUpdateBody = { ...update };
    delete modifiedUpdateBody._id;

    const updatedNetwork = await this.findOneAndUpdate(
      filter,
      modifiedUpdateBody,
      options
    ).exec();

    if (!isEmpty(updatedNetwork)) {
      return {
        success: true,
        message: "successfully modified the network",
        data: updatedNetwork,
        status: httpStatus.OK,
      };
    }
    return {
      success: false,
      message: "network does not exist, please crosscheck",
      status: httpStatus.BAD_REQUEST,
      errors: { message: "network does not exist, please crosscheck" },
    };
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

NetworkSchema.statics.remove = async function({ filter = {} } = {}, next) {
  try {
    const options = {
      projection: {
        _id: 1,
        net_name: 1,
        net_acronym: 1,
      },
    };

    const removedNetwork = await this.findOneAndRemove(filter, options).exec();

    if (!isEmpty(removedNetwork)) {
      return {
        success: true,
        message: "successfully removed the network",
        data: removedNetwork,
        status: httpStatus.OK,
      };
    }
    return {
      success: false,
      message: "network does not exist, please crosscheck",
      status: httpStatus.BAD_REQUEST,
      errors: { message: "network does not exist, please crosscheck" },
    };
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

const NetworkModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const networks = mongoose.model("networks");
    return networks;
  } catch (error) {
    const networks = getModelByTenant(dbTenant, "network", NetworkSchema);
    return networks;
  }
};

module.exports = NetworkModel;
