const mongoose = require("mongoose");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const isEmpty = require("is-empty");

// Reuses the exact same chart field definitions the personal, per-user chart
// configs use (models/Preference.js) — same shape, same validation, so the
// two stay interchangeable from a frontend's point of view; only where they
// live (per-user vs per-group) differs.
const { chartConfigSchema } = require("./Preference");

/**
 * GroupChartConfig — a group/organization-wide DEFAULT chart configuration,
 * as distinct from Preference.chartConfigurations (which is per-user). This
 * is what a group manager sets so that everyone viewing data within that
 * group sees the same default chart, rather than each user needing their
 * own saved view.
 *
 * Scoped by device_ids/site_ids arrays rather than a single device — this
 * mirrors the old, deprecated Defaults model (which had the same sites[]/
 * devices[] shape) so one saved default can apply across multiple devices
 * and/or sites at once, not just one device.
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
    device_ids: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
    site_ids: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
    chartConfigurations: [chartConfigSchema],
    created_by: { type: mongoose.Schema.Types.ObjectId },
    updated_by: { type: mongoose.Schema.Types.ObjectId },
  },
  { timestamps: true }
);

// A saved default has to apply to something — at least one device or site.
groupChartConfigSchema.pre("validate", function (next) {
  if (isEmpty(this.device_ids) && isEmpty(this.site_ids)) {
    return next(
      new Error("At least one of device_ids or site_ids is required")
    );
  }
  next();
});

groupChartConfigSchema.index({ group_id: 1 });
groupChartConfigSchema.index({ group_id: 1, device_ids: 1 });
groupChartConfigSchema.index({ group_id: 1, site_ids: 1 });

groupChartConfigSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      group_id: this.group_id,
      device_ids: this.device_ids,
      site_ids: this.site_ids,
      chartConfigurations: this.chartConfigurations,
      created_by: this.created_by,
      updated_by: this.updated_by,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
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
