const HTTPStatus = require("http-status");

function checkTenancy(req, res, next) {
    if (req.query.tenant) {
      return next();
    }
    res.status(HTTPStatus.BAD_REQUEST).json({
        success: false,
        message:
          "the organization is missing in the query params, please check documentation",
    });
}

module.exports = {
  checkTenancy: checkTenancy,
};