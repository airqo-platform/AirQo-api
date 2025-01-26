const pagination = (defaultLimit = 1000, maxLimit = 2000) => {
  return (req, res, next) => {
    let limit = parseInt(req.query.limit, 10);
    let skip = parseInt(req.query.skip, 10);

    if (Number.isNaN(limit) || limit < 1) {
      limit = defaultLimit;
    }
    if (limit > maxLimit) {
      limit = maxLimit;
    }
    if (Number.isNaN(skip) || skip < 0) {
      skip = 0; // Assign 0 directly to skip. No need for req.query
    }

    req.query.limit = limit;
    req.query.skip = skip;

    next();
  };
};

module.exports = pagination;
