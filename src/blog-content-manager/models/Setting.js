const mongoose = require("mongoose").set("debug", true);
const uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- setting-model`);
const { HttpError } = require("@utils/errors");

const SettingSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Setting name is required"],
      trim: true,
      unique: true,
    },
    value: {
      type: Object,
      required: [true, "Setting value is required"],
      validate: {
        validator: function (value) {
          // Add custom validation logic here based on the setting type
          return true; // Placeholder for type-specific validation
        },
        message: "Invalid setting value",
      },
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ["string", "boolean", "integer", "array"],
      default: "string",
    },
    category: {
      type: String,
      required: [true, "Setting category is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

SettingSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

SettingSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      name: this.name,
      value: this.value,
      description: this.description,
      type: this.type,
      category: this.category,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

SettingSchema.statics = {
  async create(args, next) {
    try {
      let body = args;
      if (body._id) {
        delete body._id;
      }
      let data = await this.create({
        ...body,
      });

      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "Setting created successfully",
          status: httpStatus.CREATED,
        };
      } else {
        return {
          success: false,
          message: "Failed to create setting",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          data: null,
        };
      }
    } catch (err) {
      logger.error(`🐛🐛 Internal Server Error ${err.message}`);
      next(new HttpError(err.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  async list({ skip = 0, limit = 20, filter = {} } = {}, next) {
    try {
      const settings = await this.find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .exec();

      const total = await this.countDocuments(filter);

      if (!isEmpty(settings)) {
        return {
          success: true,
          data: settings,
          total,
          message: "Successfully retrieved settings",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No settings found",
          data: [],
          total: 0,
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  async findById(id, next) {
    try {
      const setting = await this.findOne({ _id: id }).exec();

      if (!isEmpty(setting)) {
        return {
          success: true,
          data: setting,
          message: "Successfully retrieved setting",
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Setting not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  async update({ id, update = {} } = {}, next) {
    try {
      const options = { new: true, runValidators: true };
      if (update._id) {
        delete update._id;
      }
      const updatedSetting = await this.findByIdAndUpdate(
        id,
        update,
        options
      ).exec();

      if (!isEmpty(updatedSetting)) {
        return {
          success: true,
          message: "Successfully updated the setting",
          data: updatedSetting,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Setting not found", httpStatus.NOT_FOUND));
      }
    } catch (err) {
      logger.error(`Data conflicts detected -- ${err.message}`);
      next(new HttpError(err.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  async remove(id, next) {
    try {
      const removedSetting = await this.findByIdAndRemove(id).exec();

      if (!isEmpty(removedSetting)) {
        return {
          success: true,
          message: "Successfully removed the setting",
          data: removedSetting,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Setting not found", httpStatus.NOT_FOUND));
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  async findByCategory(category, next) {
    try {
      const settings = await this.find({ category }).sort({ name: 1 }).exec();

      if (!isEmpty(settings)) {
        return {
          success: true,
          data: settings,
          message: "Successfully retrieved settings for category",
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "No settings found for this category",
            httpStatus.NOT_FOUND
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

const SettingModel = (tenant) => {
  try {
    let settings = mongoose.model("settings");
    return settings;
  } catch (error) {
    let settings = getModelByTenant(tenant, "setting", SettingSchema);
    return settings;
  }
};

module.exports = SettingModel;
