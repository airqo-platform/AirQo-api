const { HttpError, extractErrorsFromRequest } = require("./errors");
const { logElement, logText, logObject } = require("./log");
const { escapeHtml } = require("./html.util");
const { sanitizeEmailString } = require("./string.util");
const stringify = require("./stringify.util");

const {
  EnvironmentDetector,
  isDevelopment,
  isProduction,
  isStaging,
  getEnvironment,
  getDetailedInfo,
  resetCache,
} = require("./environment.util");

const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
  createTokenResponse,
  handleResponse,
  createControllerHandler,
  createCRUDControllers,
} = require("./response-helpers");

module.exports = {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
  createTokenResponse,
  handleResponse,
  createControllerHandler,
  createCRUDControllers,
  EnvironmentDetector,
  stringify,
  isDevelopment,
  isProduction,
  isStaging,
  getEnvironment,
  getDetailedInfo,
  resetCache,
  HttpError,
  escapeHtml,
  sanitizeEmailString,
  extractErrorsFromRequest,
  logElement,
  logText,
  logObject,
};
