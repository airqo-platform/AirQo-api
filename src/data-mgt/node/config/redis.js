const redis = require("redis");
const constants = require("./constants");
const { logElement, logText, logObject } = require("../utils/log");
const REDIS_SERVER = constants.REDIS_SERVER;
const REDIS_PORT = constants.REDIS_PORT;
logElement("redis URL", REDIS_SERVER.concat(":", REDIS_PORT));

const client = redis.createClient({
  host: REDIS_SERVER,
  port: REDIS_PORT
}
);

client.on("error", (error) => {
  console.error(error);
});

module.exports = client;
