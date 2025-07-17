const PreferenceModel = require("@models/Preference");
const UserModel = require("@models/User");
const GroupModel = require("@models/Group");
const NetworkModel = require("@models/Network");
const SelectedSiteModel = require("@models/SelectedSite");
const { generateFilter } = require("@utils/common");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- preferences-util`);
const { logObject, logText, HttpError } = require("@utils/shared");
const {
  getDefaultTheme,
  hasValidTheme,
  mergeWithDefaults,
} = require("@utils/common");

const handleError = (next, title, statusCode, message) => {
  next(new HttpError(title, statusCode, { message }));
};

const validateUserAndGroup = async (tenant, userId, groupId, next) => {
  if (!isEmpty(userId)) {
    const user = await UserModel(tenant).findById(userId).lean();
    if (isEmpty(userId) || isEmpty(user)) {
      return handleError(
        next,
        "Bad Request Error",
        httpStatus.BAD_REQUEST,
        "The provided User does not exist"
      );
    }

    if (!isEmpty(groupId)) {
      if (user && user.group_roles) {
        const userBelongsToGroup = user.group_roles.some(
          (role) => role.group.toString() === groupId
        );
        if (!userBelongsToGroup) {
          return handleError(
            next,
            "Bad Request Error",
            httpStatus.BAD_REQUEST,
            "User does not belong to the specified group"
          );
        }
      } else {
        return handleError(
          next,
          "Bad Request Error",
          httpStatus.BAD_REQUEST,
          "User not found or invalid user data"
        );
      }
    }
  }
};

const prepareUpdate = (body, fieldsToUpdate, fieldsToAddToSet) => {
  const update = { ...body };

  // Utility function to remove duplicates based on _id
  const removeDuplicates = (arr, idField = "_id") => {
    return arr.filter(
      (item, index, self) =>
        index ===
        self.findIndex(
          (t) =>
            t[idField] &&
            item[idField] &&
            t[idField].toString() === item[idField].toString()
        )
    );
  };

  // Handle fields that should be added to set (array fields)
  fieldsToAddToSet.forEach((field) => {
    if (update[field]) {
      const processedArray = Array.isArray(update[field])
        ? update[field]
        : [update[field]];

      // Remove duplicates for specific fields
      const uniqueArray = removeDuplicates(processedArray);
      update["$set"] = update["$set"] || {};
      update["$set"][field] = uniqueArray;
      delete update[field];
    }
  });

  // Handle fields that need special processing (with createdAt)
  fieldsToUpdate.forEach((field) => {
    if (update[field]) {
      // Process each item
      const processedArray = update[field].map((item) => ({
        ...item,
        createdAt: item.createdAt || new Date(),
      }));

      // Remove duplicates for specific fields
      const uniqueArray = removeDuplicates(processedArray);

      update["$set"] = update["$set"] || {};
      update["$set"][field] = uniqueArray;
      delete update[field];
    }
  });

  // Process single ObjectId fields
  const singleObjectIdFields = ["user_id", "group_id"];
  singleObjectIdFields.forEach((field) => {
    if (update[field]) {
      // Ensure single ObjectId fields are processed as-is
      update[field] = update[field];
    }
  });

  return update;
};

const handleDefaultGroup = async (tenant, body, next) => {
  if (!body.group_id) {
    const defaultGroupId = constants.DEFAULT_GROUP;
    if (!defaultGroupId) {
      return handleError(
        next,
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        "DEFAULT_GROUP constant is not defined"
      );
    }
    try {
      const defaultGroupExists = await GroupModel(tenant).exists({
        _id: defaultGroupId,
      });
      if (!defaultGroupExists) {
        return handleError(
          next,
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          "The default group does not exist"
        );
      }
      body.group_id = defaultGroupId;
    } catch (error) {
      return handleError(
        next,
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        `Error checking default group: ${error.message}`
      );
    }
  }
};

// Define allowed properties for chart updates
const allowedChartProperties = [
  "fieldId",
  "title",
  "xAxisLabel",
  "yAxisLabel",
  "color",
  "backgroundColor",
  "chartType",
  "days",
  "results",
  "timescale",
  "average",
  "median",
  "sum",
  "rounding",
  "dataMin",
  "dataMax",
  "yAxisMin",
  "yAxisMax",
  "showLegend",
  "showGrid",
  "showTooltip",
  "referenceLines",
  "annotations",
  "transformation",
  "comparisonPeriod",
  "showMultipleSeries",
  "additionalSeries",
  "isPublic",
  "refreshInterval",
];

const preferences = {
  list: async (request, next) => {
    try {
      const {
        query: { tenant },
      } = request;
      const filter = generateFilter.preferences(request, next);
      const { limit, skip } = request.query;
      const listResponse = await PreferenceModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      return listResponse;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  create: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      logObject("the body", body);

      // Validate user and group
      await validateUserAndGroup(tenant, body.user_id, body.group_id, next);

      const filterResponse = generateFilter.preferences(request, next);
      if (isEmpty(filterResponse) || isEmpty(filterResponse.user_id)) {
        return handleError(
          next,
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          "Unable to obtain the corresponding identifier associated with this preference --- please reach out to support@airqo.net"
        );
      }

      // Check if a preference already exists for this user and group
      const existingPreference = await PreferenceModel(tenant).findOne(
        filterResponse
      );
      if (existingPreference) {
        return handleError(
          next,
          "Conflict",
          httpStatus.CONFLICT,
          "Preferences for this user and group already exist"
        );
      }

      await handleDefaultGroup(tenant, body, next);

      const responseFromRegisterPreference = await PreferenceModel(
        tenant
      ).register(body, next);
      logObject(
        "responseFromRegisterPreference in UTILS",
        responseFromRegisterPreference
      );

      return responseFromRegisterPreference;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  update: async (request, next) => {
    try {
      const {
        query: { tenant },
        body,
      } = request;

      // Validate user and group
      await validateUserAndGroup(tenant, body.user_id, body.group_id, next);

      const fieldsToUpdate = [
        "selected_sites",
        "selected_grids",
        "selected_cohorts",
        "selected_devices",
        "selected_airqlouds",
      ];

      const fieldsToAddToSet = [
        "airqloud_ids",
        "device_ids",
        "cohort_ids",
        "grid_ids",
        "site_ids",
        "network_ids",
        "group_ids",
      ];

      const filter = generateFilter.preferences(request, next);
      if (isEmpty(filter) || isEmpty(filter.user_id)) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Unable to obtain the corresponding identifier associated with this preference --- please reach out to support@airqo.net",
            }
          )
        );
      }

      await handleDefaultGroup(tenant, body, next);

      const update = prepareUpdate(body, fieldsToUpdate, fieldsToAddToSet);

      const modifyResponse = await PreferenceModel(tenant).modify(
        {
          filter,
          update,
        },
        next
      );

      return modifyResponse;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  upsert: async (request, next) => {
    try {
      const {
        query: { tenant },
        body,
      } = request;

      // Validate user and group
      const validationError = await validateUserAndGroup(
        tenant,
        body.user_id,
        body.group_id,
        next
      );
      if (validationError) return;

      const fieldsToUpdate = [
        "selected_sites",
        "selected_grids",
        "selected_cohorts",
        "selected_devices",
        "selected_airqlouds",
      ];

      const fieldsToAddToSet = [
        "airqloud_ids",
        "device_ids",
        "cohort_ids",
        "grid_ids",
        "site_ids",
        "network_ids",
        "group_ids",
      ];

      const filterResponse = generateFilter.preferences(request, next);
      if (isEmpty(filterResponse) || isEmpty(filterResponse.user_id)) {
        return handleError(
          next,
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          "Unable to obtain the corresponding identifier associated with this preference --- please reach out to support@airqo.net"
        );
      }

      await handleDefaultGroup(tenant, body, next);
      const update = prepareUpdate(body, fieldsToUpdate, fieldsToAddToSet);

      const options = { upsert: true, new: true };
      const modifyResponse = await PreferenceModel(tenant).findOneAndUpdate(
        filterResponse,
        update,
        options
      );

      if (!isEmpty(modifyResponse)) {
        return {
          success: true,
          message: "Successfully created or updated a preference",
          data: modifyResponse,
          status: httpStatus.OK,
        };
      } else {
        return handleError(
          next,
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          "Unable to create or update a preference"
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  replace: async (request, next) => {
    try {
      const {
        query: { tenant },
        body,
      } = request;

      // Validate user and group
      const validationError = await validateUserAndGroup(
        tenant,
        body.user_id,
        body.group_id,
        next
      );
      if (validationError) return;

      const fieldsToUpdate = [
        "selected_sites",
        "selected_grids",
        "selected_cohorts",
        "selected_devices",
        "selected_airqlouds",
      ];

      const fieldsToAddToSet = [
        "airqloud_ids",
        "device_ids",
        "cohort_ids",
        "grid_ids",
        "site_ids",
        "network_ids",
        "group_ids",
      ];

      logText("Replace the existing selected_ids....");

      const filterResponse = generateFilter.preferences(request, next);
      if (isEmpty(filterResponse) || isEmpty(filterResponse.user_id)) {
        return {
          success: false,
          message: "Internal Server Error",
          errors: {
            message:
              "Unable to obtain the corresponding identifier associated with this preference --- please reach out to support@airqo.net",
          },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      await handleDefaultGroup(tenant, body, next);

      const update = prepareUpdate(body, fieldsToUpdate, fieldsToAddToSet);

      const options = { upsert: true, new: true };

      const modifyResponse = await PreferenceModel(tenant).findOneAndUpdate(
        filterResponse,
        update,
        options
      );

      if (!isEmpty(modifyResponse)) {
        return {
          success: true,
          message: "successfully created or updated a preference",
          data: modifyResponse,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: "unable to create or update a preference" }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  delete: async (request, next) => {
    try {
      return {
        success: false,
        message: "Service Temporarily Unavailable",
        errors: {
          message: "Service Temporarily Unavailable",
        },
        status: httpStatus.SERVICE_UNAVAILABLE,
      };
      const {
        query: { tenant },
        body,
      } = request;

      const filterResponse = generateFilter.preferences(request, next);
      if (isEmpty(filterResponse) || isEmpty(filterResponse.user_id)) {
        return {
          success: false,
          message: "Internal Server Error",
          errors: {
            message:
              "Unable to obtain the corresponding identifier associated with this preference --- please reach out to support@airqo.net",
          },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      const PreferenceDetails = await PreferenceModel(tenant)
        .findOne(filterResponse)
        .select("_id")
        .lean();

      if (isEmpty(PreferenceDetails)) {
        next(
          new HttpError("Bad Request Errors", httpStatus.BAD_REQUEST, {
            message: `No existing preferences for the provided User ID: ${filterResponse.user_id.toString()}`,
          })
        );
      }

      const filter = PreferenceDetails;
      const responseFromRemovePreference = await PreferenceModel(tenant).remove(
        {
          filter,
        },
        next
      );
      return responseFromRemovePreference;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  addSelectedSites: async (request, next) => {
    try {
      const { tenant, selected_sites } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      const result = await SelectedSiteModel(tenant).insertMany(
        selected_sites,
        {
          ordered: false,
        }
      );

      const successCount = result.length;
      const failureCount = selected_sites.length - successCount;

      return {
        success: true,
        message: `Successfully added ${successCount} selected sites. ${failureCount} failed.`,
        data: result,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      if (error.code === 11000) {
        // Handle duplicate key errors
        return next(
          new HttpError("Conflict", httpStatus.CONFLICT, {
            message: "One or more selected sites already exist.",
            details: error.writeErrors || error.message,
          })
        );
      }
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  updateSelectedSite: async (request, next) => {
    try {
      const { query, params, body } = request;
      const { tenant, site_id } = { ...query, ...params };
      const filter = { site_id };
      const update = body;
      const modifyResponse = await SelectedSiteModel(tenant).modify(
        {
          filter,
          update,
        },
        next
      );
      return modifyResponse;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deleteSelectedSite: async (request, next) => {
    try {
      return {
        success: false,
        message: "Service Temporarily Unavailable",
        errors: {
          message: "Service Temporarily Unavailable",
        },
        status: httpStatus.SERVICE_UNAVAILABLE,
      };
      const { query, params, body } = request;
      const { tenant, site_id } = { ...query, ...params };
      const filter = { site_id };
      const responseFromRemoveSelectedSite = await SelectedSiteModel(
        tenant
      ).remove(
        {
          filter,
        },
        next
      );
      return responseFromRemoveSelectedSite;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listSelectedSites: async (request, next) => {
    try {
      const {
        query: { tenant, site_id, limit, skip },
      } = request;
      const filter = generateFilter.selected_sites(request, next);
      const listResponse = await SelectedSiteModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      return listResponse;
    } catch (error) {
      logObject("error", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  getMostRecent: async (request, next) => {
    try {
      const {
        query: { tenant },
        params: { user_id },
      } = request;

      const mostRecentPreference = await PreferenceModel(tenant)
        .find({ user_id: user_id })
        .sort({ lastAccessed: -1 }) // Sort by lastAccessed descending
        .limit(1) // Limit to one result
        .lean()
        .exec();

      if (!isEmpty(mostRecentPreference)) {
        // Update lastAccessed timestamp for the retrieved preference
        await PreferenceModel(tenant).findByIdAndUpdate(
          mostRecentPreference[0]._id,
          { lastAccessed: new Date() }
        );

        return {
          success: true,
          data: mostRecentPreference[0], // Return the single preference object
          message:
            "Successfully retrieved the most recently accessed preference",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No preferences found for this user",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listAll: async (request, next) => {
    try {
      const {
        query: { tenant },
        params: { user_id },
      } = request;

      // Validate that the user exists
      const userExists = await UserModel(tenant).exists({ _id: user_id });
      if (!userExists) {
        return handleError(
          next,
          "Bad Request Error",
          httpStatus.BAD_REQUEST,
          "The provided User does not exist"
        );
      }

      const allPreferences = await PreferenceModel(tenant)
        .find({ user_id })
        .sort({ lastAccessed: -1 })
        .lean()
        .exec();

      // Update lastAccessed timestamps
      if (!isEmpty(allPreferences)) {
        // Get all preference IDs
        const preferenceIds = allPreferences.map((pref) => pref._id);

        // Use updateMany for better performance
        await PreferenceModel(tenant).updateMany(
          { _id: { $in: preferenceIds } },
          { lastAccessed: new Date() }
        );
      }

      return {
        success: true,
        data: allPreferences,
        message: "Successfully retrieved all preferences for the user",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  createChart: async (request, next) => {
    try {
      const { tenant, deviceId, chartConfig } = request.body;
      const userId = request.user._id; // Assuming JWT authentication

      // Basic validation
      if (!chartConfig || !chartConfig.fieldId) {
        return {
          success: false,
          message: "Chart configuration must include a field ID",
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Find preference record - look for a device in device_ids array
      const preference = await PreferenceModel(tenant).findOne({
        user_id: userId,
        device_ids: { $in: [deviceId] },
      });

      if (!preference) {
        // If preference doesn't exist, create a new one
        const newPreference = {
          user_id: userId,
          device_ids: [deviceId],
          chartConfigurations: [chartConfig],
          period: {
            value: "Last 7 days",
            label: "Last 7 days",
            unitValue: 7,
            unit: "day",
          },
        };

        const result = await PreferenceModel(tenant).register(
          newPreference,
          next
        );
        return result;
      }

      // Add the new chart to existing preference
      preference.chartConfigurations.push(chartConfig);
      await preference.save();

      return {
        success: true,
        message: "Chart configuration created successfully",
        data: preference.chartConfigurations[
          preference.chartConfigurations.length - 1
        ],
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Error creating chart: ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  updateChart: async (request, next) => {
    try {
      const { tenant } = request.body;
      const { deviceId, chartId } = request.params;
      const updates = request.body;
      const userId = request.user._id;

      // Find preference record
      const preference = await PreferenceModel(tenant).findOne({
        user_id: userId,
        device_ids: { $in: [deviceId] },
      });

      if (!preference) {
        return {
          success: false,
          message: "Preference not found for this device",
          status: httpStatus.NOT_FOUND,
        };
      }

      // Find the chart in the chartConfigurations array
      const chartIndex = preference.chartConfigurations.findIndex(
        (chart) => chart._id.toString() === chartId
      );

      if (chartIndex === -1) {
        return {
          success: false,
          message: "Chart configuration not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      // Update allowed properties
      Object.keys(updates)
        .filter((key) => allowedChartProperties.includes(key))
        .forEach((key) => {
          preference.chartConfigurations[chartIndex][key] = updates[key];
        });

      await preference.save();

      return {
        success: true,
        message: "Chart configuration updated successfully",
        data: preference.chartConfigurations[chartIndex],
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Error updating chart: ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  deleteChart: async (request, next) => {
    try {
      const { tenant } = request.body;
      const { deviceId, chartId } = request.params;
      const userId = request.user._id;

      // Find preference record
      const preference = await PreferenceModel(tenant).findOne({
        user_id: userId,
        device_ids: { $in: [deviceId] },
      });

      if (!preference) {
        return {
          success: false,
          message: "Preference not found for this device",
          status: httpStatus.NOT_FOUND,
        };
      }

      // Find the chart in the chartConfigurations array
      const chartIndex = preference.chartConfigurations.findIndex(
        (chart) => chart._id.toString() === chartId
      );

      if (chartIndex === -1) {
        return {
          success: false,
          message: "Chart configuration not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      // Remove the chart
      preference.chartConfigurations.splice(chartIndex, 1);
      await preference.save();

      return {
        success: true,
        message: "Chart configuration deleted successfully",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Error deleting chart: ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  getChartConfigurations: async (request, next) => {
    try {
      const { tenant } = request.query || {};
      const { deviceId } = request.params;
      const userId = request.user._id;

      // Find preference record
      const preference = await PreferenceModel(tenant).findOne({
        user_id: userId,
        device_ids: { $in: [deviceId] },
      });

      if (!preference) {
        return {
          success: true,
          message: "No chart configurations found for this device",
          data: [],
          status: httpStatus.OK,
        };
      }

      return {
        success: true,
        message: "Chart configurations retrieved successfully",
        data: preference.chartConfigurations || [],
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Error retrieving chart configurations: ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  getChartConfigurationById: async (request, next) => {
    try {
      const { tenant } = request.query || {};
      const { deviceId, chartId } = request.params;
      const userId = request.user._id;

      // Find preference record
      const preference = await PreferenceModel(tenant).findOne({
        user_id: userId,
        device_ids: { $in: [deviceId] },
      });

      if (!preference) {
        return {
          success: false,
          message: "Preference not found for this device",
          status: httpStatus.NOT_FOUND,
        };
      }

      // Find the chart in the chartConfigurations array
      const chart = preference.chartConfigurations.find(
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
      logger.error(`Error retrieving chart configuration: ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  copyChartConfiguration: async (request, next) => {
    try {
      const { tenant } = request.body;
      const { deviceId, chartId } = request.params;
      const userId = request.user._id;

      // Find preference record
      const preference = await PreferenceModel(tenant).findOne({
        user_id: userId,
        device_ids: { $in: [deviceId] },
      });

      if (!preference) {
        return {
          success: false,
          message: "Preference not found for this device",
          status: httpStatus.NOT_FOUND,
        };
      }

      // Find the chart in the chartConfigurations array
      const sourceChart = preference.chartConfigurations.find(
        (chart) => chart._id.toString() === chartId
      );

      if (!sourceChart) {
        return {
          success: false,
          message: "Chart configuration not found",
          status: httpStatus.NOT_FOUND,
        };
      }

      // Create a copy of the chart (excluding _id so a new one is generated)
      const chartCopy = { ...sourceChart.toObject() };
      delete chartCopy._id;
      chartCopy.title = `${chartCopy.title} (Copy)`;

      // Add the new chart to the preference
      preference.chartConfigurations.push(chartCopy);
      await preference.save();

      return {
        success: true,
        message: "Chart configuration copied successfully",
        data: preference.chartConfigurations[
          preference.chartConfigurations.length - 1
        ],
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Error copying chart configuration: ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  // ===========================================
  // INDIVIDUAL USER THEME UTILITIES
  // ===========================================

  // Personal theme (stored in User model)
  getUserPersonalTheme: async (request, next) => {
    try {
      const { user_id } = request.params;
      const { tenant } = request.query;

      const user = await UserModel(tenant)
        .findById(user_id)
        .select("theme firstName lastName email");
      if (!user) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "User not found",
          })
        );
      }

      return {
        success: true,
        data: user.theme || getDefaultTheme(),
        source: user.theme ? "user_personal" : "default",
        message: user.theme
          ? "Personal theme retrieved successfully"
          : "No personal theme set, returning default",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updateUserPersonalTheme: async (request, next) => {
    try {
      const { body, params, query } = request;
      const { user_id } = params;
      const { tenant } = query;
      const { theme } = body;

      // Validate user exists
      const user = await UserModel(tenant).findById(user_id);
      if (!user) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "User not found",
          })
        );
      }

      // Validate theme object
      if (!theme || typeof theme !== "object") {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Valid theme object is required",
          })
        );
      }

      // Update user personal theme
      const updatedUser = await UserModel(tenant).findByIdAndUpdate(
        user_id,
        { theme },
        { new: true, runValidators: true }
      );

      return {
        success: true,
        data: updatedUser.theme,
        message: "Personal theme updated successfully",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // User theme within group context (stored in Preference model)
  getUserGroupTheme: async (request, next) => {
    try {
      const { user_id, group_id } = request.params;
      const { tenant } = request.query;

      // Validate user exists and belongs to group
      const user = await UserModel(tenant)
        .findById(user_id)
        .select("group_roles");
      if (!user) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "User not found",
          })
        );
      }

      // Check if user belongs to the group
      const userBelongsToGroup =
        user.group_roles &&
        user.group_roles.some(
          (role) => role.group && role.group.toString() === group_id.toString()
        );

      if (!userBelongsToGroup) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "User does not belong to this group",
          })
        );
      }

      // Look for preference with this user_id and group_id
      const preference = await PreferenceModel(tenant)
        .findOne({
          user_id: user_id,
          group_id: group_id,
        })
        .select("theme");

      return {
        success: true,
        data: preference?.theme || getDefaultTheme(),
        source: preference?.theme ? "user_group_context" : "default",
        message: preference?.theme
          ? "Group-scoped theme retrieved successfully"
          : "No group-scoped theme set, returning default",
        groupId: group_id,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updateUserGroupTheme: async (request, next) => {
    try {
      const { body, params, query } = request;
      const { user_id, group_id } = params;
      const { tenant } = query;
      const { theme } = body;

      // Validate user exists and belongs to group
      const user = await UserModel(tenant)
        .findById(user_id)
        .select("group_roles");
      if (!user) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "User not found",
          })
        );
      }

      // Check if user belongs to the group
      const userBelongsToGroup =
        user.group_roles &&
        user.group_roles.some(
          (role) => role.group && role.group.toString() === group_id.toString()
        );

      if (!userBelongsToGroup) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "User does not belong to this group",
          })
        );
      }

      // Validate theme object
      if (!theme || typeof theme !== "object") {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Valid theme object is required",
          })
        );
      }

      // Update or create preference with group-scoped theme
      const preference = await PreferenceModel(tenant).findOneAndUpdate(
        { user_id: user_id, group_id: group_id },
        { theme, user_id, group_id },
        { new: true, upsert: true, runValidators: true }
      );

      return {
        success: true,
        data: preference.theme,
        message: "Group-scoped theme updated successfully",
        groupId: group_id,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // User theme within network context
  getUserNetworkTheme: async (request, next) => {
    try {
      const { user_id, network_id } = request.params;
      const { tenant } = request.query;

      // Validate user exists and belongs to network
      const user = await UserModel(tenant)
        .findById(user_id)
        .select("network_roles");
      if (!user) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "User not found",
          })
        );
      }

      // Check if user belongs to the network
      const userBelongsToNetwork =
        user.network_roles &&
        user.network_roles.some(
          (role) =>
            role.network && role.network.toString() === network_id.toString()
        );

      if (!userBelongsToNetwork) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "User does not belong to this network",
          })
        );
      }

      // Look for preference with this user_id and network in network_ids
      const preference = await PreferenceModel(tenant)
        .findOne({
          user_id: user_id,
          network_ids: { $in: [network_id] },
        })
        .select("theme");

      return {
        success: true,
        data: preference?.theme || getDefaultTheme(),
        source: preference?.theme ? "user_network_context" : "default",
        message: preference?.theme
          ? "Network-scoped theme retrieved successfully"
          : "No network-scoped theme set, returning default",
        networkId: network_id,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updateUserNetworkTheme: async (request, next) => {
    try {
      const { body, params, query } = request;
      const { user_id, network_id } = params;
      const { tenant } = query;
      const { theme } = body;

      // Validate user exists and belongs to network
      const user = await UserModel(tenant)
        .findById(user_id)
        .select("network_roles");
      if (!user) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "User not found",
          })
        );
      }

      // Check if user belongs to the network
      const userBelongsToNetwork =
        user.network_roles &&
        user.network_roles.some(
          (role) =>
            role.network && role.network.toString() === network_id.toString()
        );

      if (!userBelongsToNetwork) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "User does not belong to this network",
          })
        );
      }

      // Validate theme object
      if (!theme || typeof theme !== "object") {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Valid theme object is required",
          })
        );
      }

      // Update or create preference with network-scoped theme
      const preference = await PreferenceModel(tenant).findOneAndUpdate(
        { user_id: user_id, network_ids: { $in: [network_id] } },
        {
          theme,
          user_id,
          $addToSet: { network_ids: network_id },
        },
        { new: true, upsert: true, runValidators: true }
      );

      return {
        success: true,
        data: preference.theme,
        message: "Network-scoped theme updated successfully",
        networkId: network_id,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // ===========================================
  // ORGANIZATION THEME UTILITIES
  // ===========================================

  getGroupTheme: async (request, next) => {
    try {
      const { group_id } = request.params;
      const { tenant } = request.query;

      const group = await GroupModel(tenant)
        .findById(group_id)
        .select("theme grp_title");
      if (!group) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Group not found",
          })
        );
      }

      return {
        success: true,
        data: group.theme || getDefaultTheme(),
        source: group.theme ? "group_organization" : "default",
        message: group.theme
          ? "Group theme retrieved successfully"
          : "No group theme set, returning default",
        groupId: group._id,
        groupTitle: group.grp_title,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updateGroupTheme: async (request, next) => {
    try {
      const { body, params, query } = request;
      const { group_id } = params;
      const { tenant } = query;
      const { theme } = body;
      const userId = request.user ? request.user._id : null;

      // Validate group exists
      const group = await GroupModel(tenant).findById(group_id);
      if (!group) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Group not found",
          })
        );
      }

      // If user context is available, validate user belongs to the group and has appropriate permissions
      if (userId) {
        const user = await UserModel(tenant)
          .findById(userId)
          .select("group_roles");
        if (user) {
          const userGroupRole =
            user.group_roles &&
            user.group_roles.find(
              (role) =>
                role.group && role.group.toString() === group_id.toString()
            );

          if (!userGroupRole) {
            return next(
              new HttpError("Forbidden", httpStatus.FORBIDDEN, {
                message:
                  "User does not belong to this group and cannot update its theme",
              })
            );
          }

          // Check if user has admin privileges (optional additional check)
          const isAdmin =
            userGroupRole.userType === "admin" ||
            userGroupRole.userType === "super_admin";
          if (!isAdmin) {
            return next(
              new HttpError("Forbidden", httpStatus.FORBIDDEN, {
                message: "Only group administrators can update group themes",
              })
            );
          }
        }
      }

      // Validate theme object
      if (!theme || typeof theme !== "object") {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Valid theme object is required",
          })
        );
      }

      // Update group theme
      const updatedGroup = await GroupModel(tenant).findByIdAndUpdate(
        group_id,
        { theme },
        { new: true, runValidators: true }
      );

      return {
        success: true,
        data: updatedGroup.theme,
        message: "Group theme updated successfully",
        groupId: updatedGroup._id,
        groupTitle: updatedGroup.grp_title,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getNetworkTheme: async (request, next) => {
    try {
      const { network_id } = request.params;
      const { tenant } = request.query;

      const network = await NetworkModel(tenant)
        .findById(network_id)
        .select("theme net_name");
      if (!network) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Network not found",
          })
        );
      }

      return {
        success: true,
        data: network.theme || getDefaultTheme(),
        source: network.theme ? "network_organization" : "default",
        message: network.theme
          ? "Network theme retrieved successfully"
          : "No network theme set, returning default",
        networkId: network._id,
        networkName: network.net_name,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updateNetworkTheme: async (request, next) => {
    try {
      const { body, params, query } = request;
      const { network_id } = params;
      const { tenant } = query;
      const { theme } = body;
      const userId = request.user ? request.user._id : null;

      // Validate network exists
      const network = await NetworkModel(tenant).findById(network_id);
      if (!network) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Network not found",
          })
        );
      }

      // If user context is available, validate user belongs to the network and has appropriate permissions
      if (userId) {
        const user = await UserModel(tenant)
          .findById(userId)
          .select("network_roles");
        if (user) {
          const userNetworkRole =
            user.network_roles &&
            user.network_roles.find(
              (role) =>
                role.network &&
                role.network.toString() === network_id.toString()
            );

          if (!userNetworkRole) {
            return next(
              new HttpError("Forbidden", httpStatus.FORBIDDEN, {
                message:
                  "User does not belong to this network and cannot update its theme",
              })
            );
          }

          // Check if user has admin privileges (optional additional check)
          const isAdmin =
            userNetworkRole.userType === "admin" ||
            userNetworkRole.userType === "super_admin";
          if (!isAdmin) {
            return next(
              new HttpError("Forbidden", httpStatus.FORBIDDEN, {
                message:
                  "Only network administrators can update network themes",
              })
            );
          }
        }
      }

      // Validate theme object
      if (!theme || typeof theme !== "object") {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Valid theme object is required",
          })
        );
      }

      // Update network theme
      const updatedNetwork = await NetworkModel(tenant).findByIdAndUpdate(
        network_id,
        { theme },
        { new: true, runValidators: true }
      );

      return {
        success: true,
        data: updatedNetwork.theme,
        message: "Network theme updated successfully",
        networkId: updatedNetwork._id,
        networkName: updatedNetwork.net_name,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  getEffectiveTheme: async (request, next) => {
    try {
      const { user_id } = request.params;
      const { tenant, group_id, network_id } = request.query;

      // Get user with their group roles and network associations
      const user = await UserModel(tenant)
        .findById(user_id)
        .select("theme group_roles network_roles")
        .lean();

      if (!user) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "User not found",
          })
        );
      }

      // 1. User personal theme (highest priority)
      if (hasValidTheme(user.theme)) {
        return {
          success: true,
          data: mergeWithDefaults(user.theme),
          source: "user_personal",
          message: "User personal theme retrieved successfully",
          status: httpStatus.OK,
        };
      }

      // 2. User group-scoped theme (if group_id provided and user belongs to group)
      if (group_id) {
        // Validate user belongs to the specified group
        const userBelongsToGroup =
          user.group_roles &&
          user.group_roles.some(
            (role) =>
              role.group && role.group.toString() === group_id.toString()
          );

        if (!userBelongsToGroup) {
          return next(
            new HttpError("Forbidden", httpStatus.FORBIDDEN, {
              message: "User does not belong to the specified group",
            })
          );
        }

        // Check for user's group-scoped theme
        const userGroupPreference = await PreferenceModel(tenant)
          .findOne({
            user_id: user_id,
            group_id: group_id,
          })
          .select("theme")
          .lean();

        if (userGroupPreference && hasValidTheme(userGroupPreference.theme)) {
          return {
            success: true,
            data: mergeWithDefaults(userGroupPreference.theme),
            source: "user_group_context",
            groupId: group_id,
            message: "User group-scoped theme retrieved successfully",
            status: httpStatus.OK,
          };
        }
      }

      // 3. User network-scoped theme (if network_id provided and user belongs to network)
      if (network_id) {
        // Validate user belongs to the specified network
        const userBelongsToNetwork =
          user.network_roles &&
          user.network_roles.some(
            (role) =>
              role.network && role.network.toString() === network_id.toString()
          );

        if (!userBelongsToNetwork) {
          return next(
            new HttpError("Forbidden", httpStatus.FORBIDDEN, {
              message: "User does not belong to the specified network",
            })
          );
        }

        // Check for user's network-scoped theme
        const userNetworkPreference = await PreferenceModel(tenant)
          .findOne({
            user_id: user_id,
            network_ids: { $in: [network_id] },
          })
          .select("theme")
          .lean();

        if (
          userNetworkPreference &&
          hasValidTheme(userNetworkPreference.theme)
        ) {
          return {
            success: true,
            data: mergeWithDefaults(userNetworkPreference.theme),
            source: "user_network_context",
            networkId: network_id,
            message: "User network-scoped theme retrieved successfully",
            status: httpStatus.OK,
          };
        }
      }

      // 4. Group organization theme (if group_id provided and user belongs to group)
      if (group_id) {
        const groupExists = await GroupModel(tenant)
          .findById(group_id)
          .select("_id grp_title theme")
          .lean();

        if (groupExists && hasValidTheme(groupExists.theme)) {
          return {
            success: true,
            data: mergeWithDefaults(groupExists.theme),
            source: "group_organization",
            groupId: groupExists._id,
            groupTitle: groupExists.grp_title,
            message: `Group organization theme retrieved successfully for group: ${groupExists.grp_title}`,
            status: httpStatus.OK,
          };
        }
      }

      // 5. Network organization theme (if network_id provided and user belongs to network)
      if (network_id) {
        const networkExists = await NetworkModel(tenant)
          .findById(network_id)
          .select("_id net_name theme")
          .lean();

        if (networkExists && hasValidTheme(networkExists.theme)) {
          return {
            success: true,
            data: mergeWithDefaults(networkExists.theme),
            source: "network_organization",
            networkId: networkExists._id,
            networkName: networkExists.net_name,
            message: `Network organization theme retrieved successfully for network: ${networkExists.net_name}`,
            status: httpStatus.OK,
          };
        }
      }

      // 6. User's primary group theme (no specific group_id provided)
      if (!group_id && user.group_roles && user.group_roles.length > 0) {
        // Get the primary group (first one or default group)
        let primaryGroupRole =
          user.group_roles.find(
            (role) =>
              role.group && role.group.toString() === constants.DEFAULT_GROUP
          ) || user.group_roles[0];

        if (primaryGroupRole) {
          // Check for user's primary group-scoped theme first
          const userPrimaryGroupPreference = await PreferenceModel(tenant)
            .findOne({
              user_id: user_id,
              group_id: primaryGroupRole.group,
            })
            .select("theme")
            .lean();

          if (
            userPrimaryGroupPreference &&
            hasValidTheme(userPrimaryGroupPreference.theme)
          ) {
            return {
              success: true,
              data: mergeWithDefaults(userPrimaryGroupPreference.theme),
              source: "user_primary_group_context",
              groupId: primaryGroupRole.group,
              message: "User primary group-scoped theme retrieved successfully",
              status: httpStatus.OK,
            };
          }

          // Then check for primary group organization theme
          const primaryGroup = await GroupModel(tenant)
            .findById(primaryGroupRole.group)
            .select("theme grp_title")
            .lean();

          if (primaryGroup && hasValidTheme(primaryGroup.theme)) {
            return {
              success: true,
              data: mergeWithDefaults(primaryGroup.theme),
              source: "primary_group_organization",
              groupId: primaryGroup._id,
              groupTitle: primaryGroup.grp_title,
              message:
                "Primary group organization theme retrieved successfully",
              status: httpStatus.OK,
            };
          }
        }
      }

      // 7. User's primary network theme (no specific network_id provided)
      if (!network_id && user.network_roles && user.network_roles.length > 0) {
        // Get the primary network (first one or default network)
        let primaryNetworkRole =
          user.network_roles.find(
            (role) =>
              role.network &&
              role.network.toString() === constants.DEFAULT_NETWORK
          ) || user.network_roles[0];

        if (primaryNetworkRole) {
          // Check for user's primary network-scoped theme first
          const userPrimaryNetworkPreference = await PreferenceModel(tenant)
            .findOne({
              user_id: user_id,
              network_ids: { $in: [primaryNetworkRole.network] },
            })
            .select("theme")
            .lean();

          if (
            userPrimaryNetworkPreference &&
            hasValidTheme(userPrimaryNetworkPreference.theme)
          ) {
            return {
              success: true,
              data: mergeWithDefaults(userPrimaryNetworkPreference.theme),
              source: "user_primary_network_context",
              networkId: primaryNetworkRole.network,
              message:
                "User primary network-scoped theme retrieved successfully",
              status: httpStatus.OK,
            };
          }

          // Then check for primary network organization theme
          const primaryNetwork = await NetworkModel(tenant)
            .findById(primaryNetworkRole.network)
            .select("theme net_name")
            .lean();

          if (primaryNetwork && hasValidTheme(primaryNetwork.theme)) {
            return {
              success: true,
              data: mergeWithDefaults(primaryNetwork.theme),
              source: "primary_network_organization",
              networkId: primaryNetwork._id,
              networkName: primaryNetwork.net_name,
              message:
                "Primary network organization theme retrieved successfully",
              status: httpStatus.OK,
            };
          }
        }
      }

      // 8. Default theme (lowest priority)
      return {
        success: true,
        data: getDefaultTheme(),
        source: "default",
        reason: "no_themes_configured",
        message: "No themes configured at any level. Using default theme.",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = preferences;
