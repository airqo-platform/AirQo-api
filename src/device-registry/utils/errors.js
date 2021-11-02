const HTTPStatus = require("http-status");

const axiosError = (error, req, res) => {
  if (error.response) {
    res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: error.response.data,
    });
  } else if (error.request) {
    res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: error.request,
      message: "The request was made but no response was received",
    });
  } else {
    res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
  console.log(error.config);
};

const tryCatchErrors = (res, error, message) => {
  res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: `server error - ${message}`,
    error: error.message,
  });
};

const missingQueryParams = (res) => {
  res.status(HTTPStatus.BAD_REQUEST).send({
    success: false,
    message: "misssing request parameters, please check documentation",
  });
};

const missingOrInvalidValues = (res) => {
  res.status(HTTPStatus.BAD_REQUEST).send({
    success: false,
    message:
      "missing or invalid request parameter values, please check documentation",
  });
};

const invalidParamsValue = (req, res) => {
  res.status(HTTPStatus.BAD_REQUEST).send({
    success: false,
    message: "Invalid request parameter value, please check documentation",
  });
};

const callbackErrors = (error, req, res) => {
  res
    .status(HTTPStatus.INTERNAL_SERVER_ERROR)
    .json({ success: false, message: "server error", error: error });
};

const unclearError = (res) => {
  res
    .status(HTTPStatus.INTERNAL_SERVER_ERROR)
    .json({ success: false, message: "unclear server error" });
};

const badRequest = (res, message, errors) => {
  res.status(HTTPStatus.BAD_REQUEST).json({ success: false, message, errors });
};

const utillErrors = {
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
};

let errorCodes = {
  serverErrors: [500, 501, 502, 503, 504],
};

module.exports = {
  axiosError,
  tryCatchErrors,
  missingOrInvalidValues,
  missingQueryParams,
  callbackErrors,
  unclearError,
  invalidParamsValue,
  badRequest,
  errorCodes,
  utillErrors,
};
