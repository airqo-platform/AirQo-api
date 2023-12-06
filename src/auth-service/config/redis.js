const credis = require("redis");
const constants = require("./constants");
const { logElement } = require("@utils/log");
const REDIS_SERVER = constants.REDIS_SERVER;
const REDIS_PORT = constants.REDIS_PORT;
logElement("redis URL", REDIS_SERVER && REDIS_SERVER.concat(":", REDIS_PORT));

const redis = credis.createClient({
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

module.exports = redis;
