const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;
var uniqueValidator = require("mongoose-unique-validator");
const { logElement, logText, logObject } = require("../utils/log");
const isEmpty = require("is-empty");
const jsonify = require("../utils/jsonify");
const HTTPStatus = require("http-status");

const RolesSchema = new mongoose.Schema({
  role: {
    type: String,
    trim: true,
    required: [true, "role is required!"],
  },
  resource: {
    type: String,
    required: [true, "resource is required!"],
  },
  action: {
    type: String,
    required: [true, "the action is required!"],
  },
  posession: {
    type: String,
    required: [true, "the posession is required"],
  },
  attributes: {
    type: [String],
    required: [true, "the attributes are required!"],
  },
});

RolesSchema.plugin(uniqueValidator);

RolesSchema.index(
  {
    chartTitle: 1,
    user: 1,
  },
  {
    unique: true,
  }
);

RolesSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      role: this.role,
      resource: this.resource,
      action: this.action,
      posession: this.posession,
      attributes: this.attributes,
    };
  },
};

RolesSchema.statics = {
  async register(args) {
    try {
      return {
        success: true,
        data: this.create({
          ...args,
        }),
        message: "role created",
        status: HTTPStatus.OK,
      };
    } catch (error) {
      return {
        error: error.message,
        message: "Role model server error",
        success: false,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async list({ skip = 0, limit = 5, filter = {} } = {}) {
    try {
      logObject("the filter in the roles", filter);
      let roles = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();
      let data = jsonify(roles);
      logObject("the data for roles", data);
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "successfully listed the roles",
          status: HTTPStatus.OK,
        };
      }
      if (isEmpty(data)) {
        return {
          success: true,
          message: "no roles exist",
          data,
          status: HTTPStatus.INTERNAL_SERVER_ERROR,
        };
      }
      return {
        success: false,
        message: "unable to retrieve roles",
        data,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    } catch (error) {
      return {
        success: false,
        message: "unable to list the roles",
        error: error.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true, upsert: true };
      let udpatedRole = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();

      let data = jsonify(udpatedRole);
      logObject("updatedRole", data);

      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully modified or created the role",
          data,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "roles do not exist, please crosscheck",
          status: HTTPStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "model server error",
        error: error.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: {
          _id: 0,
          role: 1,
          resource: 1,
          action: 1,
          posession: 1,
          attributes: 1,
        },
      };
      let removedRole = await this.findOneAndRemove(filter, options).exec();
      logElement("removedRole", removedRole);
      let data = jsonify(removedRole);
      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully removed the role",
          data,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "role does not exist, please crosscheck",
          status: HTTPStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "model server error",
        error: error.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = RolesSchema;
