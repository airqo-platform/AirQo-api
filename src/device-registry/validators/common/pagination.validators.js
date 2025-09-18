const pagination = (defaultLimit = 30, maxLimit = 80) => {
  return (req, res, next) => {
    if (req.method === "GET") {
      let limit = parseInt(req.query.limit, 10) || defaultLimit;
      let skip = parseInt(req.query.skip, 10) || 0;

      if (Number.isNaN(limit) || limit < 1) {
        limit = defaultLimit;
      }
      if (limit > maxLimit) {
        limit = maxLimit;
      }
      if (Number.isNaN(skip) || skip < 0) {
        skip = 0;
      }

      req.query.limit = limit;
      req.query.skip = skip;
    }
    next();
  };
};

module.exports = pagination;
