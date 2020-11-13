const HTTPStatus = require("http-status");

const axiosError = (error, req, res) => {
  if (error.response) {
    // that falls out of the range of 2xx
    res.status(HTTPStatus.BAD_GATEWAY).json({
      success: false,
      error: error.response.data,
    });
  } else if (error.request) {
    // The request was made but no response was received
    res.status(HTTPStatus.BAD_GATEWAY).json({
      success: false,
      error: error.request,
    });
  } else {
    // Something happened in setting up the request that triggered an Error
    res.status(HTTPStatus.BAD_GATEWAY).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
  console.log(error.config);
};

const tryCatchErrors = (error, req, res) => {
  res
    .status(HTTPStatus.BAD_GATEWAY)
    .send({ success: false, message: "server error", error: error.message });
};

const missingQueryParams = (req, res) => {
  res.status(HTTPStatus.BAD_REQUEST).send({
    success: false,
    message: "misssing request parameters, please check documentation",
  });
};

const callbackErrors = (error, req, res) => {
  res
    .status(HTTPStatus.BAD_GATEWAY)
    .send({ success: false, message: "server error", error: error });
};

module.exports = {
  axiosError,
  tryCatchErrors,
  missingQueryParams,
  callbackErrors,
};
