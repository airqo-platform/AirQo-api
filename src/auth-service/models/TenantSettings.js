const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const { getModelByTenant } = require("@config/database");
const httpStatus = require("http-status");
const { HttpError, logObject } = require("@utils/shared");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- tenant-settings-model`
);

const TenantSettingsSchema = new Schema({
  tenant: { type: String, required: true, unique: true },
  defaultNetwork: { type: Schema.Types.ObjectId, ref: "Network" },
  defaultNetworkRole: { type: Schema.Types.ObjectId, ref: "Role" },
  defaultGroup: { type: Schema.Types.ObjectId, ref: "Group" },
  defaultGroupRole: { type: Schema.Types.ObjectId, ref: "Role" },
});
TenantSettingsSchema.statics = {
  async register(args, next) {
    try {
      const createdTenantSettings = await this.create({
        ...args,
      });
      if (!isEmpty(createdTenantSettings)) {
        return {
          success: true,
          data: createdTenantSettings,
          message: "tenant settings created",
          status: httpStatus.OK,
        };
      } else if (isEmpty(createdTenantSettings)) {
        return {
          success: true,
          data: createdTenantSettings,
          message:
            "Operation successful but tenant settings NOT successfully created",
          status: httpStatus.OK,
        };
      }
    } catch (err) {
      logObject("the error", err);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (err.code === 11000) {
        logObject("the err.code again", err.code);
        const duplicate_record = args.tenant ? args.tenant : "unknown";
        response[duplicate_record] = `${duplicate_record} must be unique`;
        response["message"] =
          "the tenant name must be unique for every tenant setting";
      } else if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
      } else if (err.errors) {
        Object.entries(err.errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      }
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      next(new HttpError(message, status, response));
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const totalCount = await this.countDocuments(filter).exec();
      const data = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip ? parseInt(skip) : 0)
        .limit(limit ? parseInt(limit) : parseInt(constants.DEFAULT_LIMIT))
        .exec();
      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully retrieved the tenant settings",
          data,
          totalCount,
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          message: "no tenant settings exist",
          data: [],
          totalCount,
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      if (error instanceof HttpError) {
        return next(error);
      }
      return next(
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
      logText("the tenant settings modification function........");
      const options = { new: true };
      const fieldNames = Object.keys(update);
      const fieldsString = fieldNames.join(" ");
      const updatedTenantSettings = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).select(fieldsString);
      if (!isEmpty(updatedTenantSettings)) {
        const { _id, ...tenantSettingsData } = updatedTenantSettings._doc;
        return {
          success: true,
          message: "successfully modified the tenant settings",
          data: tenantSettingsData,
          status: httpStatus.OK,
        };
      }
      return next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message: "tenant settings do not exist, please crosscheck",
        })
      );
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      if (error instanceof HttpError) {
        return next(error);
      }
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 0,
          tenant: 1,
        },
      };
      const removedTenantSettings = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedTenantSettings)) {
        return {
          success: true,
          message: "Successfully removed the tenant settings",
          data: removedTenantSettings._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedTenantSettings)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Provided Tenant Settings do not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logObject("the models error", error);
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      if (error instanceof HttpError) {
        return next(error);
      }
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

const TenantSettingsModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let users = mongoose.model("tenant_settings");
    return users;
  } catch (error) {
    let users = getModelByTenant(
      dbTenant,
      "tenant_setting",
      TenantSettingsSchema
    );
    return users;
  }
};

module.exports = TenantSettingsModel;
