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
  request: async ({
    email,
    targetId,
    tenant = "airqo",
    entity_title = "",
  } = {}) => {
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
        subject: `AirQo Analytics Request to Access ${entity_title} Team`,
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
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  requestToJoinGroupByEmail: async ({
    email,
    targetId,
    tenant = "airqo",
    entity_title = "",
    inviterEmail = "",
  } = {}) => {
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
        subject: `AirQo Analytics Request to Access ${entity_title} Team`,
        html: msgTemplates.acceptInvitation({
          email,
          entity_title,
          targetId,
          inviterEmail,
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
        html = msgs.inquiry(fullName, email, category);
        switch (category) {
          case "partners":
            bcc = constants.PARTNERS_EMAILS;
            break;
          case "policy":
            bcc = constants.POLICY_EMAILS;
            break;
          case "champions":
            bcc = constants.CHAMPIONS_EMAILS;
            break;
          case "researchers":
            bcc = constants.RESEARCHERS_EMAILS;
            break;
          case "developers":
            bcc = constants.DEVELOPERS_EMAILS;
            break;
          case "general":
            bcc = constants.PARTNERS_EMAILS;
            break;
          default:
            bcc = constants.PARTNERS_EMAILS;
        }
      }

      const mailOptionsForAirQo = {
        to: `${email}`,
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        subject: `Welcome to AirQo`,
        html,
        bcc,
        attachments,
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
    category = "",
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
        html: msgTemplates.v2_emailVerification({
          email,
          firstName,
          user_id,
          token,
          category,
        }),
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

  verifyMobileEmail: async ({
    firebase_uid = "",
    token = "",
    email = "",
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
        subject: "Your Login Code for AirQo Mobile",
        html: msgTemplates.mobileEmailVerification({
          email,
          firebase_uid,
          token,
        }),
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
        html: msgTemplates.afterEmailVerification(firstName, username, email),
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
  afterAcceptingInvitation: async ({
    firstName,
    username,
    email,
    entity_title,
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
        subject: `Welcome to ${entity_title}!`,
        html: msgTemplates.afterAcceptingInvitation({
          firstName,
          username,
          email,
          entity_title,
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
        html: msgs.recovery_email(token, tenant, email),
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
        html: `${msgs.authenticate_email(token, email)}`,
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
  update: async (email, firstName, lastName, updatedUserDetails) => {
    try {
      const mailOptions = {
        from: {
          name: constants.EMAIL_NAME,
          address: constants.EMAIL,
        },
        to: `${email}`,
        subject: "AirQo Analytics account updated",
        html: `${msgs.user_updated(
          firstName,
          lastName,
          updatedUserDetails,
          email
        )}`,
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
        error: error.message,
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  assign: async (email, firstName, lastName, assignedTo) => {
    try {
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

  sendReport: async (senderEmail, recepientEmails, pdfFile, csvFile) => {
    try {
      let formart;
      if (pdfFile) {
        formart = "PDF";
        const pdfBase64 = pdfFile.data.toString('base64');
        const pdfAttachment = {
          filename: "Report.pdf",
          contentType: 'application/pdf',
          content: pdfBase64,
          encoding: 'base64',
        };
        attachments.push(pdfAttachment);
      }
      if (csvFile) {
        formart = "CSV"
        const csvBase64 = csvFile.data.toString('base64');
        const csvAttachment = {
          filename: 'Report.csv',
          content: csvBase64,
          encoding: 'base64',
        };
        attachments.push(csvAttachment);
      }
      const emailResults = [];

      for (const recepientEmail of recepientEmails) {
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
          attachments
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
      const hasFailedEmail = emailResults.some(result => !result.success);

      if (hasFailedEmail) {
        return {
          success: false,
          message: "One or more emails failed to send",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { messages: emailResults },
        };
      } else {
        return {
          success: true,
          message: "All emails successfully sent",
          data: emailResults,
          status: httpStatus.OK,
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
