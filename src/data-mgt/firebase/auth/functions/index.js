"use strict";
require("dotenv").config();

const {default: axios} = require("axios");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

const functions = require("firebase-functions");

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
 * @param {auth.UserRecord} user The new user
 */
async function createUserProfile(user) {

  try {
    const id = user.uid;
    const emailAddress = user.email ? "" : user.email;
    const phoneNumber = user.phoneNumber ? "" : user.phoneNumber;
    const photoUrl = user.photoURL ? "" : user.photoURL;
    const displayName = user.displayName ? "" : user.displayName;
    const profile = {
      "userId": id,
      "title": "",
      "firstName": displayName,
      "lastName": "",
      "emailAddress": emailAddress,
      "phoneNumber": phoneNumber,
      "device": "",
      "photoUrl": photoUrl,
      "preferences": {
        "notifications": false,
        "location": false,
        "alerts": false,
      },
    };
    // const usersCollection = functions.config().usersCollectionRef;
    const usersCollection = process.env.USERS_COLLECTION_REF;
    const docRef = firestoreDb.collection(usersCollection).doc(id);
    await docRef.set(profile);
  } catch (error) {
    console.log(error);
  }

  return null;
}

/**
 * @param {auth.UserRecord} user The new user
 */
async function sendWelcomeMessage(user) {

  try {
    const emailAddress = user.email ? "" : user.email;
    if (emailAddress == "") {
      return null;
    }
  
    const displayName = user.displayName ? "" : user.displayName;
    const endPoint = process.env.WELCOME_MESSAGE_ENDPOINT;
    const body = {
      "platform": "mobile",
      "firstName": displayName,
      "emailAddress": emailAddress,
    };
  
    axios.post(endPoint, JSON.stringify(body))
        .then((res) => {
          console.log("Request complete! response:", res);
        })
        .catch(function(error) {
          console.log(error);
        });
  } catch (error) {
    console.log(error);
  }

  return null;
}

/**
 * @param {auth.UserRecord} user The new user
 */
async function sendWelcomeNotification(user) {
  try {
    const userId = user.uid;
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

exports.createUserProfile = functions.auth.user().onCreate((user) => {
  createUserProfile(user);
  sendWelcomeMessage(user);
  sendWelcomeNotification(user);
  return null;
});

exports.deleteUserAccount = functions.auth.user().onDelete((user) => {
  sendGoodByeMessage(user);
  return null;
});
