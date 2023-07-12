const mongoose = require("mongoose");
const { Schema } = mongoose;
const isEmpty = require("is-empty");
const ObjectId = Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
const { logElement, logObject, logText } = require("@utils/log");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- admin-level-model`
);

const networkSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
  },
});

networkSchema.post("save", async function(doc) {});

networkSchema.pre("save", function(next) {
  if (this.isModified("_id")) {
    delete this._id;
  }
  return next();
});

networkSchema.pre("update", function(next) {
  if (this.isModified("_id")) {
    delete this._id;
  }
  return next();
});

networkSchema.plugin(uniqueValidator, {
  message: `{VALUE} is a duplicate value!`,
});

networkSchema.methods.toJSON = function() {
  const { _id, name, description } = this;
  return {
    _id,
    name,
    description,
  };
};

networkSchema.statics.register = async function(args) {
  try {
    let modifiedArgs = { ...args };

    const createdNetwork = await this.create(modifiedArgs);

    if (!isEmpty(createdNetwork)) {
      return {
        success: true,
        data: createdNetwork._doc,
        message: "network created",
        status: httpStatus.OK,
      };
    } else {
      return {
        success: false,
        message: "network not created despite successful operation",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: "network not created despite successful operation",
        },
      };
    }
  } catch (err) {
    let response = {
      message: "validation errors for some of the provided fields",
      success: false,
      status: httpStatus.CONFLICT,
    };

    if (!isEmpty(err.errors)) {
      response.errors = {};
      Object.entries(err.errors).forEach(([key, value]) => {
        response.errors.message = value.message;
        response.errors[value.path] = value.message;
      });
    } else {
      response.errors = { message: err.message };
    }

    return response;
  }
};

networkSchema.statics.list = async function({
  filter = {},
  limit = 1000,
  skip = 0,
} = {}) {
  try {
    const inclusionProjection = constants.NETWORK_INCLUSION_PROJECTION;
    const exclusionProjection = constants.NETWORK_EXCLUSION_PROJECTION(
      filter.category ? filter.category : "none"
    );
    if (!isEmpty(filter.category)) {
      delete filter.category;
    }

    const pipeline = this.aggregate()
      .match(filter)
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
  } catch (err) {
    return {
      errors: { message: err.message },
      message: "Internal Server Error",
      success: false,
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

networkSchema.statics.modify = async function({
  filter = {},
  update = {},
} = {}) {
  try {
    const options = {
      new: true,
      useFindAndModify: false,
      projection: { shape: 0, __v: 0 },
    };

    const modifiedUpdateBody = { ...update };
    delete modifiedUpdateBody._id;
    delete modifiedUpdateBody.name;

    const updatedNetwork = await this.findOneAndUpdate(
      filter,
      modifiedUpdateBody,
      options
    ).exec();

    if (!isEmpty(updatedNetwork)) {
      return {
        success: true,
        message: "successfully modified the network",
        data: updatedNetwork._doc,
        status: httpStatus.OK,
      };
    } else {
      return {
        success: false,
        message: "network does not exist, please crosscheck",
        status: httpStatus.BAD_REQUEST,
        errors: filter,
      };
    }
  } catch (err) {
    return {
      errors: { message: err.message },
      message: "Internal Server Error",
      success: false,
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

networkSchema.statics.remove = async function({ filter = {} } = {}) {
  try {
    const options = {
      projection: {
        _id: 1,
        name: 1,
        admin_level: 1,
      },
    };

    const removedNetwork = await this.findOneAndRemove(filter, options).exec();

    if (!isEmpty(removedNetwork)) {
      return {
        success: true,
        message: "successfully removed the network",
        data: removedNetwork._doc,
        status: httpStatus.OK,
      };
    } else {
      return {
        success: false,
        message: "network does not exist, please crosscheck",
        status: httpStatus.BAD_REQUEST,
        errors: filter,
      };
    }
  } catch (err) {
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: err.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

module.exports = networkSchema;
