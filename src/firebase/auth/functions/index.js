"use strict";
require("dotenv").config();

const axios = require("axios");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

const functions = require("firebase-functions");
const {getAuth} = require("firebase-admin/auth");

initializeApp();
const firestoreDb = getFirestore();

/**
 * @param {auth.UserRecord} _user The new user
 */
async function sendGoodByeMessage(_user) {
  // TODO send user a goodbye message and request for feedback as well
  return null;
}

/**
 * @param {any} user The new user
 */
async function sendWelcomeMessage(user) {
  try {
    const emailAddress = user.emailAddress == null ? "" : user.emailAddress;
    if (emailAddress === "") {
      return null;
    }

    const displayName = user.displayName == null ? "" : user.displayName;
    const endPoint = process.env.WELCOME_MESSAGE_ENDPOINT;
    const body = {
      "platform": "mobile",
      "firstName": displayName,
      "emailAddress": emailAddress,
    };

    // eslint-disable-next-line max-len
    axios.post(endPoint, JSON.stringify(body), {headers: {"Content-Type": "application/json"}})
        .then((res) => {
          console.log(`Welcome message status code: ${res.status}`);
        })
        .catch((error) => {
          console.error(error);
        });
  } catch (error) {
    console.log(error);
  }

  return null;
}

/**
 * @param {any} user The new user
 */
async function sendWelcomeNotification(user) {
  try {
    const userId = user.id;
    const notificationId = new Date.UTC().toString();
    const welcomeNotification = {
      "id": notificationId,
      "body": "Begin your journey to Knowing Your Air and Breathe Clean...",
      "isNew": true,
      "time": new Date.UTC().toISOString(),
      "title": "Welcome to AirQo!",
    };

    const notificationsCollection = process.env.NOTIFICATIONS_COLLECTION;
    const docRef = firestoreDb.collection(notificationsCollection)
        .doc(userId).collection(userId).doc(notificationId);
    await docRef.set(welcomeNotification);
  } catch (error) {
    console.log(error);
  }

  return null;
}

/**
 * @param {{emailAddress: string, phoneNumber: string}} data details
 */
async function checkIfUserExists(data) {
  try {
    if (data.phoneNumber !== "") {
      const phoneNumber = data.phoneNumber;
      await getAuth().getUserByPhoneNumber(phoneNumber);
      return true;
    }

    if (data.emailAddress !== "") {
      const emailAddress = data.emailAddress;
      await getAuth().getUserByEmail(emailAddress);
      return true;
    }
  } catch (e) {
    return false;
  }
}

exports.httpCheckIfUserExists = functions.https.onRequest(async (req, res) => {
  try {
    let exists;
    if (req.body.phoneNumber) {
      const phoneNumber = req.body.phoneNumber;
      exists = await checkIfUserExists(
          {"phoneNumber": phoneNumber, "emailAddress": ""});
      res.json({status: exists});
    } else if (req.body.emailAddress) {
      const emailAddress = req.body.emailAddress;
      exists = await checkIfUserExists(
          {"phoneNumber": "", "emailAddress": emailAddress});
      res.json({status: exists});
    } else {
      res.status(404);
      res.json({message: "Please provide emailAddress or phoneNumber"});
    }
  } catch (e) {
    res.status(500);
    res.json({message: "Internal Server Error"});
  }
});

exports.appCheckIfUserExists = functions.https.onCall(async (data, _) => {

  if (data.phoneNumber) {
    const phoneNumber = data.phoneNumber;
    return await checkIfUserExists(
        {"phoneNumber": phoneNumber, "emailAddress": ""});
  } else if (!data.emailAddress) {
    throw Error("Missing Email Address or Phone Number");
  } else {
    const emailAddress = data.emailAddress;
    return await checkIfUserExists(
        {"phoneNumber": "", "emailAddress": emailAddress});
  }
});

exports.sendWelcomeMessages = functions.https.onCall(async (data, _) => {
  await sendWelcomeNotification(data);
  await sendWelcomeMessage(data);
  return null;
});

exports.deleteUserAccount = functions.auth.user().onDelete(async (user) => {
  await sendGoodByeMessage(user);
  return null;
});
