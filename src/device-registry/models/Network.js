const mongoose = require("mongoose");
const { Schema } = mongoose;
const isEmpty = require("is-empty");
const ObjectId = Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
const cryptoJS = require("crypto-js");
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
      required: [true, "net_name is required"],
      unique: true,
      trim: true,
    },
    net_acronym: {
      type: String,
      unique: true,
      trim: true,
    },
    net_status: {
      type: String,
      enum: ["active", "inactive"],
      default: "inactive",
    },
    net_manager: {
      type: ObjectId,
    },
    net_manager_username: { type: String },
    net_manager_firstname: { type: String },
    net_manager_lastname: { type: String },
    net_email: {
      type: String,
      required: [true, "net_email is required"],
      unique: true,
      match: [/\S+@\S+\.\S+/, "is invalid"],
      trim: true,
    },
    net_website: {
      type: String,
      match: [/^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i, "is invalid"],
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
      // Encrypted at rest. See pre-save hook.
      select: false,
    },
    net_description: {
      type: String,
      trim: true,
    },
    net_profile_picture: {
      type: String,
      trim: true,
    },
    // Reference to the originating record in the auth-service.
    // Stored to preserve cross-service traceability without conflicting
    // with MongoDB's native _id management during upsert operations.
    auth_service_id: {
      type: ObjectId,
      index: true,
    },
    // ---------------------------------------------------------------------------
    // Network adapter configuration
    //
    // Describes how to fetch live measurements from this manufacturer's API.
    // All fields are optional and default to null / false so existing records
    // are unaffected.  Populated by admin update or the seed script; never
    // touched by the sync job (sync only writes auth-service fields).
    //
    // Fields:
    //   api_code_is_full_url  – device.api_code already is the complete fetch URL
    //   api_base_url          – base URL when building URL from a template
    //   api_url_template      – path template; {serial_number} is substituted
    //   auth_type             – how to attach the credential to the request
    //   auth_key_param        – query-param name or HTTP header name for the key
    //   serial_number_regex   – regex (string) to extract serial_number from api_code
    //   field_map             – maps manufacturer field names to AirQo field names
    //   online_check_via_feed – true → "is online?" is inferred from feed freshness
    // ---------------------------------------------------------------------------
    adapter: {
      api_code_is_full_url: { type: Boolean, default: false },
      api_base_url: { type: String, trim: true },
      api_url_template: { type: String, trim: true },
      auth_type: {
        type: String,
        enum: ["none", "query_param", "header_bearer", "header_basic"],
        default: "none",
      },
      auth_key_param: { type: String, trim: true },
      serial_number_regex: { type: String, trim: true },
      field_map: { type: Schema.Types.Mixed },
      online_check_via_feed: { type: Boolean, default: false },
    },
    // Old fields for backward compatibility
    name: {
      type: String,
      trim: true,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Encrypt API key before saving
NetworkSchema.pre("save", function(next) {
  if (this.isModified("net_api_key") && this.net_api_key) {
    this.net_api_key = cryptoJS.AES.encrypt(
      this.net_api_key,
      constants.KEY_ENCRYPTION_KEY,
    ).toString();
  }
  next();
});
// Pre-save hook for backward compatibility
NetworkSchema.pre("save", function(next) {
  // Establish net_name as the source of truth for the legacy 'name' field.
  if (this.isModified("net_name")) {
    this.name = this.net_name; // Always sync from new to old
  } else if (this.isModified("name") && !this.isModified("net_name")) {
    this.net_name = this.name; // Sync from old to new only if new wasn't modified
  }

  // Populate acronym from net_name ONLY if acronym is missing.
  if (!this.net_acronym && this.net_name) {
    this.net_acronym = this.net_name;
  }

  if (this.isModified("net_description")) {
    this.description = this.net_description;
  } else if (
    this.isModified("description") &&
    !this.isModified("net_description")
  ) {
    this.net_description = this.description;
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
    updatedAt,
    name,
    description,
    net_manager,
    net_manager_username,
    net_manager_firstname,
    net_manager_lastname,
    net_data_source,
    net_api_key,
    auth_service_id,
    adapter,
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
    net_manager,
    net_manager_username,
    net_manager_firstname,
    net_manager_lastname,
    net_data_source,
    net_api_key,
    auth_service_id,
    adapter,
    // Old fields
    name,
    description,
    createdAt: new Date(createdAt).toISOString().slice(0, 19),
    updatedAt: new Date(updatedAt).toISOString().slice(0, 19),
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
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: "network not created despite successful operation",
      }),
    );
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
  next,
) {
  try {
    const inclusionProjection = constants.NETWORK_INCLUSION_PROJECTION;
    const exclusionProjection = constants.NETWORK_EXCLUSION_PROJECTION(
      filter.path ? filter.path : "none",
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
      }),
    );
  }
};

NetworkSchema.statics.modify = async function(
  { filter = {}, update = {} } = {},
  next,
) {
  try {
    const options = {
      new: true,
      useFindAndModify: false,
      projection: { shape: 0, __v: 0 },
      runValidators: true,
      context: "query",
    };

    const modifiedUpdateBody = { ...update };
    delete modifiedUpdateBody._id;
    delete modifiedUpdateBody.name;

    const updatedNetwork = await this.findOneAndUpdate(
      filter,
      modifiedUpdateBody,
      options,
    ).exec();

    if (!isEmpty(updatedNetwork)) {
      return {
        success: true,
        message: "successfully modified the network",
        data: updatedNetwork,
        status: httpStatus.OK,
      };
    }
    next(
      new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
        ...filter,
        message: "network does not exist, please crosscheck",
      }),
    );
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      }),
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
    next(
      new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
        ...filter,
        message: "network does not exist, please crosscheck",
      }),
    );
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      }),
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
