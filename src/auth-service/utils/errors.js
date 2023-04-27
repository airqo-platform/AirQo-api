const httpStatus = require("http-status");

const constants = require("../config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- errors-util`);

const axiosError = (error, req, res) => {
  if (error.response) {
    // that falls out of the range of 2xx
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: error.response.data,
    });
  } else if (error.request) {
    // The request was made but no response was received
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: error.request,
    });
  } else {
    // Something happened in setting up the request that triggered an Error
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
  logObject("error.config", error.config);
};

const tryCatchErrors = (res, error, type) => {
  res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: `${type} server error`,
    error: error.message,
  });
};

const missingQueryParams = (req, res) => {
  res.status(httpStatus.BAD_REQUEST).send({
    success: false,
    message: "misssing request parameters, please check documentation",
  });
};

const badRequest = (res, message, errors) => {
  res.status(httpStatus.BAD_REQUEST).json({ success: false, message, errors });
};

const callbackErrors = (error, req, res) => {
  res
    .status(httpStatus.INTERNAL_SERVER_ERROR)
    .json({ success: false, message: "server error", error: error });
};

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

module.exports = {
  axiosError,
  tryCatchErrors,
  missingQueryParams,
  callbackErrors,
  badRequest,
  convertErrorArrayToObject,
};
