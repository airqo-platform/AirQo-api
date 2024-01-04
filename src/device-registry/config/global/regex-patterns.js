const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const isEmpty = require("is-empty");
const { logText } = require("@utils/log");
const logger = log4js.getLogger(`${this.ENVIRONMENT} -- constants-config`);
const regexPatterns = {
  LATITUDE_REGEX: /^(-?[1-8]?\d(?:\.\d{1,18})?|90(?:\.0{1,18})?)$/,
  LONGITUDE_REGEX: /^(-?(?:1[0-7]|[1-9])?\d(?:\.\d{1,18})?|180(?:\.0{1,18})?)$/,
  WHITE_SPACES_REGEX: /^\S*$/,
};
module.exports = regexPatterns;
