const mongoose = require("mongoose");

const mappings = {
  ACTION_CODE_SETTINGS: {
    url: process.env.AIRQO_WEBSITE,
    handleCodeInApp: true,
    iOS: {
      bundleId: process.env.MOBILE_APP_PACKAGE_NAME,
    },
    android: {
      packageName: process.env.MOBILE_APP_PACKAGE_NAME,
      installApp: true,
      minimumVersion: "12",
    },
    dynamicLinkDomain: process.env.MOBILE_APP_DYNAMIC_LINK_DOMAIN,
  },
  RANDOM_PASSWORD_CONFIGURATION: function (length) {
    return {
      length: length,
      numbers: true,
      uppercase: true,
      lowercase: true,
      strict: true,
      excludeSimilarCharacters: true,
    };
  },
  TOKEN_EXPIRATION: {
    DEFAULT: "24h",
    ADMIN: "4h",
    REMEMBER_ME: "7d",
    TEMPORARY: "1h",
    REFRESH: "30d",
    PASSWORD_RESET: "1h",
    EMAIL_VERIFICATION: "24h",
  },
};
module.exports = mappings;
