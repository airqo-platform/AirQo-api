const mongoose = require("mongoose");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
} = require("@utils/shared");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- group-chart-config-model`
);

// Reuses the exact same chart field definitions the personal, per-user chart
// configs use (models/Preference.js) — same shape, same validation, so the
// two stay interchangeable from a frontend's point of view; only where they
// live (per-user vs per-group) differs.
const { chartConfigSchema } = require("./Preference");

/**
 * GroupChartConfig — the group/organization-wide DEFAULT chart configuration
 * for a device, as distinct from Preference.chartConfigurations (which is
 * per-user). This is what a group manager sets so that everyone viewing a
 * device's data within that group sees the same default chart, rather than
 * each user needing their own saved view.
 *
 * Read access: any verified member of the group.
 * Write access: group managers/admins only (see requireGroupManagerAccess in
 * routes/v2/preferences.routes.js) — a group-wide default shouldn't be
 * something any single member can silently change for everyone else.
 */
const groupChartConfigSchema = new mongoose.Schema(
  {
    group_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "group_id is required"],
    },
    device_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "device_id is required"],
    },
    chartConfigurations: [chartConfigSchema],
    created_by: { type: mongoose.Schema.Types.ObjectId },
    updated_by: { type: mongoose.Schema.Types.ObjectId },
  },
  { timestamps: true }
);

groupChartConfigSchema.index({ group_id: 1, device_id: 1 }, { unique: true });

groupChartConfigSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      group_id: this.group_id,
      device_id: this.device_id,
      chartConfigurations: this.chartConfigurations,
      created_by: this.created_by,
      updated_by: this.updated_by,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

groupChartConfigSchema.statics = {
  async list({ filter = {}, skip = 0, limit = 1000 } = {}, next) {
    try {
      const response = await this.find(filter)
        .skip(skip)
        .limit(limit)
        .lean();
      return createSuccessResponse("list", response, "groupChartConfig", {
        message: "Successfully retrieved the group chart configuration(s)",
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      return createErrorResponse(error, "list", logger, "groupChartConfig");
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const removed = await this.findOneAndRemove(filter).exec();
      if (isEmpty(removed)) {
        return createNotFoundResponse(
          "groupChartConfig",
          "delete",
          "the group chart configuration you are trying to DELETE does not exist, please crosscheck"
        );
      }
      return createSuccessResponse("delete", removed._doc, "groupChartConfig");
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      return createErrorResponse(error, "delete", logger, "groupChartConfig");
    }
  },
};

const GroupChartConfigModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model("groupchartconfigs");
  } catch (error) {
    return getModelByTenant(
      dbTenant,
      "groupchartconfig",
      groupChartConfigSchema
    );
  }
};

module.exports = GroupChartConfigModel;
