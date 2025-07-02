const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- errors-util`);
const { logObject } = require("./log");
const { validationResult } = require("express-validator");

class HttpError extends Error {
  constructor(message, statusCode, errors = null) {
    logObject("the error message we are getting", message);
    logObject("the errors we are getting", errors);
    super(message);
    this.statusCode = statusCode;

    // Enhanced error handling for different error types
    if (errors) {
      // Handle enhanced organization context errors (keep as object)
      if (errors.debugCode || errors.details || errors.suggestions) {
        this.errors = errors; // Keep the enhanced structure
      }
      // Handle validation errors from extractErrorsFromRequest (already in array format with location)
      else if (Array.isArray(errors)) {
        this.errors = errors; // Use the array format directly
      }
      // Handle legacy validation errors (convert to array format for backward compatibility)
      else if (typeof errors === "object") {
        // Check if it's a validation errors object (param -> message)
        const isValidationErrors = Object.values(errors).every(
          (value) => typeof value === "string"
        );

        if (isValidationErrors) {
          this.errors = Object.entries(errors).map(([param, message]) => ({
            param,
            message,
            location: "body", // Default location for legacy errors
          }));
        } else {
          // Keep complex error objects as-is
          this.errors = errors;
        }
      } else {
        this.errors = errors;
      }
    } else {
      this.errors = null;
    }
  }
}

// FIXED: Convert error array to object (maintain backward compatibility for simple param->message mapping)
const convertErrorArrayToObject = (arrays) => {
  const initialValue = {};
  return arrays.reduce((obj, item) => {
    // Use item.message if available, otherwise use item.msg
    obj[item.param] = item.message || item.msg;
    return obj;
  }, initialValue);
};

// FIXED: Extract errors while preserving location information
const extractErrorsFromRequest = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    let allErrors = [];

    errors.errors.forEach((error) => {
      if (error.nestedErrors && Array.isArray(error.nestedErrors)) {
        // Handle nested errors from oneOf() validators
        error.nestedErrors.forEach((nestedError) => {
          allErrors.push({
            param: nestedError.param || nestedError.path,
            message: nestedError.message || nestedError.msg,
            location: nestedError.location || "body",
          });
        });
      } else {
        // Handle regular errors
        allErrors.push({
          param: error.param || error.path,
          message: error.message || error.msg,
          location: error.location || "body",
        });
      }
    });

    // Remove duplicates (keep the first occurrence)
    const uniqueErrors = [];
    const seen = new Set();

    allErrors.forEach((error) => {
      const key = `${error.param}-${error.location}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueErrors.push(error);
      }
    });

    return uniqueErrors;
  }

  return null;
};

// Enhanced error handler middleware for Express
const enhancedErrorHandler = (err, req, res, next) => {
  // Don't send if response already sent
  if (res.headersSent) {
    return next(err);
  }

  const isDevelopment = process.env.NODE_ENV !== "production";

  // Base error response
  const errorResponse = {
    success: false,
    message: err.message || "Internal Server Error",
    status: err.statusCode || 500,
  };

  // Handle enhanced errors with debugCode
  if (err.errors && typeof err.errors === "object") {
    if (err.errors.debugCode) {
      errorResponse.debugCode = err.errors.debugCode;

      // Add specific details for organization context errors
      if (err.errors.details) {
        errorResponse.details = err.errors.details;
      }

      if (err.errors.suggestions) {
        errorResponse.suggestions = err.errors.suggestions;
      }

      // Add help messages based on error type
      switch (err.errors.debugCode) {
        case "ORG_ACCESS_DENIED":
          errorResponse.help = {
            message: "Organization access was denied",
            commonSolutions: [
              "Ensure you're logged into the correct account",
              "Check that you have access to the requested organization",
              "Contact your administrator if you need access",
              "Verify the organization ID in the URL is correct",
            ],
          };
          break;

        case "ORG_ID_MISSING":
          errorResponse.help = {
            message: "Organization ID is required but was not provided",
            commonSolutions: [
              "Include the organization ID in the URL path",
              "Check the URL format matches the expected pattern",
              "Ensure the route parameter name is correct",
            ],
          };
          break;

        case "ORG_AUTH_MISSING":
          errorResponse.help = {
            message: "Authentication is required",
            commonSolutions: [
              "Include valid JWT token in Authorization header",
              "Check that your login session hasn't expired",
              "Ensure the token format is 'Bearer <token>'",
            ],
          };
          break;
      }

      // For development, include additional debug info
      if (isDevelopment && err.errors.debugInfo) {
        errorResponse.debugInfo = err.errors.debugInfo;
      }
    }
    // Handle validation errors (array format)
    else if (Array.isArray(err.errors)) {
      errorResponse.errors = err.errors;
    }
    // Handle other error formats
    else {
      errorResponse.errors = err.errors;
    }
  }
  // Backward compatibility for simple error objects
  else if (err.errors) {
    errorResponse.errors = err.errors;
  }

  // Add request context for debugging
  if (isDevelopment) {
    errorResponse.context = {
      url: req.originalUrl,
      method: req.method,
      userId: req.user?._id,
      userEmail: req.user?.email,
      organizationContext: req.organizationContext,
      timestamp: new Date().toISOString(),
    };
  }

  // Enhanced logging with more context
  const logData = {
    error: err.message,
    statusCode: err.statusCode || 500,
    stack: err.stack,
    userId: req.user?._id,
    userEmail: req.user?.email,
    url: req.originalUrl,
    method: req.method,
    organizationContext: req.organizationContext,
    debugCode: err.errors?.debugCode,
    userAgent: req.get("User-Agent"),
    ip: req.ip || req.connection.remoteAddress,
    timestamp: new Date().toISOString(),
  };

  // Log with appropriate level based on status code
  if (err.statusCode >= 500) {
    logger.error("[ERROR_HANDLER] Server Error:", logData);
  } else if (err.statusCode >= 400) {
    logger.warn("[ERROR_HANDLER] Client Error:", logData);
  } else {
    logger.info("[ERROR_HANDLER] Request Error:", logData);
  }

  return res.status(err.statusCode || 500).json(errorResponse);
};

// Utility function to create organization context errors
const createOrgContextError = (type, details = {}) => {
  const errorConfigs = {
    ACCESS_DENIED: {
      message: details.message || "You don't have access to this organization",
      statusCode: 403,
      debugCode: "ORG_ACCESS_DENIED",
    },
    ID_MISSING: {
      message: details.message || "Organization ID is required",
      statusCode: 400,
      debugCode: "ORG_ID_MISSING",
    },
    AUTH_MISSING: {
      message: details.message || "Authentication required",
      statusCode: 401,
      debugCode: "ORG_AUTH_MISSING",
    },
  };

  const config = errorConfigs[type];
  if (!config) {
    throw new Error(`Unknown organization context error type: ${type}`);
  }

  return new HttpError(config.message, config.statusCode, {
    debugCode: config.debugCode,
    ...details,
  });
};

// Utility function to create validation errors (backward compatibility)
const createValidationError = (
  validationErrors,
  message = "Validation failed"
) => {
  return new HttpError(message, 400, validationErrors);
};

module.exports = {
  HttpError,
  extractErrorsFromRequest,
  enhancedErrorHandler,
  createOrgContextError,
  createValidationError,
  convertErrorArrayToObject,
};
