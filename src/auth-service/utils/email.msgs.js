const constants = require("../config/constants");

module.exports = {
  confirm: "Email sent, please check your inbox to confirm",
  confirmed: "Your email is confirmed!",
  resend: "Confirmation email resent, maybe check your spam?",
  couldNotFind: "Could not find you!",
  alreadyConfirmed: "Your email was already confirmed",
  recovery_email: (token, tenant) => {
    return (
      "You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n" +
      "Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it:\n\n" +
      `${constants.PWD_RESET}?token=${token}&tenant=${tenant}\n\n` +
      "If you did not request this, please ignore this email and your password will remain unchanged.\n"
    );
  },
  joinRequest:
    "Your request to join the AirQo platform has been received. We shall get back to you as soon as possible. \n\n" +
    "Please click the following link to learn more about AirQo. \n" +
    `https://airqo.net/`,
  welcome_kcca: (firstName, lastName, password, username) => {
    return (
      `Dear ${firstName + " " + lastName} \n\n` +
      "Welcome to the KCCA AirQo air quality monitoring platform. \n\n" +
      `Your username is: ${username}\n` +
      `Your temporary password is: ${password}\n\n` +
      `Please remember to reset your password by visting: ${constants.FORGOT_PAGE}\n` +
      `Follow this link to access the dashboard right now: ${constants.LOGIN_PAGE}\n` +
      "A guide to using the platform will be found under the Documentation section of the platform\n" +
      `Demos for using our main features can be found on our Youtube channel here: ${constants.YOUTUBE_CHANNEL}\n\n\n\n` +
      "PLEASE DO NOT REPLY TO THIS EMAIL\n\n" +
      "For KCCA related questions, please contact:\n" +
      "Sadam Yiga: syiga@kcca.go.ug or Eleth Nakazzi: enakazzi@kcca.go.ug \n " +
      "If you experience any technical challenges or wish to offer suggestions, please contact us at support@airqo.net"
    );
  },
  welcome_general: (firstName, lastName, password, username) => {
    return (
      `Dear ${firstName + " " + lastName} \n\n` +
      "Welcome to the AirQo air quality monitoring platform. \n\n" +
      `Your username is: ${username}\n` +
      `Your temporary password is: ${password}\n\n` +
      `Please remember to reset your password by visting: ${constants.FORGOT_PAGE}\n` +
      `Follow this link to access the dashboard right now: ${constants.LOGIN_PAGE}\n` +
      "A guide to using the platform will be found under the Documentation section of the platform\n" +
      `Demos for using our main features can be found on our Youtube channel here:  ${constants.YOUTUBE_CHANNEL}\n\n\n\n` +
      "PLEASE DO NOT REPLY TO THIS EMAIL\n\n" +
      "If you experience any technical challenges or wish to offer suggestions, please contact us at support@airqo.net"
    );
  },
  user_updated: (firstName, lastName) => {
    return (
      `Dear ${firstName + " " + lastName} \n\n` +
      "Your account AirQo Platform account details have been updated. \n\n" +
      "If this activity sounds suspicious to you, please reach out to your organisation's administrator \n\n" +
      `Follow this link to access the platform right now: ${constants.LOGIN_PAGE}\n`
    );
  },
};
