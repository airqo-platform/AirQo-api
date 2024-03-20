const transporter = require("@config/mailer");
const { logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const SubscriptionModel = require("@models/Subscription");
const constants = require("@config/constants");
const msgs = require("@utils/email.msgs");
const msgTemplates = require("@utils/email.templates");
const httpStatus = require("http-status");
const path = require("path");
const { HttpError } = require("@utils/errors");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- mailer-util`);
const processString = (inputString) => {
  const stringWithSpaces = inputString.replace(/[^a-zA-Z0-9]+/g, " ");
  const uppercasedString = stringWithSpaces.toUpperCase();
  return uppercasedString;
};
const imagePath = path.join(__dirname, "../config/images");
let attachments = [
  {
    filename: "airqoLogo.png",
    path: imagePath + "/airqoLogo.png",
    cid: "AirQoEmailLogo",
    contentDisposition: "inline",
  },
  {
    filename: "faceBookLogo.png",
    path: imagePath + "/facebookLogo.png",
    cid: "FacebookLogo",
    contentDisposition: "inline",
  },
  {
    filename: "youtubeLogo.png",
    path: imagePath + "/youtubeLogo.png",
    cid: "YoutubeLogo",
    contentDisposition: "inline",
  },
  {
    filename: "twitterLogo.png",
    path: imagePath + "/Twitter.png",
    cid: "Twitter",
    contentDisposition: "inline",
  },
  {
    filename: "linkedInLogo.png",
    path: imagePath + "/linkedInLogo.png",
    cid: "LinkedInLogo",
    contentDisposition: "inline",
  },
];

const mailer = {
  candidate: async (
    { firstName, lastName, email, tenant = "airqo" } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }

      let bccEmails = [];

      if (constants.REQUEST_ACCESS_EMAILS) {
        bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
      }

      let subscribedEmails = [];

      for (let i = 0; i < bccEmails.length; i++) {
        const bccEmail = bccEmails[i].trim();
        const checkResult = await SubscriptionModel(
          tenant
        ).checkNotificationStatus({ email: bccEmail, type: "email" });

        if (checkResult.success) {
          subscribedEmails.push(bccEmail);
        }
      }

      const subscribedBccEmails = subscribedEmails.join(",");

      let bcc = "";
      if (tenant.toLowerCase() === "airqo") {
        bcc = subscribedBccEmails;
      }
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "AirQo Analytics JOIN request",
        html: msgs.joinRequest(firstName, lastName, email),
        bcc,
        attachments: attachments,
      };

      let response = transporter.sendMail(mailOptions);
      let data = await response;
      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  request: async (
    { email, targetId, tenant = "airqo", entity_title = "" } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }

      let bccEmails = [];

      if (constants.REQUEST_ACCESS_EMAILS) {
        bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
      }

      let subscribedEmails = [];

      for (let i = 0; i < bccEmails.length; i++) {
        const bccEmail = bccEmails[i].trim();
        const checkResult = await SubscriptionModel(
          tenant
        ).checkNotificationStatus({ email: bccEmail, type: "email" });

        if (checkResult.success) {
          subscribedEmails.push(bccEmail);
        }
      }

      const subscribedBccEmails = subscribedEmails.join(",");

      let bcc = "";
      if (tenant.toLowerCase() === "airqo") {
        bcc = subscribedBccEmails;
      }

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: `AirQo Analytics Request to Access ${processString(
          entity_title
        )} Team`,
        html: msgs.joinEntityRequest(email, entity_title),
        bcc,
        attachments: attachments,
      };

      let response = transporter.sendMail(mailOptions);
      let data = await response;
      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  requestToJoinGroupByEmail: async (
    {
      email,
      targetId,
      tenant = "airqo",
      entity_title = "",
      inviterEmail = "",
      userExists,
    } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }

      let bccEmails = [];

      if (constants.REQUEST_ACCESS_EMAILS) {
        bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
      }

      let subscribedEmails = [];

      for (let i = 0; i < bccEmails.length; i++) {
        const bccEmail = bccEmails[i].trim();
        const checkResult = await SubscriptionModel(
          tenant
        ).checkNotificationStatus({ email: bccEmail, type: "email" });

        if (checkResult.success) {
          subscribedEmails.push(bccEmail);
        }
      }

      const subscribedBccEmails = subscribedEmails.join(",");
      let bcc = "";
      if (tenant.toLowerCase() === "airqo") {
        bcc = subscribedBccEmails;
      }
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: `AirQo Analytics Request to Access ${processString(
          entity_title
        )} Team`,
        html: msgTemplates.acceptInvitation({
          email,
          entity_title,
          targetId,
          inviterEmail,
          userExists,
        }),
        bcc,
        attachments: attachments,
      };

      let response = transporter.sendMail(mailOptions);
      let data = await response;
      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        // return {
        //   success: false,
        //   message: "Internal Server Error",
        //   status: httpStatus.INTERNAL_SERVER_ERROR,
        //   errors: {
        //     message: "email not sent",
        //     emailResults: data,
        //   },
        // };
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
      }
    } catch (error) {
      logObject("the error in the mailer", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  inquiry: async (
    { fullName, email, category, message, tenant = "airqo" } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }

      let bccEmails = [];
      if (tenant.toLowerCase() === "airqo") {
        let bccEmailString = "";
        switch (category) {
          case "partners":
            bccEmailString = constants.PARTNERS_EMAILS;
            break;
          case "policy":
            bccEmailString = constants.POLICY_EMAILS;
            break;
          case "champions":
            bccEmailString = constants.CHAMPIONS_EMAILS;
            break;
          case "researchers":
            bccEmailString = constants.RESEARCHERS_EMAILS;
            break;
          case "developers":
            bccEmailString = constants.DEVELOPERS_EMAILS;
            break;
          case "general":
            bccEmailString = constants.PARTNERS_EMAILS;
            break;
          case "assistance":
            bccEmailString = constants.ASSISTANCE_EMAILS;
            break;
          default:
            bccEmailString = constants.PARTNERS_EMAILS;
        }
        bccEmails = bccEmailString.split(",").map((email) => email.trim());
      }

      // Check notification status for all BCC emails concurrently
      const checkPromises = bccEmails.map(async (bccEmail) => {
        const checkResult = await SubscriptionModel(
          tenant
        ).checkNotificationStatus({ email: bccEmail, type: "email" });
        return checkResult.success ? bccEmail : null;
      });
      const successfulEmails = (await Promise.all(checkPromises)).filter(
        (email) => email !== null
      );
      const subscribedBccEmails = successfulEmails.join(",");

      const mailOptionsForAirQo = {
        to: `${email}`,
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        subject: `Welcome to AirQo`,
        html: msgs.inquiry(fullName, email, category),
        bcc: subscribedBccEmails,
        attachments,
      };

      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: "email successfully sent",
          data: [],
          status: httpStatus.OK,
        };
      }

      let response = transporter.sendMail(mailOptionsForAirQo);
      let data = await response;
      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  clientActivationRequest: async (
    { name, email, tenant = "airqo", client_id } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }

      const activateClientBccEmails =
        constants.REQUEST_ACCESS_EMAILS || "support@airqo.net";
      const bccEmails = activateClientBccEmails
        .split(",")
        .map((email) => email.trim());

      // Check notification status for all BCC emails concurrently
      const checkPromises = bccEmails.map(async (bccEmail) => {
        const checkResult = await SubscriptionModel(
          tenant
        ).checkNotificationStatus({ email: bccEmail, type: "email" });
        return checkResult.success ? bccEmail : null;
      });
      const successfulEmails = (await Promise.all(checkPromises)).filter(
        (email) => email !== null
      );
      const subscribedBccEmails = successfulEmails.join(",");

      const mailOptionsForAirQo = {
        to: `${email}`,
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        subject: `AirQo API Client Activation Request`,
        html: msgs.clientActivationRequest({ name, email, client_id }),
        bcc: subscribedBccEmails,
        attachments,
      };

      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: "email successfully sent",
          data: [],
          status: httpStatus.OK,
        };
      }

      let response = transporter.sendMail(mailOptionsForAirQo);
      let data = await response;
      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  user: async (
    { firstName, lastName, email, password, tenant = "airqo", type } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }

      let bccEmails = [];

      if (constants.REQUEST_ACCESS_EMAILS) {
        bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
      }

      let subscribedEmails = [];

      for (let i = 0; i < bccEmails.length; i++) {
        const bccEmail = bccEmails[i].trim();
        const checkResult = await SubscriptionModel(
          tenant
        ).checkNotificationStatus({ email: bccEmail, type: "email" });

        if (checkResult.success) {
          subscribedEmails.push(bccEmail);
        }
      }

      const subscribedBccEmails = subscribedEmails.join(",");

      let bcc = "";
      if (type === "confirm") {
        bcc = subscribedBccEmails;
      }

      let mailOptions = {};
      if (tenant.toLowerCase() === "kcca") {
        mailOptions = {
          from: {
            name: constants.EMAIL_NAME,
            address: constants.EMAIL,
          },
          to: `${email}`,
          subject: "Welcome to the AirQo KCCA Platform",
          html: msgs.welcome_kcca(firstName, lastName, password, email),
          bcc,
          attachments,
        };
      } else {
        mailOptions = {
          from: {
            name: constants.EMAIL_NAME,
            address: constants.EMAIL,
          },
          to: `${email}`,
          subject: "Welcome to AirQo Analytics",
          html: msgs.welcome_general(firstName, lastName, password, email),
          bcc,
          attachments,
        };
      }

      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: "email successfully sent",
          data: [],
          status: httpStatus.OK,
        };
      }

      let response = transporter.sendMail(mailOptions);
      let data = await response;
      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  verifyEmail: async (
    {
      user_id = "",
      token = "",
      email = "",
      firstName = "",
      category = "",
      tenant = "airqo",
    } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }
      let bccEmails = [];

      if (constants.REQUEST_ACCESS_EMAILS) {
        bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
      }

      let subscribedEmails = [];

      for (let i = 0; i < bccEmails.length; i++) {
        const bccEmail = bccEmails[i].trim();
        const checkResult = await SubscriptionModel(
          tenant
        ).checkNotificationStatus({ email: bccEmail, type: "email" });

        if (checkResult.success) {
          subscribedEmails.push(bccEmail);
        }
      }

      const subscribedBccEmails = subscribedEmails.join(",");
      const imagePath = path.join(__dirname, "../config/images");

      let mailOptions = {};
      mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "Verify your AirQo Analytics account",
        html: msgTemplates.v2_emailVerification({
          email,
          firstName,
          user_id,
          token,
          category,
        }),
        bcc: subscribedBccEmails,
        attachments: [
          {
            filename: "airqoLogo.png",
            path: imagePath + "/airqoLogo.png",
            cid: "AirQoEmailLogo",
            contentDisposition: "inline",
          },
          {
            filename: "faceBookLogo.png",
            path: imagePath + "/facebookLogo.png",
            cid: "FacebookLogo",
            contentDisposition: "inline",
          },
          {
            filename: "youtubeLogo.png",
            path: imagePath + "/youtubeLogo.png",
            cid: "YoutubeLogo",
            contentDisposition: "inline",
          },
          {
            filename: "twitterLogo.png",
            path: imagePath + "/Twitter.png",
            cid: "Twitter",
            contentDisposition: "inline",
          },
          {
            filename: "linkedInLogo.png",
            path: imagePath + "/linkedInLogo.png",
            cid: "LinkedInLogo",
            contentDisposition: "inline",
          },
        ],
      };

      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: "email successfully sent",
          data: [],
          status: httpStatus.OK,
        };
      }

      let response = transporter.sendMail(mailOptions);
      let data = await response;
      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  verifyMobileEmail: async (
    { firebase_uid = "", token = "", email = "", tenant = "airqo" } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }

      let bccEmails = [];

      if (constants.REQUEST_ACCESS_EMAILS) {
        bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
      }

      let subscribedEmails = [];

      for (let i = 0; i < bccEmails.length; i++) {
        const bccEmail = bccEmails[i].trim();
        const checkResult = await SubscriptionModel(
          tenant
        ).checkNotificationStatus({ email: bccEmail, type: "email" });

        if (checkResult.success) {
          subscribedEmails.push(bccEmail);
        }
      }

      const subscribedBccEmails = subscribedEmails.join(",");

      const imagePath = path.join(__dirname, "../config/images");

      let mailOptions = {};
      mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "Your Login Code for AirQo Mobile",
        html: msgTemplates.mobileEmailVerification({
          email,
          firebase_uid,
          token,
        }),
        bcc: subscribedBccEmails,
        attachments: [
          {
            filename: "airqoLogo.png",
            path: imagePath + "/airqoLogo.png",
            cid: "AirQoEmailLogo",
            contentDisposition: "inline",
          },
          {
            filename: "faceBookLogo.png",
            path: imagePath + "/facebookLogo.png",
            cid: "FacebookLogo",
            contentDisposition: "inline",
          },
          {
            filename: "youtubeLogo.png",
            path: imagePath + "/youtubeLogo.png",
            cid: "YoutubeLogo",
            contentDisposition: "inline",
          },
          {
            filename: "twitterLogo.png",
            path: imagePath + "/Twitter.png",
            cid: "Twitter",
            contentDisposition: "inline",
          },
          {
            filename: "linkedInLogo.png",
            path: imagePath + "/linkedInLogo.png",
            cid: "LinkedInLogo",
            contentDisposition: "inline",
          },
        ],
      };

      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: "email successfully sent",
          data: [],
          status: httpStatus.OK,
        };
      }

      let response = transporter.sendMail(mailOptions);
      let data = await response;
      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  afterEmailVerification: async (
    { firstName = "", username = "", email = "", tenant = "airqo" } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }

      let bccEmails = [];

      if (constants.REQUEST_ACCESS_EMAILS) {
        bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
      }

      let subscribedEmails = [];

      for (let i = 0; i < bccEmails.length; i++) {
        const bccEmail = bccEmails[i].trim();
        const checkResult = await SubscriptionModel(
          tenant
        ).checkNotificationStatus({ email: bccEmail, type: "email" });

        if (checkResult.success) {
          subscribedEmails.push(bccEmail);
        }
      }

      const subscribedBccEmails = subscribedEmails.join(",");

      let mailOptions = {};
      mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "Welcome to AirQo!",
        html: msgTemplates.afterEmailVerification(firstName, username, email),
        bcc: subscribedBccEmails,
        attachments: attachments,
      };

      let response = transporter.sendMail(mailOptions);
      let data = await response;
      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  afterClientActivation: async (
    {
      name = "",
      email = "",
      tenant = "airqo",
      client_id,
      action = "activate",
    } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }

      let bccEmails = [];

      if (constants.REQUEST_ACCESS_EMAILS) {
        bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
      }

      let subscribedEmails = [];

      for (let i = 0; i < bccEmails.length; i++) {
        const bccEmail = bccEmails[i].trim();
        const checkResult = await SubscriptionModel(
          tenant
        ).checkNotificationStatus({ email: bccEmail, type: "email" });

        if (checkResult.success) {
          subscribedEmails.push(bccEmail);
        }
      }

      const subscribedBccEmails = subscribedEmails.join(",");

      const subject =
        action === "activate"
          ? "AirQo API Client Successfully Activated!"
          : "AirQo API Client Successfully Deactivated!";
      const htmlContent =
        action === "activate"
          ? msgs.afterClientActivation({ name, email, client_id })
          : msgs.afterClientDeactivation({ name, email, client_id });

      let mailOptions = {};
      mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject,
        html: htmlContent,
        bcc: subscribedBccEmails,
        attachments: attachments,
      };

      let response = transporter.sendMail(mailOptions);
      let data = await response;
      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  afterAcceptingInvitation: async (
    { firstName, username, email, entity_title, tenant = "airqo" } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }

      let bccEmails = [];

      if (constants.REQUEST_ACCESS_EMAILS) {
        bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
      }

      let subscribedEmails = [];

      for (let i = 0; i < bccEmails.length; i++) {
        const bccEmail = bccEmails[i].trim();
        const checkResult = await SubscriptionModel(
          tenant
        ).checkNotificationStatus({ email: bccEmail, type: "email" });

        if (checkResult.success) {
          subscribedEmails.push(bccEmail);
        }
      }

      const subscribedBccEmails = subscribedEmails.join(",");

      let mailOptions = {};
      mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: `Welcome to ${entity_title}!`,
        html: msgTemplates.afterAcceptingInvitation({
          firstName,
          username,
          email,
          entity_title,
        }),
        bcc: subscribedBccEmails,
        attachments: attachments,
      };

      let response = transporter.sendMail(mailOptions);
      let data = await response;
      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  forgot: async (
    { email, token, tenant = "airqo", version = 2 } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      logObject("checkResult", checkResult);
      if (!checkResult.success) {
        return checkResult;
      }
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: `Link To Reset Password`,
        html: msgs.recovery_email({ token, tenant, email, version }),
        attachments: attachments,
      };
      let response = transporter.sendMail(mailOptions);
      let data = await response;

      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  signInWithEmailLink: async (
    { email, token, tenant = "airqo" } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }
      const imagePath = path.join(__dirname, "../config/images");
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "Verify your email address!",
        html: msgs.join_by_email(email, token),
        attachments: attachments,
      };

      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: "email successfully sent",
          data: [],
          status: httpStatus.OK,
        };
      }
      let response = transporter.sendMail(mailOptions);
      let data = await response;

      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deleteMobileAccountEmail: async (
    { email, token, tenant = "airqo" } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "Confirm Account Deletion - AirQo",
        html: msgTemplates.deleteMobileAccountEmail(email, token),
        attachments: attachments,
      };

      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: "email successfully sent",
          data: [],
          status: httpStatus.OK,
        };
      }

      let response = transporter.sendMail(mailOptions);
      let data = await response;

      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  authenticateEmail: async ({ email, token, tenant = "airqo" } = {}, next) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "Changes to your AirQo email",
        html: `${msgs.authenticate_email(token, email)}`,
        attachments: attachments,
      };

      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: "email successfully sent",
          data: [],
          status: httpStatus.OK,
        };
      }

      let response = transporter.sendMail(mailOptions);
      let data = await response;

      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  update: async (
    {
      email = "",
      firstName = "",
      lastName = "",
      updatedUserDetails = {},
      tenant = "airqo",
    } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "AirQo Analytics account updated",
        html: `${msgs.user_updated({
          firstName,
          lastName,
          updatedUserDetails,
          email,
        })}`,
        attachments: attachments,
      };
      let response = transporter.sendMail(mailOptions);
      let data = await response;

      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  assign: async (
    { email, firstName, lastName, assignedTo, tenant = "airqo" } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "Welcome to Your New Group/Network at AirQo Analytics",
        html: `${msgs.user_assigned(firstName, lastName, assignedTo, email)}`,
        attachments: attachments,
      };
      let response = transporter.sendMail(mailOptions);
      let data = await response;

      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateForgottenPassword: async (
    { email, firstName, lastName, tenant = "airqo" } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "AirQo Analytics Password Reset Successful",
        html: `${msgs.forgotten_password_updated(firstName, lastName, email)}`,
        attachments: attachments,
      };
      let response = transporter.sendMail(mailOptions);
      let data = await response;

      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateKnownPassword: async (
    { email, firstName, lastName, tenant = "airqo" } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "AirQo Analytics Password Update Successful",
        html: `${msgs.known_password_updated(firstName, lastName, email)}`,
        attachments: attachments,
      };
      let response = transporter.sendMail(mailOptions);
      let data = await response;

      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  newMobileAppUser: async (
    { email, message, subject, tenant = "airqo" } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }

      let bccEmails = [];

      if (constants.REQUEST_ACCESS_EMAILS) {
        bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
      }

      let subscribedEmails = [];

      for (let i = 0; i < bccEmails.length; i++) {
        const bccEmail = bccEmails[i].trim();
        const checkResult = await SubscriptionModel(
          tenant
        ).checkNotificationStatus({ email: bccEmail, type: "email" });

        if (checkResult.success) {
          subscribedEmails.push(bccEmail);
        }
      }

      const subscribedBccEmails = subscribedEmails.join(",");

      logObject("the values to send to email function", {
        email,
        message,
        subject,
      });

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        subject,
        html: message,
        to: email,
        bcc: subscribedBccEmails,
      };

      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: "email successfully sent",
          data: [],
          status: httpStatus.OK,
        };
      }

      const response = await transporter.sendMail(mailOptions);

      const data = response;
      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  feedback: async (
    { email, message, subject, tenant = "airqo" } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }

      let bccEmails = [];

      if (constants.REQUEST_ACCESS_EMAILS) {
        bccEmails = constants.REQUEST_ACCESS_EMAILS.split(",");
      }

      let subscribedEmails = [];

      for (let i = 0; i < bccEmails.length; i++) {
        const bccEmail = bccEmails[i].trim();
        const checkResult = await SubscriptionModel(
          tenant
        ).checkNotificationStatus({ email: bccEmail, type: "email" });

        if (checkResult.success) {
          subscribedEmails.push(bccEmail);
        }
      }

      const subscribedBccEmails = subscribedEmails.join(",");

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        subject,
        text: message,
        cc: email,
        to: constants.SUPPORT_EMAIL,
        bcc: subscribedBccEmails,
      };

      if (email === "automated-tests@airqo.net") {
        return {
          success: true,
          message: "email successfully sent",
          data: [],
          status: httpStatus.OK,
        };
      }

      const response = await transporter.sendMail(mailOptions);

      const data = response;
      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  sendReport: async (
    {
      senderEmail,
      normalizedRecepientEmails,
      pdfFile,
      csvFile,
      tenant = "airqo",
    } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email: senderEmail, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }
      let formart;
      let reportAttachments = [...attachments];

      if (pdfFile) {
        formart = "PDF";
        const pdfBase64 = pdfFile.data.toString("base64");
        const pdfAttachment = {
          filename: "Report.pdf",
          contentType: "application/pdf",
          content: pdfBase64,
          encoding: "base64",
        };
        reportAttachments.push(pdfAttachment);
      }
      if (csvFile) {
        formart = "CSV";
        const csvBase64 = csvFile.data.toString("base64");
        const csvAttachment = {
          filename: "Report.csv",
          content: csvBase64,
          encoding: "base64",
        };
        reportAttachments.push(csvAttachment);
      }
      const emailResults = [];

      for (const recepientEmail of normalizedRecepientEmails) {
        if (recepientEmail === "automated-tests@airqo.net") {
          return {
            success: true,
            message: "Email successfully sent",
            data: [],
            status: httpStatus.OK,
          };
        }

        const mailOptions = {
          from: {
            name: constants.EMAIL_NAME,
            address: constants.EMAIL,
          },
          subject: "AirQo Analytics Report",
          html: msgs.report(senderEmail, recepientEmail, formart),
          to: recepientEmail,
          attachments: reportAttachments,
        };

        const response = await transporter.sendMail(mailOptions);

        if (isEmpty(response.rejected) && !isEmpty(response.accepted)) {
          emailResults.push({
            success: true,
            message: "Email successfully sent",
            data: response,
            status: httpStatus.OK,
          });
        } else {
          emailResults.push({
            success: false,
            message: "Email not sent",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: { message: response },
          });
        }
      }
      const hasFailedEmail = emailResults.some((result) => !result.success);

      if (hasFailedEmail) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "One or more emails failed to send",
              emailResults,
            }
          )
        );
      } else {
        return {
          success: true,
          message: "All emails successfully sent",
          data: emailResults,
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  siteActivity: async (
    {
      email = "",
      firstName = "",
      lastName = "",
      siteActivityDetails = {},
      tenant = "airqo",
    } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }

      let bccEmails = [];

      if (constants.HARDWARE_AND_DS_EMAILS) {
        bccEmails = constants.HARDWARE_AND_DS_EMAILS.split(",");
      }

      let subscribedEmails = [];

      for (let i = 0; i < bccEmails.length; i++) {
        const bccEmail = bccEmails[i].trim();
        const checkResult = await SubscriptionModel(
          tenant
        ).checkNotificationStatus({ email: bccEmail, type: "email" });

        if (checkResult.success) {
          subscribedEmails.push(bccEmail);
        }
      }

      const subscribedBccEmails = subscribedEmails.join(",");

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject:
          "AirQo Analytics: Post-Activity Notification for Device Management Actions",
        html: `${msgs.site_activity({
          firstName,
          lastName,
          siteActivityDetails,
          email,
        })}`,
        bcc: subscribedBccEmails,
        attachments: attachments,
      };
      let response = transporter.sendMail(mailOptions);
      let data = await response;

      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  compromisedToken: async (
    {
      email = "",
      firstName = "",
      lastName = "",
      ip = "",
      tenant = "airqo",
    } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }

      let bccEmails = [];

      if (constants.PLATFORM_AND_DS_EMAILS) {
        bccEmails = constants.PLATFORM_AND_DS_EMAILS.split(",");
      }

      let subscribedEmails = [];

      for (let i = 0; i < bccEmails.length; i++) {
        const bccEmail = bccEmails[i].trim();
        const checkResult = await SubscriptionModel(
          tenant
        ).checkNotificationStatus({ email: bccEmail, type: "email" });

        if (checkResult.success) {
          subscribedEmails.push(bccEmail);
        }
      }

      const subscribedBccEmails = subscribedEmails.join(",");

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject:
          "Urgent Security Alert - Potential Compromise of Your AIRQO API Token",
        html: `${msgs.token_compromised({
          firstName,
          lastName,
          ip,
          email,
        })}`,
        bcc: subscribedBccEmails,
        attachments: attachments,
      };
      let response = transporter.sendMail(mailOptions);
      let data = await response;

      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  existingUserAccessRequest: async (
    { email = "", firstName = "", lastName = "", tenant = "airqo" } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) {
        return checkResult;
      }

      let bccEmails = [];

      if (constants.PLATFORM_AND_DS_EMAILS) {
        bccEmails = constants.PLATFORM_AND_DS_EMAILS.split(",");
      }

      let subscribedEmails = [];

      for (let i = 0; i < bccEmails.length; i++) {
        const bccEmail = bccEmails[i].trim();
        const checkResult = await SubscriptionModel(
          tenant
        ).checkNotificationStatus({ email: bccEmail, type: "email" });

        if (checkResult.success) {
          subscribedEmails.push(bccEmail);
        }
      }

      const subscribedBccEmails = subscribedEmails.join(",");

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "AirQo Analytics: Existing User Access Request",
        html: `${msgs.existing_user({
          firstName,
          lastName,
          email,
        })}`,
        bcc: subscribedBccEmails,
        attachments: attachments,
      };
      let response = transporter.sendMail(mailOptions);
      let data = await response;

      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "email not sent",
              emailResults: data,
            }
          )
        );
        return;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
};

module.exports = mailer;
