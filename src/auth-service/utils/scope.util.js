const ScopeModel = require("@models/Scope");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/shared");
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
};

module.exports = scope;
