const mongoose = require("mongoose").set("debug", true);
const { logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- invitation-link-model`
);
const { getModelByTenant } = require("@config/database");
const uniqueValidator = require("mongoose-unique-validator");

const invitationLinkSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
    network_id: {
      type: ObjectId,
      required: true,
      ref: "network",
    },
    expiration: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

invitationLinkSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

invitationLinkSchema.index({ token: 1 }, { unique: true });

invitationLinkSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      token: this.token,
      network_id: this.network_id,
      expiration: this.expiration,
      used: this.used,
    };
  },
};

invitationLinkSchema.statics = {
  async register(args) {
    try {
      const data = await this.create({
        ...args,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "invitationLink created",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          data: [],
          message:
            "invitationLink NOT successfully created but operation successful",
          status: httpStatus.NO_CONTENT,
        };
      }
    } catch (err) {
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (
        !isEmpty(err.keyValue) &&
        (err.code === 11000 || err.code === 11001)
      ) {
        message = "duplicate values provided";
        Object.entries(err.keyValue).forEach(([key, value]) => {
          logObject("err.keyValue", err.keyValue);
          response[key] = value;
          response["message"] = "duplicate values provided";
          return response;
        });
      } else if (!isEmpty(err.errors)) {
        logObject("err.errors", err.errors);
        Object.entries(err.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] =
            "input validation errors for some of the provided fields";
          return response;
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
  async list({ skip = 0, limit = 100, filter = {} } = {}) {
    try {
      const inclusionProjection =
        constants.INVITATION_LINKS_INCLUSION_PROJECTION;
      const exclusionProjection =
        constants.INVITATION_LINKS_EXCLUSION_PROJECTION(
          filter.category ? filter.category : ""
        );
      logObject("inclusionProjection", inclusionProjection);
      logObject("exclusionProjection", exclusionProjection);

      let filterCopy = Object.assign({}, filter);
      if (!isEmpty(filterCopy.category)) {
        delete filterCopy.category;
      }
      const response = await this.aggregate()
        .match(filterCopy)
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);
      if (!isEmpty(response)) {
        return {
          success: true,
          message: "successfully retrieved the invitationLink details",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message:
            "No invitationLink details exist for this operation, please crosscheck",
          status: httpStatus.OK,
          data: [],
        };
      }
    } catch (err) {
      logObject("error", err);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (
        !isEmpty(err.keyValue) &&
        (err.code === 11000 || err.code === 11001)
      ) {
        message = "duplicate values provided";
        Object.entries(err.keyValue).forEach(([key, value]) => {
          response[key] = value;
          response["message"] = value;
          return response;
        });
      } else if (!isEmpty(err.errors)) {
        Object.entries(err.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] = value.message;
          return response;
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
      let modifiedUpdate = Object.assign({}, update);

      const updatedinvitationLink = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      logObject("updatedinvitationLink", updatedinvitationLink);

      if (!isEmpty(updatedinvitationLink)) {
        return {
          success: true,
          message: "successfully modified the invitationLink",
          data: updatedinvitationLink._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedinvitationLink)) {
        return {
          success: true,
          message: "No invitationLinks exist for this operation",
          status: httpStatus.OK,
          errors: { message: "No invitationLinks exist for this operation" },
        };
      }
    } catch (err) {
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (
        !isEmpty(err.code) &&
        !isEmpty(err.keyValue) &&
        (err.code === 11000 || err.code === 11001)
      ) {
        message = "duplicate values provided";
        status = httpStatus.CONFLICT;
        Object.entries(err.keyValue).forEach(([key, value]) => {
          response[key] = value;
          response["message"] = value;
          return response;
        });
      } else if (!isEmpty(err.errors)) {
        Object.entries(err.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] = value.message;
          return response;
        });
      } else if (
        !isEmpty(err.code) &&
        !isEmpty(err.codeName) &&
        (err.code === 13 || err.codeName === "Unauthorized")
      ) {
        response["message"] = "Unauthorized to carry out this operation";
        return response;
      }
      logObject("err", err);

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
          token: 1,
          network_id: 1,
          expiration: 1,
          used: 1,
        },
      };
      const removedinvitationLink = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedinvitationLink)) {
        return {
          success: true,
          message: "successfully removed the invitationLink",
          data: removedinvitationLink._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedinvitationLink)) {
        return {
          success: true,
          message: "invitationLink does not exist for this operation",
          status: httpStatus.OK,
          errors: {
            message: "invitationLink does not exist for this operation",
          },
        };
      }
    } catch (err) {
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (
        !isEmpty(err.code) &&
        !isEmpty(err.keyValue) &&
        (err.code === 11000 || err.code === 11001)
      ) {
        message = "duplicate values provided";
        status = httpStatus.CONFLICT;
        Object.entries(err.keyValue).forEach(([key, value]) => {
          response[key] = value;
          response["message"] = value;
          return response;
        });
      } else if (!isEmpty(err.errors)) {
        Object.entries(err.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] = value.message;
          return response;
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

const InvitationLinkModel = (tenant) => {
  try {
    const invitationLinks = mongoose.model("invitationLinks");
    return invitationLinks;
  } catch (error) {
    const invitationLinks = getModelByTenant(
      tenant,
      "invitationLink",
      invitationLinkSchema
    );
    return invitationLinks;
  }
};

module.exports = InvitationLinkModel;
