/* eslint-disable object-curly-spacing */
/* eslint-disable guard-for-in */
/* eslint-disable indent */
/* eslint-disable max-len */
/* eslint-disable no-unused-vars */
"use strict";
require("dotenv").config();

const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

const admin = require("firebase-admin");
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

const headers = {
  "Authorization": process.env.JWT_TOKEN,
};

const emailAttachements = [
  {
    filename: "favoriteIcon.png",
    path: "./config/images/favoriteIcon.png",
    cid: "FavoriteIcon",
    contentDisposition: "inline",
  },
  {
    filename: "airqoLogoAlternate.png",
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
  }];

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
          filename: "airqoLogoAlternate.png",
          path: "./config/images/airqoLogo.png",
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


exports.sendFCMNotification =
  functions.pubsub
  .schedule("0 8 * * *")
    .timeZone("Africa/Kampala")
    .onRun(async (context) => {
      try {
        const message = {
          notification: {
            title: "Air quality update from favorites!",
            body: "You have some updates from your favorite locations. View now",
          },
          data: {
            subject: "favorites",
          },
          topic: "push-notifications",
        };

        admin.messaging().send(message)
          .then((response) => {
            console.log("Successfully sent message:", response);
          })
          .catch((error) => {
            console.log("Error sending message:", error);
          });
        return null;
      } catch (error) {
        console.error("Error sending FCM notifications:", error);
        return null;
      }
    });


/**
 * @param {set} attachmentsSet Set of attachments
 * @param {string} filename The filename
 * @param {string} path The path to the file
 * @param {string} cid The cid
 */
function addAttachment(attachmentsSet, filename, path, cid) {
  if (!attachmentsSet.has(cid)) {
    attachmentsSet.add({
      filename,
      path,
      cid,
    });
  }
}
/**
 * @param {any} groupedFavorites List of Users and their favorites
 */
async function sendForecastEmails(groupedFavorites) {
  try {
    for (const userID in groupedFavorites) {
      const userFavorites = groupedFavorites[userID];
      let airQualityLevels = [];

      const emojiAttachments = new Set();

      for (const favorite of userFavorites) {
        airQualityLevels = favorite.airQualityLevels;

        airQualityLevels.forEach((airQualityLevel) => {
          switch (airQualityLevel) {
            case "good":
              addAttachment(emojiAttachments, "goodEmoji.png", "./config/images/goodEmoji.png", "goodEmoji");
              break;
            case "moderate":
              addAttachment(emojiAttachments, "moderateEmoji.png", "./config/images/moderateEmoji.png", "moderateEmoji");
              break;
            case "uhfsg":
              addAttachment(emojiAttachments, "uhfsgEmoji.png", "./config/images/uhfsgEmoji.png", "uhfsgEmoji");
              break;
            case "unhealthy":
              addAttachment(emojiAttachments, "unhealthyEmoji.png", "./config/images/unhealthyEmoji.png", "unhealthyEmoji");
              break;
            case "veryUnhealthy":
              addAttachment(emojiAttachments, "veryUnhealthyEmoji.png", "./config/images/veryUnhealthyEmoji.png", "veryUnhealthyEmoji");
              break;
            case "hazardous":
              addAttachment(emojiAttachments, "hazardousEmoji.png", "./config/images/hazardousEmoji.png", "hazardousEmoji");
              break;
          }
        });
      }

      const attachments = [
        ...emojiAttachments,
        ...emailAttachements,
      ];
      const mailOptions = {
        from: {
          name: "AirQo Data Team",
          address: process.env.MAIL_USER,
        },
        to: userFavorites[0].userEmail,
        subject: "Exciting Updates from Your Favorite Locations!",
        html: emailTemplate.favorite_forecast_email(userFavorites, userID),
        attachments: attachments,
      };

      try {
        await transporter.sendMail(mailOptions);
        functions.logger.log("New Email notification sent to ", userFavorites[0].userEmail);
      } catch (error) {
        functions.logger.log("Transporter failed to send email", error);
      }
    }
  } catch (error) {
    functions.logger.log("Forecast Favorites Email sending failed", error);
  }
}

exports.sendFavoritesForecastEmails = functions.pubsub
  .schedule("0 4 * * 1")
  .onRun(async (context) => {
    try {
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

                const responseFromGetForecast = await axios.get(`${process.env.PLATFORM_BASE_URL}/api/v2/predict/daily-forecast?site_id=${favorite.place_id}`,
                  { headers: headers });
                if (responseFromGetForecast.status !== 200) {
                  functions.logger.log("Error getting Forecast", responseFromGetForecast);
                  return null;
                }
                const pmValues = responseFromGetForecast.data.forecasts.map((forecast) => forecast.pm2_5);
                const airQualityLevels = pmValues.map((pm) => {
                  if (pm >= 0 && pm <= 12) {
                    return "good";
                  } else if (pm > 12 && pm <= 35.4) {
                    return "moderate";
                  } else if (pm > 35.4 && pm <= 55.4) {
                    return "uhfsg";
                  } else if (pm > 55.4 && pm <= 150.4) {
                    return "unhealthy";
                  } else if (pm > 150.4 && pm <= 250.4) {
                    return "veryUnhealthy";
                  } else {
                    return "hazardous";
                  }
                });


                if (!groupedFavorites[userID]) {
                  groupedFavorites[userID] = [];
                }

                groupedFavorites[userID].push({ name, location, userEmail, airQualityLevels });
              }
            }
          } catch (error) {
            functions.logger.log("Error grouping favorites", error);
          }
        }
        await sendForecastEmails(groupedFavorites);
      } else {
        functions.logger.log("Error fetching Favorites", responseFromGetFavorites);
      }
      return;
    } catch (error) {
      functions.logger.log("Error sending notifications", error);
    }
  });
