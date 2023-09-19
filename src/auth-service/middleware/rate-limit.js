const { client1 } = require("@config/redis");
const redisClient = client1;
const httpStatus = require("http-status");
const AccessTokenModel = require("@models/AccessToken");
const ClientModel = require("@models/Client");
const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;
const { logObject } = require("../utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- middleware/rate-limit`
);

const getClientLimit = (client) => {
  return client.rateLimit || 100;
};

const rateLimitMiddleware = async (req, res, next) => {
  try {
    let { tenant } = req.query;

    if (!tenant) {
      tenant = "airqo";
    }

    let client;
    if (req.params && req.params.token) {
      const token = req.params.token;
      const responseFromFindToken = await AccessTokenModel(tenant)
        .find({
          token,
        })
        .lean();

      logObject("responseFromFindToken[0]", responseFromFindToken[0]);

      if (!isEmpty(responseFromFindToken)) {
        const { client_id } = responseFromFindToken[0];
        if (!mongoose.Types.ObjectId.isValid(client_id)) {
          return res
            .status(httpStatus.BAD_REQUEST)
            .send("Invalid client ID associated with provided token");
        }
        client = await ClientModel(tenant).findById(ObjectId(client_id)).lean();
      }
    }

    logObject("client", client);

    if (!client) {
      return res.status(httpStatus.UNAUTHORIZED).send("Unauthorized");
    }

    const clientId = client._id;
    const clientLimit = getClientLimit(client);

    const currentCount = await redisClient.get(clientId);

    if (currentCount && parseInt(currentCount) >= clientLimit) {
      return res
        .status(httpStatus.TOO_MANY_REQUESTS)
        .send("Rate limit exceeded");
    }

    await redisClient.incr(clientId);
    await redisClient.expire(clientId, 3600);

    next();
  } catch (error) {
    logger.error(
      `Error in rate limiting middleware: -- ${JSON.stringify(error)}`
    );

    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send(`Internal Server Error -- ${error.message}`);
  }
};

module.exports = rateLimitMiddleware;
