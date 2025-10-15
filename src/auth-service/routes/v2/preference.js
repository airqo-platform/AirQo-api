const PreferenceModel = require("@models/Preference");
const { getModelByTenant } = require("@config/database");
const { HttpError, createSuccessResponse } = require("@utils/shared");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- preference-util`);

const preference = {
  getLocationPreferences: async (request, next) => {
    try {
      const { query, user } = request;
      const { tenant } = query;
      const { _id } = user;

      const filter = { user_id: _id };

      const preferenceModel = await getModelByTenant(
        tenant,
        "preference",
        PreferenceModel
      );

      const userPreference = await preferenceModel.findOne(filter).lean();

      let preferences = {};
      if (userPreference && userPreference.locationPreferences) {
        preferences = userPreference.locationPreferences;
      } else {
        // Return default values if no preference is found
        preferences = new preferenceModel().locationPreferences.toJSON();
      }

      return createSuccessResponse("get", preferences, "location preferences");
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

  updateLocationPreferences: async (request, next) => {
    try {
      const { query, body, user } = request;
      const { tenant } = query;
      const { _id } = user;

      const filter = { user_id: _id };
      const update = {
        $set: {
          locationPreferences: body.locationPreferences,
        },
      };
      const options = { new: true, upsert: true };

      const preferenceModel = await getModelByTenant(
        tenant,
        "preference",
        PreferenceModel
      );

      const updatedPreference = await preferenceModel.findOneAndUpdate(
        filter,
        update,
        options
      );

      return createSuccessResponse(
        "update",
        updatedPreference.locationPreferences,
        "location preferences"
      );
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

module.exports = preference;
