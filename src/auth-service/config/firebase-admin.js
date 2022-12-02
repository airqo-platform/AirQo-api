const admin = require("firebase-admin");
const constants = require("./constants");
const { initializeApp } = require("firebase-admin/app");
const serviceAccount = require(`${constants.GOOGLE_APPLICATION_CREDENTIALS}`);
const functions = require("firebase-functions");
const joinUtil = require("../utils/join");
const { logObject } = require("../utils/log");
const { default: isEmail } = require("validator/lib/isEmail");
const isEmpty = require("is-empty");

initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: constants.FIREBASE_DATABASE_URL,
});

exports.newUserSignUp = functions.auth.user().onCreate(async (user) => {
  try {
    let email = user.email;
    const firstName = user.firstName;
    const phoneNumber = user.phoneNumber;
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
  }
});

exports.userDeleted = functions.auth.user().onDelete(async (user) => {
  try {
    const email = user.email;
    const firstName = user.firstName;
    const uid = user.uid;
    const phoneNumber = user.phoneNumber;
    const message = `AirQo Account Deleted, ${firstName}`;
    const subject = "AirQo Account Successfully Deleted!";

    try {
      admin
        .firestore()
        .collection(`${constants.FIREBASE_COLLECTION_USERS}`)
        .doc(uid).delete;
    } catch (error) {
      logObject("error", error);
    }
    try {
      admin
        .firestore()
        .collection(`${constants.FIREBASE_COLLECTION_KYA}`)
        .doc(user.uid)
        .delete();
    } catch (error) {
      logObject("error", error);
    }

    try {
      admin
        .firestore()
        .collection(`${constants.FIREBASE_COLLECTION_ANALYTICS}`)
        .doc(user.uid)
        .delete();
    } catch (error) {
      logObject("error", error);
    }

    try {
      admin
        .firestore()
        .collection(`${constants.FIREBASE_COLLECTION_NOTIFICATIONS}`)
        .doc(user.uid)
        .delete();
    } catch (error) {
      logObject("error", error);
    }

    try {
      admin
        .firestore()
        .collection(`${constants.FIREBASE_COLLECTION_FAVORITE_PLACES}`)
        .doc(user.uid)
        .delete();
    } catch (error) {
      logObject("error", error);
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
  }
});
