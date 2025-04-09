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

      const preference = await PreferenceModel(tenant).findOne({
        user_id: userId,
        device_id: deviceId,
      });
      if (!preference) {
        return handleError(
          next,
          "Not Found",
          httpStatus.NOT_FOUND,
          "Preference not found"
        );
      }

      preference.chartConfigurations.push(chartConfig);
      await preference.save();

      return { success: true, message: "Chart created", data: chartConfig };
    } catch (error) {
      logger.error(`Error creating chart: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updateChart: async (request, next) => {
    try {
      const { tenant, deviceId, chartId } = request.params;
      const { body: updates } = request;
      const userId = request.user._id; // Assuming JWT authentication

      const preference = await PreferenceModel(tenant).findOne({
        userId,
        deviceId,
      });

      if (!preference) {
        return handleError(
          next,
          "Not Found",
          httpStatus.NOT_FOUND,
          "Preference not found"
        );
      }

      const chartIndex = preference.chartConfigurations.findIndex(
        (chart) => chart._id.toString() === chartId
      );

      if (chartIndex === -1) {
        return handleError(
          next,
          "Not Found",
          httpStatus.NOT_FOUND,
          "Chart configuration not found"
        );
      }

      // Update chart configuration properties
      Object.keys(updates).forEach((key) => {
        preference.chartConfigurations[chartIndex][key] = updates[key];
      });

      await preference.save();

      return {
        success: true,
        message: "Chart configuration updated",
        data: preference.chartConfigurations[chartIndex],
      };
    } catch (error) {
      logger.error(`Error updating chart: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  deleteChart: async (request, next) => {
    try {
      const { tenant, deviceId, chartId } = request.params;
      const userId = request.user._id; // Assuming JWT authentication

      const preference = await PreferenceModel(tenant).findOne({
        userId,
        deviceId,
      });

      if (!preference) {
        return handleError(
          next,
          "Not Found",
          httpStatus.NOT_FOUND,
          "Preference not found"
        );
      }

      const chartIndex = preference.chartConfigurations.findIndex(
        (chart) => chart._id.toString() === chartId
      );

      if (chartIndex === -1) {
        return handleError(
          next,
          "Not Found",
          httpStatus.NOT_FOUND,
          "Chart configuration not found"
        );
      }

      preference.chartConfigurations.splice(chartIndex, 1);
      await preference.save();

      return { success: true, message: "Chart configuration deleted" };
    } catch (error) {
      logger.error(`Error deleting chart: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getChartConfigurations: async (request, next) => {
    try {
      const { tenant, deviceId } = request.params;
      const userId = request.user._id; // Assuming JWT authentication

      const preference = await PreferenceModel(tenant).findOne({
        userId,
        deviceId,
      });

      if (!preference) {
        return handleError(
          next,
          "Not Found",
          httpStatus.NOT_FOUND,
          "Preference not found"
        );
      }

      return {
        success: true,
        message: "Chart configurations retrieved",
        data: preference.chartConfigurations,
      };
    } catch (error) {
      logger.error(`Error retrieving chart configurations: ${error.message}`);
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
