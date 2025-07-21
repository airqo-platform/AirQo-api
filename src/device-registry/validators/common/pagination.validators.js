const pagination = (defaultLimit = 1000, maxLimit = 2000) => {
  return (req, res, next) => {
    if (req.method === "GET" && (req.query.limit || req.query.skip)) {
      // Apply ONLY to GET requests with limit/skip
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
    }
    next();
  };
};

module.exports = pagination;
