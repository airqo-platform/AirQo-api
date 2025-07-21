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
};
module.exports = mappings;
