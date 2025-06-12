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

    // Format the errors to have a consistent structure
    if (errors) {
      // If errors is an object (param -> message), convert to array format
      if (typeof errors === "object" && !Array.isArray(errors)) {
        this.errors = Object.entries(errors).map(([param, message]) => ({
          param,
          message,
          location: "body", // Default location
        }));
      } else {
        this.errors = errors;
      }
    } else {
      this.errors = null;
    }
  }
}

const convertErrorArrayToObject = (arrays) => {
  const initialValue = {};
  return arrays.reduce((obj, item) => {
    // Use item.message if available, otherwise use item.msg
    obj[item.param] = item.message || item.msg;
    return obj;
  }, initialValue);
};

const extractErrorsFromRequest = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    let allErrors = {};
    errors.errors.forEach((error) => {
      if (error.nestedErrors && Array.isArray(error.nestedErrors)) {
        allErrors = {
          ...allErrors,
          ...convertErrorArrayToObject(error.nestedErrors),
        };
      } else {
        allErrors = { ...allErrors, ...convertErrorArrayToObject([error]) };
      }
    });
    return allErrors;
  }

  return null;
};

module.exports = {
  HttpError,
  extractErrorsFromRequest,
};
