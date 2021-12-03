const admin = require("firebase-admin");
const constants = require("./constants");
const { initializeApp } = require("firebase-admin/app");
const serviceAccount = require(`${constants.GOOGLE_APPLICATION_CREDENTIALS}`);

initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: constants.FIREBASE_DATABASE_URL,
});
