const admin = require("firebase-admin");
const constants = require("./constants");
const { initializeApp } = require("firebase-admin/app");
const { logObject, logText } = require("@utils/log");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- firebase-admin-config`
);

initializeApp({
  credential: admin.credential.cert({
    type: constants.FIREBASE_TYPE,
    project_id: constants.FIREBASE_PROJECT_ID,
    private_key_id: constants.FIREBASE_PRIVATE_KEY_ID,
    private_key: constants.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: constants.FIREBASE_CLIENT_EMAIL,
    client_id: constants.FIREBASE_CLIENT_ID,
    auth_uri: constants.FIREBASE_AUTH_URI,
    token_uri: constants.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: constants.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    universe_domain: constants.FIREBASE_UNIVERSE_DOMAIN,
  }),
  databaseURL: constants.FIREBASE_DATABASE_URL,
});

const db = admin.firestore();

module.exports = { db };
