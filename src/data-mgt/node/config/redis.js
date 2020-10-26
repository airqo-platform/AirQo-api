const redis = require("redis");

const client = redis.createClient();

client.on("error", (err) => {
  console.error(error);
});

module.exports = client;
