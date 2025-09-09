const mongoose = require("mongoose").set("debug", true);
const Schema = mongoose.Schema;
const validator = require("validator");
const bcrypt = require("bcrypt");
const constants = require("@config/constants");
const ObjectId = mongoose.Schema.Types.ObjectId;
const isEmpty = require("is-empty");
const saltRounds = constants.SALT_ROUNDS;
const httpStatus = require("http-status");
const ThemeSchema = require("@models/ThemeSchema");
const PermissionModel = require("@models/Permission");
const accessCodeGenerator = require("generate-password");
const { getModelByTenant } = require("@config/database");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- user-model`
);
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
        "user",
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
        "user",
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
      lowercase: true,
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
    network_roles: [flexibleNetworkRoleSchema], // networkRoleSchema or flexibleNetworkRoleSchema or openNetworkRoleSchema
    group_roles: [flexibleGroupRoleSchema], // groupRoleSchema or flexibleGroupRoleSchema or openGroupRoleSchema

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
    preferredTokenStrategy: {
      type: String,
      enum: Object.values(constants.TOKEN_STRATEGIES),
      default: constants.TOKEN_STRATEGIES.LEGACY,
    },
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
      priceId: String,
      currency: String,
      billingCycle: String, // 'monthly', 'annual', etc.
    },
    // Add after the existing fields, before the timestamps
    interests: {
      type: [String],
      enum: {
        values: [
          "health",
          "software developer",
          "community champion",
          "environmental",
          "student",
          "policy maker",
          "researcher",
          "air quality partner",
        ],
        message: "{VALUE} is not a valid interest option",
      },
      default: [],
    },
    interestsDescription: {
      type: String,
      maxLength: [1000, "Interests description cannot exceed 1000 characters"],
      trim: true,
    },
  },
  { timestamps: true }
);

const VALID_USER_TYPES = constants.VALID_USER_TYPES;

UserSchema.path("network_roles.userType").validate(function (value) {
  return VALID_USER_TYPES.includes(value);
}, "Invalid userType value");

UserSchema.path("group_roles.userType").validate(function (value) {
  return VALID_USER_TYPES.includes(value);
}, "Invalid userType value");

UserSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      if (this.email) {
        this.email = this.email.toLowerCase().trim();
      }
      // 1. Password hashing for new documents
      if (this.password) {
        this.password = bcrypt.hashSync(this.password, saltRounds);
      }

      // 2. Basic validation for new documents
      if (!this.email && !this.phoneNumber) {
        return next(new Error("Phone number or email is required!"));
      }

      if (!this.userName && this.email) {
        this.userName = this.email;
      }

      if (!this.userName) {
        return next(new Error("userName is required!"));
      }

      // 3. Profile picture validation
      if (this.profilePicture && !validateProfilePicture(this.profilePicture)) {
        if (this.profilePicture.length > maxLengthOfProfilePictures) {
          this.profilePicture = this.profilePicture.substring(
            0,
            maxLengthOfProfilePictures
          );
        }
        if (!validateProfilePicture(this.profilePicture)) {
          return next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "Invalid profile picture URL",
            })
          );
        }
      }

      // 4. Set default roles for new users ONLY
      const tenant = this.tenant || constants.DEFAULT_TENANT || "airqo";
      const tenantSettings = await TenantSettingsModel(tenant)
        .findOne({ tenant })
        .lean();

      if (!tenantSettings) {
        return next(
          new HttpError("Not Found Error", httpStatus.NOT_FOUND, {
            message: "Tenant Settings not found, please contact support",
          })
        );
      }

      // Only set defaults if no roles are provided
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

      // 6. Set default permissions for new users
      const permissions = await PermissionModel(tenant)
        .find({ permission: { $in: constants.DEFAULTS.DEFAULT_USER } })
        .select("_id")
        .lean();

      if (permissions.length > 0) {
        const permissionIds = permissions.map((p) => p._id);
        // Use Set to ensure uniqueness and avoid adding duplicates
        const existingPermissionIds = (this.permissions || []).map((p) =>
          p.toString()
        );
        const combinedPermissions = [
          ...new Set([
            ...existingPermissionIds,
            ...permissionIds.map((p) => p.toString()),
          ]),
        ];
        this.permissions = combinedPermissions;
      }
      // 5. Remove duplicates (simple deduplication)
      if (this.network_roles && this.network_roles.length > 0) {
        const uniqueNetworks = new Map();
        this.network_roles.forEach((role) => {
          uniqueNetworks.set(role.network.toString(), role);
        });
        this.network_roles = Array.from(uniqueNetworks.values());
      }

      if (this.group_roles && this.group_roles.length > 0) {
        const uniqueGroups = new Map();
        this.group_roles.forEach((role) => {
          uniqueGroups.set(role.group.toString(), role);
        });
        this.group_roles = Array.from(uniqueGroups.values());
      }

      // 6. Deduplicate permissions
      if (this.permissions && this.permissions.length > 0) {
        this.permissions = [...new Set(this.permissions)];
      }
    } else {
      if (!this.isNew && this.isModified("email") && this.email) {
        const existingUser = await this.constructor.findOne({
          email: this.email.toLowerCase().trim(),
          _id: { $ne: this._id },
        });

        if (existingUser) {
          throw new Error("Email already exists in the system");
        }

        this.email = this.email.toLowerCase().trim();
      }

      if (this.isModified("password") && this.password) {
        this.password = bcrypt.hashSync(this.password, saltRounds);
      }
    }

    return next();
  } catch (error) {
    console.error("❌ [MIDDLEWARE] Error in pre-save:", error);
    return next(error);
  }
});

// separate pre middleware for update operations that need special handling
UserSchema.pre(["updateOne", "findOneAndUpdate"], function (next) {
  const update = this.getUpdate();

  // Handle email normalization in updates
  if (update.email) {
    update.email = update.email.toLowerCase().trim();
  }
  if (update.$set && update.$set.email) {
    update.$set.email = update.$set.email.toLowerCase().trim();
  }

  // Handle password hashing in updates
  if (update.password) {
    update.password = bcrypt.hashSync(update.password, saltRounds);
  }

  if (update.$set && update.$set.password) {
    update.$set.password = bcrypt.hashSync(update.$set.password, saltRounds);
  }

  // Prevent modification of immutable fields
  const immutableFields = ["firebase_uid", "email", "createdAt", "_id"];
  immutableFields.forEach((field) => {
    if (update[field]) delete update[field];
    if (update.$set && update.$set[field]) delete update.$set[field];
  });

  next();
});

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ userName: 1 }, { unique: true });

UserSchema.statics = {
  async register(args, next, options = {}) {
    const { sendDuplicateEmail = false } = options;
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

        if (sendDuplicateEmail) {
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
        }
      } else if (err instanceof HttpError) {
        message = err.message;
        status = err.statusCode;
        response = err.errors || { message: err.message };
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
        interests: 1,
        interestsDescription: 1,
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

UserSchema.statics.assignUserToGroup = async function (
  userId,
  groupId,
  roleId,
  userType = "user"
) {
  try {
    // Check if user exists first
    const user = await this.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // First remove any existing role for this group
    await this.findByIdAndUpdate(userId, {
      $pull: {
        group_roles: { group: groupId },
      },
    });

    // Then add the new role
    const updatedUser = await this.findByIdAndUpdate(
      userId,
      {
        $addToSet: {
          group_roles: {
            group: groupId,
            role: roleId,
            userType: userType,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );

    return {
      success: true,
      data: updatedUser,
      message: "User successfully assigned to group",
    };
  } catch (error) {
    console.error("❌ [STATIC METHOD] Group assignment failed:", error);
    return {
      success: false,
      message: error.message,
      error: error,
    };
  }
};

UserSchema.statics.assignUserToNetwork = async function (
  userId,
  networkId,
  roleId,
  userType = "user"
) {
  try {
    // Check if user exists first
    const user = await this.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // First remove any existing role for this network
    await this.findByIdAndUpdate(userId, {
      $pull: {
        network_roles: { network: networkId },
      },
    });

    // Then add the new role
    const updatedUser = await this.findByIdAndUpdate(
      userId,
      {
        $addToSet: {
          network_roles: {
            network: networkId,
            role: roleId,
            userType: userType,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );

    return {
      success: true,
      data: updatedUser,
      message: "User successfully assigned to network",
    };
  } catch (error) {
    console.error("❌ [STATIC METHOD] Network assignment failed:", error);
    return {
      success: false,
      message: error.message,
      error: error,
    };
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
      interests: this.interests,
      interestsDescription: this.interestsDescription,
      preferredTokenStrategy: this.preferredTokenStrategy,
      loginCount: this.loginCount,
      timezone: this.timezone,
    };
  },
};

UserSchema.methods.createToken = async function (
  // TODO: remove this legacy method and use the ATF service directly
  strategy = constants.TOKEN_STRATEGIES.LEGACY,
  options = {}
) {
  try {
    // Lazy require to prevent circular dependency issues at startup
    const { AbstractTokenFactory } = require("@services/atf.service");
    const tokenFactory = new AbstractTokenFactory(this.tenant || "airqo");
    return await tokenFactory.createToken(this, strategy, options);
  } catch (error) {
    logger.error(`Error in createToken for user ${this._id}: ${error.message}`);
    throw error; // Re-throw to be handled by caller
  }
};

UserSchema.methods.addGroupRole = function (
  groupId,
  roleId,
  userType = "user"
) {
  // Remove existing role for this group if any
  this.group_roles = this.group_roles.filter(
    (gr) => gr.group.toString() !== groupId.toString()
  );

  // Add new role
  this.group_roles.push({
    group: groupId,
    role: roleId,
    userType: userType,
    createdAt: new Date(),
  });

  return this.save();
};

UserSchema.methods.addNetworkRole = function (
  networkId,
  roleId,
  userType = "user"
) {
  // Remove existing role for this network if any
  this.network_roles = this.network_roles.filter(
    (nr) => nr.network.toString() !== networkId.toString()
  );

  // Add new role
  this.network_roles.push({
    network: networkId,
    role: roleId,
    userType: userType,
    createdAt: new Date(),
  });

  return this.save();
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
