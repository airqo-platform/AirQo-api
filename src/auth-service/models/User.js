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
const mailer = require("@utils/mailer");
const ORGANISATIONS_LIMIT = 6;

function oneMonthFromNow() {
  var d = new Date();
  var targetMonth = d.getMonth() + 1;
  d.setMonth(targetMonth);
  if (d.getMonth() !== targetMonth % 12) {
    d.setDate(0); // last day of previous month
  }
  return d;
}

function validateProfilePicture(profilePicture) {
  const urlRegex =
    /^(http(s)?:\/\/.)[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/g;
  if (!urlRegex.test(profilePicture)) {
    logger.error(`🙅🙅 Bad Request Error -- Not a valid profile picture URL`);
    return false;
  }
  if (profilePicture.length > 200) {
    logText("longer than 200 chars");
    logger.error(
      `🙅🙅 Bad Request Error -- profile picture URL exceeds 200 characters`
    );
    return false;
  }
  return true;
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
    loginCount: { type: Number, default: 0 },
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
            return value.length <= ORGANISATIONS_LIMIT;
          },
          message: `Too many networks. Maximum limit: ${ORGANISATIONS_LIMIT}`,
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
            return value.length <= ORGANISATIONS_LIMIT;
          },
          message: `Too many groups. Maximum limit: ${ORGANISATIONS_LIMIT}`,
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
      maxLength: 200,
      validate: {
        validator: function (v) {
          const urlRegex =
            /^(http(s)?:\/\/.)[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/g;
          return urlRegex.test(v);
        },
        message:
          "Profile picture URL must be a valid URL & must not exceed 200 characters.",
      },
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

UserSchema.pre(
  ["updateOne", "findOneAndUpdate", "updateMany", "update", "save"],
  async function (next) {
    // Determine if this is a new document or an update
    const isNew = this.isNew;
    let updates = this.getUpdate ? this.getUpdate() : this;

    try {
      // Helper function to handle role updates
      const handleRoleUpdates = async (fieldName, idField) => {
        const query = this.getQuery ? this.getQuery() : { _id: this._id };

        // Get the correct tenant-specific model
        const tenant = this.tenant || constants.DEFAULT_TENANT || "airqo";
        const User = getModelByTenant(tenant, "user", UserSchema);
        const doc = await User.findOne(query);
        if (!doc) return;

        let newRoles = [];
        const existingRoles = doc[fieldName] || [];

        // Handle $set operations
        if (updates && updates.$set && updates.$set[fieldName]) {
          newRoles = updates.$set[fieldName];
        }
        // Handle $push operations
        else if (updates.$push && updates.$push[fieldName]) {
          const pushValue = updates.$push[fieldName];
          const newRole = pushValue.$each ? pushValue.$each[0] : pushValue;
          newRoles = [...existingRoles, newRole];
        }
        // Handle $addToSet operations
        else if (updates.$addToSet && updates.$addToSet[fieldName]) {
          const newRole = updates.$addToSet[fieldName];
          newRoles = [...existingRoles, newRole];
        }

        if (newRoles.length > 0) {
          // Create a Map to store unique roles based on network/group
          const uniqueRoles = new Map();

          // Process existing roles first
          existingRoles.forEach((role) => {
            const id = role[idField] && role[idField].toString();
            if (id) {
              uniqueRoles.set(id, role);
            }
          });

          // Process new roles, overwriting existing ones if same network/group
          newRoles.forEach((role) => {
            const id = role[idField] && role[idField].toString();
            if (id) {
              uniqueRoles.set(id, role);
            }
          });

          // Convert Map values back to array
          const finalRoles = Array.from(uniqueRoles.values());

          // Clear all update operators for this field
          if (updates && updates.$set) delete updates.$set[fieldName];
          if (updates.$push) delete updates.$push[fieldName];
          if (updates.$addToSet) delete updates.$addToSet[fieldName];

          // Set the final filtered array
          updates.$set = updates.$set || {};
          updates.$set[fieldName] = finalRoles;
        }
      };

      // Process both network_roles and group_roles
      await handleRoleUpdates("network_roles", "network");
      await handleRoleUpdates("group_roles", "group");

      // Password hashing
      if (
        (isNew && this.password) ||
        (updates &&
          (updates.password || (updates.$set && updates.$set.password)))
      ) {
        const passwordToHash = isNew
          ? this.password
          : updates.password || (updates.$set && updates.$set.password);

        if (isNew) {
          this.password = bcrypt.hashSync(passwordToHash, saltRounds);
        } else {
          if (updates && updates.password) {
            updates.password = bcrypt.hashSync(passwordToHash, saltRounds);
          }
          if (updates && updates.$set && updates.$set.password) {
            updates.$set.password = bcrypt.hashSync(passwordToHash, saltRounds);
          }
        }
      }

      // Validation only for new documents
      if (isNew) {
        // Validate contact information - only for new documents
        if (!this.email && !this.phoneNumber) {
          return next(new Error("Phone number or email is required!"));
        }

        // Profile picture validation - only for new documents
        if (
          this.profilePicture &&
          !validateProfilePicture(this.profilePicture)
        ) {
          return next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "Invalid profile picture URL",
            })
          );
        }

        // Network roles handling - only for new documents
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

        // Group roles handling - only for new documents
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
                  "Contact support@airqo.net -- unable to retrieve the default Group or Role",
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

        // Ensure default values for new documents
        this.verified = this.verified ?? false;
        this.analyticsVersion = this.analyticsVersion ?? 2;

        // Permissions handling for new documents
        if (this.permissions && this.permissions.length > 0) {
          this.permissions = [...new Set(this.permissions)];
        }
      }

      // For updates, only validate if specific fields are provided
      if (this.getUpdate) {
        const fieldsToValidate = [
          "_id",
          "firstName",
          "lastName",
          "userName",
          "email",
          "organization",
          "long_organization",
          "privilege",
          "country",
          "profilePicture",
          "phoneNumber",
          "createdAt",
          "updatedAt",
          "rateLimit",
          "lastLogin",
          "iat",
        ];

        // Get all actual fields being updated from both root and $set
        const actualUpdates = {
          ...(updates || {}),
          ...(updates.$set || {}),
        };

        // Conditional validations for updates
        // Only validate fields that are present in the update
        fieldsToValidate.forEach((field) => {
          if (field in actualUpdates) {
            const value = actualUpdates[field];
            if (value === undefined || value === null || value === "") {
              return next(
                new HttpError("Validation Error", httpStatus.BAD_REQUEST, {
                  message: `${field} cannot be empty, null, or undefined`,
                })
              );
            }
          }
        });

        // Prevent modification of certain immutable fields
        const immutableFields = ["firebase_uid", "email", "createdAt", "_id"];
        immutableFields.forEach((field) => {
          if (updates[field]) delete updates[field];
          if (updates && updates.$set && updates.$set[field]) {
            return next(
              new HttpError(
                "Modification Not Allowed",
                httpStatus.BAD_REQUEST,
                { message: `Cannot modify ${field} after creation` }
              )
            );
          }
          if (updates && updates.$set) delete updates.$set[field];
          if (updates.$push) delete updates.$push[field];
        });

        // Conditional network roles validation
        if (updates.network_roles) {
          if (updates.network_roles.length > ORGANISATIONS_LIMIT) {
            return next(
              new HttpError("Validation Error", httpStatus.BAD_REQUEST, {
                message: `Maximum ${ORGANISATIONS_LIMIT} network roles allowed`,
              })
            );
          }
        }

        // Conditional group roles validation
        if (updates.group_roles) {
          if (updates.group_roles.length > ORGANISATIONS_LIMIT) {
            return next(
              new HttpError("Validation Error", httpStatus.BAD_REQUEST, {
                message: `Maximum ${ORGANISATIONS_LIMIT} group roles allowed`,
              })
            );
          }
        }

        // Conditional permissions validation
        if (updates.permissions) {
          const uniquePermissions = [...new Set(updates.permissions)];
          if (updates && updates.$set) {
            updates.$set.permissions = uniquePermissions;
          } else {
            updates.permissions = uniquePermissions;
          }
        }

        // Conditional default values for updates
        if (updates && updates.$set) {
          updates.$set.verified = updates.$set.verified ?? false;
          updates.$set.analyticsVersion = updates.$set.analyticsVersion ?? 2;
        } else {
          updates.verified = updates.verified ?? false;
          updates.analyticsVersion = updates.analyticsVersion ?? 2;
        }
      }

      // Additional checks for new documents
      if (isNew) {
        const requiredFields = ["firstName", "lastName", "email"];
        requiredFields.forEach((field) => {
          if (!this[field]) {
            return next(new Error(`${field} is required`));
          }
        });

        if (this.network_roles && this.network_roles.length > 0) {
          const uniqueNetworks = new Map();
          this.network_roles.forEach((role) => {
            // Keep only the latest role for each network
            uniqueNetworks.set(role.network.toString(), role);
          });
          this.network_roles = Array.from(uniqueNetworks.values());
        }
        // Handle group_roles duplicates
        if (this.group_roles && this.group_roles.length > 0) {
          const uniqueGroups = new Map();
          this.group_roles.forEach((role) => {
            // Keep only the latest role for each group
            uniqueGroups.set(role.group.toString(), role);
          });
          this.group_roles = Array.from(uniqueGroups.values());
        }
      }

      return next();
    } catch (error) {
      return next(error);
    }
  }
);

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
      if (err.code === 11000) {
        logObject("the err.code again", err.code);
        const duplicate_record = args.email ? args.email : args.userName;
        response[duplicate_record] = `${duplicate_record} must be unique`;
        response["message"] =
          "the email and userName must be unique for every user";
        try {
          const email = args.email;
          const firstName = args.firstName;
          const lastName = args.lastName;
          const emailResponse = await mailer.existingUserRegistrationRequest(
            {
              email,
              firstName,
              lastName,
            },
            next
          );
          if (emailResponse && emailResponse.success === false) {
            logger.error(
              `🐛🐛 Internal Server Error -- ${stringify(emailResponse)}`
            );
          }
        } catch (error) {
          logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
        }
      } else if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
      } else if (err.errors) {
        Object.entries(err.errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      }
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      next(new HttpError(message, status, response));
    }
  },
  async listStatistics(next) {
    try {
      const response = await this.aggregate()
        .match({ email: { $nin: [null, ""] } })
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
              firstName: "$firstName",
              lastName: "$lastName",
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
                  firstName: "$firstName",
                  lastName: "$lastName",
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
              firstName: { $arrayElemAt: ["$api_clients.firstName", 0] },
              lastName: { $arrayElemAt: ["$api_clients.lastName", 0] },
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
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const inclusionProjection = constants.USERS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.USERS_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none"
      );

      if (!isEmpty(filter.category)) {
        delete filter.category;
      }
      logObject("the filter being used", filter);
      const totalCount = await this.countDocuments(filter).exec();

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
          loginCount: { $first: "$loginCount" },
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
        .skip(skip ? parseInt(skip) : 0)
        .limit(limit ? parseInt(limit) : parseInt(constants.DEFAULT_LIMIT))
        .allowDiskUse(true);
      if (!isEmpty(response)) {
        return {
          success: true,
          message: "successfully retrieved the user details",
          data: response,
          totalCount,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "no users exist",
          data: [],
          totalCount,
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
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
      const options = { new: true };
      const fieldNames = Object.keys(update);
      const fieldsString = fieldNames.join(" ");

      // Find and update user
      const updatedUser = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).select(fieldsString);

      // Handle update result
      if (!isEmpty(updatedUser)) {
        const { _id, ...userData } = updatedUser._doc;
        return {
          success: true,
          message: "successfully modified the user",
          data: userData,
          status: httpStatus.OK,
        };
      }

      // User not found
      return next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message: "user does not exist, please crosscheck",
        })
      );
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      return next(
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
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
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
      loginCount: this.loginCount,
      timezone: this.timezone,
    };
  },
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
      const oneDayExpiry = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
      const oneHourExpiry = Math.floor(Date.now() / 1000) + 60 * 60;
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
          // exp: oneHourExpiry,
        },
        constants.JWT_SECRET
      );
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error --- ${error.message}`);
  }
};

const UserModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let users = mongoose.model("users");
    return users;
  } catch (error) {
    let users = getModelByTenant(dbTenant, "user", UserSchema);
    return users;
  }
};

module.exports = UserModel;
