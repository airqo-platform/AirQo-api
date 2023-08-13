const { client1 } = require("@config/redis");
const redisClient = client1;
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(`${this.ENVIRONMENT} -- middleware/rate-limit`);

const rateLimitMiddleware = (getUserLimit) => {
  return async (req, res, next) => {
    const userId = req.user._id;
    const userLimit = getUserLimit(req.user);

    try {
      // Fetch the current request count from Redis
      const currentCount = await redisClient.get(userId);

      if (currentCount && parseInt(currentCount) >= userLimit) {
        return res
          .status(httpStatus.TOO_MANY_REQUESTS)
          .json({ message: "Rate limit exceeded" });
      }

      // Increment the request count and update Redis
      await redisClient.incr(userId);
      await redisClient.expire(userId, 3600); // Expire in 1 hour (adjust as needed)

      next();
    } catch (error) {
      logger.error(
        `Error in rate limiting middleware: -- ${JSON.stringify(error)}`
      );
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        error: { message: error.message },
      });
    }
  };
};

module.exports = rateLimitMiddleware;
