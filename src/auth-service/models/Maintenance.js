const mongoose = require("mongoose");
mongoose.set("debug", process.env.NODE_ENV !== "production");
const ObjectId = mongoose.Schema.Types.ObjectId;
var uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- maintenances-model`
);
const moment = require("moment-timezone");
const timeZone = moment.tz.guess();
const maxLimit = 100;
const PRODUCT_NAMES = Object.freeze({
  MOBILE: "mobile",
  WEBSITE: "website",
  ANALYTICS: "analytics",
});

const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

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
        return createSuccessResponse("create", data, "maintenance", {
          message: "maintenance created successfully with no issues detected",
        });
      } else {
        return createEmptySuccessResponse(
          "maintenance",
          "maintenance not created despite successful operation"
        );
      }
    } catch (err) {
      return createErrorResponse(err, "create", logger, "maintenance");
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

      return createSuccessResponse("list", maintenances, "maintenance", {
        message: "Successfully listed the maintenances",
        emptyMessage: "No maintenances found for this search",
      });
    } catch (error) {
      return createErrorResponse(error, "list", logger, "maintenance");
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
        return createSuccessResponse(
          "update",
          updatedMaintenance._doc,
          "maintenance"
        );
      } else {
        return createNotFoundResponse(
          "maintenance",
          "update",
          "The maintenance record you are trying to update does not exist. Please verify the provided filters"
        );
      }
    } catch (err) {
      return createErrorResponse(err, "update", logger, "maintenance");
    }
  },
  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 1,
          product: 1,
          isActive: 1,
          message: 1,
          startDate: 1,
          endDate: 1,
        },
      };

      const removedMaintenance = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedMaintenance)) {
        return createSuccessResponse(
          "delete",
          removedMaintenance._doc,
          "maintenance"
        );
      } else {
        return createNotFoundResponse(
          "maintenance",
          "delete",
          "The maintenance record you are trying to delete does not exist. Please verify the provided filters"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "maintenance");
    }
  },
};

const MaintenanceModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model("maintenances");
  } catch (error) {
    return getModelByTenant(dbTenant, "maintenance", MaintenanceSchema);
  }
};

module.exports = MaintenanceModel;
