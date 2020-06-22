const redis = require("redis");

const client = redis.createClient();

client.on("error", (err) => {
    console.log("Error" + err);
});

module.exports = client;