const HTTPStatus = require("http-status");

const tryCatchErrors = (res, error) => {
  return res.status(HTTPStatus.BAD_GATEWAY).json({
    success: false,
    message: "Server Error",
    error: error.message,
  });
};

module.exports = { tryCatchErrors };
