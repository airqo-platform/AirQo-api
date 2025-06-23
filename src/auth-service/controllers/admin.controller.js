//controllers/admin.controller.js
const httpStatus = require("http-status");
const adminUtil = require("@utils/admin.util");
const {
  logObject,
  logText,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- admin-controller`);

// Helper function for standard request validation and setup
const validateAndSetupRequest = (req, next) => {
  const errors = extractErrorsFromRequest(req);
  if (errors) {
    next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
    return null;
  }

  const request = req;
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  request.query.tenant = isEmpty(req.query.tenant)
    ? defaultTenant
    : req.query.tenant;

  return request;
};

// Helper function for standard response handling
const handleStandardResponse = (res, result, responseConfig = {}) => {
  if (isEmpty(result) || res.headersSent) {
    return;
  }

  const {
    successKey = "data",
    successMessage = result.message,
    errorMessage = result.message,
    errorKey = "errors",
  } = responseConfig;

  if (result.success === true) {
    const status = result.status ? result.status : httpStatus.OK;
    res.status(status).json({
      success: true,
      message: successMessage,
      [successKey]: result.data,
    });
  } else if (result.success === false) {
    const status = result.status
      ? result.status
      : httpStatus.INTERNAL_SERVER_ERROR;
    res.status(status).json({
      success: false,
      message: errorMessage,
      [errorKey]: result.errors ? result.errors : { message: "" },
    });
  }
};

// Helper function for standard error handling
const handleStandardError = (error, next) => {
  logger.error(`🐛🐛 Internal Server Error ${error.message}`);
  next(
    new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
      message: error.message,
    })
  );
};

// Helper function for parameter validation
const validateParameterError = (condition, message, next) => {
  if (condition) {
    next(
      new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
        message: message,
      })
    );
    return true;
  }
  return false;
};

const adminController = {
  setupSuperAdmin: async (req, res, next) => {
    try {
      logText("setupSuperAdmin...");
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await adminUtil.setupSuperAdmin(request, next);
      handleStandardResponse(res, result, { successKey: "super_admin_setup" });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  checkRBACHealth: async (req, res, next) => {
    try {
      logText("checkRBACHealth...");
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await adminUtil.checkRBACHealth(request, next);
      handleStandardResponse(res, result, {
        successKey: "health_status",
        successMessage: "RBAC health check completed successfully",
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  resetRBACSystem: async (req, res, next) => {
    try {
      logText("resetRBACSystem...");
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await adminUtil.resetRBACSystem(request, next);
      handleStandardResponse(res, result, {
        successKey: "reset_results",
        successMessage: "RBAC reset completed successfully",
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  initializeRBAC: async (req, res, next) => {
    try {
      logText("initializeRBAC...");
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await adminUtil.initializeRBAC(request, next);
      handleStandardResponse(res, result, {
        successKey: "initialization_status",
        successMessage: "RBAC initialization completed successfully",
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  getRBACStatus: async (req, res, next) => {
    try {
      logText("getRBACStatus...");
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await adminUtil.getRBACStatus(request, next);
      handleStandardResponse(res, result, {
        successKey: "rbac_status",
        successMessage: "RBAC status retrieved successfully",
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  // Enhanced setup with validation and detailed feedback
  enhancedSetupSuperAdmin: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await adminUtil.enhancedSetupSuperAdmin(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          operation: result.operation,
          setup_details: result.setup_details,
          before_setup: result.before_setup,
          after_setup: result.after_setup,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors
            ? result.errors
            : { message: "INTERNAL SERVER ERROR" },
        });
      }
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  // System diagnostic endpoint
  getSystemDiagnostics: async (req, res, next) => {
    try {
      const request = validateAndSetupRequest(req, next);
      if (!request) return;

      const result = await adminUtil.getSystemDiagnostics(request, next);
      handleStandardResponse(res, result, {
        successKey: "diagnostics",
        successMessage: "System diagnostics completed successfully",
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },

  // Bulk admin operations
  bulkAdminOperations: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await adminUtil.bulkAdminOperations(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      const status = result.success
        ? httpStatus.OK
        : httpStatus.PARTIAL_CONTENT;

      res.status(status).json({
        success: result.success,
        message: result.message,
        bulk_operation_results: result.data,
      });
    } catch (error) {
      handleStandardError(error, next);
    }
  },
};

module.exports = adminController;
