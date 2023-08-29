const httpStatus = require("http-status");
const { logObject } = require("@utils/log");

const errors = {
  convertErrorArrayToObject: (array) => {
    let result = {};
    function helper(helperInput) {
      if (helperInput.length === 0) {
        return;
      }
      result[`${helperInput[0].value}`] = helperInput[0].msg;
      result[`message`] = helperInput[0].msg;
      helper(helperInput.slice(1));
    }
    helper(array);
    return result;
  },

  axiosError: (error, req, res) => {
    if (error.response) {
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: error.response.data,
      });
    } else if (error.request) {
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: error.request,
        message: "The request was made but no response was received",
      });
    } else {
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Server Error",
        error: error.message,
      });
    }
    logObject("error.config", error.config);
  },

  tryCatchErrors: (res, error, message) => {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: `server error - ${message}`,
      error: error.message,
    });
  },

  missingQueryParams: (res) => {
    res.status(httpStatus.BAD_REQUEST).send({
      success: false,
      message: "misssing request parameters, please check documentation",
    });
  },
  missingOrInvalidValues: (res) => {
    res.status(httpStatus.BAD_REQUEST).send({
      success: false,
      message:
        "missing or invalid request parameter values, please check documentation",
    });
  },
  invalidParamsValue: (req, res) => {
    res.status(httpStatus.BAD_REQUEST).send({
      success: false,
      message: "Invalid request parameter value, please check documentation",
    });
  },

  callbackErrors: (error, req, res) => {
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "server error", error: error });
  },

  unclearError: (res) => {
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "unclear server error" });
  },

  badRequest: (res, message, errors) => {
    res
      .status(httpStatus.BAD_REQUEST)
      .json({ success: false, message, errors });
  },
  serverErrors: [500, 501, 502, 503, 504],
  utillErrors: {
    tryCatchErrors: (error, message) => {
      return {
        success: false,
        message: `util server error -- ${message}`,
        error: error.message,
      };
    },
    badRequest: (message, errors) => {
      return { success: false, message, errors };
    },
  },
};

module.exports = errors;
