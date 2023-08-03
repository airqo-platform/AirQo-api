const transporter = require("@config/mailer");
const { logObject, logText } = require("./log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const msgs = require("./email.msgs");
const msgTemplates = require("./email.templates");
const httpStatus = require("http-status");
const path = require("path");

const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- mailer-service`);

const imagePath = path.join(__dirname, "../config/images");
const attachments = [
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
  candidate: async (firstName, lastName, email, tenant) => {
    try {
      let bcc = "";

      if (tenant.toLowerCase() === "airqo") {
        bcc = constants.REQUEST_ACCESS_EMAILS;
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
        return {
          success: false,
          message: "email not sent",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: data },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        error: error.message,
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  inquiry: async (fullName, email, category, message, tenant) => {
    try {
      let bcc = "";
      let html = "";
      if (tenant.toLowerCase() === "airqo") {
        switch (category) {
          case "partners":
            bcc = constants.PARTNERS_EMAILS;
            html = msgTemplates.partnerInquiry(fullName);
            break;
          case "policy":
            bcc = constants.POLICY_EMAILS;
            html = msgTemplates.policyInquiry(fullName);
            break;
          case "champions":
            bcc = constants.CHAMPIONS_EMAILS;
            html = msgTemplates.championInquiry(fullName);
            break;
          case "researchers":
            bcc = constants.RESEARCHERS_EMAILS;
            html = msgTemplates.researcherInquiry(fullName);
            break;
          case "developers":
            bcc = constants.DEVELOPERS_EMAILS;
            html = msgTemplates.developerInquiry(fullName);
            break;
          case "general":
            bcc = constants.PARTNERS_EMAILS;
            html = msgTemplates.partnerInquiry(fullName);
            break;
          default:
            bcc = constants.PARTNERS_EMAILS;
            html = msgTemplates.partnerInquiry(fullName);
        }
      }

      /**
       *
       * const categoryNameWithFirstLetterCapital = category.charAt(0).toUpperCase() + category.slice(1);
       * const subject = `Welcome to AirQo, for ${categoryNameWithFirstLetterCapital}`
       */

      const mailOptionsForAirQo = {
        to: `${email}`,
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        subject: `Welcome to AirQo`,
        html,
        bcc,
      };

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
        return {
          success: false,
          message: "email not sent",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: data },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        error: error.message,
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  user: async (firstName, lastName, email, password, tenant, type) => {
    try {
      let bcc = "";
      if (type === "confirm") {
        bcc = constants.REQUEST_ACCESS_EMAILS;
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
          text: `${msgs.welcome_kcca(firstName, lastName, password, email)}`,
          bcc,
        };
      } else {
        mailOptions = {
          from: {
            name: constants.EMAIL_NAME,
            address: constants.EMAIL,
          },
          to: `${email}`,
          subject: "Welcome to AirQo Analytics",
          text: `${msgs.welcome_general(firstName, lastName, password, email)}`,
          bcc,
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
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: data },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        error: error.message,
        errors: { message: error.message },
      };
    }
  },

  verifyEmail: async ({
    user_id = "",
    token = "",
    email = "",
    firstName = "",
  } = {}) => {
    try {
      const imagePath = path.join(__dirname, "../config/images");
      let bcc = constants.REQUEST_ACCESS_EMAILS;
      let mailOptions = {};
      mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "Verify your AirQo Analytics account",
        html: msgTemplates.v2_emailVerification(
          email,
          firstName,
          user_id,
          token
        ),
        bcc,
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
          message: "email not sent",
          errors: { message: data },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  afterEmailVerification: async ({
    firstName = "",
    username = "",
    email = "",
    password = "",
  } = {}) => {
    try {
      let bcc = constants.REQUEST_ACCESS_EMAILS;
      let mailOptions = {};
      mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "Welcome to AirQo!",
        html: msgTemplates.afterEmailVerification(
          firstName,
          username,
          password
        ),
        bcc,
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
          message: "email not sent",
          errors: { message: data },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  forgot: async (email, token, tenant) => {
    try {
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: email,
        subject: `Link To Reset Password`,
        text: msgs.recovery_email(token, tenant),
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
          errors: { message: data },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        error: error.message,
        errors: { message: error.message },
      };
    }
  },
  signInWithEmailLink: async (email, token) => {
    try {
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
          errors: { message: data },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },

  deleteMobileAccountEmail: async (email, token) => {
    try {
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
          errors: { message: data },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  authenticateEmail: async (email, token) => {
    try {
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "Changes to your AirQo email",
        text: `${msgs.authenticate_email(token)}`,
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
          errors: { message: data },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  update: async (email, firstName, lastName, updatedUserDetails) => {
    try {
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "AirQo Analytics account updated",
        text: `${msgs.user_updated(firstName, lastName, updatedUserDetails)}`,
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
          errors: { message: data },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        error: error.message,
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  updateForgottenPassword: async (email, firstName, lastName) => {
    try {
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "AirQo Analytics Password Reset Successful",
        text: `${msgs.forgotten_password_updated(firstName, lastName)}`,
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
          errors: { message: data },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        error: error.message,
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  updateKnownPassword: async (email, firstName, lastName) => {
    try {
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "AirQo Analytics Password Update Successful",
        text: `${msgs.known_password_updated(firstName, lastName)}`,
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
          errors: { message: data },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        error: error.message,
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  newMobileAppUser: async ({ email, message, subject } = {}) => {
    try {
      logObject("the values to send to email function", {
        email,
        message,
        subject,
      });
      const bcc = constants.REQUEST_ACCESS_EMAILS;
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        subject,
        html: message,
        to: email,
        bcc,
      };

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
        return {
          success: false,
          message: "email not sent",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: data },
        };
      }
    } catch (error) {
      return {
        message: "internal server error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        errors: {
          message: error.message,
        },
      };
    }
  },

  feedback: async ({ email, message, subject } = {}) => {
    try {
      let bcc = constants.REQUEST_ACCESS_EMAILS;

      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        subject,
        text: message,
        cc: email,
        to: constants.SUPPORT_EMAIL,
        bcc,
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
        return {
          success: false,
          message: "email not sent",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: data },
        };
      }
    } catch (error) {
      return {
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        errors: {
          message: error.message,
        },
      };
    }
  },
};

module.exports = mailer;
