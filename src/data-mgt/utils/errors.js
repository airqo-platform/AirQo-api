const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- errors-util`);
const { logObject } = require("@utils/log");
const { validationResult } = require("express-validator");

class HttpError extends Error {
  constructor(message, statusCode, errors = null) {
    logObject("the error message we are getting", message);
    logObject("the errors we are getting", errors);
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

const convertErrorArrayToObject = (arrays) => {
  const initialValue = {};
  return arrays.reduce((obj, item) => {
    obj[item.param] = item.msg;
    return obj;
  }, initialValue);
};

const extractErrorsFromRequest = (req) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const firstError = errors.errors[0];
    const nestedErrors = firstError.nestedErrors || [];
    return convertErrorArrayToObject(nestedErrors);
  }

  return null;
};

module.exports = {
  HttpError,
  extractErrorsFromRequest,
};
