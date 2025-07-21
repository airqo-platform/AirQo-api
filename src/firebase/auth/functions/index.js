/* eslint-disable */

"use strict";
require("dotenv").config();

const functions = require("firebase-functions");

const nodemailer = require("nodemailer");
const DOMPurify = require("dompurify");

const emailTemplate = require("./config/emailTemplates");
const utils = require("./utils/utils");
const crypto = require("crypto");
const axios = require("axios");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: `${process.env.MAIL_USER}`,
    pass: `${process.env.MAIL_PASS}`,
  },
});

const { firestoreDb } = require("./utils/firebaseConfig");
const { getAuth } = require("firebase-admin/auth");
const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");

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
    functions.logger.error("Transporter failed to send email", error);
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
      functions.logger.error(
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
    functions.logger.error("Transporter failed to send email", error);
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
      functions.logger.error("Error fetching user data:", error);
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
    functions.logger.error("Transporter failed to send email", error);
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
      functions.logger.error("Error fetching user data:", error);
    }
  }
});


/**
 * @param {any} groupedFavorites List of Users and their favorites
 */
async function sendWeeklyNotifications(groupedFavorites) {
  for (const userID in groupedFavorites) {
    const userFavorites = groupedFavorites[userID];

    //randomly choose a favorite
    const randomFavorite = userFavorites[Math.floor(Math.random() * userFavorites.length)];

    const responseFromGetMeasurements = await axios.get(`${process.env.PLATFORM_BASE_URL}/api/v2/devices/measurements/sites/${randomFavorite.placeId}?token=${process.env.API_TOKEN}`,);
    if (responseFromGetMeasurements.status !== 200) {
      functions.logger.error("Error getting Measurements", responseFromGetMeasurements);
      return null;
    }
    const pmValue = responseFromGetMeasurements.data.measurements[0].pm2_5.value;

    const mailOptions = {
      from: {
        name: "AirQo Data Team",
        address: process.env.MAIL_USER,
      },
      to: userFavorites[0].userEmail,
      subject: ` Air quality of ${randomFavorite.name} is ${utils.mapPMValues(pmValue)} with a concentration level of ${pmValue.toFixed(2)}µg/m3!`,
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
      functions.logger.error("Transporter failed to send email", error);
    }
  }
}

exports.sendWeeklyNotifications = functions.pubsub
  .schedule("0 0 * * 1")
  .onRun(async (context) => {
    try {
      const groupedFavorites = await utils.groupFavorites("weekly");
      if (groupedFavorites.success === false) {
        functions.logger.error("Error grouping Favorites", groupedFavorites.error);
        return null;
      }

      await sendWeeklyNotifications(groupedFavorites);

      return null;
    } catch (error) {
      functions.logger.error("Error sending notifications", error);
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
    functions.logger.error("Transporter failed to send email", error);
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
              utils.addAttachment(emojiAttachments, "goodEmoji.png", "./config/images/goodEmoji.png", "goodEmoji");
              break;
            case "moderate":
              utils.addAttachment(emojiAttachments, "moderateEmoji.png", "./config/images/moderateEmoji.png", "moderateEmoji");
              break;
            case "uhfsg":
              utils.addAttachment(emojiAttachments, "uhfsgEmoji.png", "./config/images/uhfsgEmoji.png", "uhfsgEmoji");
              break;
            case "unhealthy":
              utils.addAttachment(emojiAttachments, "unhealthyEmoji.png", "./config/images/unhealthyEmoji.png", "unhealthyEmoji");
              break;
            case "veryUnhealthy":
              utils.addAttachment(emojiAttachments, "veryUnhealthyEmoji.png", "./config/images/veryUnhealthyEmoji.png", "veryUnhealthyEmoji");
              break;
            case "hazardous":
              utils.addAttachment(emojiAttachments, "hazardousEmoji.png", "./config/images/hazardousEmoji.png", "hazardousEmoji");
              break;
          }
        });
      }

      const attachments = [
        ...emojiAttachments,
        ...emailAttachements,
      ];

      //randomly choose a favorite
      const randomFavorite = userFavorites[Math.floor(Math.random() * userFavorites.length)];

      const responseFromGetMeasurements = await axios.get(`${process.env.PLATFORM_BASE_URL}/api/v2/devices/measurements/sites/${randomFavorite.placeId}?token=${process.env.API_TOKEN}`,);
      if (responseFromGetMeasurements.status !== 200) {
        functions.logger.error("Error getting Measurements", responseFromGetMeasurements);
        return null;
      }
      const pmValue = responseFromGetMeasurements.data.measurements[0].pm2_5.value;

      const mailOptions = {
        from: {
          name: "AirQo Data Team",
          address: process.env.MAIL_USER,
        },
        to: userFavorites[0].userEmail,
        subject: ` Air quality of ${randomFavorite.name} is expected to be ${utils.mapPMValues(pmValue)} with a concentration level of ${pmValue.toFixed(2)}µg/m3!`,
        html: emailTemplate.favorite_forecast_email(userFavorites, userID),
        attachments: attachments,
      };

      try {
        await transporter.sendMail(mailOptions);
        functions.logger.log("New Email notification sent to ", userFavorites[0].userEmail);
      } catch (error) {
        functions.logger.error("Transporter failed to send email", error);
      }
    }
  } catch (error) {
    functions.logger.error("Forecast Favorites Email sending failed", error);
  }
}

exports.sendFavoritesForecastEmails = functions.pubsub
  .schedule("0 4 * * 1")
  .onRun(async (context) => {
    try {
      const groupedFavorites = await utils.groupFavorites("forecast");
      if (groupedFavorites.success === false) {
        functions.logger.error("Error grouping Favorites", groupedFavorites.error);
        return null;
      }

        await sendForecastEmails(groupedFavorites);

      return;
    } catch (error) {
      functions.logger.error("Error sending notifications", error);
    }
  });
