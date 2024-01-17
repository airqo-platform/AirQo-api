const mongoose = require("mongoose");
const { Schema } = mongoose;
const isEmpty = require("is-empty");
const ObjectId = Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
const { logElement, logObject, logText } = require("@utils/log");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const { HttpError } = require("@utils/errors");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- cohort-model`);
const { getModelByTenant } = require("@config/database");
const cohortSchema = new Schema(
  {
    network: {
      type: String,
      trim: true,
      required: [true, "the network is required!"],
    },
    group: {
      type: String,
      trim: true,
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
    visibility: {
      type: Boolean,
      trim: true,
      default: false,
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
  const {
    _id,
    name,
    description,
    cohort_tags,
    cohort_codes,
    network,
    group,
    visibility,
  } = this;
  return {
    _id,
    name,
    visibility,
    description,
    cohort_tags,
    cohort_codes,
    network,
    group,
  };
};

cohortSchema.statics.register = async function(args, next) {
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
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "cohort not created despite successful operation" }
        )
      );
    }
  } catch (error) {
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

    return response;

    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(new HttpError(response.message, response.status, response.errors));
  }
};

cohortSchema.statics.list = async function(
  { filter = {}, limit = 1000, skip = 0 } = {},
  next
) {
  try {
    const inclusionProjection = constants.COHORTS_INCLUSION_PROJECTION;
    const exclusionProjection = constants.COHORTS_EXCLUSION_PROJECTION(
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

    const pipeline = this.aggregate()
      .match(filter)
      .lookup({
        from: "devices",
        localField: "_id",
        foreignField: "cohorts",
        as: "devices",
      })
      .unwind("$devices")
      .lookup({
        from: "sites",
        localField: "devices.site_id",
        foreignField: "_id",
        as: "devices.site",
      })
      .sort({ createdAt: -1 })
      .project(inclusionProjection)
      .project(exclusionProjection)
      .group({
        _id: "$_id",
        visibility: { $first: "$visibility" },
        cohort_tags: { $first: "$cohort_tags" },
        cohort_codes: { $first: "$cohort_codes" },
        name: { $first: "$name" },
        createdAt: { $first: "$createdAt" },
        network: { $first: "$network" },
        group: { $first: "$group" },
        numberOfDevices: { $sum: 1 },
        devices: { $push: "$devices" },
      })
      .skip(skip ? skip : 0)
      .limit(limit ? limit : 1000)
      .allowDiskUse(true);

    const cohorts = await pipeline.exec();

    const result = cohorts
      .map((cohort) => ({
        _id: cohort._id,
        visibility: cohort.visibility,
        cohort_tags: cohort.cohort_tags,
        cohort_codes: cohort.cohort_codes,
        name: cohort.name,
        network: cohort.network,
        createdAt: cohort.createdAt,
        group: cohort.group,
        numberOfDevices: cohort.numberOfDevices,
        devices: cohort.devices.map((device) => ({
          _id: device._id,
          status: device.status,
          name: device.name,
          network: device.network,
          group: device.group,
          device_number: device.device_number,
          description: device.description,
          long_name: device.long_name,
          createdAt: device.createdAt,
          host_id: device.host_id,
          site: device.site &&
            device.site[0] && {
              _id: device.site[0]._id,
              name: device.site[0].name,
            },
        })),
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (result.length > 0) {
      return {
        success: true,
        message: "Successful Operation",
        data: result,
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
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

cohortSchema.statics.modify = async function(
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
    delete modifiedUpdateBody.name;
    delete modifiedUpdateBody.cohort_codes;

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
  } catch (error) {
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

cohortSchema.statics.remove = async function({ filter = {} } = {}, next) {
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
  } catch (error) {
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

const CohortModel = (tenant) => {
  try {
    const cohorts = mongoose.model("cohorts");
    return cohorts;
  } catch (error) {
    const cohorts = getModelByTenant(tenant, "cohort", cohortSchema);
    return cohorts;
  }
};

module.exports = CohortModel;
