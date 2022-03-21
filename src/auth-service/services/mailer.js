const transporter = require("../config/mailer");
const { logObject, logText } = require("../utils/log");
const isEmpty = require("is-empty");
const constants = require("../config/constants");
const msgs = require("../utils/email.msgs");
const httpStatus = require("http-status");

const mailer = {
  candidate: async (firstName, lastName, email, tenant) => {
    try {
      let bcc = "";

      if (tenant.toLowerCase() === "airqo") {
        bcc = constants.REQUEST_ACCESS_EMAILS;
      }

      const mailOptions = {
        from: constants.EMAIL,
        to: `${email}`,
        subject: "AirQo Platform JOIN request",
        text: msgs.joinRequest(firstName, lastName),
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
          status: httpStatus.BAD_GATEWAY,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "mailer server error",
        error: error.message,
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
      if (tenant.toLowerCase() == "kcca") {
        mailOptions = {
          from: constants.EMAIL,
          to: `${email}`,
          subject: "Welcome to the AirQo KCCA Platform",
          text: `${msgs.welcome_kcca(firstName, lastName, password, email)}`,
          bcc,
        };
      } else {
        mailOptions = {
          from: constants.EMAIL,
          to: `${email}`,
          subject: "Welcome to the AirQo Platform",
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
        };
      } else {
        return {
          success: false,
          message: "email not sent",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "mailer server error",
        error: error.message,
      };
    }
  },
  forgot: async (email, token, tenant) => {
    try {
      const mailOptions = {
        from: constants.EMAIL,
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
        };
      } else {
        return {
          success: false,
          message: "email not sent",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "mailer server error",
        error: error.message,
      };
    }
  },
  signInWithEmailLink: async (email, token) => {
    try {
      const mailOptions = {
        from: constants.EMAIL,
        to: `${email}`,
        subject: "Welcome to AirQo!",
        text: `${msgs.join_by_email(token)}`,
      };
      let response = transporter.sendMail(mailOptions);
      let data = await response;

      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
        };
      } else {
        return {
          success: false,
          message: "email not sent",
          errors: {
            message: "email not sent",
          },
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

  authenticateEmail: async (email, token) => {
    try {
      const mailOptions = {
        from: constants.EMAIL,
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
        };
      } else {
        return {
          success: false,
          message: "email not sent",
          errors: {
            message: "email not sent",
          },
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
  update: async (email, firstName, lastName) => {
    try {
      const mailOptions = {
        from: constants.EMAIL,
        to: `${email}`,
        subject: "AirQo Platform account updated",
        text: `${msgs.user_updated(firstName, lastName)}`,
      };
      let response = transporter.sendMail(mailOptions);
      let data = await response;

      if (isEmpty(data.rejected) && !isEmpty(data.accepted)) {
        return {
          success: true,
          message: "email successfully sent",
          data,
        };
      } else {
        return {
          success: false,
          message: "email not sent",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "mailer server error",
        error: error.message,
      };
    }
  },
};

module.exports = mailer;
