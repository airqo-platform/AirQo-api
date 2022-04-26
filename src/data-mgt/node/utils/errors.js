const HTTPStatus = require("http-status");
const { logText, logObject, logElement } = require("./log");

const errors = {
  convertErrorArrayToObject: (controller) => {
    const initialValue = {};
    return controller.reduce((obj, item) => {
      let param = item.param;
      return {
        ...obj,
        [param]: `${item.msg}`,
      };
    }, initialValue);
  },
  errorResponse: ({ res, message, statusCode = 500, error = {} } = {}) => {
    logObject("error", error);
    res.status(statusCode).json({
      success: false,
      message,
      error: {
        statusCode,
        message,
        error,
      },
    });
  },
};
module.exports = errors;
