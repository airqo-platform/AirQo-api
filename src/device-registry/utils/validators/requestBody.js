const HTTPStatus = require("http-status");
const _ = require("underscore");

const validateRequestBody = (fieldsArr) => (req, res, next) =>  {
    const error = {};
    fieldsArr.map(field => {
        if (!(field in req.body)) {
            error[field] = "This is a required field";
        }
    })
    if(_.isEmpty(error)) {
        return next();
    }
    res.status(HTTPStatus.BAD_REQUEST).json({
        success: false,
        message: "some required field(s) are missing",
        error,
    });
}

module.exports = {
  validateRequestBody
};