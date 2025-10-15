const PrivacyZoneModel = require("@models/PrivacyZone");
const PreferenceModel = require("@models/Preference");
const LocationDataModel = require("@models/LocationData");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- privacy-zone-util`
);

const privacyZone = {
  /***
   * Privacy Zone CRUD Operations
   */
  createPrivacyZone: async (request, next) => {
    try {
      const { body, query, user } = request;
      const { tenant } = query;
      const { _id } = user;

      const privacyZoneData = {
        ...body,
        userId: _id,
      };
      return await PrivacyZoneModel(tenant).register(privacyZoneData);
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
  listPrivaceZones: async (request, next) => {
    try {
      const { query, user } = request;
      const { tenant } = query;
      const { _id } = user;

      const filter = { userId: _id };
      const { limit, skip } = query;

      return await PrivacyZoneModel(tenant).list({ filter, limit, skip });
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
  updatePrivacyZone: async (request, next) => {
    try {
      const { query, body, params, user } = request;
      const { tenant } = query;
      const { zoneId } = params;
      const { _id } = user;

      const filter = { _id: zoneId, userId: _id };
      const update = body;

      return await PrivacyZoneModel(tenant).modify({ filter, update });
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
  deletePrivacyZone: async (request, next) => {
    // Implementation for deleting a privacy zone
  },
  getLocationPreferences: async (request, next) => {
    try {
      const { query, user } = request;
      const { tenant } = query;
      const { _id } = user;

      const filter = { user_id: _id };

      const userPreference = await PreferenceModel(tenant)
        .findOne(filter)
        .lean();

      let preferences = {};
      if (userPreference && userPreference.locationPreferences) {
        preferences = userPreference.locationPreferences;
      } else {
        // Return default values if no preference is found
        preferences = new userPreference.locationPreferences.toJSON();
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

      const updatedPreference = await PreferenceModel(tenant).findOneAndUpdate(
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
  /***
   * Location Data CRUD Operations
   */
  listLocationData: async (request, next) => {
    try {
      const { query, user } = request;
      const { tenant } = query;
      const { _id } = user;

      const filter = { userId: _id };
      const { limit, skip, startDate, endDate, includeSharedOnly } = query;

      if (startDate) {
        filter.timestamp = { ...filter.timestamp, $gte: new Date(startDate) };
      }
      if (endDate) {
        filter.timestamp = { ...filter.timestamp, $lte: new Date(endDate) };
      }
      if (includeSharedOnly === "true") {
        filter.isSharedWithResearchers = true;
      }

      return await LocationDataModel(tenant).list({ filter, limit, skip });
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
  deleteLocationData: async (request, next) => {
    try {
      const { query, params, user } = request;
      const { tenant } = query;
      const { pointId } = params;
      const { _id } = user;

      const filter = { _id: pointId, userId: _id };

      return await LocationDataModel(tenant).remove({ filter });
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
  deleteRangeLocationData: async (request, next) => {
    try {
      const { query, body, user } = request;
      const { tenant } = query;
      const { startDate, endDate } = body;
      const { _id } = user;

      const filter = {
        userId: _id,
        timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) },
      };

      return await LocationDataModel(tenant).removeMany({ filter });
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
  updateSharing: async (request, next) => {
    // Implementation for updating sharing consent for one or more points
  },
};

module.exports = privacyZone;
