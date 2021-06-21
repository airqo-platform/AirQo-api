const HTTPStatus = require("http-status");

const axiosError = (error, req, res) => {
  if (error.response) {
    res.status(HTTPStatus.BAD_GATEWAY).json({
      success: false,
      error: error.response.data,
    });
  } else if (error.request) {
    res.status(HTTPStatus.BAD_GATEWAY).json({
      success: false,
      error: error.request,
      message: "The request was made but no response was received",
    });
  } else {
    res.status(HTTPStatus.BAD_GATEWAY).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
  console.log(error.config);
};

const tryCatchErrors = (res, error) => {
  res.status(HTTPStatus.BAD_GATEWAY).json({
    success: false,
    message: "internal server error",
    error: error.message,
  });
};

const missingQueryParams = (req, res) => {
  res.status(HTTPStatus.BAD_REQUEST).send({
    success: false,
    message: "misssing request parameters, please check documentation",
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
    .status(HTTPStatus.BAD_GATEWAY)
    .json({ success: false, message: "server error", error: error });
};

const unclearError = (res) => {
  res
    .status(HTTPStatus.BAD_GATEWAY)
    .json({ success: false, message: "unclear server error" });
};

const badRequest = (res, message) => {
  res.status(HTTPStatus.BAD_REQUEST).json({ success: false, message });
};

module.exports = {
  axiosError,
  tryCatchErrors,
  missingQueryParams,
  callbackErrors,
  unclearError,
  itemAlreadyExists,
  itemDoesNotExist,
  invalidParamsValue,
  badRequest,
};
