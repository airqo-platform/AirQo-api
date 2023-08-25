const mongoose = require("mongoose").set("debug", true);
const Schema = mongoose.Schema;
const { logObject, logElement, logText } = require("@utils/log");
const ObjectId = mongoose.Schema.Types.ObjectId;
const isEmpty = require("is-empty");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- sim-model`);

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

const SimSchema = new Schema(
  {
    msisdn: { type: Number, trim: true, unique: true, required: true },
    balance: { type: Number, trim: true },
    dataBalanceThreshold: { type: Number, trim: true },
    activationDate: { type: Date, trim: true },
    name: { type: String, trim: true },
    status: { type: String, trim: true },
    plan: { type: String, trim: true },
    totalTraffic: { type: Number, trim: true },
    simBarcode: { type: String, trim: true },
    active: { type: Boolean },
  },
  { timestamps: true }
);

SimSchema.index(
  {
    msisdn: 1,
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
    // ...errorRsesponse,
    message,
    errors: { message: error.message },
  };
};

SimSchema.pre("save", function (next) {
  if (this.isModified("password")) {
  }
  return next();
});

SimSchema.pre("update", function (next) {
  return next();
});

SimSchema.statics.register = async function (args) {
  try {
    logObject("inside the register function", args);
    const data = await this.create({ ...args });
    logObject("data", data);
    return {
      ...successResponse,
      data,
      message: "sim created",
    };
  } catch (error) {
    logObject("error", error);
    return handleServerError(error, "Internal Server Error");
  }
};

SimSchema.statics.list = async function ({
  skip = 0,
  limit = 5,
  filter = {},
} = {}) {
  try {
    const sims = await this.aggregate()
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

    if (!isEmpty(sims)) {
      return {
        ...successResponse,
        data: sims,
        message: "successfully listed the sims",
      };
    }

    return {
      ...successResponse,
      message: "no sims exist for this search",
      data: [],
    };
  } catch (error) {
    return handleServerError(error, "unable to retrieve sims");
  }
};

SimSchema.statics.modify = async function ({ filter = {}, update = {} } = {}) {
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
        message: "successfully modified the sim",
        data: updatedHost,
      };
    } else {
      return {
        ...badRequestResponse,
        message: "sim does not exist, please crosscheck",
        errors: { message: "sim does not exist" },
      };
    }
  } catch (error) {
    return handleServerError(error, "Internal Server Error");
  }
};

SimSchema.statics.remove = async function ({ filter = {} } = {}) {
  try {
    const projection = { _id: 1, msisdn: 1 };
    const options = { projection };
    const removedHost = await this.findOneAndRemove(filter, options);

    if (!isEmpty(removedHost)) {
      const data = removedHost._doc;
      return {
        ...successResponse,
        message: "successfully removed the sim",
        data,
      };
    } else {
      return {
        ...badRequestResponse,
        message: "sim does not exist, please crosscheck",
        errors: { message: "sim does not exist" },
      };
    }
  } catch (error) {
    return handleServerError(error, "Internal Server Error");
  }
};

SimSchema.methods.toJSON = function () {
  const {
    _id,
    balance,
    activationDate,
    msisdn,
    name,
    status,
    plan,
    totalTraffic,
  } = this;
  return {
    _id,
    balance,
    activationDate,
    msisdn,
    name,
    status,
    plan,
    totalTraffic,
  };
};

const SimModel = (tenant) => {
  try {
    return mongoose.model("sims");
  } catch (error) {
    return getModelByTenant(tenant, "sim", SimSchema);
  }
};

module.exports = SimModel;
