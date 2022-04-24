const HTTPStatus = require("http-status");
const isEmpty = require("is-empty");

const errors = {
  convertErrorArrayToObject: (arrays) => {
    const initialValue = {};
    return arrays.reduce((obj, item) => {
      let param = item.param;
      return {
        ...obj,
        [param]: `${item.msg}`,
      };
    }, initialValue);
  },
  errorResponse: ({
    res = {},
    message = "",
    statusCode = 500,
    error = {},
  } = {}) => {
    if (!isEmpty(res)) {
      return res.status(statusCode).json({
        success: false,
        message,
        errors: {
          statusCode,
          message,
          error,
        },
      });
    } else {
      return {
        success: false,
        message,
        errors: {
          statusCode,
          message,
          error,
        },
      };
    }
  },
  callbackErrors: (error, req, res) => {
    res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "server error",
      errors: { message: error },
    });
  },
  badRequest: (res, message, errors) => {
    res
      .status(HTTPStatus.BAD_REQUEST)
      .json({ success: false, message, errors });
  },
  missingQueryParams: (req, res) => {
    res.status(HTTPStatus.BAD_REQUEST).send({
      success: false,
      message: "misssing request parameters, please check documentation",
    });
  },
  tryCatchErrors: (res, error, type) => {
    res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: `${type} server error`,
      errors: { message: error.message },
    });
  },
  axiosError: (error, req, res) => {
    if (error.response) {
      // that falls out of the range of 2xx
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        errors: { message: error.response.data },
      });
    } else if (error.request) {
      // The request was made but no response was received
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        errors: { message: error.request },
      });
    } else {
      // Something happened in setting up the request that triggered an Error
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Server Error",
        errors: { message: error.message },
      });
    }
    console.log(error.config);
  },
};

module.exports = errors;
