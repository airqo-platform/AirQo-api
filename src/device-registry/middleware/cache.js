const redis = require("@config/redis");
const cacheGenerator = require("@utils/cache-id-generator");
const constants = require("@config/constants");
const log4js = require("log4js");
const { logObject, logText } = require("../utils/log");
const httpStatus = require("http-status");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- middleware/cache`);

/**
 * Create a robust cache middleware factory
 * @param {Object} options - Configuration options for cache middleware
 * @returns {Function} Express middleware function
 */
const createCacheMiddleware = (options = {}) => {
  const {
    timeout = 60000, // Matching your 60s timeout
    cacheLimit = parseInt(constants.EVENTS_CACHE_LIMIT) || 1800,
    logErrors = true,
    fallbackOnError = true,
  } = options;

  /**
   * Safely execute a cache operation with timeout
   * @param {Function} operation - Cache operation to execute
   * @param {*} fallbackValue - Value to return on failure
   * @returns {Promise<*>} Result of operation or fallback
   */
  const safeCacheOperation = async (operation, fallbackValue = null) => {
    try {
      return await Promise.race([
        operation(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Cache Operation Timeout")),
            timeout
          )
        ),
      ]);
    } catch (error) {
      if (logErrors) {
        logger.error(`Cache Operation Error: ${error.message}`, {
          error,
          operation: operation.name,
        });
      }
      return fallbackValue;
    }
  };

  /**
   * Cache Middleware
   */
  return async (req, res, next) => {
    try {
      // Generate cache ID
      const cacheID = cacheGenerator.generateCacheID(req, next);
      req.cacheID = cacheID;

      // Attach enhanced cache methods to request
      req.cache = {
        get: async () => {
          try {
            const result = await safeCacheOperation(async () => {
              const cachedData = await redis.get(cacheID);
              if (!cachedData) {
                return {
                  success: false,
                  message: "No cache present",
                  errors: { message: "No cache present" },
                  status: httpStatus.NOT_FOUND,
                };
              }

              const parsedData = JSON.parse(cachedData);
              logText("Utilizing cache...");

              return {
                success: true,
                message: "Utilizing cache...",
                data: parsedData,
                status: httpStatus.OK,
              };
            });

            return result;
          } catch (error) {
            logger.error(`🐛🐛 Cache Retrieval Error: ${error.message}`);
            return {
              success: false,
              message: "Internal Server Error",
              errors: { message: error.message },
              status: httpStatus.INTERNAL_SERVER_ERROR,
            };
          }
        },

        set: async (data, ttl = cacheLimit) => {
          try {
            logText("Setting cache...");

            const cacheData = {
              isCache: true,
              success: true,
              message: "Successfully retrieved data",
              data,
            };

            const result = await safeCacheOperation(async () => {
              await redis.set(cacheID, JSON.stringify(cacheData));
              await redis.expire(cacheID, ttl);

              logText("Cache set.");

              return {
                success: true,
                message: "Response stored in cache",
                status: httpStatus.OK,
              };
            });

            return result;
          } catch (error) {
            logger.error(`🐛🐛 Cache Setting Error: ${error.message}`);
            return {
              success: false,
              message: "Internal Server Error",
              errors: { message: error.message },
              status: httpStatus.INTERNAL_SERVER_ERROR,
            };
          }
        },

        delete: async () => {
          try {
            const result = await safeCacheOperation(async () => {
              const deleted = await redis.del(cacheID);
              return {
                success: deleted > 0,
                message: deleted > 0 ? "Cache deleted" : "Cache not found",
                status: deleted > 0 ? httpStatus.OK : httpStatus.NOT_FOUND,
              };
            });

            return result;
          } catch (error) {
            logger.error(`🐛🐛 Cache Deletion Error: ${error.message}`);
            return {
              success: false,
              message: "Internal Server Error",
              errors: { message: error.message },
              status: httpStatus.INTERNAL_SERVER_ERROR,
            };
          }
        },
      };

      // Attempt to retrieve cached data
      const cacheResult = await req.cache.get();
      req.cachedData = cacheResult.success ? cacheResult.data : null;

      next();
    } catch (error) {
      logger.error("Cache Middleware Error", { error });
      next(fallbackOnError ? null : error);
    }
  };
};

const cacheMiddleware = createCacheMiddleware();

module.exports = {
  createCacheMiddleware,
  cacheMiddleware,
};
