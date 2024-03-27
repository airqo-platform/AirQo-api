const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- errors-util`);
const { logObject } = require("@utils/log");
const { validationResult } = require("express-validator");

class HttpError extends Error {
  constructor(message, statusCode, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

const convertErrorArrayToObject = (arrays) => {
  return arrays.reduce((obj, item) => {
    let param = item.param || "message";
    let msg = item.msg ? item.msg : "";
    return {
      ...obj,
      [param]: msg,
    };
  }, {});
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
