const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const { getModelByTenant } = require("@config/database");
const httpStatus = require("http-status");
const { HttpError, logObject } = require("@utils/shared");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- application-email-configuration-model`
);

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const ApplicationEmailConfigurationSchema = new Schema(
  {
    tenant: { type: String, required: true, unique: true, lowercase: true },
    // Emails belonging to applications (not real people). When system-generated
    // emails are sent to any of these addresses, admin CC emails are added automatically.
    applicationEmails: {
      type: [String],
      default: [],
      set: (emails) => [...new Set(emails.map((e) => e.toLowerCase().trim()))],
      validate: {
        validator: (emails) => emails.every(isValidEmail),
        message: "One or more application emails are invalid",
      },
    },
    // Comma-separated list of admin email addresses to CC whenever an email
    // lands on one of the applicationEmails above.
    adminCCEmails: {
      type: String,
      default: "",
      trim: true,
      validate: {
        validator: (val) => {
          if (!val) return true;
          return val
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean)
            .every(isValidEmail);
        },
        message: "One or more admin CC emails are invalid",
      },
    },
  },
  { timestamps: true }
);

ApplicationEmailConfigurationSchema.statics = {
  async register(args, next) {
    try {
      const created = await this.create({ ...args });
      if (!isEmpty(created)) {
        return {
          success: true,
          message: "Application email configuration created successfully",
          data: created,
          status: httpStatus.CREATED,
        };
      }
      return {
        success: false,
        message: "Operation successful but configuration not created",
        status: httpStatus.OK,
      };
    } catch (err) {
      logObject("the error", err);
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      let errors = {};
      if (err.code === 11000) {
        errors["tenant"] =
          "An application email configuration for this tenant already exists";
      } else if (err.errors) {
        Object.entries(err.errors).forEach(([k, v]) => (errors[k] = v.message));
      } else {
        errors = { message: err.message };
      }
      return {
        success: false,
        message: "Validation errors for some of the provided fields",
        status: httpStatus.CONFLICT,
        errors,
      };
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const totalCount = await this.countDocuments(filter).exec();
      const data = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .exec();
      return {
        success: true,
        message: data.length
          ? "Successfully retrieved application email configurations"
          : "No application email configurations exist",
        data,
        totalCount,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true, runValidators: true };
      const updated = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();
      if (!isEmpty(updated)) {
        return {
          success: true,
          message: "Successfully modified the application email configuration",
          data: updated,
          status: httpStatus.OK,
        };
      }
      return {
        success: false,
        message: "Application email configuration not found",
        status: httpStatus.NOT_FOUND,
        errors: {
          message: "Configuration does not exist, please crosscheck",
        },
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      if (error instanceof HttpError) return error;
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const removed = await this.findOneAndRemove(filter).exec();
      if (!isEmpty(removed)) {
        return {
          success: true,
          message: "Successfully removed the application email configuration",
          data: removed,
          status: httpStatus.OK,
        };
      }
      return {
        success: false,
        message: "Application email configuration not found",
        status: httpStatus.NOT_FOUND,
        errors: { message: "Configuration does not exist" },
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      if (error instanceof HttpError) return error;
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
};

const ApplicationEmailConfigurationModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model("application_email_configuration");
  } catch (error) {
    return getModelByTenant(
      dbTenant,
      "application_email_configuration",
      ApplicationEmailConfigurationSchema
    );
  }
};

module.exports = ApplicationEmailConfigurationModel;
