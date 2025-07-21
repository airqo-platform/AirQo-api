const mongoose = require("mongoose");

const credentials = {
  SLACK_TOKEN: process.env.SLACK_TOKEN,
  SLACK_CHANNEL: process.env.SLACK_CHANNEL,
  SLACK_USERNAME: process.env.SLACK_USERNAME,
};
module.exports = credentials;
