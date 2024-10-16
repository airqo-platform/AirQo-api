const mongoose = require("mongoose").set("debug", true);
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

const MaintenanceSchema = new mongoose.Schema(
  {
    product: {
      type: String,
      enum: [
        "AirQo Mobile Application",
        "Official AirQo Website",
        "AirQo Analytics",
      ],
      required: [true, "Product name is required!"],
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
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: [true, "End date is required!"],
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
      logObject("error in the object", err);
      logger.error(`Data conflicts detected -- ${err.message}`);
      let response = {};
      let errors = {};
      let message = "Internal Server Error";
      let status = httpStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = httpStatus.CONFLICT;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value);
        });
      } else {
        message = "validation errors for some of the provided fields";
        status = httpStatus.CONFLICT;
        errors = err.errors;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      }

      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      next(new HttpError(message, status, response));
    }
  },
  async list({ skip = 0, limit = 1000, filter = {} } = {}, next) {
    try {
      const maintenances = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
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
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
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
              "the User Maintenance  you are trying to UPDATE does not exist, please crosscheck",
          })
        );
      }
    } catch (err) {
      logger.error(`Data conflicts detected -- ${err.message}`);
      let errors = { message: err.message };
      let message = "Internal Server Error";
      let status = httpStatus.INTERNAL_SERVER_ERROR;
      if (err.code == 11000) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = httpStatus.CONFLICT;
      }
      next(new HttpError(message, status, errors));
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
              "the User Maintenance  you are trying to DELETE does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logger.error(`Data conflicts detected -- ${error.message}`);
      next(
        new HttpError("Data conflicts detected", httpStatus.CONFLICT, {
          message: error.message,
        })
      );
    }
  },
};

const MaintenanceModel = (tenant) => {
  try {
    let maintenances = mongoose.model("maintenances");
    return maintenances;
  } catch (error) {
    let maintenances = getModelByTenant(
      tenant,
      "maintenance",
      MaintenanceSchema
    );
    return maintenances;
  }
};

module.exports = MaintenanceModel;
