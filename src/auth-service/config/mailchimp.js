const mailchimp = require("@mailchimp/mailchimp_marketing");
const constants = require("./constants");
const { logObject, logElement, logText } = require("../utils/log");
logElement("constants.MAILCHIMP_API_KEY", constants.MAILCHIMP_API_KEY);

mailchimp.setConfig({
  apiKey: constants.MAILCHIMP_API_KEY,
  server: constants.MAILCHIMP_SERVER_PREFIX,
});

module.exports = mailchimp;
