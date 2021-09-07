const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Schema.Types.ObjectId;
const { Schema } = mongoose;
const validator = require("validator");
var uniqueValidator = require("mongoose-unique-validator");
const { logObject, logElement, logText } = require("../utils/log");
const jsonify = require("../utils/jsonify");
const isEmpty = require("is-empty");
const createOrganizationUtil = require("../utils/create-organization");
const { getModelByTenant } = require("../utils/multitenancy");
const HTTPStatus = require("http-status");

const OrganizationSchema = new mongoose.Schema(
  {
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
      required: [true, "category is required"],
    },
  },
  {
    timestamps: true,
  }
);

OrganizationSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

OrganizationSchema.index({ website: 1 }, { unique: true });
OrganizationSchema.index({ email: 1 }, { unique: true });
OrganizationSchema.index({ name: 1 }, { unique: true });
OrganizationSchema.index({ phoneNumber: 1 }, { unique: true });

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
      createdAt: this.createdAt,
    };
  },
};

const sanitizeName = (name) => {
  try {
    let nameWithoutWhiteSpaces = name.replace(/\s/g, "");
    let shortenedName = nameWithoutWhiteSpaces.substring(0, 15);
    let trimmedName = shortenedName.trim();
    return trimmedName.toLowerCase();
  } catch (error) {
    logElement("the sanitise name error", error.message);
  }
};

OrganizationSchema.statics = {
  async register(args) {
    try {
      logText("the register method in the model........");
      let modifiedArgs = args;
      let long_name = modifiedArgs.long_name;
      if (long_name) {
        modifiedArgs["name"] = sanitizeName(long_name);
      }
      let data = await this.create({
        ...modifiedArgs,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "organization created",
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: true,
          data,
          message:
            "organization NOT successfully created but operation successful",
          status: HTTPStatus.NO_CONTENT,
        };
      }
    } catch (err) {
      let e = jsonify(err);
      let response = {};
      logObject("the err", err);
      let errors = {};
      let message = "Internal Server Error";
      let status = HTTPStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = HTTPStatus.CONFLICT;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value);
        });
      } else {
        message = "validation errors for some of the provided fields";
        status = HTTPStatus.CONFLICT;
        errors = err.errors;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      }
      return {
        errors: response,
        message,
        success: false,
        status,
      };
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
          status: HTTPStatus.OK,
        };
      }
      if (isEmpty(data)) {
        return {
          success: false,
          message: "no organizations exist",
          data,
          status: HTTPStatus.NOT_FOUND,
        };
      }
      return {
        success: false,
        message: "unable to retrieve organizations",
        data,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    } catch (err) {
      let e = jsonify(err);
      let response = {};
      logObject("the err", e);
      let errors = {};
      let message = "Internal Server Error";
      let status = HTTPStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = HTTPStatus.CONFLICT;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value);
        });
      } else {
        message = "validation errors for some of the provided fields";
        status = HTTPStatus.CONFLICT;
        errors = err.errors;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      }
      return {
        errors: response,
        message,
        success: false,
        status,
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
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "organization does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
          errors: "Not Found",
        };
      }
    } catch (err) {
      let e = jsonify(err);
      let response = {};
      logObject("the err", e);
      let errors = {};
      let message = "Internal Server Error";
      let status = HTTPStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = HTTPStatus.CONFLICT;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value);
        });
      } else {
        message = "validation errors for some of the provided fields";
        status = HTTPStatus.CONFLICT;
        errors = err.errors;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      }
      return {
        errors: response,
        message,
        success: false,
        status,
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
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "organization does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
          errors: "Not Found",
        };
      }
    } catch (err) {
      let e = jsonify(err);
      let response = {};
      logObject("the err", e);
      let errors = {};
      let message = "Internal Server Error";
      let status = HTTPStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = HTTPStatus.CONFLICT;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value);
        });
      } else {
        message = "validation errors for some of the provided fields";
        status = HTTPStatus.CONFLICT;
        errors = err.errors;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      }
      return {
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },
};

module.exports = OrganizationSchema;
