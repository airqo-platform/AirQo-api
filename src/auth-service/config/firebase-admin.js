const admin = require("firebase-admin");
const constants = require("./constants");
const { initializeApp } = require("firebase-admin/app");
const serviceAccount = require(`${constants.GOOGLE_APPLICATION_CREDENTIALS}`);
// const functions = require("firebase-functions");
// const createUserUtil = require("../utils/create-user");
const { logObject, logText } = require("@utils/log");
// const isEmpty = require("is-empty");
// const emailMessages = require("../utils/email.msgs");

const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- firebase-admin-config`
);

// FIREBASE_API_KEY: constants.FIREBASE_API_KEY,
// FIREBASE_AUTH_DOMAIN: constants.FIREBASE_AUTH_DOMAIN,
// FIREBASE_AUTHORIZATION_URL: constants.FIREBASE_AUTHORIZATION_URL,

initializeApp({
  credential: admin.credential.cert({
    type: constants.FIREBASE_TYPE,
    project_id: constants.FIREBASE_PROJECT_ID,
    private_key_id: constants.FIREBASE_PRIVATE_KEY_ID,
    private_key: constants.FIREBASE_PRIVATE_KEY,
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

// exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
//   try {
//     logObject("new mobile app user created", user);
//     let email = user.email;
//     const firstName = user.firstName;
//     const message = emailMessages.mobileAppWelcome();
//     const subject = "Welcome to AirQo!";

//     if (!isEmpty(email)) {
//       return await createUserUtil.sendFeedback({
//         email,
//         message,
//         subject,
//       });
//     }
//   } catch (error) {
//     logObject("error", error);
//     logger.error(`internal server error -- ${error.message}`);
//   }
// });

// exports.onUserDelete = functions.auth.user().onDelete(async (user) => {
//   try {
//     logObject("new mobile app user deleted", user);
//     const email = user.email;
//     const firstName = user.firstName;
//     const message = `AirQo Account Deleted, ${firstName}`;
//     const subject = "AirQo Account Successfully Deleted!";

//     try {
//       admin
//         .firestore()
//         .collection(`${constants.FIREBASE_COLLECTION_USERS}`)
//         .doc(user.uid)
//         .delete();
//     } catch (error) {
//       logObject("error", error);
//       logger.error(`internal server error -- ${error.message}`);
//     }
//     try {
//       admin
//         .firestore()
//         .collection(`${constants.FIREBASE_COLLECTION_KYA}`)
//         .doc(user.uid)
//         .delete();
//     } catch (error) {
//       logObject("error", error);
//       logger.error(`internal server error -- ${error.message}`);
//     }

//     try {
//       admin
//         .firestore()
//         .collection(`${constants.FIREBASE_COLLECTION_ANALYTICS}`)
//         .doc(user.uid)
//         .delete();
//     } catch (error) {
//       logObject("error", error);
//       logger.error(`internal server error -- ${error.message}`);
//     }

//     try {
//       admin
//         .firestore()
//         .collection(`${constants.FIREBASE_COLLECTION_NOTIFICATIONS}`)
//         .doc(user.uid)
//         .delete();
//     } catch (error) {
//       logObject("error", error);
//       logger.error(`internal server error -- ${error.message}`);
//     }

//     try {
//       admin
//         .firestore()
//         .collection(`${constants.FIREBASE_COLLECTION_FAVORITE_PLACES}`)
//         .doc(user.uid)
//         .delete();
//     } catch (error) {
//       logObject("error", error);
//       logger.error(`internal server error -- ${error.message}`);
//     }

//     if (!isEmpty(email)) {
//       return await createUserUtil.sendFeedback({
//         email,
//         message,
//         subject,
//       });
//     }
//   } catch (error) {
//     logObject("error", error);
//     logger.error(`internal server error -- ${error.message}`);
//   }
// });

module.exports = { db };
