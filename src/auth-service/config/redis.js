// const redis2 = require("redis");
const constants = require("./constants");
const { logElement } = require("@utils/log");
const Redis = require("ioredis");
const REDIS_SERVER = constants.REDIS_SERVER;
const REDIS_PORT = constants.REDIS_PORT;
logElement("redis URL", REDIS_SERVER && REDIS_SERVER.concat(":", REDIS_PORT));
/***********************************
 * CONFIGURATION OPTIONS FOR CLIENT 1:
 * ---------------------
 * 
new Redis(); // Connect to 127.0.0.1:6379
new Redis(6380); // 127.0.0.1:6380
new Redis(6379, "192.168.1.1"); // 192.168.1.1:6379
new Redis("/tmp/redis.sock");
new Redis({
  port: 6379, // Redis port
  host: "127.0.0.1", // Redis host
  username: "default", // needs Redis >= 6
  password: "my-top-secret",
  db: 0, // Defaults to 0
});
***********************************
 */
const client1 = new Redis({
  port: REDIS_PORT,
  host: REDIS_SERVER,
  showFriendlyErrorStack: true,
});

// const client2 = redis2.createClient({
//   host: JSON.stringify(REDIS_SERVER),
//   port: REDIS_PORT,
//   connect_timeout: 10000,
//   retry_strategy: () => 10000,
// });

// client2.connect();

// client2.on("error", (error) => {
//   console.error(error);
// });

// client2.on("connect", () => {
//   console.log("Connected to Redis server");
// });

// client2.on("ready", () => {
//   console.log("Redis connection esablished");
// });

// client2.on("end", () => {
//   console.log("Redis client disconnected");
// });

module.exports = { client1 };
