/* eslint-disable no-unused-vars */
"use strict";
require("dotenv").config();

const axios = require("axios");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

const functions = require("firebase-functions");
const {getAuth} = require("firebase-admin/auth");
const {Kafka} = require("kafkajs");
const nodemailer = require("nodemailer");

const emailTemplate = require("../config/emailTemplates");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: `${process.env.MAIL_USER}`,
    pass: `${process.env.MAIL_PASS}`,
  },
});


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
 * @param {any} email The user's email
 */
async function sendWelcomeEmail(email) {
  const mailOptions = {
    from: {
      name: "AirQo Data Team",
      address: process.env.MAIL_USER,
    },
    to: email,
    subject: "Welcome to AirQo!",
    html: emailTemplate.mobileAppWelcome(),
  };

  await transporter.sendMail(mailOptions);
  functions.logger.log("New welcome email sent to:", email);
  return null;
}


// kafka configuration
const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID,
  brokers: process.env.KAFKA_BOOTSTRAP_SERVERS.split(","),
  // clientId: process.env.KAFKA_CLIENT_ID_DEV,
  // brokers: ["localhost:9092"],
});


// Function to produce messages

/**
 * @param {any} user The new user
 */
async function produceMessage(user) {
  try {
    const producer = kafka.producer();
    const emailAddress = user.email == null ? "" : user.email;
    if (emailAddress === "") {
      return null;
    }

    await producer.connect();

    const topic = process.env.NEW_MOBILE_APP_USER_TOPIC;
    const message = {
      value: `{email:${emailAddress}}`,
    };

    await producer.send({
      topic,
      messages: [
        message,
      ],
    });
    await producer.disconnect();
  } catch (error) {
    console.log(error);
  }
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

exports.sendWelcomeEmail = functions.auth.user().onCreate((user) => {
  if (user.email !== null) {
    const email = user.email;
    return sendWelcomeEmail(email);
  }
});

exports.onUserSignUp = functions.auth.user().onCreate(async (user) => {
  if (user.email !== null) {
    // return await produceMessage(user);
  }
});

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
  // await sendWelcomeMessage(data);
  return null;
});

exports.deleteUserAccount = functions.auth.user().onDelete(async (user) => {
  await sendGoodByeMessage(user);
  return null;
});
