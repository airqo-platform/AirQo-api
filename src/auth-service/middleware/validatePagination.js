const validatePagination = (defaultLimit = 100, maxLimit = 1000) => {
  return (req, res, next) => {
    let limit = parseInt(req.query.limit || req.body.limit, 10);
    const skip = parseInt(req.query.skip || req.body.skip, 10) || 0;

    // Set default limit if not provided or invalid
    if (isNaN(limit) || limit < 1) {
      limit = defaultLimit;
    }

    // Cap the limit at maxLimit
    if (limit > maxLimit) {
      limit = maxLimit;
    }

    // Set the validated limit and skip values in the request object
    req.pagination = {
      limit,
      skip,
    };

    next();
  };
};

module.exports = validatePagination;
