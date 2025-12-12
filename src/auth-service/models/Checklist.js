const mongoose = require("mongoose");
var uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- checklist-model`);
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

const checklistItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      unique: true, // Ensures title is unique within the array for a user
      default: "no title",
    },
    completed: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      default: "not started",
      enum: ["not started", "in progress", "completed", "started"],
    },
    completionDate: {
      type: Date,
    },
    videoProgress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  { _id: false }
);

const ChecklistSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: [true, "user_id is required"],
      unique: true,
    },
    items: [checklistItemSchema],
  },
  {
    timestamps: true,
  }
);

ChecklistSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

ChecklistSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      user_id: this.user_id,
      items: this.items,
    };
  },
};

ChecklistSchema.statics = {
  async register(args, next) {
    try {
      let body = args;

      // Remove _id if present
      if (body._id) {
        delete body._id;
      }

      const data = await this.create({
        ...body,
      });

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "checklist", {
          message: "checklist created successfully with no issues detected",
        });
      } else {
        return createEmptySuccessResponse(
          "checklist",
          "checklist not created despite successful operation"
        );
      }
    } catch (err) {
      logger.error(`🐛🐛 Internal Server Error ${err.message}`);
      return createErrorResponse(err, "create", logger, "checklist");
    }
  },

  async list({ skip = 0, limit = 1000, filter = {} } = {}, next) {
    try {
      const totalCount = await this.countDocuments(filter);

      const checklists = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit) // Preserve higher limit (1000)
        .exec();

      const safeLimit = limit > 0 ? limit : 1;
      return {
        success: true,
        data: checklists,
        message: "successfully listed the checklists",
        status: httpStatus.OK,
        meta: {
          total: totalCount,
          skip,
          limit,
          page: Math.floor(skip / safeLimit) + 1,
          pages: Math.ceil(totalCount / safeLimit) || 1,
        },
      };
    } catch (error) {
      return createErrorResponse(error, "list", logger, "checklist");
    }
  },

  async modify({ filter = {}, update = {}, options = {} } = {}, next) {
    try {
      const modelOptions = { new: true, ...options };

      // Remove _id from update if present
      if (update._id) {
        delete update._id;
      }

      const updatedChecklist = await this.findOneAndUpdate(
        filter,
        update,
        modelOptions
      ).exec();

      if (!isEmpty(updatedChecklist)) {
        return createSuccessResponse(
          "update",
          updatedChecklist._doc,
          "checklist"
        );
      } else {
        return createNotFoundResponse(
          "checklist",
          "update",
          "the User Checklist you are trying to UPDATE does not exist, please crosscheck"
        );
      }
    } catch (err) {
      logger.error(`Data conflicts detected -- ${err.message}`);

      // Handle specific duplicate errors with enhanced validation handling
      if (err.code == 11000) {
        return {
          success: false,
          message: "duplicate values provided",
          status: httpStatus.CONFLICT,
          errors: err.keyValue || { message: err.message },
        };
      } else if (err.errors) {
        let errors = {};
        Object.entries(err.errors).forEach(([key, value]) => {
          return (errors[key] = value.message);
        });
        return {
          success: false,
          message: "validation errors for some of the provided fields",
          status: httpStatus.CONFLICT,
          errors,
        };
      } else {
        return createErrorResponse(err, "update", logger, "checklist");
      }
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 1,
          user_id: 1, // Preserve user_id projection for checklist tracking
        },
      };

      const removedChecklist = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedChecklist)) {
        return createSuccessResponse(
          "delete",
          removedChecklist._doc,
          "checklist"
        );
      } else {
        return createNotFoundResponse(
          "checklist",
          "delete",
          "the User Checklist you are trying to DELETE does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "checklist");
    }
  },
};

const ChecklistModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let checklists = mongoose.model("checklists");
    return checklists;
  } catch (error) {
    let checklists = getModelByTenant(dbTenant, "checklist", ChecklistSchema);
    return checklists;
  }
};

module.exports = ChecklistModel;
