const { extractErrorsFromRequest, HttpError } = require("@utils/shared");
const httpStatus = require("http-status");

const validate = (req, res, next) => {
  const errors = extractErrorsFromRequest(req);
  if (errors) {
    return next(
      new HttpError("Validation Error", httpStatus.BAD_REQUEST, errors)
    ); // next with HttpError
  }
  next(); // Proceed if no errors
};

module.exports = validate;
