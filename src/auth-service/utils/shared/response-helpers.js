//response-helpers.js
const httpStatus = require("http-status");
const isEmpty = require("is-empty");

/**
 * Creates standardized success responses for model operations
 * @param {string} operation - Type of operation: 'create', 'list', 'update', 'delete', 'find'
 * @param {any} data - The data to return
 * @param {string} resourceName - Name of the resource (e.g., 'inquiry', 'access request', 'token')
 * @param {Object} options - Additional options
 * @returns {Object} Standardized success response
 */
const createSuccessResponse = (operation, data, resourceName, options = {}) => {
  const baseResponse = {
    success: true,
    data,
    status: httpStatus.OK,
  };

  switch (operation) {
    case "create":
      return {
        ...baseResponse,
        message: options.message || `${resourceName} created successfully`,
      };

    case "list":
      if (Array.isArray(data) && data.length === 0) {
        return {
          ...baseResponse,
          message: options.emptyMessage || `no ${resourceName}s found`,
          status: httpStatus.NOT_FOUND,
        };
      }
      return {
        ...baseResponse,
        message:
          options.message || `successfully retrieved the ${resourceName}s`,
      };

    case "update":
      return {
        ...baseResponse,
        message: options.message || `successfully modified the ${resourceName}`,
      };

    case "delete":
      return {
        ...baseResponse,
        message: options.message || `successfully removed the ${resourceName}`,
      };

    case "find":
      if (
        !data ||
        (typeof data === "object" && Object.keys(data).length === 0)
      ) {
        return {
          success: true,
          data: data || null,
          message: options.notFoundMessage || `${resourceName} not found`,
          status: httpStatus.NOT_FOUND,
        };
      }
      return {
        ...baseResponse,
        message: options.message || `${resourceName} found successfully`,
      };

    default:
      return {
        ...baseResponse,
        message: options.message || "operation completed successfully",
      };
  }
};

/**
 * Creates standardized error responses for model operations
 * @param {Error} err - The error object
 * @param {string} operation - Type of operation: 'create', 'list', 'update', 'delete', 'find'
 * @param {Object} logger - Logger instance
 * @param {string} resourceName - Name of the resource (optional, for better error messages)
 * @returns {Object} Standardized error response
 */
const createErrorResponse = (
  err,
  operation,
  logger,
  resourceName = "resource"
) => {
  logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);

  let response = {};
  let message = "Internal Server Error";
  let status = httpStatus.INTERNAL_SERVER_ERROR;

  // Only check for validation and duplicate errors on create/update operations
  if (["create", "update"].includes(operation)) {
    if (err.code === 11000 || err.code === 11001) {
      // Duplicate key error
      message = "duplicate values provided";
      status = httpStatus.CONFLICT;
      if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          response[key] = `the ${key} must be unique`;
        });
      } else {
        response.message = `duplicate ${resourceName} detected`;
      }
    } else if (err.errors) {
      // Validation errors
      message = "validation errors for some of the provided fields";
      status = httpStatus.CONFLICT;
      Object.entries(err.errors).forEach(([key, value]) => {
        response[key] = value.message;
      });
    } else {
      // General error
      response = { message: err.message };
    }
  } else {
    // For list, delete, find operations - only general errors
    response = { message: err.message };
  }

  return {
    success: false,
    message,
    status,
    errors: response,
  };
};

/**
 * Creates standardized "not found" responses for model operations
 * @param {string} resourceName - Name of the resource
 * @param {string} operation - Type of operation
 * @param {string} customMessage - Custom message (optional)
 * @returns {Object} Standardized not found response
 */
const createNotFoundResponse = (resourceName, operation, customMessage) => {
  const operationMessages = {
    update: `the ${resourceName} you are trying to UPDATE does not exist, please crosscheck`,
    delete: `the ${resourceName} you are trying to DELETE does not exist, please crosscheck`,
    find: `${resourceName} does not exist, please crosscheck`,
  };

  const message =
    customMessage ||
    operationMessages[operation] ||
    `${resourceName} not found`;

  return {
    success: false,
    message,
    status: httpStatus.BAD_REQUEST,
    errors: { message },
  };
};

/**
 * Creates empty success response for create operations that didn't actually create anything
 * @param {string} resourceName - Name of the resource
 * @param {string} customMessage - Custom message (optional)
 * @returns {Object} Empty success response
 */
const createEmptySuccessResponse = (resourceName, customMessage) => {
  return {
    success: true,
    data: [],
    message:
      customMessage ||
      `operation successful but ${resourceName} NOT successfully created`,
    status: httpStatus.ACCEPTED,
  };
};

/**
 * Helper for findToken operations that return user and token info
 * @param {Object} user - User object or null
 * @param {string} token - Token string or null
 * @param {string} tokenType - Type of token ('access', 'verify', etc.)
 * @returns {Object} Token response
 */
const createTokenResponse = (user, token, tokenType = "access") => {
  return {
    success: true,
    user,
    [`current${tokenType.charAt(0).toUpperCase() + tokenType.slice(1)}Token`]:
      token,
  };
};

/**
 * Handles HTTP response sending based on standardized result objects
 * @param {Object} res - Express response object
 * @param {Object} result - Result object from util functions
 * @param {string} successDataKey - Key to use for success data (defaults to "data")
 */
const handleResponse = (res, result, successDataKey = "data") => {
  if (isEmpty(result) || res.headersSent) {
    return;
  }

  const status =
    result.status ||
    (result.success ? httpStatus.OK : httpStatus.INTERNAL_SERVER_ERROR);

  if (result.success) {
    res.status(status).json({
      success: true,
      message: result.message,
      [successDataKey]: result.data,
    });
  } else {
    res.status(status).json({
      success: false,
      message: result.message,
      errors: result.errors || { message: "" },
    });
  }
};

/**
 * Higher-level controller wrapper that handles common controller patterns
 * @param {Function} utilFunction - The util function to call
 * @param {string} resourceName - Name of the resource for response data key
 * @param {Object} logger - Logger instance
 * @returns {Function} Express middleware function
 */
const createControllerHandler = (utilFunction, resourceName, logger) => {
  return async (req, res, next) => {
    try {
      const { extractErrorsFromRequest, HttpError } = require("@utils/shared");

      // Check for validation errors
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      // Call the util function
      const result = await utilFunction(req, next);

      // Handle response
      if (isEmpty(result) || res.headersSent) {
        return;
      }

      handleResponse(res, result, resourceName);
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "An unexpected error occurred." }
        )
      );
      return;
    }
  };
};

/**
 * Creates a complete set of CRUD controller handlers
 * @param {Object} util - Util object with CRUD methods
 * @param {string} resourceName - Name of the resource
 * @param {Object} logger - Logger instance
 * @returns {Object} Object with create, list, update, delete handlers
 */
const createCRUDControllers = (util, resourceName, logger) => {
  return {
    create: createControllerHandler(util.create, resourceName, logger),
    list: createControllerHandler(util.list, resourceName, logger),
    update: createControllerHandler(util.update, resourceName, logger),
    delete: createControllerHandler(util.delete, resourceName, logger),
  };
};

module.exports = {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
  createTokenResponse,
  handleResponse,
  createControllerHandler,
  createCRUDControllers,
};
