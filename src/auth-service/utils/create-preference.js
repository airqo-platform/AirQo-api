const PreferenceModel = require("@models/Preference");
const UserModel = require("@models/User");
const SelectedSiteModel = require("@models/SelectedSite");
const { logElement, logText, logObject } = require("./log");
const generateFilter = require("./generate-filter");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- preferences-util`);
const { HttpError } = require("@utils/errors");

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
      const user_id = body.user_id;
      const user = await UserModel(tenant).findById(user_id).lean();
      if (isEmpty(user_id) || isEmpty(user)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "The provided User does not exist",
            value: user_id,
          })
        );
      }

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

      const filterResponse = generateFilter.preferences(request, next);
      if (isEmpty(filterResponse) || isEmpty(filterResponse.user_id)) {
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
      const update = body;

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

      const update = body;

      fieldsToAddToSet.forEach((field) => {
        if (update[field]) {
          update["$addToSet"] = {
            [field]: { $each: update[field] },
          };
          delete update[field];
        }
      });

      fieldsToUpdate.forEach((field) => {
        if (update[field]) {
          update[field] = update[field].map((item) => ({
            ...item,
            createdAt: item.createdAt || new Date(),
          }));
          update["$addToSet"] = {
            [field]: { $each: update[field] },
          };
          delete update[field];
        }
      });

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
  replace: async (request, next) => {
    try {
      const {
        query: { tenant },
        body,
      } = request;

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

      const update = body;
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
};

module.exports = preferences;
