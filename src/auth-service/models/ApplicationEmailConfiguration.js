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
  // Each tenant already gets its own physical database (see getModelByTenant),
  // so this collection is intended to be a per-tenant singleton. register()
  // is a create-or-merge upsert (findOneAndUpdate with { upsert: true })
  // rather than insert-then-catch-duplicate-key. This isn't airtight against
  // two truly concurrent first-time writes -- see the 11000 retry below --
  // but matches this model's real write pattern (infrequent, single-admin
  // edits via the settings UI).
  async register(args, next) {
    try {
      const { applicationEmails, adminCCEmails } = args;
      const update = {};

      if (Array.isArray(applicationEmails) && applicationEmails.length > 0) {
        // The schema's `set` normalizer (lowercase/trim/dedupe) only runs on
        // document assignment, not on update operators like $addToSet --
        // applied manually here so it isn't silently bypassed.
        const normalizedApplicationEmails = [
          ...new Set(
            applicationEmails.map((e) => String(e).toLowerCase().trim())
          ),
        ];
        if (normalizedApplicationEmails.length > 0) {
          update.$addToSet = {
            applicationEmails: { $each: normalizedApplicationEmails },
          };
        }
      }

      if (adminCCEmails) {
        const existing = await this.findOne({})
          .sort({ createdAt: 1 })
          .lean();
        const merged = new Set(
          ((existing && existing.adminCCEmails) || "")
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean)
        );
        adminCCEmails
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean)
          .forEach((e) => merged.add(e));
        update.adminCCEmails = Array.from(merged).join(", ");
      }

      if (isEmpty(update)) {
        return {
          success: false,
          message: "Operation successful but configuration not created",
          status: httpStatus.OK,
        };
      }

      const hadExisting = !!(await this.exists({}));
      const upsertOptions = {
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
        sort: { createdAt: 1 },
      };
      let saved;
      try {
        saved = await this.findOneAndUpdate({}, update, {
          ...upsertOptions,
          upsert: true,
        });
      } catch (upsertErr) {
        if (upsertErr.code !== 11000) {
          throw upsertErr;
        }
        // Lost the upsert race to a concurrent first write (or the legacy
        // tenant_1 index is still present on older deployments) -- the row
        // exists now, so retry as a plain update instead of failing.
        saved = await this.findOneAndUpdate({}, update, upsertOptions);
      }

      return {
        success: true,
        message: hadExisting
          ? "An application email configuration already existed -- the provided values were merged into it"
          : "Application email configuration created successfully",
        data: saved,
        status: hadExisting ? httpStatus.OK : httpStatus.CREATED,
      };
    } catch (err) {
      logObject("the error", err);
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      let errors = {};
      let message;
      let status;
      if (err.errors) {
        Object.entries(err.errors).forEach(([k, v]) => (errors[k] = v.message));
        message = "Validation errors for some of the provided fields";
        status = httpStatus.UNPROCESSABLE_ENTITY;
      } else {
        errors = { message: err.message };
        message = "Internal Server Error";
        status = httpStatus.INTERNAL_SERVER_ERROR;
      }
      return { success: false, message, status, errors };
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
  return getModelByTenant(
    dbTenant,
    "application_email_configuration",
    ApplicationEmailConfigurationSchema
  );
};

module.exports = ApplicationEmailConfigurationModel;
