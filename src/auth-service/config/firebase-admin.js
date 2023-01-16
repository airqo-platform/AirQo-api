const admin = require("firebase-admin");
const constants = require("./constants");
const { initializeApp } = require("firebase-admin/app");
const serviceAccount = require(`${constants.GOOGLE_APPLICATION_CREDENTIALS}`);
const functions = require("firebase-functions");
const joinUtil = require("../utils/join");
const { logObject, logText } = require("../utils/log");
const { default: isEmail } = require("validator/lib/isEmail");
const isEmpty = require("is-empty");

initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: constants.FIREBASE_DATABASE_URL,
});

const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- firebase-admin-config`
);

logText("the listening...");

const firebaseFuncs = {
  userDeleted: functions.auth.user().onDelete(async (user) => {
    try {
      logObject("new mobile app user deleted", user);
      const email = user.email;
      const firstName = user.firstName;
      const message = `AirQo Account Deleted, ${firstName}`;
      const subject = "AirQo Account Successfully Deleted!";

      try {
        admin
          .firestore()
          .collection(`${constants.FIREBASE_COLLECTION_USERS}`)
          .doc(user.uid)
          .delete();
      } catch (error) {
        logObject("error", error);
        logger.error(`internal server error -- ${error.message}`);
      }
      try {
        admin
          .firestore()
          .collection(`${constants.FIREBASE_COLLECTION_KYA}`)
          .doc(user.uid)
          .delete();
      } catch (error) {
        logObject("error", error);
        logger.error(`internal server error -- ${error.message}`);
      }

      try {
        admin
          .firestore()
          .collection(`${constants.FIREBASE_COLLECTION_ANALYTICS}`)
          .doc(user.uid)
          .delete();
      } catch (error) {
        logObject("error", error);
        logger.error(`internal server error -- ${error.message}`);
      }

      try {
        admin
          .firestore()
          .collection(`${constants.FIREBASE_COLLECTION_NOTIFICATIONS}`)
          .doc(user.uid)
          .delete();
      } catch (error) {
        logObject("error", error);
        logger.error(`internal server error -- ${error.message}`);
      }

      try {
        admin
          .firestore()
          .collection(`${constants.FIREBASE_COLLECTION_FAVORITE_PLACES}`)
          .doc(user.uid)
          .delete();
      } catch (error) {
        logObject("error", error);
        logger.error(`internal server error -- ${error.message}`);
      }

      if (!isEmpty(email)) {
        return await joinUtil.sendFeedback({
          email,
          message,
          subject,
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
    }
  }),

  newUserSignUp: functions.auth.user().onCreate(async (user) => {
    try {
      logObject("new mobile app user created", user);
      let email = user.email;
      const firstName = user.firstName;
      const message = `Welcome to AirQo, ${firstName}`;
      const subject = "Welcome to AirQo!";

      if (!isEmpty(email)) {
        return await joinUtil.sendFeedback({
          email,
          message,
          subject,
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
    }
  }),
};

module.exports = firebaseFuncs;
