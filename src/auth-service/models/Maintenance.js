const mongoose = require("mongoose");
mongoose.set("debug", process.env.NODE_ENV !== "production");
const ObjectId = mongoose.Types.ObjectId;
var uniqueValidator = require("mongoose-unique-validator");
const { logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- maintenances-model`
);
const { HttpError } = require("@utils/errors");
const moment = require("moment-timezone");
const timeZone = moment.tz.guess();
const maxLimit = 100;
const PRODUCT_NAMES = Object.freeze({
  MOBILE: "mobile",
  WEBSITE: "website",
  ANALYTICS: "analytics",
});

function handleError(err, next, defaultMessage) {
  logger.error(`Internal Server Error -- ${err.message}`);
  let response = {};
  let errors = {};
  let message = defaultMessage;
  let status = httpStatus.INTERNAL_SERVER_ERROR;

  if (err.code === 11000 || err.code === 11001) {
    errors = err.keyValue;
    message = "Duplicate maintenance entry for the product.";
    status = httpStatus.CONFLICT;
    Object.entries(errors).forEach(([key, value]) => {
      response[key] = value;
    });
  } else {
    errors = err.errors || { message: err.message };
    message = "Validation errors for some of the provided fields";
    status = httpStatus.BAD_REQUEST;
    Object.entries(errors).forEach(([key, value]) => {
      response[key] = value.message || value;
    });
  }

  next(new HttpError(message, status, response));
}

const MaintenanceSchema = new mongoose.Schema(
  {
    product: {
      type: String,
      enum: Object.values(PRODUCT_NAMES),
      required: [true, "Product name is required!"],
      unique: true,
    },
    isActive: {
      type: Boolean,
      required: [true, "Maintenance status is required!"],
      default: false,
    },
    message: {
      type: String,
      required: [true, "Maintenance message is required!"],
      default: "The site is currently undergoing maintenance.",
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required!"],
      default: () => moment.tz(timeZone).toDate(),
    },
    endDate: {
      type: Date,
      required: [true, "End date is required!"],
      default: () => moment.tz(timeZone).add(5, "hours").toDate(),
      validate: {
        validator: function (value) {
          return this.startDate && value > this.startDate;
        },
        message: "End date must be after the start date",
      },
    },
  },
  {
    timestamps: true,
  }
);

MaintenanceSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

MaintenanceSchema.pre("save", function (next) {
  return next();
});

MaintenanceSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      product: this.product,
      isActive: this.isActive,
      message: this.message,
      startDate: this.startDate,
      endDate: this.endDate,
    };
  },
};

MaintenanceSchema.statics = {
  async register(args, next) {
    try {
      const { _id, ...maintenanceRequestBody } = args;
      const data = await this.create(maintenanceRequestBody);
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "maintenance created successfully with no issues detected",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          message: "maintenance not created despite successful operation",
          status: httpStatus.OK,
          data: [],
        };
      }
    } catch (err) {
      handleError(err, next, "Internal Server Error");
    }
  },
  async list({ skip = 0, limit = maxLimit, filter = {} } = {}, next) {
    try {
      const parsedLimit = parseInt(limit, 10);
      const effectiveLimit = Number.isNaN(parsedLimit)
        ? maxLimit
        : Math.min(parsedLimit, maxLimit);
      const maintenances = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(effectiveLimit)
        .exec();

      if (!isEmpty(maintenances)) {
        return {
          success: true,
          data: maintenances,
          message: "Successfully listed the maintenances",
          status: httpStatus.OK,
        };
      } else if (isEmpty(maintenances)) {
        return {
          success: true,
          message: "No maintenances found for this search",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      handleError(error, next, "Internal Server Error");
    }
  },
  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      const { _id, ...updateBody } = update;
      const updatedMaintenance = await this.findOneAndUpdate(
        filter,
        updateBody,
        options
      ).exec();

      if (!isEmpty(updatedMaintenance)) {
        return {
          success: true,
          message: "successfully modified the maintenance",
          data: updatedMaintenance._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedMaintenance)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "The maintenance record you are trying to update does not exist. Please verify the provided filters",
          })
        );
      }
    } catch (err) {
      handleError(err, next, "Internal Server Error");
    }
  },
  async remove({ filter = {} } = {}, next) {
    try {
      let options = {
        projection: {
          _id: 1,
          product: 1,
          isActive: 1,
          message: 1,
          startDate: 1,
          endDate: 1,
        },
      };
      let removedMaintenance = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedMaintenance)) {
        return {
          success: true,
          message: "successfully removed the maintenance",
          data: removedMaintenance._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedMaintenance)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "The maintenance record you are trying to delete does not exist. Please verify the provided filters",
          })
        );
      }
    } catch (error) {
      handleError(error, next, "Internal Server Error");
    }
  },
};

const MaintenanceModel = (tenant) => {
  try {
    return mongoose.model("maintenances");
  } catch (error) {
    return getModelByTenant(tenant, "maintenance", MaintenanceSchema);
  }
};

module.exports = MaintenanceModel;
