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
// const passwordReg = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/;
const passwordReg = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;

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
    privilege: {
      type: String,
      required: [true, "the privilege is required!"],
      default: "user",
    },
    isActive: { type: Boolean },
    duration: { type: Date, default: oneMonthFromNow },
    networks: {
      type: [
        {
          type: ObjectId,
          ref: "network",
          unique: true,
        },
      ],
      default: [mongoose.Types.ObjectId(constants.DEFAULT_NETWORK)],
    },
    groups: [
      {
        type: ObjectId,
        ref: "group",
      },
    ],
    role: {
      type: ObjectId,
      ref: "role",
      default: constants.DEFAULT_ROLE,
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
      default: "airqo",
    },
    long_organization: {
      type: String,
      required: [true, "the long_organization is required!"],
      default: "airqo",
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
    google_id: { type: String, trim: true },
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
      const data = await this.create({
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
          status: httpStatus.BAD_REQUEST,
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
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },
  async listStatistics() {
    try {
      const response = await this.aggregate()
        .match({})
        .sort({ createdAt: -1 })
        .group({
          _id: null,
          count: { $sum: 1 },
          active: { $sum: { $cond: ["$isActive", 1, 0] } },
        })
        .project({
          _id: 0,
        })
        .allowDiskUse(true);

      if (!isEmpty(response)) {
        return {
          success: true,
          message: "successfully retrieved the user statistics",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "no users statistics exist",
          data: [],
          status: httpStatus.OK,
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
  async list({ skip = 0, limit = 5, filter = {} } = {}) {
    try {
      const inclusionProjection = constants.USERS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.USERS_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none"
      );
      const response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "networks",
          localField: "networks",
          foreignField: "_id",
          as: "networks",
        })
        .lookup({
          from: "networks",
          localField: "_id",
          foreignField: "net_manager",
          as: "my_networks",
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
        .unwind("$role")
        .lookup({
          from: "permissions",
          localField: "role.role_permissions",
          foreignField: "_id",
          as: "role.role_permissions",
        })
        .addFields({
          createdAt: {
            $dateToString: {
              format: "%Y-%m-%d %H:%M:%S",
              date: "$_id",
            },
          },
        })
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(limit ? limit : parseInt(constants.DEFAULT_LIMIT))
        .allowDiskUse(true);

      logObject("response in the model", response);
      if (!isEmpty(response)) {
        return {
          success: true,
          message: "successfully retrieved the user details",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "no users exist",
          data: [],
          status: httpStatus.OK,
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
      const fieldNames = Object.keys(update);
      const fieldsString = fieldNames.join(" ");
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

      const updatedUser = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).select(fieldsString);

      if (!isEmpty(updatedUser)) {
        return {
          success: true,
          message: "successfully modified the user",
          data: updatedUser._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedUser)) {
        return {
          success: false,
          message: "user does not exist, please crosscheck",
          status: httpStatus.BAD_REQUEST,
          data: [],
          errors: { message: "user does not exist, please crosscheck" },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "INTERNAL SERVER ERROR",
        error: error.message,
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      const options = {
        projection: { _id: 0, email: 1, firstName: 1, lastName: 1 },
      };
      const removedUser = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedUser)) {
        return {
          success: true,
          message: "successfully removed the user",
          data: removedUser._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedUser)) {
        return {
          success: false,
          message: "user does not exist, please crosscheck",
          status: httpStatus.BAD_REQUEST,
          data: [],
          errors: { message: "user does not exist, please crosscheck" },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
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
        return {
          success: true,
          message: "successfully deleted the user",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: false,
          message: "no users exist",
          data: [],
          status: httpStatus.BAD_REQUEST,
          errors: { message: "no users exist for this operation" },
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
        role: this.role,
        networks: this.networks,
        privilege: this.privilege,
        country: this.country,
        profilePicture: this.profilePicture,
        phoneNumber: this.phoneNumber,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
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
      networks: this.networks,
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
