// this collection will pick its data from subscribing to a Kafka topic
const mongoose = require("mongoose").set("debug", true);
const Schema = mongoose.Schema;
const { logObject } = require("@utils/log");
const ObjectId = mongoose.Schema.Types.ObjectId;
const isEmpty = require("is-empty");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- host-model`);
const successResponse = {
  success: true,
  status: httpStatus.OK,
};

const errorResponse = {
  success: false,
  status: httpStatus.INTERNAL_SERVER_ERROR,
};

const badRequestResponse = {
  success: false,
  status: httpStatus.BAD_REQUEST,
};

const HostSchema = new Schema(
  {
    first_name: {
      type: String,
      required: [true, "first_name is required!"],
      trim: true,
    },
    last_name: {
      type: String,
      required: [true, "last_name is required"],
      trim: true,
    },
    phone_number: {
      type: Number,
      required: [true, "phone_number is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "email is required"],
      trim: true,
    },
    site_id: {
      type: ObjectId,
      required: [true, "site_id is required"],
      trim: true,
    },
  },
  { timestamps: true }
);

HostSchema.index(
  {
    email: 1,
    phone_number: 1,
    site_id: 1,
  },
  {
    unique: true,
  }
);

const handleServerError = (error, message) => {
  logObject("error", error);
  const stingifiedMessage = JSON.stringify(error ? error : "");
  logger.error(`Internal Server Error -- ${stingifiedMessage}`);
  return {
    ...errorResponse,
    message,
    errors: { message: error.message },
  };
};

HostSchema.pre("save", function(next) {
  if (this.isModified("password")) {
  }
  return next();
});

HostSchema.pre("update", function(next) {
  return next();
});

HostSchema.statics.register = async function(args, next) {
  try {
    const data = await this.create({ ...args });
    return {
      ...successResponse,
      data,
      message: "host created",
    };
  } catch (error) {
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

HostSchema.statics.list = async function(
  { skip = 0, limit = 5, filter = {} } = {},
  next
) {
  try {
    const hosts = await this.aggregate()
      .match(filter)
      .addFields({
        createdAt: {
          $dateToString: {
            format: "%Y-%m-%d %H:%M:%S",
            date: "$_id",
          },
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    if (!isEmpty(hosts)) {
      return {
        ...successResponse,
        data: hosts,
        message: "successfully listed the hosts",
      };
    }

    return {
      ...successResponse,
      message: "no hosts exist for this search",
    };
  } catch (error) {
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

HostSchema.statics.modify = async function(
  { filter = {}, update = {} } = {},
  next
) {
  try {
    const modifiedUpdate = update;
    const projection = { _id: 1 };
    Object.keys(modifiedUpdate).forEach((key) => {
      projection[key] = 1;
    });
    const options = { new: true, projection };

    const updatedHost = await this.findOneAndUpdate(
      filter,
      modifiedUpdate,
      options
    );

    if (!isEmpty(updatedHost)) {
      return {
        ...successResponse,
        message: "successfully modified the host",
        data: updatedHost,
      };
    } else {
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message: "host does not exist",
        })
      );
    }
  } catch (error) {
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

HostSchema.statics.remove = async function({ filter = {} } = {}, next) {
  try {
    const projection = { _id: 1, email: 1, first_name: 1, last_name: 1 };
    const options = { projection };
    const removedHost = await this.findOneAndRemove(filter, options);

    if (!isEmpty(removedHost)) {
      const data = removedHost._doc;
      return {
        ...successResponse,
        message: "successfully removed the host",
        data,
      };
    } else {
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message: "host does not exist",
        })
      );
    }
  } catch (error) {
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

HostSchema.methods.toJSON = function() {
  const { _id, first_name, last_name, site_id, phone_number } = this;
  return {
    _id,
    first_name,
    last_name,
    site_id,
    phone_number,
  };
};

const HostModel = (tenant) => {
  try {
    return mongoose.model("hosts");
  } catch (error) {
    return getModelByTenant(tenant, "host", HostSchema);
  }
};

module.exports = HostModel;
