const httpStatus = require("http-status");
const AccessTokenModel = require("@models/AccessToken");
const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;
const { logObject } = require("../utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- middleware/check-scope`
);

const checkScope = (requiredScope) => {
  return async (req, res, next) => {
    try {
      let { tenant } = req.query;

      if (!tenant) {
        tenant = "airqo";
      }

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
      logger.error(
        `Error in access control middleware: -- ${JSON.stringify(error)}`
      );

      return res
        .status(httpStatus.INTERNAL_SERVER_ERROR)
        .send(`Internal Server Error -- ${error.message}`);
    }
  };
};

module.exports = checkScope;
