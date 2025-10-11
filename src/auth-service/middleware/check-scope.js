const httpStatus = require("http-status");
const AccessTokenModel = require("@models/AccessToken");
const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- middleware/check-scope`
);
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");

const checkScope = (requiredScope) => {
  return async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      if (req.params && req.params.token) {
        const token = req.params.token;
        const responseFromFindToken = await AccessTokenModel(tenant)
          .find({
            token,
          })
          .lean();

        logObject("responseFromFindToken[0]", responseFromFindToken[0]);

        if (!isEmpty(responseFromFindToken)) {
          const { client_id, scopes } = responseFromFindToken[0];
          if (
            !mongoose.Types.ObjectId.isValid(client_id) ||
            !scopes.includes(requiredScope)
          ) {
            return res
              .status(httpStatus.UNAUTHORIZED)
              .send("Unauthorized due to insufficient scope");
          }
        }
      }

      next();
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  };
};

module.exports = checkScope;
