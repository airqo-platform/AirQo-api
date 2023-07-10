const mongoose = require("mongoose");
const { Schema } = mongoose;
const isEmpty = require("is-empty");
const ObjectId = Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
const { logElement, logObject, logText } = require("@utils/log");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- cohort-model`);

const cohortSchema = new Schema(
  {
    network: {
      type: String,
      trim: true,
      required: [true, "the network is required!"],
    },
    name: {
      type: String,
      required: [true, "name is required!"],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    cohort_tags: {
      type: Array,
      default: [],
    },
    cohort_codes: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  { timestamps: true }
);

cohortSchema.post("save", async function(doc) {});

cohortSchema.pre("save", function(next) {
  if (this.isModified("_id")) {
    delete this._id;
  }
  this.cohort_codes = [this._id, this.name];
  return next();
});

cohortSchema.pre("update", function(next) {
  if (this.isModified("_id")) {
    delete this._id;
  }
  return next();
});

cohortSchema.plugin(uniqueValidator, {
  message: `{VALUE} is a duplicate value!`,
});

cohortSchema.index({ geoHash: 1 });

cohortSchema.methods.toJSON = function() {
  const { _id, name, description, cohort_tags, cohort_codes, network } = this;
  return {
    _id,
    name,
    description,
    cohort_tags,
    cohort_codes,
    network,
  };
};

cohortSchema.statics.register = async function(args) {
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

    const createdCohort = await this.create(modifiedArgs);

    if (!isEmpty(createdCohort)) {
      return {
        success: true,
        data: createdCohort._doc,
        message: "cohort created",
        status: httpStatus.OK,
      };
    } else {
      return {
        success: false,
        message: "cohort not created despite successful operation",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: "cohort not created despite successful operation",
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

cohortSchema.statics.list = async function({
  filter = {},
  limit = 1000,
  skip = 0,
} = {}) {
  try {
    const inclusionProjection = constants.COHORTS_INCLUSION_PROJECTION;
    const exclusionProjection = constants.COHORTS_EXCLUSION_PROJECTION(
      filter.category ? filter.category : "none"
    );

    if (!isEmpty(filter.category)) {
      delete filter.category;
    }

    const pipeline = this.aggregate()
      .match(filter)
      .sort({ createdAt: -1 })
      .project(inclusionProjection)
      .skip(skip ? skip : 0)
      .limit(limit ? limit : 1000)
      .allowDiskUse(true);

    if (Object.keys(exclusionProjection).length > 0) {
      pipeline.project(exclusionProjection);
      // const projectionStage = { $project: {} };
      // Object.entries(exclusionProjection).forEach(([key, value]) => {
      //   projectionStage.$project[key] = value;
      // });
      // pipeline.push(projectionStage);
    }

    const data = await pipeline;
    logObject("the data baby", data);
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

cohortSchema.statics.modify = async function({
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

    const updatedCohort = await this.findOneAndUpdate(
      filter,
      modifiedUpdateBody,
      options
    ).exec();

    if (!isEmpty(updatedCohort)) {
      return {
        success: true,
        message: "successfully modified the cohort",
        data: updatedCohort._doc,
        status: httpStatus.OK,
      };
    } else {
      return {
        success: false,
        message: "cohort does not exist, please crosscheck",
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

cohortSchema.statics.remove = async function({ filter = {} } = {}) {
  try {
    const options = {
      projection: {
        _id: 1,
        name: 1,
      },
    };

    const removedCohort = await this.findOneAndRemove(filter, options).exec();

    if (!isEmpty(removedCohort)) {
      return {
        success: true,
        message: "successfully removed the cohort",
        data: removedCohort._doc,
        status: httpStatus.OK,
      };
    } else {
      return {
        success: false,
        message: "cohort does not exist, please crosscheck",
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
module.exports = cohortSchema;
