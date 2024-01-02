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
const { getModelByTenant } = require("@config/database");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- user-model`
);
const validUserTypes = ["user", "guest"];
const { HttpError } = require("@utils/errors");

function oneMonthFromNow() {
  var d = new Date();
  var targetMonth = d.getMonth() + 1;
  d.setMonth(targetMonth);
  if (d.getMonth() !== targetMonth % 12) {
    d.setDate(0); // last day of previous month
  }
  return d;
}
const passwordReg = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@#?!$%^&*,.]{6,}$/;
const UserSchema = new Schema(
  {
    due_date: { type: Date },
    status: { type: String },
    address: { type: String },
    country: { type: String },
    firebase_uid: { type: String },
    city: { type: String },
    department_id: {
      type: ObjectId,
      ref: "department",
    },
    role: {
      type: ObjectId,
      ref: "role",
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
    analyticsVersion: { type: Number, default: 2 },
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
      default: "user",
    },
    isActive: { type: Boolean, default: false },
    duration: { type: Date, default: oneMonthFromNow },
    network_roles: {
      type: [
        {
          network: {
            type: ObjectId,
            ref: "network",
            default: mongoose.Types.ObjectId(constants.DEFAULT_NETWORK),
          },
          userType: { type: String, default: "guest", enum: validUserTypes },
          createdAt: { type: String, default: new Date() },
          role: {
            type: ObjectId,
            ref: "role",
            default: mongoose.Types.ObjectId(constants.DEFAULT_NETWORK_ROLE),
          },
        },
      ],
      default: [],
      _id: false,
      validate: [
        {
          validator: function (value) {
            const maxLimit = 6;
            return value.length <= maxLimit;
          },
          message: "Too many networks. Maximum limit: 6.",
        },
      ],
    },
    group_roles: {
      type: [
        {
          group: {
            type: ObjectId,
            ref: "group",
            default: mongoose.Types.ObjectId(constants.DEFAULT_GROUP),
          },
          userType: { type: String, default: "guest", enum: validUserTypes },
          createdAt: { type: String, default: new Date() },
          role: {
            type: ObjectId,
            ref: "role",
            default: mongoose.Types.ObjectId(constants.DEFAULT_GROUP_ROLE),
          },
        },
      ],
      default: [],
      _id: false,
      validate: [
        {
          validator: function (value) {
            const maxLimit = 6;
            return value.length <= maxLimit;
          },
          message: "Too many groups. Maximum limit: 6.",
        },
      ],
    },

    permissions: [
      {
        type: ObjectId,
        ref: "permission",
      },
    ],
    organization: {
      type: String,
      default: "airqo",
    },
    long_organization: {
      type: String,
      default: "airqo",
    },
    rateLimit: {
      type: Number,
    },
    phoneNumber: {
      type: Number,
      validate: {
        validator(phoneNumber) {
          return !!phoneNumber || this.email;
        },
        message: "Phone number or email is required!",
      },
    },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    jobTitle: {
      type: String,
    },
    website: { type: String },
    description: { type: String },
    lastLogin: {
      type: Date,
    },
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
    timezone: { type: String, trim: true },
  },
  { timestamps: true }
);

UserSchema.path("network_roles.userType").validate(function (value) {
  return validUserTypes.includes(value);
}, "Invalid userType value");

UserSchema.path("group_roles.userType").validate(function (value) {
  return validUserTypes.includes(value);
}, "Invalid userType value");

UserSchema.pre("save", function (next) {
  if (this.isModified("password")) {
    this.password = bcrypt.hashSync(this.password, saltRounds);
  }
  if (!this.email && !this.phoneNumber) {
    return next(new Error("Phone number or email is required!"));
  }

  if (!this.network_roles || this.network_roles.length === 0) {
    if (
      !constants ||
      !constants.DEFAULT_NETWORK ||
      !constants.DEFAULT_NETWORK_ROLE
    ) {
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message:
            "Contact support@airqo.net -- unable to retrieve the default Network or Role to which the User will belong",
        }
      );
    }

    this.network_roles = [
      {
        network: mongoose.Types.ObjectId(constants.DEFAULT_NETWORK),
        userType: "guest",
        createdAt: new Date(),
        role: mongoose.Types.ObjectId(constants.DEFAULT_NETWORK_ROLE),
      },
    ];
  }

  if (!this.group_roles || this.group_roles.length === 0) {
    if (
      !constants ||
      !constants.DEFAULT_GROUP ||
      !constants.DEFAULT_GROUP_ROLE
    ) {
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message:
            "Contact support@airqo.net -- unable to retrieve the default Group or Role to which the User will belong",
        }
      );
    }

    this.group_roles = [
      {
        group: mongoose.Types.ObjectId(constants.DEFAULT_GROUP),
        userType: "guest",
        createdAt: new Date(),
        role: mongoose.Types.ObjectId(constants.DEFAULT_GROUP_ROLE),
      },
    ];
  }

  if (!this.verified) {
    this.verified = false;
  }

  if (!this.analyticsVersion) {
    this.analyticsVersion = 2;
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
  async register(args, next) {
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
          message: "Operation successful but user NOT successfully created",
          status: httpStatus.OK,
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

      logger.error(`Internal Server Error -- ${err.message}`);
      next(new HttpError(message, status, response));
    }
  },
  async listStatistics(next) {
    try {
      const response = await this.aggregate()
        .match({ email: { $ne: null } })
        .sort({ createdAt: -1 })
        .lookup({
          from: "clients",
          localField: "_id",
          foreignField: "user_id",
          as: "clients",
        })
        .lookup({
          from: "users",
          localField: "clients.user_id",
          foreignField: "_id",
          as: "api_clients",
        })
        .group({
          _id: null,
          users: { $sum: 1 },
          user_details: {
            $push: {
              userName: "$userName",
              email: "$email",
              _id: "$_id",
            },
          },
          active_users: { $sum: { $cond: ["$isActive", 1, 0] } },
          active_user_details: {
            $addToSet: {
              $cond: {
                if: "$isActive",
                then: {
                  userName: "$userName",
                  email: "$email",
                  _id: "$_id",
                },
                else: "$nothing",
              },
            },
          },
          client_users: { $addToSet: "$clients.user_id" },
          api_user_details: {
            $addToSet: {
              userName: { $arrayElemAt: ["$api_clients.userName", 0] },
              email: { $arrayElemAt: ["$api_clients.email", 0] },
              _id: { $arrayElemAt: ["$api_clients._id", 0] },
            },
          },
        })
        .project({
          _id: 0,
          users: {
            number: "$users",
            details: "$user_details",
          },
          active_users: {
            number: "$active_users",
            details: "$active_user_details",
          },
          api_users: {
            number: { $size: { $ifNull: ["$client_users", []] } },
            details: "$api_user_details",
          },
        })
        .allowDiskUse(true);

      if (!isEmpty(response)) {
        return {
          success: true,
          message: "Successfully retrieved the user statistics",
          data: response[0],
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "No users statistics exist",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async list({ skip = 0, limit = 1000, filter = {} } = {}, next) {
    try {
      const inclusionProjection = constants.USERS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.USERS_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none"
      );

      if (!isEmpty(filter.category)) {
        delete filter.category;
      }
      logObject("the filter being used", filter);
      const response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "permissions",
          localField: "permissions",
          foreignField: "_id",
          as: "permissions",
        })
        .lookup({
          from: "clients",
          localField: "_id",
          foreignField: "user_id",
          as: "clients",
        })
        .lookup({
          from: "networks",
          localField: "_id",
          foreignField: "net_manager",
          as: "my_networks",
        })
        .lookup({
          from: "groups",
          localField: "_id",
          foreignField: "grp_manager",
          as: "my_groups",
        })
        .addFields({
          createdAt: {
            $dateToString: {
              format: "%Y-%m-%d %H:%M:%S",
              date: "$_id",
            },
          },
        })
        .unwind({
          path: "$network_roles",
          preserveNullAndEmptyArrays: true,
        })
        .unwind({
          path: "$group_roles",
          preserveNullAndEmptyArrays: true,
        })
        .lookup({
          from: "networks",
          localField: "network_roles.network",
          foreignField: "_id",
          as: "network",
        })
        .lookup({
          from: "groups",
          localField: "group_roles.group",
          foreignField: "_id",
          as: "group",
        })
        .lookup({
          from: "roles",
          localField: "network_roles.role",
          foreignField: "_id",
          as: "network_role",
        })
        .lookup({
          from: "roles",
          localField: "group_roles.role",
          foreignField: "_id",
          as: "group_role",
        })
        .lookup({
          from: "permissions",
          localField: "network_role.role_permissions",
          foreignField: "_id",
          as: "network_role_permissions",
        })
        .lookup({
          from: "permissions",
          localField: "group_role.role_permissions",
          foreignField: "_id",
          as: "group_role_permissions",
        })
        .group({
          _id: "$_id",
          firstName: { $first: "$firstName" },
          lastName: { $first: "$lastName" },
          lastLogin: { $first: "$lastLogin" },
          timezone: { $first: "$timezone" },
          isActive: { $first: "$isActive" },
          userName: { $first: "$userName" },
          email: { $first: "$email" },
          verified: { $first: "$verified" },
          analyticsVersion: { $first: "$analyticsVersion" },
          country: { $first: "$country" },
          privilege: { $first: "$privilege" },
          website: { $first: "$website" },
          category: { $first: "$category" },
          organization: { $first: "$organization" },
          long_organization: { $first: "$long_organization" },
          rateLimit: { $first: "$rateLimit" },
          jobTitle: { $first: "$jobTitle" },
          description: { $first: "$description" },
          profilePicture: { $first: "$profilePicture" },
          phoneNumber: { $first: "$phoneNumber" },
          group_roles: { $first: "$group_roles" },
          network_roles: { $first: "$network_roles" },
          group_role: { $first: "$group_role" },
          network_role: { $first: "$network_role" },
          clients: { $first: "$clients" },
          groups: {
            $addToSet: {
              grp_title: { $arrayElemAt: ["$group.grp_title", 0] },
              _id: { $arrayElemAt: ["$group._id", 0] },
              createdAt: { $arrayElemAt: ["$group.createdAt", 0] },
              status: { $arrayElemAt: ["$group.grp_status", 0] },
              role: {
                $cond: {
                  if: { $ifNull: ["$group_role", false] },
                  then: {
                    _id: { $arrayElemAt: ["$group_role._id", 0] },
                    role_name: { $arrayElemAt: ["$group_role.role_name", 0] },
                    role_permissions: "$group_role_permissions",
                  },
                  else: null,
                },
              },
              userType: {
                $cond: {
                  if: { $eq: [{ $type: "$group_roles.userType" }, "missing"] },
                  then: "user",
                  else: "$group_roles.userType",
                },
              },
            },
          },
          permissions: { $first: "$permissions" },
          my_networks: { $first: "$my_networks" },
          my_groups: { $first: "$my_groups" },
          createdAt: { $first: "$createdAt" },
          updatedAt: { $first: "$createdAt" },
          networks: {
            $addToSet: {
              net_name: { $arrayElemAt: ["$network.net_name", 0] },
              _id: { $arrayElemAt: ["$network._id", 0] },
              role: {
                $cond: {
                  if: { $ifNull: ["$network_role", false] },
                  then: {
                    _id: { $arrayElemAt: ["$network_role._id", 0] },
                    role_name: { $arrayElemAt: ["$network_role.role_name", 0] },
                    role_permissions: "$network_role_permissions",
                  },
                  else: null,
                },
              },
              userType: {
                $cond: {
                  if: {
                    $eq: [{ $type: "$network_roles.userType" }, "missing"],
                  },
                  then: "user",
                  else: "$network_roles.userType",
                },
              },
            },
          },
        })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .sort({ createdAt: -1 })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : parseInt(constants.DEFAULT_LIMIT))
        .allowDiskUse(true);
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
      logger.error(`Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      logText("the user modification function........");
      let options = { new: true };
      const fieldNames = Object.keys(update);
      const fieldsString = fieldNames.join(" ");
      let modifiedUpdate = update;
      modifiedUpdate["$addToSet"] = {};

      if (update.password) {
        modifiedUpdate.password = bcrypt.hashSync(update.password, saltRounds);
      }

      if (modifiedUpdate.network_roles) {
        if (isEmpty(modifiedUpdate.network_roles.network)) {
          delete modifiedUpdate.network_roles;
        } else {
          modifiedUpdate["$addToSet"] = {
            network_roles: { $each: modifiedUpdate.network_roles },
          };
          delete modifiedUpdate.network_roles;
        }
      }

      if (modifiedUpdate.group_roles) {
        if (isEmpty(modifiedUpdate.group_roles.group)) {
          delete modifiedUpdate.group_roles;
        } else {
          modifiedUpdate["$addToSet"] = {
            group_roles: { $each: modifiedUpdate.group_roles },
          };
          delete modifiedUpdate.group_roles;
        }
      }

      if (modifiedUpdate.permissions) {
        modifiedUpdate["$addToSet"]["permissions"] = {};
        modifiedUpdate["$addToSet"]["permissions"]["$each"] =
          modifiedUpdate.permissions;
        delete modifiedUpdate["permissions"];
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
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "user does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 0,
          email: 1,
          firstName: 1,
          lastName: 1,
          lastLogin: 1,
        },
      };
      const removedUser = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedUser)) {
        return {
          success: true,
          message: "Successfully removed the user",
          data: removedUser._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedUser)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Provided User does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logObject("the models error", error);
      logger.error(`Internal Server Error -- ${error.message}`);
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

UserSchema.methods = {
  authenticateUser(password) {
    return bcrypt.compareSync(password, this.password);
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
  async toAuthJSON() {
    const token = await this.createToken();
    return {
      _id: this._id,
      userName: this.userName,
      token: `JWT ${token}`,
      email: this.email,
    };
  },
  toJSON() {
    return {
      _id: this._id,
      userName: this.userName,
      email: this.email,
      firstName: this.firstName,
      organization: this.organization,
      long_organization: this.long_organization,
      group_roles: this.group_roles,
      network_roles: this.network_roles,
      privilege: this.privilege,
      lastName: this.lastName,
      country: this.country,
      website: this.website,
      category: this.category,
      jobTitle: this.jobTitle,
      profilePicture: this.profilePicture,
      phoneNumber: this.phoneNumber,
      description: this.description,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      role: this.role,
      verified: this.verified,
      analyticsVersion: this.analyticsVersion,
      rateLimit: this.rateLimit,
      lastLogin: this.lastLogin,
      isActive: this.isActive,
      timezone: this.timezone,
    };
  },
};

const UserModel = (tenant) => {
  try {
    let users = mongoose.model("users");
    return users;
  } catch (error) {
    let users = getModelByTenant(tenant, "user", UserSchema);
    return users;
  }
};
UserSchema.methods.createToken = async function () {
  try {
    const filter = { _id: this._id };
    const userWithDerivedAttributes = await UserModel("airqo").list({ filter });
    if (
      userWithDerivedAttributes.success &&
      userWithDerivedAttributes.success === false
    ) {
      logger.error(
        `Internal Server Error -- ${JSON.stringify(userWithDerivedAttributes)}`
      );
      return userWithDerivedAttributes;
    } else {
      const user = userWithDerivedAttributes.data[0];
      // Calculate expiration time (24 hours from now) in seconds
      const expirationTime = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
      logObject("user", user);
      return jwt.sign(
        {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          userName: user.userName,
          email: user.email,
          organization: user.organization,
          long_organization: user.long_organization,
          privilege: user.privilege,
          role: user.role,
          country: user.country,
          profilePicture: user.profilePicture,
          phoneNumber: user.phoneNumber,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          rateLimit: user.rateLimit,
          lastLogin: user.lastLogin,
          exp: expirationTime,
        },
        constants.JWT_SECRET
      );
    }
  } catch (error) {
    logger.error(`Internal Server Error --- ${error.message}`);
  }
};

module.exports = UserModel;
