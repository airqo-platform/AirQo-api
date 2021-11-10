const actionCodeSettings = {
  url: "https://www.airqo.net",
  handleCodeInApp: true,
  iOS: {
    bundleId: "com.airqo.net",
  },
  android: {
    packageName: "com.airqo.net",
    installApp: true,
    minimumVersion: "12",
  },
  dynamicLinkDomain: "airqo.page.link",
};

module.exports = actionCodeSettings;
