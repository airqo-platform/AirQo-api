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

function oneMonthFromNow() {
  var d = new Date();
  var targetMonth = d.getMonth() + 1;
  d.setMonth(targetMonth);
  if (d.getMonth() !== targetMonth % 12) {
    d.setDate(0); // last day of previous month
  }
  return d;
}
const passwordReg = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;

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
    isActive: { type: Boolean },
    duration: { type: Date, default: oneMonthFromNow },
    network_roles: {
      type: [
        {
          network: {
            type: ObjectId,
            ref: "network",
            default: mongoose.Types.ObjectId(constants.DEFAULT_NETWORK),
          },
          role: {
            type: ObjectId,
            ref: "role",
            default: mongoose.Types.ObjectId(constants.DEFAULT_ROLE),
          },
        },
      ],
      default: [],
      _id: false,
    },

    groups: {
      type: [
        {
          group: {
            type: ObjectId,
            ref: "group",
          },
        },
      ],
      default: [],
      _id: false,
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
  if (!this.email && !this.phoneNumber) {
    return next(new Error("Phone number or email is required!"));
  }

  if (!this.network_roles || this.network_roles.length === 0) {
    this.network_roles = [
      {
        network: mongoose.Types.ObjectId(constants.DEFAULT_NETWORK),
        role: mongoose.Types.ObjectId(constants.DEFAULT_ROLE),
      },
    ];
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
      logger.error(`internal server error -- ${JSON.stringify(err)}`);
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
      logger.error(`internal server error -- ${JSON.stringify(error)}`);
      logObject("error", error);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async list({ skip = 0, limit = 1000, filter = {} } = {}) {
    try {
      const inclusionProjection = constants.USERS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.USERS_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none"
      );

      if (!isEmpty(filter.category)) {
        delete filter.category;
      }

      const response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "roles",
          localField: "role",
          foreignField: "_id",
          as: "lol",
        })
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
          path: "$groups",
          preserveNullAndEmptyArrays: true,
        })
        .lookup({
          from: "networks",
          localField: "network_roles.network",
          foreignField: "_id",
          as: "network",
        })
        .lookup({
          from: "roles",
          localField: "network_roles.role",
          foreignField: "_id",
          as: "role",
        })
        .lookup({
          from: "permissions",
          localField: "role.role_permissions",
          foreignField: "_id",
          as: "role_permissions",
        })
        .group({
          _id: "$_id",
          firstName: { $first: "$firstName" },
          lastName: { $first: "$lastName" },
          userName: { $first: "$userName" },
          email: { $first: "$email" },
          verified: { $first: "$verified" },
          country: { $first: "$country" },
          privilege: { $first: "$privilege" },
          website: { $first: "$website" },
          category: { $first: "$category" },
          jobTitle: { $first: "$jobTitle" },
          description: { $first: "$description" },
          profilePicture: { $first: "$profilePicture" },
          phoneNumber: { $first: "$phoneNumber" },
          lol: { $first: "$lol" },
          clients: { $first: "$clients" },
          permissions: { $first: "$permissions" },
          my_networks: { $first: "$my_networks" },
          createdAt: { $first: "$createdAt" },
          updatedAt: { $first: "$createdAt" },
          networks: {
            $push: {
              net_name: { $arrayElemAt: ["$network.net_name", 0] },
              _id: { $arrayElemAt: ["$network._id", 0] },
              role: {
                $cond: {
                  if: { $ifNull: ["$role", false] },
                  then: {
                    _id: { $arrayElemAt: ["$role._id", 0] },
                    role_name: { $arrayElemAt: ["$role.role_name", 0] },
                    role_permissions: "$role_permissions",
                  },
                  else: null,
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
      logger.error(`internal server error -- ${JSON.stringify(error)}`);
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
        return {
          success: false,
          message: "user does not exist, please crosscheck",
          status: httpStatus.BAD_REQUEST,
          data: [],
          errors: { message: "user does not exist, please crosscheck" },
        };
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
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
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
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
        firstName: this.firstName,
        lastName: this.lastName,
        userName: this.userName,
        email: this.email,
        organization: this.organization,
        long_organization: this.long_organization,
        privilege: this.privilege,
        role: this.role,
        country: this.country,
        profilePicture: this.profilePicture,
        phoneNumber: this.phoneNumber,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        rateLimit: this.rateLimit,
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
      organization: this.organization,
      long_organization: this.long_organization,
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
      rateLimit: this.rateLimit,
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

module.exports = UserModel;
