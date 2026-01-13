const PrivacyZoneModel = require("@models/PrivacyZone");
const PreferenceModel = require("@models/Preference");
const LocationDataModel = require("@models/LocationData");
const { HttpError, createSuccessResponse } = require("@utils/shared");
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
  listPrivacyZones: async (request, next) => {
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
      const disallowedFields = new Set([
        "_id",
        "id",
        "userId",
        "user_id",
        "tenant",
        "createdAt",
        "updatedAt",
      ]);
      const cleanUpdate = {};
      for (const [key, value] of Object.entries(body || {})) {
        if (!disallowedFields.has(key)) {
          cleanUpdate[key] = value;
        }
      }
      const update = { $set: cleanUpdate };

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
    try {
      const { query, params, user } = request;
      const { tenant } = query;
      const { zoneId } = params;
      const { _id } = user;

      const filter = { _id: zoneId, userId: _id };

      return await PrivacyZoneModel(tenant).remove({ filter });
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
        // Return default values from the schema
        preferences = {
          trackingEnabled: true,
          trackingPaused: false,
          dataRetentionDays: 90,
          maxHistoryEntries: 10000,
          allowBackgroundTracking: true,
          trackingAccuracy: "high",
        };
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
      const {
        tenant,
        skip: skipValue,
        limit: queryLimit,
        startDate,
        endDate,
        includeSharedOnly,
      } = query;
      const { _id } = user;

      // Parse pagination parameters with defaults
      const skip = parseInt(skipValue, 10) || 0;
      const limit = Math.min(parseInt(queryLimit, 10) || 100, 1000); // Cap at 1000

      // Build filter object
      const filter = { userId: _id };

      // Add date range filters if provided
      if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) {
          filter.timestamp.$gte = new Date(startDate);
        }
        if (endDate) {
          filter.timestamp.$lte = new Date(endDate);
        }
      }

      // Add shared filter if specified
      if (includeSharedOnly === "true") {
        filter.isSharedWithResearchers = true;
      }

      return await LocationDataModel(tenant).list({
        filter,
        skip,
        limit,
      });
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
