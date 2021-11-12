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
  joinRequest: (firstName, lastName) => {
    return (
      `Dear ${firstName + " " + lastName}, \n\n` +
      "Your request to join the AirQo platform has been received.\n" +
      "We shall get back to you as soon as possible. \n\n" +
      "Before utilising airqo data, your application record has to undergo \n" +
      "the process of approval by the AirQo platform administration. Once your \n" +
      "application is reviewed, you will receive an email on the mailbox \n\n" +
      "Please visit our website to learn more about us. \n" +
      `https://airqo.net/`
    );
  },
  welcome_kcca: (firstName, lastName, password, username) => {
    return (
      `Dear ${firstName + " " + lastName} \n\n` +
      "Welcome to the KCCA AirQo air quality monitoring platform. \n\n" +
      `Your username is: ${username}\n` +
      `Your temporary password is: ${password}\n\n` +
      `You can always change your password in your account settings after login\n` +
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
      `Your temporary password is: ${password}\n` +
      `You can always change your password in your account settings after login\n\n` +
      `Follow this link to access the dashboard right now: ${constants.LOGIN_PAGE}\n\n` +
      `You can also use your platform credentials to access the AirQo API\n` +
      `The AirQo API reference can be found here: https://docs.airqo.net/airqo-rest-api-documentation/ \n\n` +
      `By actively utilising the platform, you automatically agree to the AirQo terms and conditions: https://docs.airqo.net/airqo-terms-and-conditions/HxYx3ysdA6k0ng6YJkU3/ \n\n` +
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
  join_by_email: (token) => {
    return (
      `Begin your journey to Knowing Your Air and Breathe Clean. \n\n` +
      `First, we need to know that your email address is real.\n\n` +
      `Enter the code below in the app to verify your email. \n\n` +
      `The code: ${token}`
    );
  },
};
