const mongoose = require("mongoose").set("debug", true);
const Schema = mongoose.Schema;
const validator = require("validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const constants = require("@config/constants");
const { logObject, logText } = require("@utils/log");
const ObjectId = mongoose.Schema.Types.ObjectId;
const isEmpty = require("is-empty");
const saltRounds = constants.SALT_ROUNDS;
const httpStatus = require("http-status");
const accessCodeGenerator = require("generate-password");

function oneMonthFromNow() {
  var d = new Date();
  var targetMonth = d.getMonth() + 1;
  d.setMonth(targetMonth);
  if (d.getMonth() !== targetMonth % 12) {
    d.setDate(0); // last day of previous month
  }
  return d;
}
const passwordReg = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/;

const UserSchema = new Schema(
  {
    due_date: { type: Date },
    status: { type: String },
    address: { type: String },
    country: { type: String },
    city: { type: String },
    department_id: {
      type: ObjectId,
      ref: "department",
    },
    birthday: { type: Date },
    reports_to: { type: ObjectId, ref: "user" },
    replaced_by: { type: ObjectId, ref: "user" },
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
    verified: {
      type: Boolean,
      default: false,
    },
    firstName: {
      type: String,
      required: [true, "FirstName is required!"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "LastName is required"],
      trim: true,
    },
    userName: {
      type: String,
      required: [true, "UserName is required!"],
      trim: true,
      unique: true,
    },
    password: {
      type: String,
      required: [true, "Password is required!"],
      trim: true,
      minlength: [6, "Password is required"],
      validate: {
        validator(password) {
          return passwordReg.test(password);
        },
        message: "{VALUE} is not a valid password, please check documentation!",
      },
    },
    privilege: { type: String, required: [true, "the role is required!"] },
    isActive: { type: Boolean },
    duration: { type: Date, default: oneMonthFromNow },
    networks: [
      {
        type: ObjectId,
        ref: "network",
      },
    ],
    groups: [
      {
        type: ObjectId,
        ref: "group",
      },
    ],
    role: {
      type: ObjectId,
      ref: "role",
    },
    permissions: [
      {
        type: ObjectId,
        ref: "permission",
      },
    ],
    organization: {
      type: String,
      required: [true, "the organization is required!"],
    },
    long_organization: {
      type: String,
      required: [true, "the long_organization is required!"],
    },
    phoneNumber: { type: Number },
    locationCount: { type: Number, default: 5 },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    jobTitle: {
      type: String,
    },
    website: { type: String },
    description: { type: String },
    category: {
      type: String,
    },
    notifications: {
      email: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
      text: { type: Boolean, default: false },
      phone: { type: Boolean, default: false },
    },
    profilePicture: {
      type: String,
    },
  },
  { timestamps: true }
);

UserSchema.pre("save", function (next) {
  if (this.isModified("password")) {
    this.password = bcrypt.hashSync(this.password, saltRounds);
  }
  return next();
});

UserSchema.pre("update", function (next) {
  if (this.isModified("password")) {
    this.password = bcrypt.hashSync(this.password, saltRounds);
  }
  return next();
});

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ userName: 1 }, { unique: true });

UserSchema.statics = {
  async register(args) {
    try {
      data = await this.create({
        ...args,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "user created",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          data,
          message: "operation successful but user NOT successfully created",
          status: httpStatus.NOT_FOUND,
        };
      }
    } catch (err) {
      logObject("the error", err);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
      } else if (err.errors) {
        Object.entries(err.errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      } else if (err.code === 11000) {
        const duplicate_record = args.email ? args.email : args.userName;
        response[duplicate_record] = `${duplicate_record} must be unique`;
        response["message"] =
          "the email and userName must be unique for every user";
      }
      return {
        error: response,
        message,
        success: false,
        status,
      };
    }
  },
  async list({ skip = 0, limit = 5, filter = {} } = {}) {
    try {
      logText("we are inside the model/collection....");
      const projectAll = {
        _id: 1,
        firstName: 1,
        lastName: 1,
        userName: 1,
        email: 1,
        verified: 1,
        country: 1,
        privilege: 1,
        profilePicture: 1,
        phoneNumber: 1,
        role: { $arrayElemAt: ["$role", 0] },
        networks: "$networks",
        access_tokens: "$access_tokens",
        permissions: "$permissions",
      };

      const projectSummary = {};

      const response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "networks",
          localField: "networks",
          foreignField: "_id",
          as: "networks",
        })
        .lookup({
          from: "access_tokens",
          localField: "_id",
          foreignField: "user_id",
          as: "access_tokens",
        })
        .lookup({
          from: "groups",
          localField: "_id",
          foreignField: "grp_users",
          as: "groups",
        })
        .lookup({
          from: "permissions",
          localField: "permissions",
          foreignField: "_id",
          as: "permissions",
        })
        .lookup({
          from: "roles",
          localField: "role",
          foreignField: "_id",
          as: "role",
        })
        .sort({ createdAt: -1 })
        .project(projectAll)
        .project({
          "networks.__v": 0,
          "networks.net_status": 0,
          "networks.net_acronym": 0,
          "networks.createdAt": 0,
          "networks.updatedAt": 0,
          "networks.net_users": 0,
          "networks.net_roles": 0,
          "networks.net_groups": 0,
          "networks.net_description": 0,
          "networks.net_departments": 0,
          "networks.net_permissions": 0,
          "networks.net_email": 0,
          "networks.net_category": 0,
          "networks.net_phoneNumber": 0,
          "networks.net_manager": 0,
        })
        .project({
          "access_tokens.__v": 0,
          "access_tokens.user_id": 0,
          "access_tokens.createdAt": 0,
          "access_tokens.updatedAt": 0,
        })
        .project({
          "permissions.__v": 0,
          "permissions._id": 0,
          "permissions.createdAt": 0,
          "permissions.updatedAt": 0,
        })

        .project({
          "role.__v": 0,
          "role._id": 0,
          "role.createdAt": 0,
          "role.updatedAt": 0,
        })
        .project({
          "groups.__v": 0,
          "groups._id": 0,
          "groups.createdAt": 0,
          "groups.updatedAt": 0,
        })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);

      if (!isEmpty(response)) {
        let data = response;
        return {
          success: true,
          message: "successfully retrieved the user details",
          data,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "no users exist",
          data: [],
          status: httpStatus.NOT_FOUND,
        };
      }
    } catch (error) {
      logObject("error", error);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdate = update;
      modifiedUpdate["$addToSet"] = {};

      if (update.password) {
        modifiedUpdate.password = bcrypt.hashSync(update.password, saltRounds);
      }

      if (modifiedUpdate.networks) {
        modifiedUpdate["$addToSet"]["networks"] = {};
        modifiedUpdate["$addToSet"]["networks"]["$each"] =
          modifiedUpdate.networks;
        delete modifiedUpdate["networks"];
      }

      if (modifiedUpdate.permissions) {
        modifiedUpdate["$addToSet"]["permissions"] = {};
        modifiedUpdate["$addToSet"]["permissions"]["$each"] =
          modifiedUpdate.permissions;
        delete modifiedUpdate["permissions"];
      }

      if (modifiedUpdate.roles) {
        modifiedUpdate["$addToSet"]["roles"] = {};
        modifiedUpdate["$addToSet"]["roles"]["$each"] = modifiedUpdate.roles;
        delete modifiedUpdate["roles"];
      }

      if (modifiedUpdate.groups) {
        modifiedUpdate["$addToSet"]["groups"] = {};
        modifiedUpdate["$addToSet"]["groups"]["$each"] = modifiedUpdate.groups;
        delete modifiedUpdate["groups"];
      }

      let updatedUser = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedUser)) {
        let data = updatedUser._doc;
        return {
          success: true,
          message: "successfully modified the user",
          data,
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "user does not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
          data: [],
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "INTERNAL SERVER ERROR",
        error: error.message,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: { _id: 0, email: 1, firstName: 1, lastName: 1 },
      };
      let removedUser = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedUser)) {
        return {
          success: true,
          message: "successfully removed the user",
          data: removedUser._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedUser)) {
        return {
          success: true,
          message: "user does not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
          data: [],
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "User model server error - remove",
        error: error.message,
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  async v2_remove({ filter = {} } = {}) {
    try {
      const response = await this.aggregate()
        .lookup({
          from: "access_tokens",
          localField: "_id",
          foreignField: "user_id",
          as: "access_tokens",
        })
        .unwind("$access_tokens")
        .lookup({
          from: "scopes",
          localField: "access_tokens.scopes",
          foreignField: "_id",
          as: "scopes",
        })
        .unwind("scopes")
        .match(filter)
        .delete({
          filter: { _id: "$access_tokens._id" },
          delete: "access_tokens",
        })
        .delete({
          filter: { _id: "$scopes._id" },
          delete: "scopes",
        })
        .allowDiskUse(true);

      if (!isEmpty(response)) {
        let data = response;
        return {
          success: true,
          message: "successfully deleted the user",
          data,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "no users exist",
          data: [],
          status: httpStatus.NOT_FOUND,
        };
      }
    } catch (error) {
      logObject("error", error);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

UserSchema.methods = {
  authenticateUser(password) {
    return bcrypt.compareSync(password, this.password);
  },
  createToken() {
    return jwt.sign(
      {
        _id: this._id,
        locationCount: this.locationCount,
        organization: this.organization,
        long_organization: this.long_organization,
        firstName: this.firstName,
        lastName: this.lastName,
        userName: this.userName,
        email: this.email,
        privilege: this.privilege,
        country: this.country,
        profilePicture: this.profilePicture,
        phoneNumber: this.phoneNumber,
      },
      constants.JWT_SECRET
    );
  },
  newToken() {
    const token = accessCodeGenerator.generate(
      constants.RANDOM_PASSWORD_CONFIGURATION(10)
    );
    const hashedToken = bcrypt.hashSync(token, saltRounds);
    return {
      accessToken: hashedToken,
      plainTextToken: `${token.id}|${plainTextToken}`,
    };
  },
  toAuthJSON() {
    return {
      _id: this._id,
      userName: this.userName,
      token: `JWT ${this.createToken()}`,
      email: this.email,
    };
  },
  toJSON() {
    return {
      _id: this._id,
      userName: this.userName,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      locationCount: this.locationCount,
      privilege: this.privilege,
      country: this.country,
      website: this.website,
      organization: this.organization,
      long_organization: this.long_organization,
      category: this.category,
      jobTitle: this.jobTitle,
      profilePicture: this.profilePicture,
      phoneNumber: this.phoneNumber,
      description: this.description,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      role: this.role,
      verified: this.verified,
    };
  },
};

/***
 * prototype functions need to be added here
 */
const User = {
  prototype: {},
};

User.prototype.newToken = async function newToken(device_name = "Web FE") {
  const plainTextToken = Random(40);

  const token = await this.createToken({
    name: device_name,
    token: hash(plainTextToken),
  });

  return {
    accessToken: token,
    plainTextToken: `${token.id}|${plainTextToken}`,
  };
};

User.prototype.hasRole = async function hasRole(role) {
  if (!role || role === "undefined") {
    return false;
  }
  const roles = await this.getRoles();
  return !!roles.map(({ name }) => name).includes(role);
};

User.prototype.hasPermission = async function hasPermission(permission) {
  if (!permission || permission === "undefined") {
    return false;
  }
  const permissions = await this.getPermissions();
  return !!permissions.map(({ name }) => name).includes(permission.name);
};

User.prototype.hasPermissionThroughRole =
  async function hasPermissionThroughRole(permission) {
    if (!permission || permission === "undefined") {
      return false;
    }
    const roles = await this.getRoles();
    // eslint-disable-next-line no-restricted-syntax
    for await (const item of permission.roles) {
      if (roles.filter((role) => role.name === item.name).length > 0) {
        return true;
      }
    }
    return false;
  };

User.prototype.hasPermissionTo = async function hasPermissionTo(permission) {
  if (!permission || permission === "undefined") {
    return false;
  }
  return (
    (await this.hasPermissionThroughRole(permission)) ||
    this.hasPermission(permission)
  );
};

module.exports = UserSchema;
