const HTTPStatus = require("http-status");

const axiosError = ({ error = {}, res = {}, extra = [] } = {}) => {
  let errors = extra;
  if (error.response) {
    // that falls out of the range of 2xx
    res.status(HTTPStatus.BAD_GATEWAY).json({
      success: false,
      error: errors.push(error.response.data),
      message:
        "server error, please crosscheck the Device readKey on Netmanager",
    });
  } else if (error.request) {
    // The request was made but no response was received
    res.status(HTTPStatus.BAD_GATEWAY).json({
      success: false,
      error: errors.push(error.request),
      message: "server error, no response",
    });
  } else {
    errors.push(error.config);
    // Something happened in setting up the request that triggered an Error
    res.status(HTTPStatus.BAD_GATEWAY).json({
      success: false,
      message: "server error",
      error: errors.push(error.message),
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

const badRequest = (res, message, errors) => {
  res.status(HTTPStatus.BAD_REQUEST).json({ success: false, message, errors });
};

module.exports = {
  axiosError,
  tryCatchErrors,
  missingQueryParams,
  callbackErrors,
  badRequest,
};
