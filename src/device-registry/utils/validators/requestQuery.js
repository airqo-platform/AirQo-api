const HTTPStatus = require("http-status");
const _ = require("underscore");

const validateRequestQuery = (paramsArr) => (req, res, next) =>  {
    const error = {};
    paramsArr.map(param => {
        if (!(param in req.query)) {
            error[param] = "This is a required request query parameter";
        }
    })
    if(_.isEmpty(error)) {
        return next();
    }
    res.status(HTTPStatus.BAD_REQUEST).json({
        success: false,
        message: "some request query parameter(s) are required",
        error,
    });
}

module.exports = {
  validateRequestQuery
};