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
  user_updated: (firstName, lastName, updatedData) => {
    const updatedFields = Object.keys(updatedData)
      .map((field) => `• ${field}: ${updatedData[field]}`)
      .join("\n");

    return (
      `Dear ${firstName} ${lastName},\n\n` +
      "Your AirQo Analytics account details have been updated:\n\n" +
      `${updatedFields}\n\n` +
      "If this activity sounds suspicious to you, please reach out to your organisation's administrator.\n\n" +
      `Follow this link to access the platform right now: ${constants.LOGIN_PAGE}\n`
    );
  },
  join_by_email: (email, token) => {
    return `<!DOCTYPE html>
<html>

    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>

    <body style="margin: 0; padding: 0; font-family:Arial, sans-serif;">

        <div style="width: 90%; height: 100%; padding: 32px; background: #F3F6F8;">
            <!-- Email content container with white background -->
            <table style="width: 100%; max-width: 1024px; margin: 0 auto; background: white;">
                <tr>
                    <td style="padding: 24px;">
                        <!-- Logo and title section -->
                        <table style="width: 100%; padding-bottom: 24px;">
                            <tr>
                                <td style="display: flex; align-items: center;">
                                    <img src="cid:AirQoEmailLogo" alt="logo" style="height: 50px; margin-right: 10px;">
                                    <span
                                        style="color: #135DFF; margin-left: auto; font-family: Inter; font-size: 20px; font-weight: 600; line-height: 24px; letter-spacing: 0em; text-align: right;">Breathe
                                        Clean</span>
                                </td>
                            </tr>

                        </table>

                        <!-- Email content section -->
                        <table style="width: 100%;">
                        
                            <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                To get started with "Knowing Your Air" and Breathing Clean, we need to verify your email address.
                                    <br /><br />
                                    Please Enter the code: ${token}
                                    <br /><br />
                                    That's it! Once verified, you'll gain access to all the app's features. Enjoy tracking your air quality and making
                                    informed decisions for a healthier life.

                                    <br />
                                    <br />
                                </td>
                            </tr>
                            <tr>
                                <td style=" height: 8px; background: #EBF1FF;"></td>
                            </tr>
                        </table>

                        <!-- Social media section -->
                        <table style="width: 100%; text-align: center; padding-top: 32px; padding-bottom: 32px;">
                            <tr>
                                <td>
                                    <a href="https://www.facebook.com/AirQo/" target="_blank"><img
                                            src="cid:FacebookLogo" alt="FacebookLogo"
                                            style="width: 24px; height: 24px; margin-right: 20px; border-radius: 50%;"></a>
                                    <a href="https://www.youtube.com/@airqo7875" target="_blank"><img
                                            src="cid:YoutubeLogo" alt="YoutubeLogo"
                                            style="width: 24px; height: 24px; margin-right: 20px; border-radius: 50%;"></a>
                                    <a href="https://www.linkedin.com/company/airqo/" target="_blank"><img
                                            src="cid:LinkedInLogo" alt="LinkedInLogo"
                                            style="width: 24px; height: 24px; margin-right: 20px; border-radius: 50%;"></a>
                                    <a href="https://twitter.com/AirQoProject" target="_blank"><img src="cid:Twitter"
                                            alt="Twitter"
                                            style="width: 24px; height: 24px; margin-right: 20px; border-radius: 50%;"></a>
                                </td>
                            </tr>
                        </table>

                        <!-- Footer section -->
                        <table style="width: 100%; text-align: center;">
                            <tr>
                                <td>
                                    <span
                                        style="color: #667085; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">This
                                        email was sent to</span>
                                    <span
                                        style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">${email}</span>
                                    <span
                                        style="color: #667085; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">.
                                        If you'd rather not receive this kind of email, you can </span>
                                    <span
                                        style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">unsubscribe</span>
                                    <span
                                        style="color: #667085; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">
                                        or </span>
                                    <span
                                        style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">manage
                                        your email preferences.</span><br /><br />
                                    <span
                                        style="color: #667085; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">©
                                        2023 AirQo<br /><br />
                                        Makerere University, Software Systems Centre, Block B, Level 3, College of
                                        Computing and
                                        Information Sciences, Plot 56 University Pool Road</span>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </div>

    </body>

</html>`;
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
