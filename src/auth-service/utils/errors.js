const constants = require("../config/constants");
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
    let param = item.param;
    return {
      ...obj,
      [param]: `${item.msg}`,
    };
  }, initialValue);
};

const extractErrorsFromRequest = (req) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const nestedErrors = errors.errors[0].nestedErrors;
    return convertErrorArrayToObject(nestedErrors);
  }

  return null;
};

module.exports = {
  HttpError,
  extractErrorsFromRequest,
};
