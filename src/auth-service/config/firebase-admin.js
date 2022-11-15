const admin = require("firebase-admin");
const constants = require("./constants");
const { initializeApp } = require("firebase-admin/app");
const serviceAccount = require(`${constants.GOOGLE_APPLICATION_CREDENTIALS}`);
const functions = require("firebase-functions");
const joinUtil = require("../utils/join");
const { logObject } = require("../utils/log");

initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: constants.FIREBASE_DATABASE_URL,
});

exports.newUserSignUp = functions.auth.user().onCreate(async (user) => {
  try {
    const email = user.email;
    const message = `Welcome to AirQo, ${user.firstName}`;
    const subject = "Welcome to AirQo!";

    admin.firestore().collection("users").doc(user.uid).set({
      email: user.email,
    });

    return await joinUtil.sendFeedback({
      email,
      message,
      subject,
    });
  } catch (error) {
    logObject("error", error);
  }
});

exports.userDeleted = functions.auth.user().onDelete(async (user) => {
  try {
    const email = user.email;
    const message = `AirQo Account Deleted, ${user.firstName}`;
    const subject = "AirQo Account Successfully Deleted!";

    const doc = admin.firestore().collection("users").doc(user.uid);
    doc.delete();

    return await joinUtil.sendFeedback({
      email,
      message,
      subject,
    });
  } catch (error) {
    logObject("error", error);
  }
});
