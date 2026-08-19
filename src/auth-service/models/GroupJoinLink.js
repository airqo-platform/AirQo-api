const mongoose = require("mongoose");
const { Schema } = mongoose;
const ObjectId = mongoose.Schema.Types.ObjectId;
const httpStatus = require("http-status");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- group-join-link-model`,
);

const GroupJoinLinkSchema = new Schema(
  {
    group_id: {
      type: ObjectId,
      ref: "group",
      required: [true, "group_id is required"],
    },
    token: {
      type: String,
      required: [true, "token is required"],
      unique: true,
    },
    created_by: {
      type: ObjectId,
      ref: "user",
      required: [true, "created_by is required"],
    },
    label: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    expires_at: {
      type: Date,
    },
    max_uses: {
      type: Number,
      min: 1,
    },
    uses_count: {
      type: Number,
      default: 0,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    // Safer default: a manager must explicitly opt a link into instant join.
    requires_approval: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

GroupJoinLinkSchema.index({ token: 1 }, { unique: true });
GroupJoinLinkSchema.index({ group_id: 1, is_active: 1 });

GroupJoinLinkSchema.statics = {
  async register(args, next) {
    try {
      const data = await this.create({ ...args });
      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "group join link", {
          message: "group join link created",
        });
      } else {
        return createEmptySuccessResponse(
          "group join link",
          "operation successful but group join link NOT successfully created",
        );
      }
    } catch (error) {
      return createErrorResponse(error, "create", logger, "group join link");
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const data = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : parseInt(constants.DEFAULT_LIMIT))
        .lean();

      const totalCount = await this.countDocuments(filter);

      return {
        success: true,
        data,
        message: "successfully listed the group join links",
        status: httpStatus.OK,
        meta: {
          total: totalCount,
          skip,
          limit,
          page: Math.floor(skip / limit) + 1,
          pages: Math.ceil(totalCount / limit) || 1,
        },
      };
    } catch (error) {
      return createErrorResponse(error, "list", logger, "group join link");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      const updatedLink = await this.findOneAndUpdate(
        filter,
        update,
        options,
      ).exec();

      if (!isEmpty(updatedLink)) {
        return createSuccessResponse(
          "update",
          updatedLink._doc,
          "group join link",
        );
      } else {
        return createNotFoundResponse(
          "group join link",
          "update",
          "group join link does not exist, please crosscheck",
        );
      }
    } catch (error) {
      return createErrorResponse(error, "update", logger, "group join link");
    }
  },
};

GroupJoinLinkSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      group_id: this.group_id,
      token: this.token,
      created_by: this.created_by,
      label: this.label,
      expires_at: this.expires_at,
      max_uses: this.max_uses,
      uses_count: this.uses_count,
      is_active: this.is_active,
      requires_approval: this.requires_approval,
      createdAt: this.createdAt,
    };
  },
};

const GroupJoinLinkModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const group_join_links = mongoose.model("group_join_links");
    return group_join_links;
  } catch (error) {
    const group_join_links = getModelByTenant(
      dbTenant,
      "group_join_link",
      GroupJoinLinkSchema,
    );
    return group_join_links;
  }
};

module.exports = GroupJoinLinkModel;
