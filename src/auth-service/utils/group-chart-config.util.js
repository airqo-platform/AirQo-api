const GroupChartConfigModel = require("@models/GroupChartConfig");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- group-chart-config-util`
);
const { allowedChartProperties } = require("./preference.util");

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

      // A single atomic $pull rather than findOne -> splice -> save: the
      // read-modify-write shape raced against a concurrent delete/update on
      // the same doc (whole-document save() can silently drop the other
      // request's change). $pull removes the matching array element
      // directly, so there's no window for that to happen.
      const updateResult = await GroupChartConfigModel(tenant).updateOne(
        { group_id: groupId, "chartConfigurations._id": chartId },
        {
          $pull: { chartConfigurations: { _id: chartId } },
          $set: { updated_by: userId },
        }
      );

      if (updateResult.matchedCount === 0) {
        return {
          success: false,
          message: "Group chart configuration not found",
          status: httpStatus.NOT_FOUND,
        };
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

      const groupCharts = await GroupChartConfigModel(tenant).find(filter);

      const skipNum = Number(skip) || 0;
      const limitNum = Number(limit) || groupCharts.length || 1;
      const data = groupCharts.slice(skipNum, skipNum + limitNum);

      return {
        success: true,
        message:
          data.length > 0
            ? "Group chart configurations retrieved successfully"
            : "No group chart configurations found",
        data,
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
