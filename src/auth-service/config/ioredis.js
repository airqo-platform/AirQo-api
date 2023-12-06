const constants = require("./constants");
const { logElement } = require("@utils/log");
const cioredis = require("ioredis");
const REDIS_SERVER = constants.REDIS_SERVER;
const REDIS_PORT = constants.REDIS_PORT;
logElement("redis URL", REDIS_SERVER && REDIS_SERVER.concat(":", REDIS_PORT));

const ioredis = new cioredis({
  port: REDIS_PORT,
  host: REDIS_SERVER,
  showFriendlyErrorStack: true,
});

module.exports = ioredis;
