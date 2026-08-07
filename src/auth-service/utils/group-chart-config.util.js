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
const groupChartConfig = {
  create: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { groupId, deviceId } = request.params;
      const { chartConfig } = request.body;
      const userId = request.user._id;

      if (!chartConfig || !chartConfig.fieldId) {
        return {
          success: false,
          message: "Chart configuration must include a field ID",
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Atomically add this chart to the group's default set for this
      // device, creating the doc if it doesn't exist yet — same
      // findOneAndUpdate-keyed-on-the-unique-index shape as the personal
      // chart create, which is what keeps it safe from duplicate-key
      // errors on a first save (see the note in preference.util.js).
      const groupChart = await GroupChartConfigModel(tenant).findOneAndUpdate(
        { group_id: groupId, device_id: deviceId },
        {
          $push: { chartConfigurations: chartConfig },
          $set: { updated_by: userId },
          $setOnInsert: {
            group_id: groupId,
            device_id: deviceId,
            created_by: userId,
          },
        },
        { upsert: true, new: true, runValidators: true }
      );

      return {
        success: true,
        message: "Group chart configuration created successfully",
        data:
          groupChart.chartConfigurations[
            groupChart.chartConfigurations.length - 1
          ],
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
      const { groupId, deviceId, chartId } = request.params;
      const updates = request.body;
      const userId = request.user._id;

      const groupChart = await GroupChartConfigModel(tenant).findOne({
        group_id: groupId,
        device_id: deviceId,
        "chartConfigurations._id": chartId,
      });

      if (!groupChart) {
        return {
          success: false,
          message: "Group chart configuration not found for this device",
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

      Object.keys(updates)
        .filter((key) => allowedChartProperties.includes(key))
        .forEach((key) => {
          groupChart.chartConfigurations[chartIndex][key] = updates[key];
        });
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
      const { groupId, deviceId, chartId } = request.params;
      const userId = request.user._id;

      // A single atomic $pull rather than findOne -> splice -> save: the
      // read-modify-write shape raced against a concurrent delete/update on
      // the same group+device doc (whole-document save() can silently drop
      // the other request's change). $pull removes the matching array
      // element directly, so there's no window for that to happen.
      const updateResult = await GroupChartConfigModel(tenant).updateOne(
        { group_id: groupId, device_id: deviceId, "chartConfigurations._id": chartId },
        {
          $pull: { chartConfigurations: { _id: chartId } },
          $set: { updated_by: userId },
        }
      );

      if (updateResult.matchedCount === 0) {
        return {
          success: false,
          message: "Group chart configuration not found for this device",
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
      const { tenant, limit, skip } = request.query;
      const { groupId, deviceId } = request.params;

      const groupChart = await GroupChartConfigModel(tenant).findOne({
        group_id: groupId,
        device_id: deviceId,
      });

      // chartConfigurations is an array embedded in a single document, not
      // its own collection — pagination (set by the route's pagination()
      // middleware) is applied in memory rather than via a Mongo
      // .skip()/.limit() query.
      const allCharts = groupChart ? groupChart.chartConfigurations : [];
      const skipNum = Number(skip) || 0;
      const limitNum = Number(limit) || allCharts.length || 1;
      const data = allCharts.slice(skipNum, skipNum + limitNum);

      return {
        success: true,
        message: groupChart
          ? "Group chart configurations retrieved successfully"
          : "No group chart configurations found for this device",
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
      const { groupId, deviceId, chartId } = request.params;

      const groupChart = await GroupChartConfigModel(tenant).findOne({
        group_id: groupId,
        device_id: deviceId,
      });

      if (!groupChart) {
        return {
          success: false,
          message: "Group chart configuration not found for this device",
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
        data: chart,
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
