const ActivityLogModel = require("@models/ActivityLog");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- activity-logger-util`
);
const { logObject } = require("@utils/shared");

const ActivityLogger = {
  /**
   * Log an API insertion/update activity
   * @param {Object} params - Activity parameters
   * @param {string} params.operation_type - INSERT, UPDATE, DELETE, etc.
   * @param {string} params.entity_type - EVENT, READING, DEVICE, etc.
   * @param {string} params.status - SUCCESS, FAILURE, PARTIAL_SUCCESS
   * @param {number} params.records_attempted - Number of records attempted
   * @param {number} params.records_successful - Number of successful records
   * @param {number} params.records_failed - Number of failed records
   * @param {string} params.tenant - Tenant identifier
   * @param {string} params.source_function - Function name that called this
   * @param {number} params.execution_time_ms - Execution time in milliseconds
   * @param {Object} params.metadata - Additional context data
   * @param {string} params.error_details - Error message if failed
   * @param {string} params.error_code - Error code if failed
   * @param {string} params.entity_id - ID of the entity being operated on
   */
  async logActivity(params) {
    try {
      const activityData = {
        operation_type: params.operation_type,
        entity_type: params.entity_type,
        entity_id: params.entity_id,
        status: params.status,
        records_attempted: params.records_attempted || 1,
        records_successful: params.records_successful || 0,
        records_failed: params.records_failed || 0,
        error_details: params.error_details,
        error_code: params.error_code,
        tenant: params.tenant || "airqo",
        source_function: params.source_function,
        execution_time_ms: params.execution_time_ms,
        metadata: params.metadata,
        timestamp: new Date(),
      };

      ActivityLogModel(params.tenant || "airqo")
        .logActivity(activityData)
        .catch((error) => {
          logger.warn(`Activity logging failed: ${error.message}`);
        });

      return { success: true };
    } catch (error) {
      logger.warn(`Activity logger error: ${error.message}`);
      return { success: false, error: error.message };
    }
  },

  /**
   * Wrapper function to track function execution and log results
   * @param {Function} fn - Function to execute and track
   * @param {Object} trackingParams - Tracking parameters
   * @returns {Promise} - Result of the function execution
   */
  async trackOperation(fn, trackingParams) {
    const startTime = Date.now();
    let result;
    let status = "SUCCESS";
    let errorDetails = null;
    let errorCode = null;

    try {
      result = await fn();

      if (result && result.success === false) {
        status = "FAILURE";
        errorDetails = result.message || "Operation failed";
        errorCode = result.status || "UNKNOWN";
      } else if (result && result.errors && result.errors.length > 0) {
        status = "PARTIAL_SUCCESS";
        errorDetails = `${result.errors.length} errors occurred`;
      }

      return result;
    } catch (error) {
      status = "FAILURE";
      errorDetails = error.message;
      errorCode = error.code || error.name || "EXCEPTION";
      throw error;
    } finally {
      const executionTime = Date.now() - startTime;

      let derivedSuccess = 0;
      let derivedFailed = 0;

      if (result) {
        if (
          result.deployment_stats &&
          typeof result.deployment_stats.successful_insertions === "number"
        ) {
          derivedSuccess = result.deployment_stats.successful_insertions;
        } else if (typeof result.records_successful === "number") {
          derivedSuccess = result.records_successful;
        } else if (result.eventsAdded && Array.isArray(result.eventsAdded)) {
          derivedSuccess = result.eventsAdded.length;
        } else if (status === "SUCCESS") {
          derivedSuccess = trackingParams.records_attempted || 1;
        }

        if (
          result.deployment_stats &&
          typeof result.deployment_stats.failed_insertions === "number"
        ) {
          derivedFailed = result.deployment_stats.failed_insertions;
        } else if (typeof result.records_failed === "number") {
          derivedFailed = result.records_failed;
        } else if (
          result.eventsRejected &&
          Array.isArray(result.eventsRejected)
        ) {
          derivedFailed = result.eventsRejected.length;
        } else if (status === "FAILURE") {
          derivedFailed = trackingParams.records_attempted || 1;
        }
      } else {
        if (status === "SUCCESS") {
          derivedSuccess = trackingParams.records_attempted || 1;
        } else if (status === "FAILURE") {
          derivedFailed = trackingParams.records_attempted || 1;
        }
      }

      await this.logActivity({
        ...trackingParams,
        status,
        execution_time_ms: executionTime,
        error_details: errorDetails,
        error_code: errorCode,
        records_successful: derivedSuccess,
        records_failed: derivedFailed,
      });
    }
  },

  /**
   * Create activity logger middleware for Express routes
   * @param {Object} options - Middleware options
   * @returns {Function} - Express middleware function
   */
  createMiddleware(options = {}) {
    return async (req, res, next) => {
      const startTime = Date.now();

      const originalJson = res.json;

      res.json = function(body) {
        const executionTime = Date.now() - startTime;

        const method = req.method;
        const operationType =
          method === "POST"
            ? "INSERT"
            : method === "PUT" || method === "PATCH"
            ? "UPDATE"
            : method === "DELETE"
            ? "DELETE"
            : "OTHER";

        const entityType =
          options.entityType ||
          (req.route && req.route.path
            ? req.route.path.split("/")[1].toUpperCase()
            : "OTHER");

        const status =
          res.statusCode >= 200 && res.statusCode < 300 ? "SUCCESS" : "FAILURE";

        let recordsAttempted = 1;
        let recordsSuccessful = 0;
        let recordsFailed = 0;

        if (body && Array.isArray(req.body)) {
          recordsAttempted = req.body.length;
        }

        if (status === "SUCCESS") {
          recordsSuccessful = recordsAttempted;
        } else {
          recordsFailed = recordsAttempted;
        }

        ActivityLogger.logActivity({
          operation_type: operationType,
          entity_type: entityType,
          status,
          records_attempted: recordsAttempted,
          records_successful: recordsSuccessful,
          records_failed: recordsFailed,
          tenant: req.query.tenant || "airqo",
          source_function: `${req.method} ${
            req.route ? req.route.path : req.path
          }`,
          execution_time_ms: executionTime,
          metadata: {
            route: req.path,
            method: req.method,
            user_agent: req.get("User-Agent"),
            ip: req.ip,
          },
          error_details: status === "FAILURE" ? body.message : null,
          error_code: status === "FAILURE" ? res.statusCode.toString() : null,
        }).catch((error) => {
          logger.warn(`Middleware activity logging failed: ${error.message}`);
        });

        return originalJson.call(this, body);
      };

      next();
    };
  },
};

module.exports = ActivityLogger;
