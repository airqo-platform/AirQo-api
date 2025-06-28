const constants = require("@config/constants");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
  escapeHtml,
} = require("@utils/shared");

const processString = (inputString) => {
  const stringWithSpaces = inputString.replace(/[^a-zA-Z0-9]+/g, " ");
  const uppercasedString = stringWithSpaces.toUpperCase();
  return uppercasedString;
};

module.exports = {
  confirm: "Email sent, please check your inbox to confirm",
  confirmed: "Your email is confirmed!",
  resend: "Confirmation email resent, maybe check your spam?",
  couldNotFind: "Could not find you!",
  alreadyConfirmed: "Your email was already confirmed",
  recovery_email: ({ token, email, version = 3, slug = "" }) => {
    let PASSWORD_RESET_URL = constants.PWD_RESET;
    let instructions = `Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it: ${PASSWORD_RESET_URL}?token=${token}`;
    if (version && parseInt(version) === 3 && !slug) {
      PASSWORD_RESET_URL = `${constants.ANALYTICS_BASE_URL}/account/forgotPwd/reset`;
      instructions = `Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it: ${PASSWORD_RESET_URL}?token=${token}`;
    } else if (slug) {
      // Validate and sanitize slug to prevent URL manipulation
      const sanitizedSlug = slug.replace(/[^a-zA-Z0-9\-_]/g, "");
      if (!sanitizedSlug) {
        // Fallback to version-based logic if slug is invalid
        PASSWORD_RESET_URL =
          version && parseInt(version) === 3
            ? `${constants.ANALYTICS_BASE_URL}/account/forgotPwd/reset`
            : constants.PWD_RESET;
      } else {
        PASSWORD_RESET_URL = `${constants.ANALYTICS_BASE_URL}/org/${sanitizedSlug}/forgotPwd/reset`;
      }
      instructions = `Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it: ${PASSWORD_RESET_URL}?token=${token}`;
    }
    const content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                    You are receiving this because you (or someone else) have requested the reset of the password for your AirQo account.
                                    <br />
                                    <br />
                                    ${instructions}
                                    <br />
                                    <br />
                                    If you are using the AirQo mobile app, you can also reset your password directly within the app.
                                    <br />
                                    <br />
                                    If you did not request this, please ignore this email and your password will remain unchanged.
                                    <br />
                                    <br />
                                </td>
                            </tr>`;
    return constants.EMAIL_BODY({ email, content });
  },
  mobilePasswordReset: ({ token, email }) => {
    const content = `
      <tr>
        <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
          <p>You requested a password reset for your AirQo account associated with ${email}.</p>
          <p>Use this code to finish setting up your new password:</p>
          <h1 style="font-size: 36px; font-weight: bold; margin: 20px 0;">${token}</h1>
          <p>This code will expire in 24 hours.</p>
          <p>If you are using the AirQo mobile app, enter this code directly in the app to reset your password.</p>
        </td>
      </tr>
    `;
    return constants.EMAIL_BODY({ email, content });
  },
  mobileEmailVerification: ({ token, email }) => {
    const content = `
      <tr>
        <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
          <p>Welcome to AirQo!  Thank you for registering.</p>
          <p>Please use the code below to verify your email address (${email}):</p>
          <h1 style="font-size: 36px; font-weight: bold; margin: 20px 0;">${token}</h1>
          <p>This code will expire in 24 hours.</p>
          <p>If you are using the AirQo mobile app, enter this code directly in the app to verify your email.</p>
          <p>If you did not register for an AirQo account, you can safely ignore this email.</p>
        </td>
      </tr>
    `;
    return constants.EMAIL_BODY({ email, content });
  },
  joinRequest: (firstName, lastName, email) => {
    const name = firstName + " " + lastName;
    const content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                    Your request to join AirQo has been received, we shall get back to you as soon as possible.
                                    <br />
                                    <br />
                                    Before utilising the AirQo data, your application record has to undergo the process of approval by AirQo administration.
                                    <br />
                                    Once your application is approved, you will receive a confirmation email.
                                    <br />
                                    <br />
                                    Whether you use the AirQo web platform or the mobile app, you will be able to access the data once your request is approved.
                                    <br />
                                    <br />
                                    Please visit our website to learn more about us. <a href="https://airqo.net/">AirQo</a>
                                    <br />
                                </td>
                            </tr>`;
    return constants.EMAIL_BODY({ email, content, name });
  },
  joinEntityRequest: (email, entity_title) => {
    const name = "";
    const content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                    Your request to access ${processString(
                                      entity_title
                                    )} has been received, we shall get back to you as soon as possible.
                                    <br />
                                    <br />
                                    Before utilising the AirQo data, your application record has to undergo the process of approval by the respective
                                    administration.
                                    <br />
                                    Once your application is approved, you will receive a confirmation email.
                                    <br />
                                    <br />
                                    Whether you use the AirQo web platform or the mobile app, you will be able to access the data once your request is approved.
                                    <br />
                                    <br />
                                    Please visit our website to learn more about us. <a href="https://airqo.net/">AirQo</a>
                                    <br />
                                </td>
                            </tr>`;
    return constants.EMAIL_BODY({ email, content, name });
  },
  inquiry: (fullName, email, category) => {
    let content;
    switch (category) {
      case "policy":
        content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                Thank you for getting in touch with us and for your interest in our work.
                                    <br />
                                    Kindly let us know how you would like to partner with us and we will get back to you.
                                    <br />
                                    Alternatively, you can get in touch with our Policy Engagement Officer Angela Nshimye at angela@airqo.net who will be of
                                    further support.
                                    <br />
                                </td>
                            </tr>`;
        break;
      case "champions":
        content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                Thank you for choosing to become an AirQo air quality champion. 
                                We appreciate your interest and effort in improving your community's health and quality of life. 
                               
                                    <br /><br />
                                 As a first step, we would like to learn more about you so that we can jointly understand how to work together to build a healthier and better community.
                                    <br /><br />
                                    Kindly complete this <a href = "${constants.CHAMPIONS_FORM}">Form</a> to provide your information. 
                                    <br />
                                </td>
                            </tr>`;
        break;
      case "researchers":
        content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                Thank you for your interest in accessing our air quality data to further research in air quality monitoring and
                                management,
                                    <br />
                            You can visit our website at airqo.net and navigate to <a href="https://airqo.net/explore-data">Explore Data</a> or
                            click <a href="https://airqo.net/explore-data">here</a> to access data.
                                    <br />
                                    If you still need further support, please contact our Data Scientists Richard Sserujogi at richard.sserunjogi@airqo.net or Wabinyai
                                    Fidel Raja at raja@airqo.net for further support.
                                    <br />
                                </td>
                            </tr>`;
        break;
      case "developers":
        content = `<tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                    <p>Thank you for your interest in our work.</p>
                                    <p>If you are interested in Data Science (ML/AI), please reach out to our Data Science Lead, Richard Sserunjogi, at richard.sserunjogi@airqo.net and CC: ds@airqo.net.</p>
                                    <p>For inquiries related to Hardware (Embedded Systems) Engineering, accessing the AirQo API, obtaining AirQo devices, or setting up an Air Quality Monitoring Network, please contact our Hardware Lead, Joel Ssematimba, at joel@airqo.net and CC: network@airqo.net.</p>
                                    <p>To contribute to our open-source community as a software engineer, please fill out this <a href="https://docs.google.com/forms/d/e/1FAIpQLSc7xixPoIo65pe6mlbNVB8jM5F4ZKCz87SmQTY412XbsqWrLQ/viewform?usp=dialog">form</a>.</p>
                                    <p>You can access our data through the AirQo website or the mobile app.</p>
                                </td>
                  </tr>`;
        break;
      case "assistance":
        content = `<tr>
                                   <td
                                       style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">  
                                   <p>Thank you for reaching out for assistance. </p>
                                   <p>Please reach out to our Analytics Team Lead Belinda at belindamarion@airqo.net for further support. </p>
                                   <p>Thank you for choosing AirQo.</p>
                                   </td>
                    </tr>`;
        break;
      default:
        content = `<tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                Thank you for getting in touch with us and for your interest in supporting our work in closing the air quality data gaps
                                in African Cities. We are happy to foster partnerships to advance air quality monitoring and management in African
                                Cities.
                                    <br />
                                    <br />
                                    Please get in touch with our project lead Professor Engineer at baino@airqo.net or Programme Manager Deo Okure at
                                    dokure@airqo.net for further support.
                                    <br />
                                </td>
                            </tr>`;
        break;
    }
    return constants.EMAIL_BODY({ email, content, fullName });
  },
  clientActivationRequest: ({ name = "", email, client_id = "" } = {}) => {
    const content = ` <tr>
    <td
        style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
        <p>Your request to activate your Client ID <strong>${client_id}</strong> has been received, we shall get back to you as soon as possible.</p>
        <p>Before utilising the AirQo API, your Client ID <strong>${client_id}</strong> has to undergo the process of approval by AirQo administration.</p>
        <p>Once your request is approved, you will receive a confirmation email</p>
        <p>Please visit our website to learn more about us. <a href="https://airqo.net/">AirQo</a></p>
    </td>
</tr>`;
    return constants.EMAIL_BODY({ email, content, name });
  },
  yearEndSummary: ({
    username = "",
    email = "",
    engagementTier = "",
    activityDuration = {},
    topServiceDescription = "",
    topServices = [],
    mostUsedEndpoints = [],
  } = {}) => {
    const content = `<tr>
      <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
        
        <p>Congratulations on an amazing year with AirQo! 🎉</p>
        
        ${
          engagementTier ||
          activityDuration.description ||
          topServiceDescription
            ? `
          <div style="margin: 24px 0;">
            <h2 style="color: #344054; font-size: 20px; font-weight: 600; margin-bottom: 16px;">
              🌟 Your 2024 Highlights 🌟
            </h2>
            
            ${
              engagementTier
                ? `<p><strong>Engagement Level:</strong> ${engagementTier}</p>`
                : ""
            }
            ${
              activityDuration.description
                ? `<p><strong>Activity Duration:</strong> ${activityDuration.description}</p>`
                : ""
            }
            
            ${
              topServiceDescription
                ? `<p style="margin-top: 16px;"><strong>Top Service:</strong> ${topServiceDescription}</p>`
                : ""
            }
          </div>`
            : ""
        }
        
        ${
          topServices && topServices.length > 0
            ? `
          <div style="margin: 24px 0;">
            <h3 style="color: #344054; font-size: 18px; font-weight: 600; margin-bottom: 12px;">
              Most Used Services:
            </h3>
            ${topServices
              .slice(0, 3)
              .map(
                (service, index) => `
                  <p style="margin: 8px 0;">
                    ${index + 1}. <strong>${service.service}</strong> (Used ${
                  service.count
                } times)
                  </p>
                `
              )
              .join("")}
          </div>`
            : ""
        }
        
        <p style="margin-top: 24px;">Thank you for being an incredible part of our community!</p>
        
        <p>Best wishes,<br/>The AirQo Team</p>
        
        <p style="margin-top: 24px;">
          Please visit our website to learn more about us. <a href="https://airqo.net/" style="color: #0066CC;">AirQo</a>
        </p>
        <p>You can also access our data through the AirQo mobile app.</p>
      </td>
    </tr>`;

    return constants.EMAIL_BODY({ email, content, name: username });
  },
  afterClientActivation: ({ name = "", email, client_id = "" } = {}) => {
    const content = `<tr>
                          <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                              <p>Congratulations! Your Client ID <strong>${client_id}</strong> has been successfully activated.</p>
                              <p>If you have any questions or need assistance with anything, please don't hesitate to reach out to our customer support
                              team. We are here to help. </p>
                              <p>Thank you for choosing AirQo Analytics, and we look forward to helping you achieve your goals.</p
                              <p>Sincerely,</p>
                              <p>The AirQo Data Team </p>
                          </td>
                      </tr>`;
    return constants.EMAIL_BODY({ email, content, name });
  },
  afterClientDeactivation: ({ name = "", email, client_id = "" } = {}) => {
    const content = `
    <tr>
         <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
             <p>We are writing to inform you that your AirQo API client with ID: <strong> ${client_id} </strong> has been successfully deactivated.</p>
             <p>This action means that the client will no longer be able to access the AirQo API services until it is reactivated.</p>
             <p>If you have any questions or need further assistance, please do not hesitate to contact our support team.</p>
             <p>Thank you for your understanding.</p>
             <p>Best regards,</p>
             <p>The AirQo Team</p>
       </td>
  </tr>`;

    return constants.EMAIL_BODY({ email, content, name });
  },
  welcome_kcca: (firstName, lastName, password, email) => {
    const name = firstName + " " + lastName;
    const content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                    Welcome to the KCCA AirQo air quality monitoring platform.
                                    <br />
                                    Your username is: ${email}
                                    <br />
                                    Your password is: ${password}
                                    <br /><br />
                                    You can always change your password in your account settings after login. Follow this link to access the dashboard right
                                    now: ${constants.LOGIN_PAGE}
                                    <br />
                                    A guide to using AirQo Analytics will be found under the Documentation section of AirQo Analytics
                                    <br /><br />
                                    PLEASE DO NOT REPLY TO THIS EMAIL. For KCCA related questions, please contact:
                                    <ul>
                                        <li>Sadam Yiga: <span
                                                style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">syiga@kcca.go.ug</span>
                                        </li>
                                        <li>Eleth Nakazzi: <span
                                                style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">enakazzi@kcca.go.ug</span>
                                        </li>
                                    </ul>
                                    <br />
                                    If you experience any technical challenges or wish to offer suggestions, please contact us at
                                    <span
                                        style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">support@airqo.net</span>
                                </td>
                            </tr>`;
    return constants.EMAIL_BODY({ email, content, name });
  },
  welcome_general: (firstName, lastName, password, email) => {
    const name = firstName + " " + lastName;
    const content = `<tr>
                         <td
                             style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                             <p>Welcome to AirQo Analytics!! 🎉🎉</p>
                             <p>Your login details are:</p>
                             <ul>
                                 <li>USERNAME: ${email}</li>
                                 <li>PASSWORD: ${password}</li>
                                 <li>Access your dashboard: <a href="${constants.LOGIN_PAGE}">LOGIN</a></li>
                             </ul>
                             <p>Key Documentations:</p>
                             <ul>
                                 <li><a href="https://docs.airqo.net/airqo-rest-api-documentation/">API Documentation</a></li>
                                 <li><a href="https://docs.airqo.net/airqo-terms-and-conditions/HxYx3ysdA6k0ng6YJkU3/">AirQo Terms and Conditions</a></li>
                                 <li><a href="https://docs.airqo.net/airqo-platform/">User Guide</a></li>
                             </ul>
                             <p>For support, contact us at support@airqo.net. This is an automated message. Do not reply</p>
                             <p>Best regards, AirQo Data Team</p>
                         </td>
                    </tr>`;
    return constants.EMAIL_BODY({ email, content, name });
  },
  user_updated: ({
    firstName = "",
    lastName = "",
    updatedUserDetails = {},
    email = "",
  } = {}) => {
    // Safely handle updated fields
    let updatedFields = "";
    const fieldKeys = Object.keys(updatedUserDetails);

    if (fieldKeys.length > 0) {
      updatedFields = "<ol>\n";
      fieldKeys.forEach((field) => {
        // Escape HTML in field names to prevent XSS
        const safeField = escapeHtml(String(field));
        updatedFields += ` <li>${safeField}</li>\n`;
      });
      updatedFields += "</ol>";
    } else {
      updatedFields = "<p><em>No specific field details available.</em></p>";
    }

    const content = ` <tr>
                            <td
                                style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                Your AirQo account details have been updated.
                                <br />
                                The following fields have been updated:
                                
                                ${updatedFields}
                                
                                <br />
                                If this activity sounds suspicious to you, please reach out to your organization's administrator immediately.
                                <br />
                                If you are using the AirQo web platform, follow this link to access AirQo Analytics: ${constants.LOGIN_PAGE}
                                <br />
                                <br />
                                If you are using the AirQo mobile app, you can view your updated details directly within the app.
                                <br />
                                <br />
                            </td>
                        </tr>`;
    const name = `${firstName} ${lastName}`.trim() || "User";

    return constants.EMAIL_BODY({ email, content, name });
  },
  site_activity: ({
    firstName = "",
    lastName = "",
    siteActivityDetails = {},
    email = "",
  }) => {
    // Safely handle site activity details
    let updatedFields = "";
    const siteEntries = Object.entries(siteActivityDetails);

    if (siteEntries.length > 0) {
      updatedFields = "<ol>\n";
      siteEntries.forEach(([key, value]) => {
        // Escape HTML in values to prevent XSS
        const safeValue =
          typeof value === "string" ? escapeHtml(value) : String(value);
        updatedFields += ` <li> ${escapeHtml(key)}: "${safeValue}"</li>\n`;
      });
      updatedFields += "</ol>";
    } else {
      updatedFields = "<p><em>No specific activity details available.</em></p>";
    }

    const content = ` <tr>
                            <td
                                style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                You have just performed an activity on an AirQo Device or Site.
                                <br />
                                The following are the details:
                               
                                ${updatedFields}
                            
                                <br />
                                If this activity sounds suspicious to you, please reach out to your organization's administrator.
                                <br />
                                If you are using the AirQo web platform, follow this link to access AirQo Analytics: ${constants.LOGIN_PAGE}
                                <br />
                                <br />
                                If you are using the AirQo mobile app, you can view the activity details directly within the app.
                                <br />
                                <br />
                            </td>
                        </tr>`;
    const name = firstName + " " + lastName;

    return constants.EMAIL_BODY({ email, content, name });
  },
  field_activity: ({
    firstName = "",
    lastName = "",
    activityDetails = {},
    deviceDetails = {},
    email = "",
    activityType = "recall", // Parameter to determine activity type
  }) => {
    // Safely create activity details list
    const activityEntries = Object.entries(activityDetails);
    let activityDetailsList = "";

    if (activityEntries.length > 0) {
      activityDetailsList = activityEntries
        .map(([key, value]) => {
          // Escape HTML in values to prevent XSS
          const safeKey = escapeHtml(String(key));
          const safeValue =
            typeof value === "string"
              ? escapeHtml(value)
              : escapeHtml(String(value));
          return `<li>${safeKey}: "${safeValue}"</li>`;
        })
        .join("\n");
    } else {
      activityDetailsList = "<li><em>No activity details available</em></li>";
    }

    // Safely create device details list
    const deviceEntries = Object.entries(deviceDetails);
    let deviceDetailsList = "";

    if (deviceEntries.length > 0) {
      deviceDetailsList = deviceEntries
        .map(([key, value]) => {
          // Escape HTML in values to prevent XSS
          const safeKey = escapeHtml(String(key));
          const safeValue =
            typeof value === "string"
              ? escapeHtml(value)
              : escapeHtml(String(value));
          return `<li>${safeKey}: "${safeValue}"</li>`;
        })
        .join("\n");
    } else {
      deviceDetailsList = "<li><em>No device details available</em></li>";
    }

    // Create appropriate action message based on activity type
    const actionMessages = {
      recall: "A device has been recalled in your AirQo system.",
      deployment: "A device has been deployed in your AirQo system.",
      maintenance:
        "Device maintenance has been performed in your AirQo system.",
      inspection:
        "A device inspection has been completed in your AirQo system.",
    };

    const actionMessage =
      actionMessages[activityType] ||
      "A field activity has been performed in your AirQo system.";

    const content = `
      <tr>
          <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
              ${actionMessage}
              <br />
              <strong>Here are the details:</strong>
              <br />
              <strong>Activity Details:</strong>
              <ol>${activityDetailsList}</ol>
              <strong>Device Details:</strong>
              <ol>${deviceDetailsList}</ol>
              <br />
              If you have any questions or concerns regarding this action, please contact your organization's administrator.
              <br />
              If you are using the AirQo web platform, you can access AirQo Analytics here: ${constants.LOGIN_PAGE}
              <br /><br />
              If you are using the AirQo mobile app, you can view the activity details directly within the app.
              <br /><br />
          </td>
      </tr>`;

    const name = `${firstName} ${lastName}`.trim() || "User";
    return constants.EMAIL_BODY({ email, content, name });
  },
  token_compromised: ({
    firstName = "",
    lastName = "",
    ip = "",
    email = "",
  } = {}) => {
    const name = firstName + " " + lastName;
    const content = `
    <tr>
      <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
        <p>Suspected unauthorized access detected with your AIRQO API token from <strong>IP address ${ip}</strong>.</p>
        <p>Consider changing your AirQo Account password. Additionally, whitelist your respective IP address by updating the CLIENT associated with your TOKEN.</p>
        <p>Report any further suspicious activities.</p>
        <p>If you are using the AirQo web platform, <a href="${constants.LOGIN_PAGE}">Follow this link</a> to access AirQo Analytics: ${constants.LOGIN_PAGE}</p>
        <p>If you are using the AirQo mobile app, you can manage your API token settings directly within the app.</p>
      </td>
    </tr>
   `;

    return constants.EMAIL_BODY({ email, content, name });
  },
  tokenExpired: ({
    firstName = "",
    lastName = "",
    email = "",
    token = "",
  } = {}) => {
    const name = firstName + " " + lastName;
    const content = `
    <tr>
      <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
        <p>Your AIRQO API token <strong>${token}</strong> has expired.</p>
        <p>Please create a new token to continue accessing our services. You can do so by logging into your account and navigating to the API section under settings.</p>
        <p>If you are using the AirQo web platform, <a href="${constants.LOGIN_PAGE}">Click here</a> to log in to your AirQo account.</p>
        <p>If you are using the AirQo mobile app, you can manage your API token settings directly within the app.</p>
      </td>
    </tr>
    `;

    return constants.EMAIL_BODY({ email, content, name });
  },
  tokenExpiringSoon: ({ firstName = "", lastName = "", email = "" }) => {
    const name = firstName + " " + lastName;
    let content = "";
    content = `
      <tr>
        <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
          <p>Your AIRQO API token is set to expire soon, in less than 1 month from today.</p>
          <p>Please generate a new token to continue accessing our services.</p>
          <p>If you have already done so, please ignore this message.</p>
          <p>You can manage your API token settings through the AirQo web platform or directly within the mobile app.</p>
        </td>
      </tr>
    `;

    return constants.EMAIL_BODY({ email, content, name });
  },
  updateProfilePrompt: ({ firstName = "", lastName = "", email = "" }) => {
    const name = `${firstName} ${lastName}`;
    let content = "";
    content = `
      <tr>
        <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
          <p>We noticed that your first name and last name are not yet set in your profile. Updating these details will enhance your experience with our service.</p>
          <p>If you are using the AirQo web platform, please visit AirQo Analytics to update your profile with your full name.</p>
          <p>If you are using the AirQo mobile app, you can update your profile directly within the app.</p>
          <p>If you have already updated your name, please ignore this message.</p>
        </td>
      </tr>
    `;

    return constants.EMAIL_BODY({ email, content, name });
  },
  existing_user: ({ firstName = "", lastName = "", email = "" } = {}) => {
    const name = firstName + " " + lastName;
    const FORGOT_PAGE = `${constants.ANALYTICS_BASE_URL}/account/forgotPwd`;
    const content = `
    <tr>
     <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
       <p>You already exist as an AirQo User.</p>
       <p>For AirQo Web, please use the FORGOT PASSWORD feature by clicking <a href="${FORGOT_PAGE}" style="color: blue; text-decoration: underline;">HERE</a>.</p>
       <p>For AirQo Mobile, please use the FORGOT PASSWORD feature in the app.</p>
     </td>
    </tr>
    `;

    return constants.EMAIL_BODY({ email, content, name });
  },
  user_assigned: (firstName, lastName, assignedTo, email) => {
    const name = firstName + " " + lastName;
    const content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                Hello ${name},
                                    <br />
                                    You have been assigned to a new Group or Network: ${assignedTo}.
                                    <br />
                                    Please login to access your new Group or Network.
                                    <br />
                                    If you have any questions or concerns, please feel free to contact your organization's administrator.
                                    <br />
                                    If you are using the AirQo web platform, Click here to log in: ${constants.LOGIN_PAGE}
                                    <br />
                                    <br />
                                    If you are using the AirQo mobile app, you can view your new group or network directly within the app.
                                    <br />
                                    <br />
                                </td>
                            </tr>`;

    return constants.EMAIL_BODY({ email, content, name });
  },
  forgotten_password_updated: (firstName, lastName, email) => {
    const name = firstName + " " + lastName;
    const content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                Your AirQo account password has been successfully reset.
                                <br />
                                If you did not initiate this password reset, please reach out to your organization's administrator immediately.
                                    <br />
                                    <br />
                                    If you are using the AirQo web platform, follow this link to access <a href="${constants.LOGIN_PAGE}">AirQo Analytics:</a>
                                    <br />
                                    Or Paste this link into your browser: ${constants.LOGIN_PAGE}
                                    <br />
                                    <br />
                                    If you are using the AirQo mobile app, you can log in directly within the app using your new password.
                                    <br />
                                    <br />
                                </td>
                            </tr>`;
    return constants.EMAIL_BODY({ email, content, name });
  },
  known_password_updated: (firstName, lastName, email) => {
    const name = firstName + " " + lastName;
    const content = `<tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                Your AirQo account password has been successfully updated.
                                <br />
                                If you did not initiate this password update, please reach out to your organization's administrator immediately.
                                    <br />
                                    <br />
                                    If you are using the AirQo web platform, follow this link to access <a href="${constants.LOGIN_PAGE}">AirQo Analytics right now:</a>
                                    <br />
                                    Or Paste this link into your browser: ${constants.LOGIN_PAGE}
                                    <br />
                                    <br />
                                    If you are using the AirQo mobile app, you can log in directly within the app using your new password.
                                    <br />
                                    <br />
                                </td>
                            </tr>`;
    return constants.EMAIL_BODY({ email, content, name });
  },
  join_by_email: (email, token) => {
    const content = `<tr>
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
                                    Enter this code directly in the AirQo mobile app to verify your email.
                                    <br />
                                    <br />
                                </td>
                            </tr>`;
    return constants.EMAIL_BODY({ email, content });
  },
  authenticate_email: (token, email) => {
    const content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                You are about to make changes to your email address.
                                <br />
                                <br />
                                First, you need you to re-authenticate.
                                    <br />
                                Enter the code below in the app.
                                <br />
                                The code: ${token}
                                    <br />
                                    <br />
                                    Enter this code directly in the AirQo mobile app to re-authenticate.
                                    <br />
                                    <br />
                                </td>
                            </tr>`;
    return constants.EMAIL_BODY({ email, content });
  },
  report: (senderEmail, recipientEmail, format) => {
    // Escape HTML in email addresses to prevent XSS
    const safeSenderEmail = escapeHtml(senderEmail);
    const safeRecipientEmail = escapeHtml(recipientEmail);
    const safeFormat = escapeHtml(format);

    const content = `
  <tr>
      <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
          This is an automated notification to inform you that <strong>${safeSenderEmail}</strong> has shared an air quality data report with you.
          <br />
          The attached report was generated from our analytics dashboard and provides insights into key air quality metrics for the specified time period.
          <br />
          <br />
          <strong>Report Details:</strong>
          <ul>
           <li><strong>Format:</strong> ${safeFormat}</li>
           <li><strong>Shared by:</strong> ${safeSenderEmail}</li>
           <li><strong>Generated on:</strong> ${new Date().toLocaleDateString()}</li>
          </ul>
          <br />
          You can access the report in the attachments above. If you have any questions or require further clarification regarding
          the data presented in the report, please feel free to reach out to ${safeSenderEmail} directly or contact our support team.
          <br />
          <br />
          You can also access real-time data through the AirQo web platform or mobile app.
          <br />
          <br />
          <div style="padding: 12px; background-color: #f8f9fa; border-radius: 6px; border-left: 4px solid #135DFF; margin: 16px 0;">
            <p style="margin: 0; font-size: 14px; color: #6c757d;">
              <strong>Need Help?</strong> If you have trouble accessing the report or need assistance interpreting the data, 
              contact our support team at <a href="mailto:support@airqo.net" style="color: #135DFF;">support@airqo.net</a>
            </p>
          </div>
      </td>
  </tr>
  `;

    // Use recipientEmail as the email parameter for EMAIL_BODY
    return constants.EMAIL_BODY({ email: recipientEmail, content });
  },

  // Add to email.msgs.js
  notifyAdminsOfNewOrgRequest: ({
    organization_name,
    contact_name,
    contact_email,
  }) => {
    const content = `
    <tr>
      <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
        <p>A new organization request has been submitted:</p>
        <ul>
          <li><strong>Organization Name:</strong> ${organization_name}</li>
          <li><strong>Contact Name:</strong> ${contact_name}</li>
          <li><strong>Contact Email:</strong> ${contact_email}</li>
        </ul>
        <p>Please review and process this request in the admin dashboard.</p>
        <p>You can access the admin dashboard at: ${constants.ANALYTICS_BASE_URL}/admin/organisations/requests</p>
      </td>
    </tr>
  `;

    return constants.EMAIL_BODY({ email: "support@airqo.net", content });
  },

  confirmOrgRequestReceived: ({
    organization_name,
    contact_name,
    contact_email,
  }) => {
    const name = contact_name;

    const content = `
    <tr>
      <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
        <p>Thank you for submitting an organization request for "${organization_name}".</p>
        <p>We have received your request and will review it shortly. You will receive another email once your request has been processed.</p>
        <p>If you have any questions, please contact our support team at support@airqo.net.</p>
      </td>
    </tr>
  `;

    return constants.EMAIL_BODY({ email: contact_email, content, name });
  },

  notifyOrgRequestApproved: ({
    organization_name,
    contact_name,
    contact_email,
    login_url,
  }) => {
    const name = contact_name;

    const content = `
    <tr>
      <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
        <p>Congratulations! Your organization request for "${organization_name}" has been approved.</p>
        <p>You can now access your organization dashboard using the following link:</p>
        <p><a href="${login_url}">${login_url}</a></p>
        <p>If you have any questions or need assistance, please contact our support team at support@airqo.net.</p>
      </td>
    </tr>
  `;

    return constants.EMAIL_BODY({ email: contact_email, content, name });
  },

  notifyOrgRequestRejected: ({
    organization_name,
    contact_name,
    contact_email,
    rejection_reason,
  }) => {
    const name = contact_name;

    const content = `
  <tr>
    <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
      <p>We have reviewed your organization request for "${escapeHtml(
        organization_name
      )}" and regret to inform you that we are unable to approve it at this time.</p>
      ${
        rejection_reason
          ? `<p><strong>Reason:</strong> ${escapeHtml(rejection_reason)}</p>`
          : ""
      }
      <p>If you have any questions or would like to submit a revised request, please contact our support team at support@airqo.net.</p>
    </td>
  </tr>
  `;

    return constants.EMAIL_BODY({ email: contact_email, content, name });
  },
  notifyOrgRequestApprovedWithOnboarding: ({
    organization_name,
    contact_name,
    contact_email,
    onboarding_url,
    organization_slug,
  }) => {
    const name = contact_name;

    const content = `
  <tr>
    <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
      <p>🎉 <strong>Congratulations!</strong> Your organization request for "${organization_name}" has been approved.</p>
      
      <div style="padding: 16px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #28a745; margin: 20px 0;">
        <h3 style="color: #28a745; margin-top: 0;">Next Steps - Complete Your Account Setup</h3>
        <p style="margin-bottom: 8px;">To get started with your AirQo organization account, please complete the following steps:</p>
        <ol style="margin: 12px 0; padding-left: 20px;">
          <li><strong>Set up your password</strong> - Create a secure password for your account</li>
          <li><strong>Verify your account</strong> - Confirm your email address</li>
          <li><strong>Access your dashboard</strong> - Start managing your air quality data</li>
        </ol>
      </div>
      
      <div style="text-align: center; margin: 24px 0;">
        <a href="${onboarding_url}" 
           style="display: inline-block; padding: 12px 24px; background-color: #135DFF; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Complete Account Setup
        </a>
      </div>
      
      <div style="padding: 12px; background-color: #fff3cd; border-radius: 6px; border-left: 4px solid #ffc107; margin: 16px 0;">
        <p style="margin: 0; font-size: 14px; color: #856404;">
          <strong>⏰ Important:</strong> This setup link will expire in 7 days. Please complete your account setup soon to ensure uninterrupted access.
        </p>
      </div>
      
      <p><strong>What you'll get access to:</strong></p>
      <ul>
        <li>Real-time air quality data dashboard</li>
        <li>Historical data analysis and reporting</li>
        <li>API access for custom integrations</li>
        <li>User management for your organization</li>
      </ul>
      
      <p>If you have any questions or need assistance during setup, please contact our support team at <a href="mailto:support@airqo.net">support@airqo.net</a>.</p>
      
      <p>Welcome to the AirQo community!</p>
    </td>
  </tr>
`;

    return constants.EMAIL_BODY({ email: contact_email, content, name });
  },

  onboardingAccountSetup: ({
    organization_name,
    contact_name,
    contact_email,
    setup_url,
  }) => {
    const name = contact_name;

    const content = `
  <tr>
    <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
      <p>Welcome to AirQo, ${contact_name}!</p>
      
      <p>Your organization "${organization_name}" has been set up successfully. To complete your account activation, please set up your password by clicking the link below:</p>
      
      <div style="text-align: center; margin: 24px 0;">
        <a href="${setup_url}" 
           style="display: inline-block; padding: 12px 24px; background-color: #135DFF; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Set Up Your Password
        </a>
      </div>
      
      <p>This link will expire in 7 days for security reasons. If you need a new setup link, please contact support.</p>
      
      <div style="padding: 12px; background-color: #f8f9fa; border-radius: 6px; border-left: 4px solid #135DFF; margin: 16px 0;">
        <p style="margin: 0; font-size: 14px; color: #6c757d;">
          <strong>Security Note:</strong> For your protection, this email contains a secure one-time setup link. 
          Do not share this link with anyone else.
        </p>
      </div>
      
      <p>If you didn't request this account setup, please ignore this email or contact our support team.</p>
    </td>
  </tr>
`;

    return constants.EMAIL_BODY({ email: contact_email, content, name });
  },

  onboardingCompleted: ({
    organization_name,
    contact_name,
    contact_email,
    login_url,
  }) => {
    const name = contact_name;

    const content = `
  <tr>
    <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
      <p>🎉 <strong>Account Setup Complete!</strong></p>
      
      <p>Congratulations ${contact_name}! You have successfully completed the setup for your AirQo organization account for "${organization_name}".</p>
      
      <p>You can now access your dashboard and start exploring air quality data:</p>
      
      <div style="text-align: center; margin: 24px 0;">
        <a href="${login_url}" 
           style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Access Your Dashboard
        </a>
      </div>
      
      <div style="padding: 16px; background-color: #f8f9fa; border-radius: 8px; margin: 20px 0;">
        <h4 style="color: #135DFF; margin-top: 0;">Getting Started Resources:</h4>
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li><a href="https://docs.airqo.net/airqo-platform/">User Guide</a> - Learn how to navigate the platform</li>
          <li><a href="https://docs.airqo.net/airqo-rest-api-documentation/">API Documentation</a> - For developers and integrations</li>
          <li><a href="https://docs.airqo.net/airqo-terms-and-conditions/HxYx3ysdA6k0ng6YJkU3/">Terms and Conditions</a> - Important usage guidelines</li>
        </ul>
      </div>
      
      <p>If you need any assistance or have questions, please don't hesitate to contact our support team at <a href="mailto:support@airqo.net">support@airqo.net</a>.</p>
      
      <p>Thank you for joining AirQo. Together, we're working towards cleaner air for everyone!</p>
    </td>
  </tr>
`;

    return constants.EMAIL_BODY({ email: contact_email, content, name });
  },
};
