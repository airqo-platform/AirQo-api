const constants = require("@config/constants");
const isEmpty = require("is-empty");

module.exports = (req, res, next) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  req.query.tenant = isEmpty(req.query.tenant)
    ? defaultTenant
    : req.query.tenant;
  next();
};
