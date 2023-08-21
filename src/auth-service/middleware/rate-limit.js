const { client1 } = require("@config/redis");
const redisClient = client1;
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const AccessTokenSchema = require("@models/AccessToken");
const ClientSchema = require("@models/Client");
const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const { logObject } = require("../utils/log");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(`${this.ENVIRONMENT} -- middleware/rate-limit`);

const AccessTokenModel = (tenant) => {
  try {
    let tokens = mongoose.model("access_tokens");
    return tokens;
  } catch (error) {
    let tokens = getModelByTenant(tenant, "access_token", AccessTokenSchema);
    return tokens;
  }
};

const ClientModel = (tenant) => {
  try {
    let clients = mongoose.model("clients");
    return clients;
  } catch (error) {
    let clients = getModelByTenant(tenant, "client", ClientSchema);
    return clients;
  }
};

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
