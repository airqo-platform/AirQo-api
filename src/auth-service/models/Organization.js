const mongoose = require("mongoose").set("debug", true);
const Schema = mongoose.Schema;
const validator = require("validator");
const { logObject, logElement, logText } = require("../utils/log");
const jsonify = require("../utils/jsonify");
const isEmpty = require("is-empty");
const createOrganizationUtil = require("../utils/create-organization");

const OrganizationSchema = new Schema({
  email: {
    type: String,
    unique: true,
    required: [true, "Email is required"],
    trim: true,
    validate: {
      validator(email) {
        return validator.isEmail(email);
      },
      message: "{VALUE} is not a valid email!",
    },
  },
  status: { type: String, default: "inactive" },
  phoneNumber: {
    type: Number,
    unique: true,
    required: [true, "phoneNumber is required"],
  },
  website: {
    type: String,
    unique: true,
    required: [true, "the website is required"],
  },
  name: { type: String, unique: true, required: [true, "name is required"] },
  long_name: { type: String, required: [true, "long_name is required"] },
  category: {
    type: String,
    unique: true,
    required: [true, "category is required"],
  },
});

OrganizationSchema.index({ website: 1 }, { unique: true });
OrganizationSchema.index({ email: 1 }, { unique: true });
OrganizationSchema.index({ name: 1 }, { unique: true });
OrganizationSchema.index({ phoneNumber: 1 }, { unique: true });

OrganizationSchema.statics = {
  async register(args) {
    try {
      let modifiedArgs = args;
      let long_name = modifiedArgs.long_name;
      if (long_name) {
        modifiedArgs["name"] = createOrganizationUtil.sanitizeName(long_name);
      }
      data = this.create({
        ...modifiedArgs,
      });
      if (data) {
        return {
          success: true,
          data,
          message: "organization created",
        };
      }
      return {
        success: true,
        data,
        message:
          "operation successful but organization NOT successfully created",
      };
    } catch (error) {
      logObject("the error", error);
      if (error.code == 11000) {
        return {
          errors: error.keyValue,
          message: "duplicate value",
          success: false,
        };
      }
    }
  },
  async list({ skip = 0, limit = 5, filter = {} } = {}) {
    try {
      let organizations = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();
      let data = jsonify(organizations);
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "successfully listed the organizations",
        };
      }

      if (isEmpty(data)) {
        return {
          success: true,
          message: "no organizations exist",
          data,
        };
      }
      return {
        success: false,
        message: "unable to retrieve organizations",
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: "Organization model server error - list",
        errors: error.message,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdate = update;
      logObject("modifiedUpdate", modifiedUpdate);
      if (modifiedUpdate.name) {
        delete modifiedUpdate.name;
      }
      let udpatedOrganization = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();
      let data = jsonify(udpatedOrganization);
      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully modified the organization",
          data,
        };
      } else {
        return {
          success: false,
          message: "organization does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Organization model server error - modify",
        error: error.message,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: { _id: 1, email: 1, website: 1, long_name: 1, name: 1 },
      };
      let removedOrganization = await this.findOneAndRemove(
        filter,
        options
      ).exec();
      let data = jsonify(removedOrganization);
      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully removed the organization",
          data,
        };
      } else {
        return {
          success: false,
          message: "organization does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Organization model server error - remove",
        error: error.message,
      };
    }
  },
};

OrganizationSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      email: this.email,
      website: this.website,
      category: this.category,
      status: this.status,
      phoneNumber: this.phoneNumber,
      name: this.name,
      long_name: this.long_name,
    };
  },
};

module.exports = OrganizationSchema;
