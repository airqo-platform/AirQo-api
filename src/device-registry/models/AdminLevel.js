const mongoose = require("mongoose");
const { Schema } = mongoose;
const isEmpty = require("is-empty");
const ObjectId = Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
const { logObject } = require("@utils/log");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const { getModelByTenant } = require("@config/database");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- admin-level-model`
);
const { HttpError } = require("@utils/errors");

const adminLevelSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
  },
});

adminLevelSchema.post("save", async function(doc) {});

adminLevelSchema.pre("save", function(next) {
  if (this.isModified("_id")) {
    delete this._id;
  }
  return next();
});

adminLevelSchema.pre("update", function(next) {
  if (this.isModified("_id")) {
    delete this._id;
  }
  return next();
});

adminLevelSchema.plugin(uniqueValidator, {
  message: `{VALUE} is a duplicate value!`,
});

adminLevelSchema.methods.toJSON = function() {
  const { _id, name, description } = this;
  return {
    _id,
    name,
    description,
  };
};

adminLevelSchema.statics.register = async function(args, next) {
  try {
    let modifiedArgs = { ...args };
    const createdAdminLevel = await this.create(modifiedArgs);
    if (!isEmpty(createdAdminLevel)) {
      return {
        success: true,
        data: createdAdminLevel._doc,
        message: "adminLevel created",
        status: httpStatus.OK,
      };
    } else {
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: "adminLevel not created despite successful operation",
          }
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
    logger.error(`Internal Server Error ${error.message}`);
    next(new HttpError(response.message, response.status, response.errors));
  }
};
adminLevelSchema.statics.list = async function(
  { filter = {}, limit = 1000, skip = 0 } = {},
  next
) {
  try {
    const inclusionProjection = constants.ADMIN_LEVEL_INCLUSION_PROJECTION;
    const exclusionProjection = constants.ADMIN_LEVEL_EXCLUSION_PROJECTION(
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
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};
adminLevelSchema.statics.modify = async function(
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

    const updatedAdminLevel = await this.findOneAndUpdate(
      filter,
      modifiedUpdateBody,
      options
    ).exec();
    logObject("updatedAdminLevel", updatedAdminLevel);
    if (!isEmpty(updatedAdminLevel)) {
      return {
        success: true,
        message: "successfully modified the adminLevel",
        data: updatedAdminLevel._doc,
        status: httpStatus.OK,
      };
    } else {
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          ...filter,
          message: "admin level does not exist, please crosscheck",
        })
      );
    }
  } catch (error) {
    logger.error(`Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};
adminLevelSchema.statics.remove = async function({ filter = {} } = {}, next) {
  try {
    const options = {
      projection: {
        _id: 1,
        name: 1,
        admin_level: 1,
      },
    };

    const removedAdminLevel = await this.findOneAndRemove(
      filter,
      options
    ).exec();

    if (!isEmpty(removedAdminLevel)) {
      return {
        success: true,
        message: "successfully removed the adminLevel",
        data: removedAdminLevel._doc,
        status: httpStatus.OK,
      };
    } else {
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          ...filter,
          message: "admin level does not exist, please crosscheck",
        })
      );
    }
  } catch (error) {
    logger.error(`Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

const AdminLevelModel = (tenant) => {
  try {
    const adminlevels = mongoose.model("adminlevels");
    return adminlevels;
  } catch (error) {
    const adminlevels = getModelByTenant(
      tenant,
      "adminlevel",
      adminLevelSchema
    );
    return adminlevels;
  }
};

module.exports = AdminLevelModel;
