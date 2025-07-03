const PreferenceModel = require("@models/Preference");
const UserModel = require("@models/User");
const GroupModel = require("@models/Group");
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
  getTheme: async (request, next) => {
    try {
      const { user_id, group_id } = request.params;
      const { tenant } = request.query;

      // First, try to get user's personal theme
      if (user_id) {
        const user = await UserModel(tenant).findById(user_id).select("theme");
        if (user && user.theme) {
          return {
            success: true,
            data: user.theme,
            message: "User theme retrieved successfully",
            status: httpStatus.OK,
          };
        }
      }

      // If no user theme or user_id not provided, check for organization theme
      if (group_id) {
        const group = await GroupModel(tenant)
          .findById(group_id)
          .select("theme");
        if (group && group.theme) {
          return {
            success: true,
            data: group.theme,
            message: "Organization theme retrieved successfully",
            status: httpStatus.OK,
          };
        }
      }

      // Return default theme if no theme found
      return {
        success: true,
        data: {
          primaryColor: "#1976d2",
          mode: "light",
          interfaceStyle: "default",
          contentLayout: "wide",
        },
        message: "Default theme returned",
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

  updateUserTheme: async (request, next) => {
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

      // Update user theme
      const updatedUser = await UserModel(tenant).findByIdAndUpdate(
        user_id,
        { theme },
        { new: true, runValidators: true }
      );

      return {
        success: true,
        data: updatedUser.theme,
        message: "User theme updated successfully",
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

  updateOrganizationTheme: async (request, next) => {
    try {
      const { body, params, query } = request;
      const { group_id } = params;
      const { tenant } = query;
      const { theme } = body;

      // Validate group exists
      const group = await GroupModel(tenant).findById(group_id);
      if (!group) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Organization not found",
          })
        );
      }

      // Update organization theme
      const updatedGroup = await GroupModel(tenant).findByIdAndUpdate(
        group_id,
        { theme },
        { new: true, runValidators: true }
      );

      return {
        success: true,
        data: updatedGroup.theme,
        message: "Organization theme updated successfully",
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
      const { tenant, group_id } = request.query;

      // Get user with their group roles
      const user = await UserModel(tenant)
        .findById(user_id)
        .select("theme group_roles")
        .lean();

      if (!user) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "User not found",
          })
        );
      }

      // If user has a theme set, return it (user theme always takes precedence)
      if (hasValidTheme(user.theme)) {
        return {
          success: true,
          data: mergeWithDefaults(user.theme),
          source: "user",
          message: "User theme retrieved successfully",
          status: httpStatus.OK,
        };
      }

      // Handle organization theme based on group_id parameter
      if (group_id) {
        // When group_id is explicitly provided, we need to be strict about validation

        // First, check if the group exists in the database
        const groupExists = await GroupModel(tenant)
          .findById(group_id)
          .select("_id grp_title theme")
          .lean();

        if (!groupExists) {
          return next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: `Group with ID ${group_id} does not exist`,
            })
          );
        }

        // Check if user belongs to this specific group
        const userBelongsToGroup = user.group_roles.some(
          (role) => role.group.toString() === group_id.toString()
        );

        if (!userBelongsToGroup) {
          return next(
            new HttpError("Forbidden", httpStatus.FORBIDDEN, {
              message: `User does not belong to group: ${groupExists.grp_title} (${group_id})`,
            })
          );
        }

        // User belongs to the group, get the group's theme
        if (hasValidTheme(groupExists.theme)) {
          return {
            success: true,
            data: mergeWithDefaults(groupExists.theme),
            source: "organization",
            groupId: groupExists._id,
            groupTitle: groupExists.grp_title,
            message: `Organization theme retrieved successfully for group: ${groupExists.grp_title}`,
            status: httpStatus.OK,
          };
        } else {
          // Group exists, user belongs to it, but group has no theme set
          return {
            success: true,
            data: getDefaultTheme(),
            source: "default",
            reason: "group_has_no_theme",
            groupId: groupExists._id,
            groupTitle: groupExists.grp_title,
            message: `Group '${groupExists.grp_title}' has no theme configured. Using default theme.`,
            status: httpStatus.OK,
          };
        }
      }

      // No group_id provided - use existing logic for primary group
      if (user.group_roles && user.group_roles.length > 0) {
        // Get the primary organization (first one)
        const primaryGroupRole = user.group_roles[0];
        const group = await GroupModel(tenant)
          .findById(primaryGroupRole.group)
          .select("theme grp_title")
          .lean();

        if (group && hasValidTheme(group.theme)) {
          return {
            success: true,
            data: mergeWithDefaults(group.theme),
            source: "organization",
            groupId: group._id,
            groupTitle: group.grp_title,
            message:
              "Organization theme retrieved successfully from primary group",
            status: httpStatus.OK,
          };
        }
      }

      // Return default theme - only when no group_id specified and no primary group theme
      return {
        success: true,
        data: getDefaultTheme(),
        source: "default",
        reason:
          user.group_roles && user.group_roles.length > 0
            ? "no_group_theme"
            : "no_groups",
        message:
          user.group_roles && user.group_roles.length > 0
            ? "No organization theme configured. Using default theme."
            : "User not assigned to any groups. Using default theme.",
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
