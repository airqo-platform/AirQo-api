const mongoose = require("mongoose").set("debug", true);
const Schema = mongoose.Schema;
const validator = require("validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const constants = require("@config/constants");
const ObjectId = mongoose.Schema.Types.ObjectId;
const isEmpty = require("is-empty");
const saltRounds = constants.SALT_ROUNDS;
const httpStatus = require("http-status");
const ThemeSchema = require("@models/ThemeSchema");
const accessCodeGenerator = require("generate-password");
const { getModelByTenant } = require("@config/database");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- user-model`
);
const validUserTypes = ["user", "guest"];
const { mailer, stringify } = require("@utils/common");
const ORGANISATIONS_LIMIT = 6;
const { logObject, logText, logElement, HttpError } = require("@utils/shared");
const TenantSettingsModel = require("@models/TenantSettings");

const maxLengthOfProfilePictures = 1024;

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
  if (profilePicture.length > maxLengthOfProfilePictures) {
    logText(`longer than ${maxLengthOfProfilePictures} chars`);
    logger.error(
      `🙅🙅 Bad Request Error -- profile picture URL exceeds ${maxLengthOfProfilePictures} characters`
    );
    return false;
  }
  return true;
}
const passwordReg = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@#?!$%^&*,.]{6,}$/;

const networkRoleSchema = new Schema({
  network: {
    type: Schema.Types.ObjectId,
    ref: "Network",
  },
  role: {
    type: Schema.Types.ObjectId,
    ref: "Role",
  },
  userType: {
    type: String,
    enum: {
      values: [
        "guest",
        "member",
        "admin",
        "super_admin",
        "viewer",
        "contributor",
        "moderator",
      ],
      message: "{VALUE} is not a valid user type",
    },
    default: "guest",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const groupRoleSchema = new Schema({
  group: {
    type: Schema.Types.ObjectId,
    ref: "Group",
  },
  role: {
    type: Schema.Types.ObjectId,
    ref: "Role",
  },
  userType: {
    type: String,
    enum: {
      values: [
        "guest",
        "member",
        "admin",
        "super_admin",
        "viewer",
        "contributor",
        "moderator",
      ],
      message: "{VALUE} is not a valid user type",
    },
    default: "guest",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Option 2: More flexible approach (recommended for evolving requirements)
const flexibleNetworkRoleSchema = new Schema({
  network: {
    type: Schema.Types.ObjectId,
    ref: "Network",
  },
  role: {
    type: Schema.Types.ObjectId,
    ref: "Role",
  },
  userType: {
    type: String,
    default: "guest",
    validate: {
      validator: function (value) {
        // Allow any reasonable string value, but with some basic validation
        return /^[a-z_]+$/.test(value) && value.length <= 20;
      },
      message:
        "userType must be lowercase letters and underscores only, max 20 characters",
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const flexibleGroupRoleSchema = new Schema({
  group: {
    type: Schema.Types.ObjectId,
    ref: "Group",
  },
  role: {
    type: Schema.Types.ObjectId,
    ref: "Role",
  },
  userType: {
    type: String,
    default: "guest",
    validate: {
      validator: function (value) {
        // Allow any reasonable string value, but with some basic validation
        return /^[a-z_]+$/.test(value) && value.length <= 20;
      },
      message:
        "userType must be lowercase letters and underscores only, max 20 characters",
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Option 3: Completely flexible (no validation) - for maximum future flexibility
const openNetworkRoleSchema = new Schema({
  network: {
    type: Schema.Types.ObjectId,
    ref: "Network",
  },
  role: {
    type: Schema.Types.ObjectId,
    ref: "Role",
  },
  userType: {
    type: String,
    default: "guest",
    // No enum or validation - completely open
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const openGroupRoleSchema = new Schema({
  group: {
    type: Schema.Types.ObjectId,
    ref: "Group",
  },
  role: {
    type: Schema.Types.ObjectId,
    ref: "Role",
  },
  userType: {
    type: String,
    default: "guest",
    // No enum or validation - completely open
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const UserSchema = new Schema(
  {
    due_date: { type: Date },
    status: { type: String },
    address: { type: String },
    country: { type: String },
    firebase_uid: { type: String },
    city: { type: String },
    theme: {
      type: ThemeSchema,
      default: () => ({}),
    },
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
    network_roles: [networkRoleSchema], // or flexibleNetworkRoleSchema or openNetworkRoleSchema
    group_roles: [groupRoleSchema], // or flexibleGroupRoleSchema or openGroupRoleSchema

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
      maxLength: maxLengthOfProfilePictures,
      validate: {
        validator: function (v) {
          const urlRegex =
            /^(http(s)?:\/\/.)[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/g;
          return urlRegex.test(v);
        },
        message: `Profile picture URL must be a valid URL & must not exceed ${maxLengthOfProfilePictures} characters.`,
      },
    },
    google_id: { type: String, trim: true },
    timezone: { type: String, trim: true },
    subscriptionStatus: {
      type: String,
      enum: ["inactive", "active", "past_due", "cancelled"],
      default: "inactive",
    },
    currentSubscriptionId: {
      type: String,
    },
    lastSubscriptionCheck: {
      type: Date,
    },
    subscriptionCancelledAt: {
      type: Date,
    },
    automaticRenewal: {
      type: Boolean,
      default: false,
    },
    nextBillingDate: {
      type: Date,
    },
    lastRenewalDate: {
      type: Date,
    },
    currentPlanDetails: {
      type: {
        priceId: String,
        currency: String,
        billingCycle: String, // 'monthly', 'annual', etc.
      },
    },
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

    // Safely get updates object, accounting for different mongoose operations
    let updates = {};
    if (this.getUpdate) {
      updates = this.getUpdate() || {};
    } else if (!isNew) {
      updates = this.toObject();
    } else {
      updates = this;
    }

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

        // Initialize update operators safely
        updates.$set = updates.$set || {};
        updates.$push = updates.$push || {};
        updates.$addToSet = updates.$addToSet || {};

        // Handle update operations in order of precedence
        if (updates.$set && updates.$set[fieldName]) {
          // $set takes precedence as it's a direct override
          newRoles = updates.$set[fieldName];
        } else if (updates.$push && updates.$push[fieldName]) {
          // Safely handle $push with potential $each operator
          const pushValue = updates.$push[fieldName];
          if (pushValue) {
            if (pushValue.$each && Array.isArray(pushValue.$each)) {
              newRoles = [...existingRoles, ...pushValue.$each];
            } else {
              newRoles = [...existingRoles, pushValue];
            }
          }
        } else if (updates.$addToSet && updates.$addToSet[fieldName]) {
          // Safely handle $addToSet
          const addToSetValue = updates.$addToSet[fieldName];
          if (addToSetValue) {
            if (addToSetValue.$each && Array.isArray(addToSetValue.$each)) {
              newRoles = [...existingRoles, ...addToSetValue.$each];
            } else {
              newRoles = [...existingRoles, addToSetValue];
            }
          }
        } else if (updates[fieldName]) {
          // Direct field update
          newRoles = updates[fieldName];
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

          // Set the final filtered array using $set and clean up other operators
          updates.$set[fieldName] = finalRoles;
          delete updates.$push[fieldName];
          delete updates.$addToSet[fieldName];
          delete updates[fieldName]; // Clean up direct field update if any
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

        if (!this.userName && this.email) {
          this.userName = this.email;
        }

        if (!this.userName) {
          return next(new Error("userName is required!"));
        }

        // Profile picture validation - only for new documents
        if (
          this.profilePicture &&
          !validateProfilePicture(this.profilePicture)
        ) {
          // Truncate if too long
          if (this.profilePicture.length > maxLengthOfProfilePictures) {
            this.profilePicture = this.profilePicture.substring(
              0,
              maxLengthOfProfilePictures
            );
          }
          //validate again after truncating
          if (!validateProfilePicture(this.profilePicture)) {
            next(
              new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
                message: "Invalid profile picture URL",
              })
            );
            return;
          }
        }

        const tenant = this.tenant || constants.DEFAULT_TENANT || "airqo";
        const tenantSettings = await TenantSettingsModel(tenant)
          .findOne({
            tenant,
          })
          .lean();

        if (!tenantSettings) {
          next(
            new HttpError("Not Found Error", httpStatus.NOT_FOUND, {
              message: "Tenant Settings not found, please contact support",
            })
          );
          return;
        }

        // Network roles handling - only for new documents
        if (!this.network_roles || this.network_roles.length === 0) {
          this.network_roles = [
            {
              network: tenantSettings.defaultNetwork,
              userType: "guest",
              createdAt: new Date(),
              role: tenantSettings.defaultNetworkRole,
            },
          ];
        }

        // Group roles handling - only for new documents
        if (!this.group_roles || this.group_roles.length === 0) {
          this.group_roles = [
            {
              group: tenantSettings.defaultGroup,
              userType: "guest",
              createdAt: new Date(),
              role: tenantSettings.defaultGroupRole,
            },
          ];
        }

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

        // Profile picture validation for updates
        if (actualUpdates.profilePicture) {
          if (!validateProfilePicture(actualUpdates.profilePicture)) {
            next(
              new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
                message: "Invalid profile picture URL",
              })
            );
            return;
          }
        }

        // Conditional validations for updates
        // Only validate fields that are present in the update
        fieldsToValidate.forEach((field) => {
          if (field in actualUpdates) {
            const value = actualUpdates[field];
            if (value === undefined || value === null || value === "") {
              next(
                new HttpError("Validation Error", httpStatus.BAD_REQUEST, {
                  message: `${field} cannot be empty, null, or undefined`,
                })
              );
              return;
            }
          }
        });

        // Prevent modification of certain immutable fields
        const immutableFields = ["firebase_uid", "email", "createdAt", "_id"];
        immutableFields.forEach((field) => {
          if (updates[field]) delete updates[field];
          if (updates && updates.$set && updates.$set[field]) {
            next(
              new HttpError(
                "Modification Not Allowed",
                httpStatus.BAD_REQUEST,
                { message: `Cannot modify ${field} after creation` }
              )
            );
            return;
          }
          if (updates && updates.$set) delete updates.$set[field];
          if (updates.$push) delete updates.$push[field];
        });

        // Conditional network roles validation
        if (updates.network_roles) {
          if (updates.network_roles.length > ORGANISATIONS_LIMIT) {
            next(
              new HttpError("Validation Error", httpStatus.BAD_REQUEST, {
                message: `Maximum ${ORGANISATIONS_LIMIT} network roles allowed`,
              })
            );
            return;
          }
        }

        // Conditional group roles validation
        if (updates.group_roles) {
          if (updates.group_roles.length > ORGANISATIONS_LIMIT) {
            next(
              new HttpError("Validation Error", httpStatus.BAD_REQUEST, {
                message: `Maximum ${ORGANISATIONS_LIMIT} group roles allowed`,
              })
            );
            return;
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
            { email, firstName, lastName },
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

      // Return error response instead of calling next()
      return {
        success: false,
        message,
        status,
        errors: response,
      };
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
      if (error instanceof HttpError) {
        return next(error);
      }
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
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
        .unwind({
          path: "$network_role",
          preserveNullAndEmptyArrays: true,
        })
        .unwind({
          path: "$group_role",
          preserveNullAndEmptyArrays: true,
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
          clients: { $first: "$clients" },
          groups: {
            $addToSet: {
              grp_title: { $arrayElemAt: ["$group.grp_title", 0] },
              organization_slug: {
                $arrayElemAt: ["$group.organization_slug", 0],
              },
              grp_profile_picture: {
                $arrayElemAt: ["$group.grp_profile_picture", 0],
              },
              _id: { $arrayElemAt: ["$group._id", 0] },
              createdAt: { $arrayElemAt: ["$group.createdAt", 0] },
              status: { $arrayElemAt: ["$group.grp_status", 0] },
              role: {
                $cond: {
                  if: { $ifNull: ["$group_role", false] },
                  then: {
                    _id: "$group_role._id",
                    role_name: "$group_role.role_name",
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
                    _id: "$network_role._id",
                    role_name: "$network_role.role_name",
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
      if (error instanceof HttpError) {
        return next(error);
      }
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
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
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message: "user does not exist, please crosscheck",
        })
      );
      return;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      if (error instanceof HttpError) {
        return next(error);
      }
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
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
        return;
      }
    } catch (error) {
      logObject("the models error", error);
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      if (error instanceof HttpError) {
        return next(error);
      }
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
};

// Enhanced user details with role clarity
UserSchema.statics.getEnhancedUserDetails = async function (
  { filter = {}, includeDeprecated = false } = {},
  next
) {
  try {
    const users = await this.aggregate()
      .match(filter)
      .lookup({
        from: "permissions",
        localField: "permissions",
        foreignField: "_id",
        as: "permissions",
      })
      .lookup({
        from: "roles",
        localField: "network_roles.role",
        foreignField: "_id",
        as: "network_role_details",
      })
      .lookup({
        from: "roles",
        localField: "group_roles.role",
        foreignField: "_id",
        as: "group_role_details",
      })
      .lookup({
        from: "networks",
        localField: "network_roles.network",
        foreignField: "_id",
        as: "network_details",
      })
      .lookup({
        from: "groups",
        localField: "group_roles.group",
        foreignField: "_id",
        as: "group_details",
      })
      .addFields({
        // Enhanced role information with clear separation
        enhanced_network_roles: {
          $map: {
            input: "$network_roles",
            as: "nr",
            in: {
              network: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$network_details",
                      cond: { $eq: ["$$this._id", "$$nr.network"] },
                    },
                  },
                  0,
                ],
              },
              role: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$network_role_details",
                      cond: { $eq: ["$$this._id", "$$nr.role"] },
                    },
                  },
                  0,
                ],
              },
              userType: "$$nr.userType",
              createdAt: "$$nr.createdAt",
            },
          },
        },
        enhanced_group_roles: {
          $map: {
            input: "$group_roles",
            as: "gr",
            in: {
              group: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$group_details",
                      cond: { $eq: ["$$this._id", "$$gr.group"] },
                    },
                  },
                  0,
                ],
              },
              role: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$group_role_details",
                      cond: { $eq: ["$$this._id", "$$gr.role"] },
                    },
                  },
                  0,
                ],
              },
              userType: "$$gr.userType",
              createdAt: "$$gr.createdAt",
            },
          },
        },
        // Role summary statistics for clear understanding
        role_summary: {
          network_roles_count: { $size: { $ifNull: ["$network_roles", []] } },
          group_roles_count: { $size: { $ifNull: ["$group_roles", []] } },
          network_roles_limit: ORGANISATIONS_LIMIT,
          group_roles_limit: ORGANISATIONS_LIMIT,
          network_roles_remaining: {
            $subtract: [
              ORGANISATIONS_LIMIT,
              { $size: { $ifNull: ["$network_roles", []] } },
            ],
          },
          group_roles_remaining: {
            $subtract: [
              ORGANISATIONS_LIMIT,
              { $size: { $ifNull: ["$group_roles", []] } },
            ],
          },
          total_roles: {
            $add: [
              { $size: { $ifNull: ["$network_roles", []] } },
              { $size: { $ifNull: ["$group_roles", []] } },
            ],
          },
        },
      })
      .project({
        _id: 1,
        firstName: 1,
        lastName: 1,
        email: 1,
        userName: 1,
        verified: 1,
        isActive: 1,
        country: 1,
        website: 1,
        category: 1,
        jobTitle: 1,
        description: 1,
        profilePicture: 1,
        phoneNumber: 1,
        timezone: 1,
        createdAt: 1,
        updatedAt: 1,
        permissions: 1,

        // Enhanced role information with clear separation
        enhanced_network_roles: 1,
        enhanced_group_roles: 1,
        role_summary: 1,

        // Include deprecated fields only if requested for backward compatibility
        ...(includeDeprecated && {
          role: 1,
          privilege: 1,
          organization: 1,
          long_organization: 1,
          network_roles: 1,
          group_roles: 1,
        }),
      })
      .allowDiskUse(true);

    if (!isEmpty(users)) {
      return {
        success: true,
        message: "Successfully retrieved enhanced user details",
        data: users,
        status: httpStatus.OK,
      };
    } else {
      return {
        success: true,
        message: "No users found",
        data: [],
        status: httpStatus.OK,
      };
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    if (error instanceof HttpError) {
      return next(error);
    }
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
    return;
  }
};

// Method to audit deprecated field usage for migration planning
UserSchema.statics.auditDeprecatedFieldUsage = async function (next) {
  try {
    const usersWithDeprecatedFields = await this.aggregate([
      {
        $match: {
          $or: [
            { role: { $exists: true, $ne: null } },
            { privilege: { $exists: true, $ne: null } },
            { organization: { $exists: true, $ne: null } },
            { long_organization: { $exists: true, $ne: null } },
          ],
        },
      },
      {
        $group: {
          _id: null,
          total_users_with_deprecated_fields: { $sum: 1 },
          users_with_role_field: {
            $sum: {
              $cond: [{ $ne: ["$role", null] }, 1, 0],
            },
          },
          users_with_privilege_field: {
            $sum: {
              $cond: [{ $ne: ["$privilege", null] }, 1, 0],
            },
          },
          users_with_organization_field: {
            $sum: {
              $cond: [{ $ne: ["$organization", null] }, 1, 0],
            },
          },
          users_with_long_organization_field: {
            $sum: {
              $cond: [{ $ne: ["$long_organization", null] }, 1, 0],
            },
          },
        },
      },
    ]);

    const totalUsers = await this.countDocuments();

    return {
      success: true,
      message: "Deprecated field usage audit completed",
      data: {
        total_users: totalUsers,
        deprecated_field_usage: usersWithDeprecatedFields[0] || {
          total_users_with_deprecated_fields: 0,
          users_with_role_field: 0,
          users_with_privilege_field: 0,
          users_with_organization_field: 0,
          users_with_long_organization_field: 0,
        },
        migration_readiness: {
          percentage_using_deprecated_fields:
            totalUsers > 0
              ? Math.round(
                  ((usersWithDeprecatedFields[0]
                    ?.total_users_with_deprecated_fields || 0) /
                    totalUsers) *
                    100
                )
              : 0,
          safe_to_migrate:
            (usersWithDeprecatedFields[0]?.total_users_with_deprecated_fields ||
              0) === 0,
        },
      },
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    if (error instanceof HttpError) {
      return next(error);
    }
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
    return;
  }
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
