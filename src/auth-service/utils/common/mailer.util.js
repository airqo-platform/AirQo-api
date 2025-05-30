const transporter = require("@config/mailer.config");
const isEmpty = require("is-empty");
const SubscriptionModel = require("@models/Subscription");
const constants = require("@config/constants");
const msgs = require("./email.msgs");
const msgTemplates = require("./email.templates");
const httpStatus = require("http-status");
const path = require("path");
const {
  sendMailWithDeduplication,
  emailDeduplicator,
} = require("./emailDeduplication");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  sanitizeEmailString,
  extractErrorsFromRequest,
} = require("@utils/shared");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- mailer-util`);
const processString = (inputString) => {
  const stringWithSpaces = inputString.replace(/[^a-zA-Z0-9]+/g, " ");
  const uppercasedString = stringWithSpaces.toUpperCase();
  return uppercasedString;
};

const projectRoot = path.join(__dirname, "..", ".."); // Go two levels up
// const projectRoot = "/usr/src/app";
const imagePath = path.join(projectRoot, "config", "images");

let attachments = [
  {
    filename: "airqoLogo.png",
    path: path.join(imagePath, "airqoLogo.png"),
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

const getSubscribedBccEmails = async () => {
  let bccEmails = constants.HARDWARE_AND_DS_EMAILS
    ? constants.HARDWARE_AND_DS_EMAILS.split(",")
    : [];
  let subscribedEmails = [];

  const checkPromises = bccEmails.map(async (bccEmail) => {
    try {
      const checkResult = await SubscriptionModel(
        "airqo"
      ).checkNotificationStatus({ email: bccEmail.trim(), type: "email" });
      return checkResult.success ? bccEmail.trim() : null;
    } catch (error) {
      logger.error(
        `Error checking notification status for ${bccEmail}: ${error.message}`
      );
      return null;
    }
  });
  const successfulEmails = (await Promise.all(checkPromises)).filter(
    (email) => email !== null
  );
  subscribedEmails = successfulEmails;
  return subscribedEmails.join(",");
};

const createMailOptions = ({
  email,
  firstName,
  lastName,
  activityDetails,
  deviceDetails,
  bccEmails,
  activityType,
} = {}) => {
  const subject =
    activityType === "recall"
      ? "Your AirQo Account: Device Recall Notification"
      : "Your AirQo Account: Device Deployment Notification";

  return {
    from: {
      name: constants.EMAIL_NAME,
      address: constants.EMAIL,
    },
    to: email,
    subject,
    html: msgs.field_activity({
      firstName,
      lastName,
      email,
      activityDetails,
      deviceDetails,
      activityType,
    }),
    bcc: bccEmails,
    attachments: attachments,
  };
};
const handleMailResponse = (data) => {
  if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
    return { success: true, message: "Email successfully sent", data };
  } else {
    throw new HttpError(
      "Internal Server Error",
      httpStatus.INTERNAL_SERVER_ERROR,
      { message: "Email not sent", emailResults: data }
    );
  }
};

const getSubscribedEmails = async (emailList, tenant) => {
  if (!emailList || !emailList.length) return [];

  const checkPromises = emailList.map(async (email) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email: email.trim(), type: "email" });
      return checkResult.success ? email.trim() : null;
    } catch (error) {
      logger.error(
        `Error checking notification status for ${email}: ${error.message}`
      );
      return null;
    }
  });

  const subscribedEmails = (await Promise.all(checkPromises)).filter(Boolean);
  return subscribedEmails;
};

const mailer = {
  notifyAdminsOfNewOrgRequest: async (
    { organization_name, contact_name, contact_email, tenant = "airqo" } = {},
    next
  ) => {
    try {
      // Get admin emails
      let adminEmails = constants.REQUEST_ACCESS_EMAILS
        ? constants.REQUEST_ACCESS_EMAILS.split(",")
        : ["support@airqo.net"];

      // Get subscribed emails in parallel
      const subscribedEmails = await getSubscribedEmails(adminEmails, tenant);

      // Format all admin emails for BCC
      const subscribedBccEmails = subscribedEmails.join(",");

      // If no admins can receive emails, send to a default address
      const toEmail =
        subscribedEmails.length > 0 ? subscribedEmails[0] : "support@airqo.net";

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: toEmail,
        subject: `New Organization Request: ${sanitizeEmailString(
          organization_name
        )}`,
        html: msgs.notifyAdminsOfNewOrgRequest({
          organization_name,
          contact_name,
          contact_email,
        }),
        bcc: subscribedBccEmails,
        attachments: attachments,
      };

      // Send the email
      let response = transporter.sendMail(mailOptions);
      let data = await response;

      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "Admin notification email sent successfully",
          data,
          status: httpStatus.OK,
        };
      } else {
        if (next) {
          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: "Email notification to admins failed",
                emailResults: data,
              }
            )
          );
        }
        return {
          success: false,
          message: "Email notification to admins failed",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      if (next) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      }
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  confirmOrgRequestReceived: async (
    { organization_name, contact_name, contact_email, tenant = "airqo" } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email: contact_email, type: "email" });

      if (!checkResult.success) {
        return checkResult;
      }

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: contact_email,
        subject: `Your Organization Request: ${sanitizeEmailString(
          organization_name
        )}`,
        html: msgs.confirmOrgRequestReceived({
          organization_name,
          contact_name,
          contact_email,
        }),
        attachments: attachments,
      };

      // Send the email
      let response = transporter.sendMail(mailOptions);
      let data = await response;

      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "Confirmation email sent successfully",
          data,
          status: httpStatus.OK,
        };
      } else {
        if (next) {
          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: "Confirmation email failed",
                emailResults: data,
              }
            )
          );
        }
        return {
          success: false,
          message: "Confirmation email failed",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      if (next) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      }
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  notifyOrgRequestApproved: async (
    {
      organization_name,
      contact_name,
      contact_email,
      login_url,
      tenant = "airqo",
    } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email: contact_email, type: "email" });

      if (!checkResult.success) {
        return checkResult;
      }

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: contact_email,
        subject: `Organization Request Approved: ${sanitizeEmailString(
          organization_name
        )}`,
        html: msgs.notifyOrgRequestApproved({
          organization_name,
          contact_name,
          contact_email,
          login_url,
        }),
        attachments: attachments,
      };

      // Send the email
      let response = transporter.sendMail(mailOptions);
      let data = await response;

      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "Approval notification email sent successfully",
          data,
          status: httpStatus.OK,
        };
      } else {
        if (next) {
          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: "Approval notification email failed",
                emailResults: data,
              }
            )
          );
        }
        return {
          success: false,
          message: "Approval notification email failed",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      if (next) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      }
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  notifyOrgRequestRejected: async (
    {
      organization_name,
      contact_name,
      contact_email,
      rejection_reason,
      tenant = "airqo",
    } = {},
    next
  ) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email: contact_email, type: "email" });

      if (!checkResult.success) {
        return checkResult;
      }

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: contact_email,
        subject: `Organization Request Status: ${sanitizeEmailString(
          organization_name
        )}`,
        html: msgs.notifyOrgRequestRejected({
          organization_name,
          contact_name,
          contact_email,
          rejection_reason,
        }),
        attachments: attachments,
      };

      // Send the email
      let response = transporter.sendMail(mailOptions);
      let data = await response;

      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "Rejection notification email sent successfully",
          data,
          status: httpStatus.OK,
        };
      } else {
        if (next) {
          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: "Rejection notification email failed",
                emailResults: data,
              }
            )
          );
        }
        return {
          success: false,
          message: "Rejection notification email failed",
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      if (next) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      }
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
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
        subject: "Your AirQo Account JOIN request",
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
        subject: `Your AirQo Account Request to Access ${processString(
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
  yearEndEmail: async ({
    email = "",
    firstName = "",
    lastName = "",
    tenant = "airqo",
    userStat = {},
  } = {}) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({ email, type: "email" });

      if (!checkResult.success) {
        return checkResult;
      }

      const mailOptions = {
        to: email,
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        subject: "Your Your AirQo Account 2024 Year in Review 🌍",
        html: msgs.yearEndSummary(userStat),
        attachments: attachments,
      };

      let response = transporter.sendMail(mailOptions);
      let data = await response;

      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "Year-end email successfully sent",
          data,
          status: httpStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: "Email not sent", emailResults: data },
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
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
        subject: `Your AirQo Account Request to Access ${processString(
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
          subject: "Welcome to Your AirQo Account",
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

      let mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "Verify your Your AirQo Account account",
        html: msgTemplates.v2_emailVerification({
          email,
          firstName,
          user_id,
          token,
          category,
        }),
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

      // Replace transporter.sendMail with sendMailWithDeduplication
      const result = await sendMailWithDeduplication(transporter, mailOptions, {
        skipDeduplication: false,
        logDuplicates: true,
        throwOnDuplicate: false,
      });

      // Handle duplicate case
      if (result.duplicate) {
        logger.info(`Duplicate verification email prevented for: ${email}`);
        return {
          success: true,
          message: "Verification email already sent recently",
          data: null,
          status: httpStatus.OK,
        };
      }

      // Handle success/failure
      if (result.success && !isEmpty(result.data.accepted)) {
        return {
          success: true,
          message: "Email successfully sent",
          data: result.data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "Email not sent",
              emailResults: result.data,
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

  clearEmailDeduplication: async (email, subject, content = "") => {
    try {
      const mockMailOptions = {
        to: email,
        subject: subject,
        html: content,
      };

      const removed = await emailDeduplicator.removeEmailKey(mockMailOptions);
      return {
        success: true,
        message: removed ? "Deduplication key removed" : "Key not found",
        removed,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  },

  getDeduplicationStats: async () => {
    try {
      const stats = await emailDeduplicator.getStats();
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  },
  sendVerificationEmail: async ({ email, token, tenant }, next) => {
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
      // bcc: subscribedBccEmails,

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: `Email Verification Code: ${token}`,
        html: msgs.mobileEmailVerification({ token, email }),
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
    {
      firstName = "",
      lastName = "",
      username = "",
      email = "",
      tenant = "airqo",
      analyticsVersion,
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
      //bcc: subscribedBccEmails,

      let mailOptions = {};
      mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "Welcome to AirQo!",
        html: msgTemplates.afterEmailVerification(
          {
            firstName,
            lastName,
            username,
            email,
            analyticsVersion,
          },
          next
        ),
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
          ? "AirQo API Client Activated!"
          : "AirQo API Client Deactivated!";
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

      // Replace transporter.sendMail with sendMailWithDeduplication
      const result = await sendMailWithDeduplication(transporter, mailOptions, {
        skipDeduplication: false,
        logDuplicates: true,
        throwOnDuplicate: false,
      });

      // Handle duplicate case
      if (result.duplicate) {
        logger.info(`Duplicate password reset email prevented for: ${email}`);
        return {
          success: true,
          message: "Password reset email already sent recently",
          data: null,
          status: httpStatus.OK,
        };
      }

      // Handle success/failure
      if (result.success && !isEmpty(result.data.accepted)) {
        return {
          success: true,
          message: "Email successfully sent",
          data: result.data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "Email not sent",
              emailResults: result.data,
            }
          )
        );
      }
      // let response = transporter.sendMail(mailOptions);
      // let data = await response;

      // if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
      //   return {
      //     success: true,
      //     message: "email successfully sent",
      //     data,
      //     status: httpStatus.OK,
      //   };
      // } else {
      //   next(
      //     new HttpError(
      //       "Internal Server Error",
      //       httpStatus.INTERNAL_SERVER_ERROR,
      //       {
      //         message: "email not sent",
      //         emailResults: data,
      //       }
      //     )
      //   );
      // }
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

  sendPasswordResetEmail: async ({ email, token, tenant = "airqo" }, next) => {
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
        to: email,
        subject: `Password Reset Code: ${token}`,
        html: msgs.mobilePasswordReset({ token, email }),
        attachments: attachments,
      };

      let response = transporter.sendMail(mailOptions);
      let data = await response;

      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "Email sent successfully",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError("Email not sent", httpStatus.INTERNAL_SERVER_ERROR, {
            emailResults: data,
          })
        );
      }
    } catch (error) {
      logger.error(`Error sending password reset email: ${error.message}`);
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
        subject: "Your AirQo Account account updated",
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
        subject: "Welcome to Your New Group/Network at Your AirQo Account",
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
        subject: "Your AirQo Account Password Reset Successful",
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
        subject: "Your AirQo Account Password Update Successful",
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
          subject: "Your AirQo Account Report",
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
      activityDetails = {},
      deviceDetails = {},
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
        subject: "Your AirQo Account: Monitor Deployment/Recall Alert",
        html: `${msgs.site_activity({
          firstName,
          lastName,
          siteActivityDetails,
          email,
          activityDetails,
          deviceDetails,
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

  fieldActivity: async ({
    email = "",
    firstName = "",
    lastName = "",
    activityDetails = {},
    deviceDetails = {},
    activityType = "recall", // New parameter to determine activity type
  }) => {
    try {
      const checkResult = await SubscriptionModel(
        "airqo"
      ).checkNotificationStatus({ email, type: "email" });
      if (!checkResult.success) return checkResult;

      const bccEmails = await getSubscribedBccEmails();
      const mailOptions = createMailOptions({
        email,
        firstName,
        lastName,
        activityDetails,
        deviceDetails,
        bccEmails,
        activityType,
      });

      let response = await transporter.sendMail(mailOptions);
      return handleMailResponse(response);
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
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
      // bcc: subscribedBccEmails,
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
  expiredToken: async (
    {
      email = "",
      firstName = "",
      lastName = "",
      tenant = "airqo",
      token = "",
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
      // bcc: subscribedBccEmails,
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "Action Required: Your AirQo API Token is expired",
        html: `${msgs.tokenExpired({
          firstName,
          lastName,
          email,
          token,
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
  expiringToken: async ({
    email = "",
    firstName = "",
    lastName = "",
    tenant = "airqo",
  } = {}) => {
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
      // bcc: subscribedBccEmails,
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "AirQo API Token Expiry: Create New Token Urgently",
        html: `${msgs.tokenExpiringSoon({
          firstName,
          lastName,
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
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: "email not sent", emailResults: data },
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  updateProfileReminder: async ({
    email = "",
    firstName = "Unknown",
    lastName = "Unknown",
    tenant = "airqo",
  } = {}) => {
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
      // bcc: subscribedBccEmails,
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject:
          "Your AirQo Account: Update Your Name to Enhance Your Experience",
        html: `${msgs.updateProfilePrompt({
          firstName,
          lastName,
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
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: "email not sent", emailResults: data },
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
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
        subject: "Your AirQo Account: Existing User Access Request",
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
  existingUserRegistrationRequest: async (
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
        subject: "Your AirQo Account: Existing User Registration Request",
        html: `${msgs.existing_user({
          firstName,
          lastName,
          email,
        })}`,
        bcc: subscribedBccEmails,
        attachments: attachments,
      };
      let data = await transporter.sendMail(mailOptions);

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
  sendPollutionAlert: async ({
    email = "",
    firstName = "",
    lastName = "",
    subject = "",
    content = "",
    tenant = "airqo",
  } = {}) => {
    try {
      const checkResult = await SubscriptionModel(
        tenant
      ).checkNotificationStatus({
        email,
        type: "email",
      });
      if (!checkResult.success) {
        return checkResult;
      }

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: subject,
        html: `${constants.EMAIL_BODY({
          email,
          content,
          name: `${firstName} ${lastName}`.trim(),
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
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: "email not sent", emailResults: data },
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
};

module.exports = mailer;

/*
REFACTORING PATTERN FOR OTHER FUNCTIONS:

1. Keep all existing logic (subscription checks, BCC handling, etc.)

2. Replace this:
   let response = transporter.sendMail(mailOptions);
   let data = await response;

   With this:
   const result = await sendMailWithDeduplication(transporter, mailOptions, {
     skipDeduplication: false,
     logDuplicates: true,
     throwOnDuplicate: false
   });

3. Add duplicate handling after the sendMail call:
   if (result.duplicate) {
     logger.info(`Duplicate [EMAIL_TYPE] email prevented for: ${email}`);
     return {
       success: true,
       message: "[EMAIL_TYPE] email already sent recently",
       data: null,
       status: httpStatus.OK
     };
   }

4. Update success condition:
   if (result.success && !isEmpty(result.data.accepted)) {
     // success handling
   }

5. Keep all existing error handling unchanged
*/
