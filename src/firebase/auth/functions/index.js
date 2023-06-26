/* eslint-disable max-len */
/* eslint-disable no-unused-vars */
"use strict";
require("dotenv").config();

const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

const functions = require("firebase-functions");
const {getAuth} = require("firebase-admin/auth");
const nodemailer = require("nodemailer");

const emailTemplate = require("./config/emailTemplates");

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
 * @param {any} email The user's email
 * @param {any} userId The user's userId
 * @param {any} creationTime The user's creation time
 */
async function sendDeleteConfirmationEmail(email, userId, creationTime) {
  const mailOptions = {
    from: {
      name: "AirQo Data Team",
      address: process.env.MAIL_USER,
    },
    to: email,
    subject: "Confirm Account Deletion - AirQo!",
    html: emailTemplate.deleteConfirmationEmail(email, userId, creationTime),
    attachments: [
      {
        filename: "airqoLogo.png",
        path: "./config/images/airqoLogo.png",
        cid: "AirQoEmailLogo",
        contentDisposition: "inline",
      },
      {
        filename: "faceBookLogo.png",
        path: "./config/images/facebookLogo.png",
        cid: "FacebookLogo",
        contentDisposition: "inline",
      },
      {
        filename: "youtubeLogo.png",
        path: "./config/images/youtubeLogo.png",
        cid: "YoutubeLogo",
        contentDisposition: "inline",
      },
      {
        filename: "twitterLogo.png",
        path: "./config/images/Twitter.png",
        cid: "Twitter",
        contentDisposition: "inline",
      },
      {
        filename: "linkedInLogo.png",
        path: "./config/images/linkedInLogo.png",
        cid: "LinkedInLogo",
        contentDisposition: "inline",
      }],
  };
  try {
    await transporter.sendMail(mailOptions);
    functions.logger.log("Delete Confirmation email sent to:", email);
    return null;
  } catch (error) {
    functions.logger.log("Transporter failed to send email", error);
  }
}

exports.confirmAccountDeletionMobile =
  functions.https.onRequest(async (request, response) => {
    const {email} = request.body;
    if (!email) {
      response.status(400).json({
        success: false,
        message: "Email is required",
      });
    }
    let user;
    try {
      try {
        user = await getAuth().getUserByEmail(email);
      } catch (error) {
        response.status(500).json({
          success: false,
          message: "User does not exist.",
          errors: {message: error.message},
        });
      }

      const userId = user.uid;
      let creationTime = user.metadata.creationTime;
      creationTime=creationTime.replace(/\D/g, "");

      sendDeleteConfirmationEmail(email, userId, creationTime);
      response.status(200).json({
        success: true,
        message: "Account deletion email sent",
      });
    } catch (error) {
      functions.logger.log(
          "Error sending Account deletion confirmation Email:",
          error,
      );
      response.status(500).json({
        success: false,
        message: "Error sending Account deletion confirmation Email",
        errors: error,
      });
    }
  });

/**
 * @param {any} email The user's email
 * @param {any} name The user's name
 */
async function sendWelcomeEmail(email, name) {
  const mailOptions = {
    from: {
      name: "AirQo Data Team",
      address: process.env.MAIL_USER,
    },
    to: email,
    subject: "Welcome to AirQo!",
    html: emailTemplate.mobileAppWelcome(email, name),
    attachments: [{
      filename: "welcomeImage.png",
      path: "./config/images/welcomeImage.png",
      cid: "AirQoEmailWelcomeImage",
      contentDisposition: "inline",
    },
    {
      filename: "airqoLogo.png",
      path: "./config/images/airqoLogo.png",
      cid: "AirQoEmailLogo",
      contentDisposition: "inline",
    },
    {
      filename: "faceBookLogo.png",
      path: "./config/images/facebookLogo.png",
      cid: "FacebookLogo",
      contentDisposition: "inline",
    },
    {
      filename: "youtubeLogo.png",
      path: "./config/images/youtubeLogo.png",
      cid: "YoutubeLogo",
      contentDisposition: "inline",
    },
    {
      filename: "twitterLogo.png",
      path: "./config/images/Twitter.png",
      cid: "Twitter",
      contentDisposition: "inline",
    },
    {
      filename: "linkedInLogo.png",
      path: "./config/images/linkedInLogo.png",
      cid: "LinkedInLogo",
      contentDisposition: "inline",
    }],
  };
  try {
    await transporter.sendMail(mailOptions);
    functions.logger.log("New welcome email sent to:", email);
    return null;
  } catch (error) {
    functions.logger.log("Transporter failed to send email", error);
  }
}
exports.sendWelcomeEmail = functions.auth.user().onCreate((user) => {
  if (user.email !== null) {
    const email = user.email;
    try {
      setTimeout(async () => {
        const userRef = firestoreDb.collection(process.env.USERS_COLLECTION)
            .doc(user.uid);
        const userDoc = await userRef.get();

        let firstName = userDoc.data().firstName;
        if (firstName == null) {
          firstName = "";
        }
        sendWelcomeEmail(email, firstName);
      }, 300000);
    } catch (error) {
      functions.logger.log("Error fetching user data:", error);
    }
  }
});


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
exports.sendWelcomeMessages = functions.https.onCall(async (data, _) => {
  await sendWelcomeNotification(data);
  // await sendWelcomeMessage(data);
  return null;
});

/**
 * @param {auth.UserRecord} email The user's email
 * @param {auth.UserRecord} firstName The user's name
 */
async function sendGoodByeMessage(email, firstName) {
  const mailOptions = {
    from: {
      name: "AirQo Data Team",
      address: process.env.MAIL_USER,
    },
    to: email,
    subject: "We're Sad to See You Go - Account Deletion Confirmation!",
    html: emailTemplate.mobileAppGoodbye(email, firstName),
    attachments: [
      {
        filename: "airqoLogo.png",
        path: "./config/images/airqoLogo.png",
        cid: "AirQoEmailLogo",
        contentDisposition: "inline",
      },
      {
        filename: "faceBookLogo.png",
        path: "./config/images/facebookLogo.png",
        cid: "FacebookLogo",
        contentDisposition: "inline",
      },
      {
        filename: "youtubeLogo.png",
        path: "./config/images/youtubeLogo.png",
        cid: "YoutubeLogo",
        contentDisposition: "inline",
      },
      {
        filename: "twitterLogo.png",
        path: "./config/images/Twitter.png",
        cid: "Twitter",
        contentDisposition: "inline",
      },
      {
        filename: "linkedInLogo.png",
        path: "./config/images/linkedInLogo.png",
        cid: "LinkedInLogo",
        contentDisposition: "inline",
      }],
  };
  try {
    await transporter.sendMail(mailOptions);
    functions.logger.log("New Goodbye email sent to:", email);
    return null;
  } catch (error) {
    functions.logger.log("Transporter failed to send email", error);
  }
}
exports.deleteUserAccount = functions.auth.user().onDelete(async (user) => {
  if (user.email !== null) {
    const email = user.email;
    try {
      const userRef = firestoreDb.collection(process.env.USERS_COLLECTION)
          .doc(user.uid);
      const userDoc = await userRef.get();

      let firstName = userDoc.data().firstName;
      if (firstName == null) {
        firstName = "";
      }
      await sendGoodByeMessage(email, firstName);
    } catch (error) {
      functions.logger.log("Error fetching user data:", error);
    }
  }
});
