const mailchimp = require("@mailchimp/mailchimp_marketing");
const constants = require("./constants");

mailchimp.setConfig({
  apiKey: constants.MAILCHIMP_API_KEY,
  server: constants.MAILCHIMP_SERVER_PREFIX,
});

module.exports = mailchimp;
