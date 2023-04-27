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
      "Your request to join the AirQo platform has been received, " +
      "we shall get back to you as soon as possible. \n\n" +
      "Before utilising the AirQo data, your application record has to undergo " +
      "the process of approval by the AirQo platform administration.\n" +
      "Once your application is approved, you will receive a confirmation email\n\n" +
      "Please visit our website to learn more about us. \n" +
      `https://airqo.net/`
    );
  },
  inquiry: (fullName) => {
    return (
      `Hi ${fullName}, \n\n` +
      "We are excited to welcome you to AirQo and we are even more excited \n" +
      "about what we have got planned. You are already on your way to creating \n" +
      "beautiful visual products. \n\n" +
      "Whether you are here for your brand, for a cause, or just for fun---,welcome! \n" +
      "If there is anything you need, we will be here every step of the way. \n\n" +
      "Thank you for signing up. If you have any questions, send us a message at\n" +
      "info@airqo.net or on Twitter. We would love to hear from you.\n\n" +
      "The AirQo team."
    );
    // return `${message} \n\n` + `https://airqo.net/`;
  },

  partner_inquiry: (fullName) => {
    return (
      `Hi ${fullName}, \n\n` +
      "Thank you for getting in touch with us and for your interest in \n" +
      "supporting our work in closing the air quality data gaps in \n" +
      "African Cities. We are happy to foster partnerships to advance \n" +
      "air quality monitoring and management in African Cities. \n\n" +
      "Please get in touch with our project lead Professor Engineer at baino@airqo.net\n" +
      "or Programme Manager Deo Okure at deo@airqo.net for further support"
    );
  },
  policy_inquiry: (fullName) => {
    return (
      `Hi ${fullName}, \n\n` +
      "Thank you for getting in touch with us and for your interest in our work. \n" +
      "Kindly let us know how you would like to partner with us and we will get back to you.\n" +
      "alternatively, you can get in touch with our Policy Engagement Officer \n" +
      "Angela Nshimye at angela@airqo.net who will be of further support"
    );
  },
  community_inquiry: (fullName) => {
    return (
      `Hi ${fullName}, \n\n` +
      "Thank you for getting in touch with us and for your interest in being an air quality champion in your community. \n" +
      "As an air quality champion, you are key in advocating for clean air \n" +
      "practices in your community and urging community members to take action against air pollution \n" +
      "Please get in touch with our Marketing and Communications Lead at maclina@airqo.net for further support. "
    );
  },
  researcher_inquiry: (fullName) => {
    return (
      `Hi ${fullName}, \n\n` +
      "Thank you for your interest in accessing our air quality data to  \n" +
      "further research in air quality monitoring and management.\n" +
      "You can visit our website at airqo.net and navigate to \n" +
      "https://airqo.net/explore-data or click here to access data. If \n" +
      "you still need further support, please contact our Data Scientists  \n" +
      "Richard Sserujogi at Richard@airqo.net or Wabinyai Fidel Raja at raja@airqo.net for further support."
    );
  },
  developer_inquiry: (fullName) => {
    return (
      `Hi ${fullName}, \n\n` +
      "Thank you for your interest in our work. Please get in touch \n" +
      "with our Software Engineering Lead \n" +
      "Martin Bbaale at martin@airqo.net for further support"
    );
  },

  mobileAppWelcome: () => {
    return (
      "We're thrilled to have you onboard and excited for you to experience all that our app has to offer. This is the first step to Know Your Air and Breathe Clean.\n" +
      "With the AirQo app, you'll have access to:\n" +
      "1. Air quality analytics - view air quality readings by day/week in different locations\n" +
      "2. For You - personalized air quality recommendations based on what you share frequently and your favorite locations \n" +
      "3. Search - find locations by location name or by navigating the map\n" +
      "4. Know your air - a fun way of learning about air quality\n\n" +
      "We've designed it to be easy to use and navigate, so you can find what you're looking for quickly." +
      "Get air quality information like air quality lessons and tips on how to reduce air" +
      "pollution that you can share with your pals through text or visual updates \n\n" +
      "We're constantly updating and improving our app to make sure you have the best" +
      "experience possible. " +
      "If you have any questions or feedback, please don't hesitate to reach out to us through the app's support feature.\n\n" +
      "Thank you for choosing our app, and we can't wait for you to see what it can do for you. Happy exploring!\n"
    );
  },

  welcome_kcca: (firstName, lastName, password, username) => {
    return (
      `Dear ${firstName + " " + lastName} \n\n` +
      "Welcome to the KCCA AirQo air quality monitoring platform. \n\n" +
      `Your username is: ${username}\n` +
      `Your password is: ${password}\n\n` +
      `You can always change your password in your account settings after login\n` +
      `Follow this link to access the dashboard right now: ${constants.LOGIN_PAGE}\n` +
      "A guide to using the platform will be found under the Documentation section of the platform\n\n\n\n" +
      // `Demos for using our main features can be found on our Youtube channel here: ${constants.YOUTUBE_CHANNEL}\n\n\n\n` +
      "PLEASE DO NOT REPLY TO THIS EMAIL\n\n" +
      "For KCCA related questions, please contact:\n" +
      "Sadam Yiga: syiga@kcca.go.ug or Eleth Nakazzi: enakazzi@kcca.go.ug \n " +
      "If you experience any technical challenges or wish to offer suggestions, please contact us at support@airqo.net"
    );
  },
  welcome_general: (firstName, lastName, password, username) => {
    return (
      `Dear ${firstName + " " + lastName} \n\n` +
      "Welcome to the AirQo air quality monitoring platform. Your login credentials are as follows: \n\n" +
      `YOUR USERNAME: ${username}\n` +
      `YOUR PASSWORD: ${password}\n\n` +
      `To access the dashboard, please follow this link: ${constants.LOGIN_PAGE}\n` +
      `After login, you can change your password in your account settings.\n\n` +
      `You can also use your platform credentials to access the AirQo API\n` +
      `The AirQo API reference can be found here: https://docs.airqo.net/airqo-rest-api-documentation/ \n\n` +
      `By actively utilising the platform, you automatically agree to the AirQo terms and conditions: https://docs.airqo.net/airqo-terms-and-conditions/HxYx3ysdA6k0ng6YJkU3/ \n\n` +
      /// `Demos for using our main features can be found on our Youtube channel here:  ${constants.YOUTUBE_CHANNEL}\n\n\n\n` +
      "For any technical challenges or suggestions, please contact us at support@airqo.net. \n\n" +
      "Please note that this is an automated message, so please do not reply to this email. \n\n" +
      "To learn more about the AirQo platform and its features, please refer to the user guide available here: https://docs.airqo.net/airqo-platform/ \n\n" +
      "Best regards, \n\n" +
      "AirQo Data Team"
    );
  },
  user_updated: (firstName, lastName) => {
    return (
      `Dear ${firstName + " " + lastName} \n\n` +
      "Your AirQo Platform account details have been updated. \n\n" +
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
  authenticate_email: (token) => {
    return (
      `You are about to make changes to your email address. \n\n` +
      `First, you need you to re-authenticate.\n\n` +
      `Enter the code below in the app. \n\n` +
      `The code: ${token}`
    );
  },
};
