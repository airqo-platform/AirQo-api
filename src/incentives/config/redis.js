// const redis2 = require("redis");
const constants = require("./constants");
const { logElement } = require("@utils/log");
const Redis = require("ioredis");
const REDIS_SERVER = constants.REDIS_SERVER;
const REDIS_PORT = constants.REDIS_PORT;
logElement("redis URL", REDIS_SERVER && REDIS_SERVER.concat(":", REDIS_PORT));

const client1 = new Redis({
  port: REDIS_PORT,
  host: REDIS_SERVER,
  showFriendlyErrorStack: true,
});

module.exports = { client1 };
