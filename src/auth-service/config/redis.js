const redis = require("redis");
const constants = require("./constants");
const { logElement } = require("@utils/log");
const Redis = require("ioredis");
const REDIS_SERVER = constants.REDIS_SERVER;
const REDIS_PORT = constants.REDIS_PORT;
logElement("redis URL", REDIS_SERVER && REDIS_SERVER.concat(":", REDIS_PORT));

/*************** using ioredis ********************** */
const ioredis = new Redis({
  port: REDIS_PORT,
  host: REDIS_SERVER,
  showFriendlyErrorStack: true,
});

/*************** using redis ********************** */
const redis = redis.createClient({
  host: REDIS_SERVER,
  port: REDIS_PORT,
  retry_strategy: () => 1000,
});

redis.on("error", (error) => {
  console.error(error);
});

redis.on("ready", () => {
  console.log("Redis connection esablished");
});

module.exports = { ioredis, redis };
