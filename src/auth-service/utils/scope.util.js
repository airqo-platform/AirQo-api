const ScopeModel = require("@models/Scope");
const httpStatus = require("http-status");
const { generateFilter } = require("@utils/common");
const constants = require("@config/constants");
const log4js = require("log4js");
const { logObject, logText, HttpError } = require("@utils/shared");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- scope-util`);

const scope = {
  updateScope: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.scopes(request, next);
      const update = Object.assign({}, body);
      const responseFromUpdateToken = await ScopeModel(
        tenant.toLowerCase()
      ).modify({ filter, update }, next);
      return responseFromUpdateToken;
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
  deleteScope: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.scopes(request, next);
      const responseFromDeleteToken = await ScopeModel(
        tenant.toLowerCase()
      ).remove({ filter }, next);
      return responseFromDeleteToken;
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
  listScope: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;
      const filter = generateFilter.scopes(request, next);
      const responseFromListToken = await ScopeModel(tenant.toLowerCase()).list(
        { skip, limit, filter },
        next
      );
      return responseFromListToken;
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
  createScope: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const { tier } = body;
      if (!tier) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "the subscription tier is required",
          })
        );
      }
      const responseFromCreateToken = await ScopeModel(
        tenant.toLowerCase()
      ).register(body, next);
      return responseFromCreateToken;
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
  createBulkScopes: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const { scopes } = body;

      if (!Array.isArray(scopes) || scopes.length === 0) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "scopes must be a non-empty array of scope objects",
          })
        );
      }

      // Validate that each scope has the required tier
      for (const scope of scopes) {
        if (!scope.tier) {
          return next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "the subscription tier is required for all scopes",
            })
          );
        }
      }

      // Use the bulk operation for better performance
      const ScopeModelInstance = ScopeModel(tenant.toLowerCase());
      const bulkOps = scopes.map((scopeData) => ({
        insertOne: { document: scopeData },
      }));

      const result = await ScopeModelInstance.bulkWrite(bulkOps, {
        ordered: false,
      }).catch((error) => {
        // Handle duplicate key errors separately
        if (error.code === 11000) {
          const duplicateScopes = error.writeErrors
            .filter((err) => err.code === 11000)
            .map((err) => err.errmsg || err.keyValue);

          return {
            success: false,
            message: "Some scopes already exist",
            existingScopes: duplicateScopes,
            insertedCount: error.result?.nInserted || 0,
          };
        }
        throw error; // Re-throw other errors
      });

      // Fetch the created documents
      const createdScopeIds = result.insertedIds
        ? Object.values(result.insertedIds).map((id) => id)
        : [];

      let createdScopes = [];
      if (createdScopeIds.length > 0) {
        createdScopes = await ScopeModelInstance.find({
          _id: { $in: createdScopeIds },
        });
      }

      return {
        success: true,
        message: `Successfully created ${
          result.insertedCount || createdScopes.length
        } scopes`,
        failedCount: result.writeErrors?.length || 0,
        data: createdScopes,
        status: httpStatus.OK,
      };
    } catch (error) {
      logObject("the error", error);
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
  // Add this function to your existing scope.util.js

  /**
   * Initialize default scopes for API subscription tiers
   * @param {string} tenant - Tenant name (default: "airqo")
   * @param {function} next - Express next middleware function
   * @returns {Promise<object>} Success status and message
   */
  initializeDefaultScopes: async (tenant = "airqo", next) => {
    try {
      logger.info("Starting scope initialization...");

      // Define default scopes for Free tier
      const freeScopes = [
        {
          scope: "read:recent_measurements",
          description: "Access to recent measurements (last 24 hours)",
          tier: "Free",
          resource_type: "measurements",
          access_type: "read",
          data_timeframe: "recent",
        },
        {
          scope: "read:devices",
          description: "Access to device metadata",
          tier: "Free",
          resource_type: "devices",
          access_type: "read",
          data_timeframe: "all",
        },
        {
          scope: "read:sites",
          description: "Access to site metadata",
          tier: "Free",
          resource_type: "sites",
          access_type: "read",
          data_timeframe: "all",
        },
        {
          scope: "read:cohorts",
          description: "Access to cohort metadata",
          tier: "Free",
          resource_type: "cohorts",
          access_type: "read",
          data_timeframe: "all",
        },
        {
          scope: "read:grids",
          description: "Access to grid metadata",
          tier: "Free",
          resource_type: "grids",
          access_type: "read",
          data_timeframe: "all",
        },
      ];

      // Define scopes for Standard tier
      const standardScopes = [
        {
          scope: "read:historical_measurements",
          description: "Access to historical measurements",
          tier: "Standard",
          resource_type: "measurements",
          access_type: "read",
          data_timeframe: "historical",
        },
      ];

      // Define scopes for Premium tier
      const premiumScopes = [
        {
          scope: "read:forecasts",
          description: "Access to air quality forecasts",
          tier: "Premium",
          resource_type: "forecasts",
          access_type: "read",
          data_timeframe: "all",
        },
        {
          scope: "read:insights",
          description: "Access to air quality insights and analytics",
          tier: "Premium",
          resource_type: "insights",
          access_type: "read",
          data_timeframe: "all",
        },
      ];

      // Combine all scopes
      const allScopes = [...freeScopes, ...standardScopes, ...premiumScopes];

      // Create or update each scope
      let createdCount = 0;
      let updatedCount = 0;

      for (const scopeData of allScopes) {
        try {
          // Check if scope already exists
          const filter = { scope: scopeData.scope };
          const existingScopes = await ScopeModel(tenant).list(
            { filter },
            next
          );

          if (
            existingScopes &&
            existingScopes.data &&
            existingScopes.data.length > 0
          ) {
            // Update existing scope
            await ScopeModel(tenant).modify(
              { filter, update: scopeData },
              next
            );
            updatedCount++;
            logger.info(`Updated scope: ${scopeData.scope}`);
          } else {
            // Create new scope
            await ScopeModel(tenant).register(scopeData, next);
            createdCount++;
            logger.info(`Created scope: ${scopeData.scope}`);
          }
        } catch (error) {
          logger.error(
            `Error processing scope ${scopeData.scope}: ${error.message}`
          );
        }
      }

      logger.info(
        `Scope initialization completed. Created: ${createdCount}, Updated: ${updatedCount}`
      );
      return {
        success: true,
        message: `Scopes initialized. Created: ${createdCount}, Updated: ${updatedCount}`,
      };
    } catch (error) {
      logger.error(`Error initializing scopes: ${error.message}`);
      if (next) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      }
      return {
        success: false,
        message: `Failed to initialize scopes: ${error.message}`,
      };
    }
  },
};

module.exports = scope;
