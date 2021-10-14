const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { Schema } = mongoose;
const validator = require("validator");
var uniqueValidator = require("mongoose-unique-validator");
const { logObject, logElement, logText } = require("../utils/log");
const isEmpty = require("is-empty");
const createOrganizationUtil = require("../utils/create-organization");
const { getModelByTenant } = require("../utils/multitenancy");
const HTTPStatus = require("http-status");

const OrganizationSchema = new Schema(
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
    isActive: { type: Boolean, default: false },
    isAlias: { type: Boolean },
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
    tenant: {
      type: String,
      required: [true, "tenant is required"],
      unique: true,
    },
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
OrganizationSchema.index({ tenant: 1 }, { unique: true });

OrganizationSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      email: this.email,
      website: this.website,
      category: this.category,
      status: this.status,
      isAlias: this.isAlias,
      isActive: this.isActive,
      phoneNumber: this.phoneNumber,
      tenant: this.tenant,
      name: this.name,
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
      // let name = modifiedArgs.name;
      // if (name) {
      //   modifiedArgs["tenant"] = sanitizeName(name);
      // }
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
      if (!isEmpty(organizations)) {
        let data = organizations;
        return {
          success: true,
          data,
          message: "successfully listed the organizations",
          status: HTTPStatus.OK,
        };
      }
      if (isEmpty(organizations)) {
        return {
          success: false,
          message: "no organizations exist for this search",
          data: [],
          status: HTTPStatus.NOT_FOUND,
          errors: { message: "no organizations exist for this search" },
        };
      }
      return {
        success: false,
        message: "unable to retrieve organizations",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: { message: "unable to retrieve organizations" },
      };
    } catch (err) {
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
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdate = update;
      logObject("modifiedUpdate", modifiedUpdate);
      if (modifiedUpdate.tenant) {
        delete modifiedUpdate.tenant;
      }
      let updatedOrganization = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedOrganization)) {
        let data = updatedOrganization._doc;
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
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: {
          _id: 1,
          email: 1,
          website: 1,
          tenant: 1,
          name: 1,
          isActive: 1,
          isAlias: 1,
        },
      };
      let removedOrganization = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedOrganization)) {
        let data = removedOrganization._doc;
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
};

module.exports = OrganizationSchema;
