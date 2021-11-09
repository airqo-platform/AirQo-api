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

const link =
  "https://airqo.page.link?" +
  "link=https://airqo-250220.firebaseapp.com/__/auth/action?" +
  "apiKey%3DAIzaSyDtqmO3VwIAJKnqHi4UVIbX94o1jm4UfK4" +
  "%26mode%3DsignIn" +
  "%26oobCode%3DA1e6ucVJGk7TOsLp7nDMOeZjwSs3V2K9rw3zSQBUzM8AAAF9Ant_Hw" +
  "%26continueUrl%3Dhttps://www.airqo.net" +
  "%26lang%3Den&apn=com.airqo.net&amv=12&ibi=com.airqo.net&ifl=https://airqo-250220.firebaseapp.com/__/auth/action?" +
  "apiKey%3DAIzaSyDtqmO3VwIAJKnqHi4UVIbX94o1jm4UfK4" +
  "%26mode%3DsignIn" +
  "%26oobCode%3DA1e6ucVJGk7TOsLp7nDMOeZjwSs3V2K9rw3zSQBUzM8AAAF9Ant_Hw" +
  "%26continueUrl%3Dhttps://www.airqo.net" +
  "%26lang%3Den";

module.exports = actionCodeSettings;
