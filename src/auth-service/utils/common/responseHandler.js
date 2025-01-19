const httpStatus = require("http-status");
const isEmpty = require("is-empty");

exports.handleResponse = (res, result, successDataKey = "data") => {
  if (isEmpty(result) || res.headersSent) {
    return;
  }

  const status =
    result.status ||
    (result.success ? httpStatus.OK : httpStatus.INTERNAL_SERVER_ERROR);

  if (result.success) {
    res.status(status).json({
      success: true,
      message: result.message,
      [successDataKey]: result.data,
    });
  } else {
    res.status(status).json({
      success: false,
      message: result.message,
      errors: result.errors || { message: "" },
    });
  }
};
