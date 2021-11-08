const constants = require("./constants");
const admin = require("firebase-admin/app");
var serviceAccount = require(`${constants.GOOGLE_APPLICATION_CREDENTIALS}`);

const firebaseConfig = {
  credential: "",
};

admin.initializeApp();

module.exports = admin;
