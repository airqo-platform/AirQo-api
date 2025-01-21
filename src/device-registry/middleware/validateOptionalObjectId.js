const { isValidObjectId } = require("mongoose");
const { BadRequestError } = require("@utils/shared");

const validateOptionalObjectId = (field) => {
  return (req, res, next) => {
    if (req.query[field]) {
      let values;
      if (Array.isArray(req.query[field])) {
        values = req.query[field];
      } else {
        values = req.query[field].toString().split(",");
      }

      const errors = [];
      for (const value of values) {
        if (!isValidObjectId(value)) {
          errors.push(`Invalid ${field} format: ${value}`);
        }
      }

      if (errors.length > 0) {
        throw new BadRequestError({
          message: `Validation failed for ${field}`,
          errors: errors,
        });
      }
    }
    next();
  };
};

module.exports = validateOptionalObjectId;
