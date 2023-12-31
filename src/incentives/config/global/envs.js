const mongoose = require("mongoose");

const envs = {
  SESSION_SECRET: process.env.SESSION_SECRET,
  JWT_SECRET: process.env.JWT_SECRET,
};
module.exports = envs;
