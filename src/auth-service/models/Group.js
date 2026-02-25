const mongoose = require("mongoose");
const ObjectId = mongoose.ObjectId;
const { Schema } = mongoose;
var uniqueValidator = require("mongoose-unique-validator");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const { getModelByTenant } = require("@config/database");
const ThemeSchema = require("@models/ThemeSchema");
const httpStatus = require("http-status");
const { logObject, logText, HttpError } = require("@utils/shared");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- group-model`);

function validateProfilePicture(grp_profile_picture) {
  const urlRegex =
    /^(http(s)?:\/\/.)[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/g;
  if (!urlRegex.test(grp_profile_picture)) {
    logger.error(`🙅🙅 Bad Request Error -- Not a valid profile picture URL`);
    return false;
  }
  if (grp_profile_picture.length > 200) {
    logText("longer than 200 chars");
    logger.error(
      `🙅🙅 Bad Request Error -- profile picture URL exceeds 200 characters`,
    );
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// protectedFilter — MongoDB query expression matching any protected group.
// Used for the pre-check findOne and the this.where($nor) query guard.
//
// Criteria (all four guards preserved from the previous refactor):
//   1. grp_title === "airqo"            — primary, environment-agnostic
//   2. organization_slug === "airqo"    — belt-and-suspenders slug check
//   3. is_default === true              — any explicitly flagged system group
//   4. _id === constants.DEFAULT_GROUP  — backwards-compat _id fallback
// ---------------------------------------------------------------------------
const protectedFilter = [
  { grp_title: { $regex: /^airqo$/i } },
  { organization_slug: { $regex: /^airqo$/i } },
  { is_default: true },
  // Only included when the constant is set — avoids matching everything
  // when DEFAULT_GROUP is undefined.
  ...(constants.DEFAULT_GROUP ? [{ _id: constants.DEFAULT_GROUP }] : []),
];

// isProtectedGroup — used on the document middleware path (doc.remove())
// where `this` is a plain JS document object, not a DB query result.
const isProtectedGroup = (doc) => {
  if (!doc) return false;

  const nameMatch = doc.grp_title && doc.grp_title.toLowerCase() === "airqo";

  const slugMatch =
    doc.organization_slug && doc.organization_slug.toLowerCase() === "airqo";

  const flagMatch = doc.is_default === true;

  const idMatch =
    constants.DEFAULT_GROUP &&
    doc._id &&
    doc._id.toString() === constants.DEFAULT_GROUP.toString();

  return nameMatch || slugMatch || flagMatch || idMatch;
};

const GroupSchema = new Schema(
  {
    grp_title: {
      type: String,
      unique: true,
      required: [true, "grp_title is required"],
      lowercase: true,
    },
    organization_slug: {
      type: String,
      unique: true,
      sparse: true, // Allow null values but ensure uniqueness when present
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true; // Allow null/undefined
          return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
        },
        message: "Slug must be lowercase alphanumeric with hyphens only",
      },
    },
    theme: {
      type: ThemeSchema,
      default: () => ({}),
    },
    grp_status: { type: String, default: "INACTIVE" },
    grp_tasks: { type: Number },
    grp_description: {
      type: String,
      required: [true, "grp_description is required"],
    },
    grp_manager: { type: ObjectId },
    grp_sites: {
      type: [ObjectId],
      validate: {
        validator: function (value) {
          // Check for duplicates in the array
          return Array.isArray(value) && new Set(value).size === value.length;
        },
        message: "Duplicate grp_sites are not allowed.",
      },
    },
    grp_manager_username: { type: String },
    grp_manager_firstname: { type: String },
    grp_manager_lastname: { type: String },
    grp_website: { type: String },
    grp_industry: { type: String },
    grp_country: { type: String },
    grp_timezone: { type: String },
    grp_image: { type: String },
    grp_profile_picture: {
      type: String,
      maxLength: 200,
      default: constants.DEFAULT_ORGANISATION_PROFILE_PICTURE,
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
    cohorts: [
      {
        type: ObjectId,
      },
    ],
    is_default: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

GroupSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

GroupSchema.index({ grp_title: 1 }, { unique: true });

GroupSchema.pre(
  ["updateOne", "findOneAndUpdate", "updateMany", "update", "save"],
  async function (next) {
    // Pre-save hook to normalize grp_sites and remove duplicates
    if (this.grp_sites && Array.isArray(this.grp_sites)) {
      this.grp_sites = [...new Set(this.grp_sites.map(String))].map((id) =>
        mongoose.Types.ObjectId(id),
      );
    }

    // Determine if this is a new document or an update
    const isNew = this.isNew;
    let updates = this.getUpdate ? this.getUpdate() : this;

    try {
      // Get all actual fields being updated from both root and $set
      const actualUpdates = {
        ...(updates || {}),
        ...(updates.$set || {}),
      };

      // This check ensures the following logic only runs for query middleware (e.g., findOneAndUpdate)
      // and skips document middleware (e.g., save), where `this.getQuery` is not a function.
      if (typeof this.getQuery === "function") {
        // Query middleware (e.g., findOneAndUpdate, updateMany)
        if (
          actualUpdates.grp_title &&
          actualUpdates.grp_title.toLowerCase() !== "airqo"
        ) {
          const query = this.getQuery();
          // For multi-document operations (e.g., updateMany), ensure that no
          // document matching the query is the default 'airqo' group.
          const airqoFilter = { $and: [query, { grp_title: "airqo" }] };
          const airqoExists = await this.model.exists(airqoFilter);
          if (airqoExists) {
            return next(
              new HttpError("Forbidden", httpStatus.FORBIDDEN, {
                message: "The default 'airqo' group cannot be renamed.",
              }),
            );
          }
        }
      } else {
        // Document middleware (e.g., doc.save())
        if (!this.isNew && this.isModified("grp_title")) {
          const originalDoc = await this.constructor
            .findOne({ _id: this._id })
            .lean();
          if (originalDoc && originalDoc.grp_title.toLowerCase() === "airqo") {
            return next(
              new HttpError("Forbidden", httpStatus.FORBIDDEN, {
                message: "The default 'airqo' group cannot be renamed.",
              }),
            );
          }
        }
      }
      if (actualUpdates.grp_sites) {
        const grpSites = actualUpdates.grp_sites;
        if (
          Array.isArray(grpSites) &&
          new Set(grpSites).size !== grpSites.length
        ) {
          return next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "Duplicate grp_sites are not allowed.",
            }),
          );
        }
      }

      // Profile picture validation for both new documents and updates
      if (isNew) {
        // Validation for new documents

        if (!this.grp_profile_picture) {
          this.grp_profile_picture =
            constants.DEFAULT_ORGANISATION_PROFILE_PICTURE;
        } else if (
          this.grp_profile_picture &&
          !validateProfilePicture(this.grp_profile_picture)
        ) {
          return next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "Invalid profile picture URL",
            }),
          );
        }
      } else if (actualUpdates.grp_profile_picture) {
        // Validation for updates
        if (!validateProfilePicture(actualUpdates.grp_profile_picture)) {
          return next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "Invalid profile picture URL",
            }),
          );
        }
      }

      return next();
    } catch (error) {
      return next(error);
    }
  },
);

// Pre-remove hook
GroupSchema.pre(
  [
    "findOneAndRemove",
    "remove",
    "findOneAndDelete",
    // "findByIdAndDelete" removed — Mongoose v6+ routes findByIdAndDelete
    // through findOneAndDelete internally, so registering it here is
    // redundant; findOneAndDelete above already covers it.
    "deleteOne",
    "deleteMany",
  ],
  async function (next) {
    try {
      const isQueryMiddleware = typeof this.getQuery === "function";

      if (isQueryMiddleware) {
        // -----------------------------------------------------------------
        // Query middleware path (findOneAndDelete, deleteOne, deleteMany…)
        //
        // Step 1 — targeted findOne intersection check.
        //   Single index seek: { $and: [callerQuery, { $or: protectedFilter }] }
        //   Only grp_title is projected since that is all we need for the
        //   error message; _id is always returned by MongoDB unless explicitly
        //   suppressed, giving us a reliable fallback if grp_title is missing.
        //
        // Step 2 — this.where($nor) query guard.
        //   Merges the exclusion into the live query to close the TOCTOU
        //   window between the check and the actual delete.
        // -----------------------------------------------------------------
        const callerQuery = this.getQuery();
        const Model = this.model;

        const protectedDoc = await Model.findOne({
          $and: [callerQuery, { $or: protectedFilter }],
        })
          .select("grp_title") // project only what is needed for the error message
          .lean();

        if (protectedDoc) {
          // grp_title may be absent if the document matched via slug, flag,
          // or _id guard rather than by name — fall back to _id in that case.
          const identifier =
            protectedDoc.grp_title || protectedDoc._id || "default group";

          return next(
            new HttpError("Forbidden", httpStatus.FORBIDDEN, {
              message: `Cannot delete the default '${identifier}' group.`,
            }),
          );
        }

        // No protected document found — apply $nor guard before proceeding.
        this.where({ $nor: protectedFilter });
      } else {
        // -----------------------------------------------------------------
        // Document middleware path (doc.remove())
        // `this` is the document instance — no query object, no this.where().
        // -----------------------------------------------------------------
        if (isProtectedGroup(this)) {
          const identifier = this.grp_title || this._id || "default group";

          return next(
            new HttpError("Forbidden", httpStatus.FORBIDDEN, {
              message: `Cannot delete the default '${identifier}' group.`,
            }),
          );
        }
      }

      return next();
    } catch (error) {
      return next(error);
    }
  },
);

GroupSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      grp_title: this.grp_title,
      organization_slug: this.organization_slug,
      theme: this.theme,
      grp_status: this.grp_status,
      grp_tasks: this.grp_tasks,
      grp_description: this.grp_description,
      createdAt: this.createdAt,
      grp_manager: this.grp_manager,
      grp_manager_username: this.grp_manager_username,
      grp_manager_firstname: this.grp_manager_firstname,
      grp_manager_lastname: this.grp_manager_lastname,
      grp_website: this.grp_website,
      grp_profile_picture: this.grp_profile_picture,
      grp_industry: this.grp_industry,
      grp_country: this.grp_country,
      grp_timezone: this.grp_timezone,
      grp_image: this.grp_image,
      cohorts: this.cohorts,
    };
  },
};

const convertToLowerCaseWithUnderscore = (inputString) => {
  try {
    const uppercaseString = inputString.toLowerCase();
    const transformedString = uppercaseString.replace(/ /g, "_");
    return transformedString;
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error --  ${JSON.stringify(error)}`);
  }
};

GroupSchema.statics = {
  async register(args, next) {
    try {
      let modifiedArgs = Object.assign({}, args);

      // Preserve grp_title transformation logic
      if (modifiedArgs.grp_title) {
        modifiedArgs.grp_title = convertToLowerCaseWithUnderscore(
          modifiedArgs.grp_title,
        );
      }

      const data = await this.create({
        ...modifiedArgs,
      });

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "group", {
          message: "group created",
        });
      } else {
        return createEmptySuccessResponse(
          "group",
          "group NOT successfully created but operation successful",
        );
      }
    } catch (err) {
      logObject("the error for registering a group", err);
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      return createErrorResponse(err, "create", logger, "group");
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      logObject("filter", filter);
      const inclusionProjection = constants.GROUPS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.GROUPS_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none",
      );

      if (!isEmpty(filter.category)) {
        delete filter.category;
      }

      const totalCount = await this.countDocuments(filter);

      const response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "users",
          localField: "_id",
          foreignField: "group_roles.group",
          as: "grp_users",
        })
        .addFields({
          numberOfGroupUsers: { $size: "$grp_users" },
        })
        .lookup({
          from: "users",
          localField: "grp_manager",
          foreignField: "_id",
          as: "grp_manager",
        })
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);

      return {
        success: true,
        data: response,
        message: "successfully retrieved the groups",
        status: httpStatus.OK,
        meta: {
          total: totalCount,
          skip,
          limit,
          page: Math.floor(skip / limit) + 1,
          pages: Math.ceil(totalCount / limit) || 1,
        },
      };
    } catch (err) {
      logObject("the error for listing a group", err);
      return createErrorResponse(err, "list", logger, "group");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      let modifiedUpdate = Object.assign({}, update);
      modifiedUpdate["$addToSet"] = {};

      // Remove fields that shouldn't be updated
      if (modifiedUpdate.tenant) {
        delete modifiedUpdate.tenant;
      }

      if (modifiedUpdate.grp_title) {
        delete modifiedUpdate.grp_title;
        logger.warn(
          "Attempted to update grp_title via general modify endpoint. This is not allowed.",
        );
      }

      const updatedGroup = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options,
      ).exec();

      if (!isEmpty(updatedGroup)) {
        return createSuccessResponse("update", updatedGroup._doc, "group");
      } else {
        return createNotFoundResponse(
          "group",
          "update",
          "group does not exist, please crosscheck -- Not Found",
        );
      }
    } catch (err) {
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      return createErrorResponse(err, "update", logger, "group");
    }
  },

  async modifyName({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      const modifiedUpdate = Object.assign({}, update);

      // Normalize grp_title to match the format used in registration
      if (modifiedUpdate.grp_title) {
        modifiedUpdate.grp_title = convertToLowerCaseWithUnderscore(
          modifiedUpdate.grp_title,
        );
      }

      // Only allow grp_title to be updated
      const updateToApply = { grp_title: modifiedUpdate.grp_title };

      if (!updateToApply.grp_title) {
        return createErrorResponse(
          { message: "grp_title is required for this operation" },
          "update",
          logger,
          "group",
        );
      }

      const updatedGroup = await this.findOneAndUpdate(
        filter,
        updateToApply,
        options,
      ).exec();

      if (!isEmpty(updatedGroup)) {
        return createSuccessResponse("update", updatedGroup._doc, "group");
      } else {
        return createNotFoundResponse("group", "update", "group not found");
      }
    } catch (err) {
      logger.error(err, { source: "modifyName" });
      return createErrorResponse(err, "update", logger, "group");
    }
  },
  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 1,
          grp_title: 1,
          organization_slug: 1,
          grp_status: 1,
          grp_description: 1,
          createdAt: 1,
        },
      };

      const removedGroup = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedGroup)) {
        return createSuccessResponse("delete", removedGroup._doc, "group");
      } else {
        return createNotFoundResponse(
          "group",
          "delete",
          "Bad Request, Group Not Found -- please crosscheck",
        );
      }
    } catch (err) {
      return createErrorResponse(err, "delete", logger, "group");
    }
  },
};

const GroupModel = (tenant) => {
  logObject("the tenant value being used in the group model creation", tenant);
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let groups = mongoose.model("groups");
    return groups;
  } catch (error) {
    let groups = getModelByTenant(dbTenant, "group", GroupSchema);
    return groups;
  }
};

module.exports = GroupModel;
