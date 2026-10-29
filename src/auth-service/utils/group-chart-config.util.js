const GroupChartConfigModel = require("@models/GroupChartConfig");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- group-chart-config-util`
);
const {
  allowedChartProperties,
  findStaleMetadataEntry,
} = require("./preference.util");

// Mirrors utils/preference.util.js's personal chart CRUD, but scoped to a
// group (the org/organization-wide DEFAULT chart, as distinct from a single
// user's own saved chart). group_id always comes from the route param
// (req.params.grp_id, enforced upstream by requireGroupManagerAccess on
// writes), never a body default — a group-wide default should never be
// implicit.
//
// Scoping is by device_ids/site_ids arrays (from the request body on
// create/update, or ?device_id=/?site_id= query filters on list), not a
// single :deviceId path param — this mirrors the old, deprecated Defaults
// model's sites[]/devices[] shape, so one saved default can cover multiple
// devices and/or sites. Each create makes its own document (no
// findOneAndUpdate-merge into one doc per scope, since matching an exact
// device_ids/site_ids array combination is unreliable) — same plain-insert
// shape the old Defaults model used.
const groupChartConfig = {
  create: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { groupId } = request.params;
      const { chartConfig, device_ids = [], site_ids = [] } = request.body;
      const userId = request.user._id;

      if (!chartConfig || !chartConfig.fieldId) {
        return {
          success: false,
          message: "Chart configuration must include a field ID",
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Enforced by the route validators too, but checked again here so a
      // direct/validator-bypassing call fails as a clear 400 rather than
      // hitting the schema's pre-validate hook and surfacing as a 500.
      if (isEmpty(device_ids) && isEmpty(site_ids)) {
        return {
          success: false,
          message: "At least one of device_ids or site_ids is required",
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Unlike the personal chart, a group chart's scope lives on this
      // parent document (device_ids/site_ids above), not on the chart
      // subdocument itself — so sites/devices are checked against the
      // parent-level arrays, not any scope field on chartConfig.
      const staleSite = findStaleMetadataEntry(
        chartConfig.sites,
        "site_id",
        site_ids
      );
      if (staleSite) {
        return {
          success: false,
          message: `sites[].site_id ${staleSite.site_id} is not in this chart's site_ids`,
          status: httpStatus.BAD_REQUEST,
        };
      }
      const staleDevice = findStaleMetadataEntry(
        chartConfig.devices,
        "device_id",
        device_ids
      );
      if (staleDevice) {
        return {
          success: false,
          message: `devices[].device_id ${staleDevice.device_id} is not in this chart's device_ids`,
          status: httpStatus.BAD_REQUEST,
        };
      }

      const groupChart = await GroupChartConfigModel(tenant).create({
        group_id: groupId,
        device_ids,
        site_ids,
        chartConfigurations: [chartConfig],
        created_by: userId,
        updated_by: userId,
      });

      return {
        success: true,
        message: "Group chart configuration created successfully",
        data: groupChart.chartConfigurations[0],
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Error creating group chart: ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  update: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { groupId, chartId } = request.params;
      const { device_ids, site_ids, ...chartUpdates } = request.body;
      const userId = request.user._id;

      const groupChart = await GroupChartConfigModel(tenant).findOne({
        group_id: groupId,
        "chartConfigurations._id": chartId,
      });

      if (!groupChart) {
        return {
          success: false,
          message: "Group chart configuration not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      const chartIndex = groupChart.chartConfigurations.findIndex(
        (chart) => chart._id.toString() === chartId
      );

      if (chartIndex === -1) {
        return {
          success: false,
          message: "Chart configuration not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      Object.keys(chartUpdates)
        .filter((key) => allowedChartProperties.includes(key))
        .forEach((key) => {
          groupChart.chartConfigurations[chartIndex][key] = chartUpdates[key];
        });

      // device_ids/site_ids update the whole document's scope (which
      // devices/sites this saved default applies to), not a single chart
      // field, so they're applied separately from chartUpdates above.
      if (Array.isArray(device_ids)) groupChart.device_ids = device_ids;
      if (Array.isArray(site_ids)) groupChart.site_ids = site_ids;

      // Checked here (post-merge, pre-save) rather than left to the
      // schema's pre-validate hook: a request can clear one array while
      // leaving the other untouched, and only the merged result — not the
      // request body alone — can tell us whether that leaves the doc with
      // no scope at all. Catching it here returns a normal 400 instead of
      // an uncaught validation error surfacing as a 500.
      if (isEmpty(groupChart.device_ids) && isEmpty(groupChart.site_ids)) {
        return {
          success: false,
          message: "At least one of device_ids or site_ids is required",
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Checked against the parent doc's (just-merged) device_ids/site_ids,
      // not any field on the chart subdocument — see the same check in
      // create() above for why.
      const updatedChart = groupChart.chartConfigurations[chartIndex];
      const staleSite = findStaleMetadataEntry(
        updatedChart.sites,
        "site_id",
        groupChart.site_ids
      );
      if (staleSite) {
        return {
          success: false,
          message: `sites[].site_id ${staleSite.site_id} is not in this chart's site_ids`,
          status: httpStatus.BAD_REQUEST,
        };
      }
      const staleDevice = findStaleMetadataEntry(
        updatedChart.devices,
        "device_id",
        groupChart.device_ids
      );
      if (staleDevice) {
        return {
          success: false,
          message: `devices[].device_id ${staleDevice.device_id} is not in this chart's device_ids`,
          status: httpStatus.BAD_REQUEST,
        };
      }

      groupChart.updated_by = userId;

      await groupChart.save();

      return {
        success: true,
        message: "Group chart configuration updated successfully",
        data: groupChart.chartConfigurations[chartIndex],
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Error updating group chart: ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  delete: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { groupId, chartId } = request.params;
      const userId = request.user._id;

      // findOneAndUpdate rather than findOne -> splice -> save: the
      // read-modify-write shape raced against a concurrent delete/update on
      // the same doc (whole-document save() can silently drop the other
      // request's change). It's still a single atomic command like the
      // $pull-only updateOne this replaced — the difference is it also
      // hands back the updated document, which is what lets us detect (and
      // clean up) a doc left with zero charts after this pull. Since
      // create() always makes its own new document rather than merging
      // into an existing one, nothing else can race to repopulate this
      // specific doc's chartConfigurations between the pull and the
      // cleanup delete below.
      const updatedDoc = await GroupChartConfigModel(tenant).findOneAndUpdate(
        { group_id: groupId, "chartConfigurations._id": chartId },
        {
          $pull: { chartConfigurations: { _id: chartId } },
          $set: { updated_by: userId },
        },
        { new: true }
      );

      if (!updatedDoc) {
        return {
          success: false,
          message: "Group chart configuration not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      // A saved default with no charts left in it is dead weight — it'd
      // otherwise keep showing up in list() (matching on group_id/scope)
      // with an empty chartConfigurations array.
      if (updatedDoc.chartConfigurations.length === 0) {
        await GroupChartConfigModel(tenant).deleteOne({ _id: updatedDoc._id });
      }

      return {
        success: true,
        message: "Group chart configuration deleted successfully",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Error deleting group chart: ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  list: async (request, next) => {
    try {
      const { tenant, limit, skip, device_id, site_id } = request.query;
      const { groupId } = request.params;

      // Each saved default is now its own document with its own
      // device_ids/site_ids scope (no longer one array embedded in a
      // single per-device doc), so list returns matching documents
      // themselves, optionally narrowed by a specific device/site.
      const filter = { group_id: groupId };
      if (device_id) filter.device_ids = device_id;
      if (site_id) filter.site_ids = site_id;

      // Paginated at the query level, not in memory — each saved default
      // is its own document now (not one array embedded in a single doc),
      // so a group with many saved defaults would otherwise mean loading
      // all of them just to slice a page off in JS. skip(0)/limit(0) are
      // both no-ops in MongoDB, so this is safe to chain unconditionally.
      const skipNum = Number(skip) || 0;
      const limitNum = Number(limit) || 0;
      const groupCharts = await GroupChartConfigModel(tenant)
        .find(filter)
        .skip(skipNum)
        .limit(limitNum);

      return {
        success: true,
        message:
          groupCharts.length > 0
            ? "Group chart configurations retrieved successfully"
            : "No group chart configurations found",
        data: groupCharts,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Error retrieving group charts: ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  getById: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { groupId, chartId } = request.params;

      const groupChart = await GroupChartConfigModel(tenant).findOne({
        group_id: groupId,
        "chartConfigurations._id": chartId,
      });

      if (!groupChart) {
        return {
          success: false,
          message: "Chart configuration not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      const chart = groupChart.chartConfigurations.find(
        (chart) => chart._id.toString() === chartId
      );

      if (!chart) {
        return {
          success: false,
          message: "Chart configuration not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      return {
        success: true,
        message: "Chart configuration retrieved successfully",
        data: {
          ...chart.toObject(),
          device_ids: groupChart.device_ids,
          site_ids: groupChart.site_ids,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Error retrieving group chart: ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = groupChartConfig;
