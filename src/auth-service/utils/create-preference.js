const PreferenceModel = require("@models/Preference");
const UserModel = require("@models/User");
const { logElement, logText, logObject } = require("./log");
const generateFilter = require("./generate-filter");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- preferences-util`);
const { HttpError } = require("@utils/errors");

const preferences = {
  list: async (request) => {
    try {
      const {
        query: { tenant },
      } = request;
      const filterResponse = generateFilter.preferences(request);
      logObject("filterResponse", filterResponse);
      if (filterResponse.success === false) {
        return filterResponse;
      }

      const { limit, skip } = request.query;
      logObject("limit", limit);
      logObject("skip", skip);

      const filter = filterResponse;

      const listResponse = await PreferenceModel(tenant).list({
        filter,
        limit,
        skip,
      });

      logObject("listResponse", listResponse);
      return listResponse;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
  create: async (request) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      logObject("the body", body);
      const user_id = body.user_id;
      const user = await UserModel(tenant).findById(user_id).lean();
      if (isEmpty(user_id) || isEmpty(user)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: "The provided User does not exist",
            value: user_id,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const responseFromRegisterPreference = await PreferenceModel(
        tenant
      ).register(body);
      logObject(
        "responseFromRegisterPreference in UTILS",
        responseFromRegisterPreference
      );

      return responseFromRegisterPreference;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
  update: async (request) => {
    try {
      const {
        query: { tenant },
        body,
      } = request;

      const filterResponse = generateFilter.preferences(request);
      logObject("filterResponse", filterResponse);

      if (filterResponse.success === false) {
        return filterResponse;
      } else if (isEmpty(filterResponse) || isEmpty(filterResponse.user_id)) {
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message:
              "Unable to obtain the corresponding identifier associated with this preference --- please reach out to support@airqo.net",
          },
        };
      }

      const PreferenceDetails = await PreferenceModel(tenant)
        .findOne(filterResponse)
        .select("_id")
        .lean();

      if (isEmpty(PreferenceDetails)) {
        return {
          success: false,
          message: "Bad Request Errors",
          errors: {
            message: `No existing preferences for the provided User ID: ${filterResponse.user_id.toString()}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const filter = PreferenceDetails;
      const update = body;

      const modifyResponse = await PreferenceModel(tenant).modify({
        filter,
        update,
      });
      logObject("modifyResponse", modifyResponse);

      return modifyResponse;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
  upsert: async (request) => {
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

      const filterResponse = generateFilter.preferences(request);
      logObject("filterResponse", filterResponse);

      if (filterResponse.success === false) {
        return filterResponse;
      } else if (isEmpty(filterResponse) || isEmpty(filterResponse.user_id)) {
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message:
              "Unable to obtain the corresponding identifier associated with this preference --- please reach out to support@airqo.net",
          },
        };
      }

      const PreferenceDetails = await PreferenceModel(tenant)
        .findOne(filterResponse)
        .select("_id")
        .lean();

      logObject("PreferenceDetails", PreferenceDetails);

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
      const filter = PreferenceDetails;
      logObject("filter", filter);
      const options = { upsert: true, new: true };

      const modifyResponse = await PreferenceModel(tenant).findOneAndUpdate(
        filter,
        update,
        options
      );
      logObject("modifyResponse", modifyResponse);

      if (!isEmpty(modifyResponse)) {
        return {
          success: true,
          message: "successfully created or updated a preference",
          data: modifyResponse,
          status: httpStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "unable to create or update a preference",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: "unable to create or update a preference" },
        };
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
  replace: async (request) => {
    try {
      const {
        query: { tenant },
        body,
      } = request;

      logText("Replace the existing selected_ids....");

      const filterResponse = generateFilter.preferences(request);
      logObject("filterResponse", filterResponse);

      if (filterResponse.success === false) {
        return filterResponse;
      } else if (isEmpty(filterResponse) || isEmpty(filterResponse.user_id)) {
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message:
              "Unable to obtain the corresponding identifier associated with this preference --- please reach out to support@airqo.net",
          },
        };
      }

      const PreferenceDetails = await PreferenceModel(tenant)
        .findOne(filterResponse)
        .select("_id")
        .lean();

      const update = body;
      const filter = PreferenceDetails;
      const options = { upsert: true, new: true };

      const modifyResponse = await PreferenceModel(tenant).findOneAndUpdate(
        filter,
        update,
        options
      );
      logObject("modifyResponse", modifyResponse);

      if (!isEmpty(modifyResponse)) {
        return {
          success: true,
          message: "successfully created or updated a preference",
          data: modifyResponse,
          status: httpStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "unable to create or update a preference",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: "unable to create or update a preference" },
        };
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
  delete: async (request) => {
    try {
      const {
        query: { tenant },
        body,
      } = request;

      const filterResponse = generateFilter.preferences(request);
      logObject("filterResponse", filterResponse);
      logObject("the user_id", filterResponse.user_id.toString());

      if (filterResponse.success === false) {
        return filterResponse;
      } else if (isEmpty(filterResponse) || isEmpty(filterResponse.user_id)) {
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message:
              "Unable to obtain the corresponding identifier associated with this preference --- please reach out to support@airqo.net",
          },
        };
      }

      const PreferenceDetails = await PreferenceModel(tenant)
        .findOne(filterResponse)
        .select("_id")
        .lean();

      if (isEmpty(PreferenceDetails)) {
        return {
          success: false,
          message: "Bad Request Errors",
          errors: {
            message: `No existing preferences for the provided User ID: ${filterResponse.user_id.toString()}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      logObject("PreferenceDetails", PreferenceDetails);

      const filter = PreferenceDetails;
      const responseFromRemovePreference = await PreferenceModel(tenant).remove(
        {
          filter,
        }
      );
      return responseFromRemovePreference;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
};

module.exports = preferences;
