/* eslint-disable object-curly-spacing */
/* eslint-disable guard-for-in */
/* eslint-disable indent */
/* eslint-disable max-len */
/* eslint-disable no-unused-vars */
"use strict";
require("dotenv").config();

const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

const functions = require("firebase-functions");
const {getAuth} = require("firebase-admin/auth");
const nodemailer = require("nodemailer");
const DOMPurify = require("dompurify");

const emailTemplate = require("./config/emailTemplates");
const crypto = require("crypto");
const axios = require("axios");

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
 * @param {any} userId The user's id
 * @param {any} token The user's token
 */
async function sendDeleteConfirmationEmail(email, userId, token) {
  const mailOptions = {
    from: {
      name: "AirQo Data Team",
      address: process.env.MAIL_USER,
    },
    to: email,
    subject: "Confirm Account Deletion - AirQo!",
    html: emailTemplate.deleteConfirmationEmail(email, userId, token),
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
      creationTime = creationTime.replace(/\D/g, "");

      const tokenString = `${userId}+${creationTime}`;


      const token = crypto
          .createHash("sha256")
          .update(tokenString)
          .digest("hex");

      console.log("Token:", token);

      sendDeleteConfirmationEmail(email, userId, token);
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


/**
 * @param {any} groupedFavorites List of Users and their favorites
 */
async function sendEmailNotifications(groupedFavorites) {
  for (const userID in groupedFavorites) {
    const userFavorites = groupedFavorites[userID];

    const mailOptions = {
      from: {
        name: "AirQo Data Team",
        address: process.env.MAIL_USER,
      },
      to: userFavorites[0].userEmail,
      subject: "Exciting Updates from Your Favorite Locations!",
      html: emailTemplate.email_notification(userFavorites, userID),
      attachments: [
        {
          filename: "favoriteIcon.png",
          path: "./config/images/favoriteIcon.png",
          cid: "FavoriteIcon",
          contentDisposition: "inline",
        },
        {
          filename: "airqoLogo.png",
          path: "./config/images/airqoLogoAlternate.png",
          cid: "AirQoEmailLogoAlternate",
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
      functions.logger.log("New Email notification sent to ", userFavorites[0].userEmail);
    } catch (error) {
      functions.logger.log("Transporter failed to send email", error);
    }
  }
}

exports.sendWeeklyNotifications = functions.pubsub
  .schedule("0 0 * * 1")
  .onRun(async (context) => {
    try {
      const headers = {
        "Authorization": process.env.JWT_TOKEN,
      };
      const responseFromGetFavorites = await axios.get(`${process.env.PLATFORM_BASE_URL}/api/v2/users/favorites`,
        { headers: headers });

      if (responseFromGetFavorites.data.success === true) {
        const favorites = responseFromGetFavorites.data.favorites;
        const groupedFavorites = {};

        for (const favorite of favorites) {
          try {
            const userID = favorite.firebase_user_id;
            const user = await getAuth().getUser(userID);
            const userEmail = user.email;
            const userRef = firestoreDb.collection(process.env.USERS_COLLECTION).doc(userID);
            const userDoc = await userRef.get();
            if (userDoc.exists) {
              const isSubscribedToEmailNotifs = userDoc.data().isSubscribedToEmailNotifs;

              if (userEmail && isSubscribedToEmailNotifs !== false) {
                const { name, location } = favorite;

                if (!groupedFavorites[userID]) {
                  groupedFavorites[userID] = [];
                }

                groupedFavorites[userID].push({ name, location, userEmail });
              }
            }
          } catch (error) {
            functions.logger.log("Error getting Favorites", error);
          }
        }

        await sendEmailNotifications(groupedFavorites);
      } else {
        functions.logger.log("Error fetching Favorites", responseFromGetFavorites);
      }
      return null;
    } catch (error) {
      console.error("Error:", error);
      functions.logger.log("Error sending notifications", error);
    }
  });


/**
 * @param {auth.UserRecord} email The user's email
 * @param {auth.UserRecord} firstName The user's name
 * @param {auth.UserRecord} userId The user's userId
 */
async function sendUnsubscriptionEmail(email, firstName, userId) {
  const mailOptions = {
    from: {
      name: "AirQo Data Team",
      address: process.env.MAIL_USER,
    },
    to: email,
    subject: "We're Sad to See You Go - Unsubscription Confirmation!",
    html: emailTemplate.emailNotificationUnsubscibe(email, firstName, userId),
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
    functions.logger.log("New Unscription email sent to:", email);
    return null;
  } catch (error) {
    functions.logger.log("Transporter failed to send email", error);
  }
}

exports.emailNotifsUnsubscribe = functions.https.onRequest(async (req, res) => {
  try {
    const userId = DOMPurify.sanitize(req.query.userId);
    const email = DOMPurify.sanitize(req.query.email);
    const userRef = firestoreDb.collection(process.env.USERS_COLLECTION).doc(userId);
    const userDoc = await userRef.get();
    let name = userDoc.data().firstName;
    if (name == null) {
      name = "";
    }

    if (!userDoc.exists) {
      await userRef.set({
        isSubscribedToEmailNotifs: false,
      });
    } else {
      await userRef.update({
        isSubscribedToEmailNotifs: false,
      });
    }
    await sendUnsubscriptionEmail(email, name, userId);
    res.redirect("https://airqo.page.link/NOTIF");
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while processing your request.");
  }
});

exports.emailNotifsSubscribe = functions.https.onRequest(async (req, res) => {
  try {
    const userId = DOMPurify.sanitize(req.query.userId);
    const userRef = firestoreDb.collection(process.env.USERS_COLLECTION).doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      await userRef.set({
        isSubscribedToEmailNotifs: true,
      });
    } else {
      await userRef.update({
        isSubscribedToEmailNotifs: true,
      });
    }
    res.redirect("https://airqo.page.link/NOTIF");
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while processing your request.");
  }
});
