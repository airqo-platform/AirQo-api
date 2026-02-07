const constants = require("@config/constants");
const { log } = require("async");
const { escapeHtml } = require("@utils/shared");
const processString = (inputString) => {
  const stringWithSpaces = inputString.replace(/[^a-zA-Z0-9]+/g, " ");
  const uppercasedString = stringWithSpaces.toUpperCase();
  return uppercasedString;
};
module.exports = {
  confirm: (id) => ({
    subject: "AirQo Analytics JOIN request",
    html: `
      <a href='${constants.CLIENT_ORIGIN}/confirm/${id}'>
        Click to know more about AirQo
      </a>
    `,
    text: `Copy and paste this link: ${constants.CLIENT_ORIGIN}/confirm/${id}`,
  }),
  inquiryTemplate: (fullName) => {
    return `
    <h3>Hi ${fullName}</h3>
    <p>We are excited to welcome you to AirQo and we are even more excited about what we have got planned. You are already on your way to creating beautiful visual products.</p>
    <br> 
    <p>Whether you are here for your brand, for a cause, or just for fun, welcome!</p>
    <p>If there is anything you need, we will be here every step of the way.</p>
    <br> 
    <a href=${constants.PLATFORM_BASE_URL}> Check out AirQo Analytics</a>
    <p>Weekly new updates and improvements to our products</p>
    <br> 
    <a href=${constants.PLATFORM_BASE_URL}> Support our expansion in Africa</a>
    <p>Stay up to date with the latest announcements and jobs</p>
    <br> 
    <a href=${constants.PLATFORM_BASE_URL}> Support our ongoing projects</a>
    <p>Find out how you can support our ongoing projects</p>
    <br> 
    <p>Thank you for signing up. If you have any questions, send us a message at info@airqo.net or on <a href=${constants.TWITTER_ACCOUNT}>Twitter</a>. We would love to hear from you.</p>
    <br> 
    <p>--The AirQo team.</p>
    </div>`;
  },
  emailVerification: (firstName, user_id, token) => {
    return `
<h3>Dear ${firstName}</h3>
<p> Thank you for signing up for AirQo! We are excited to have you on board.</p>
<p> Before you can fully access all of the features and services offered by AirQo, we need to verify your account. </p>
<p> This is a quick and easy process that helps us ensure the security and privacy of our users. </p>
<br>
<p> If you are using the AirQo web platform, please click on the following link to verify your account: <a href="${constants.PLATFORM_BASE_URL}/api/v1/users/verify/${user_id}/${token}">verification link</a></p>
<p> If you are using the AirQo mobile app, you can verify your account directly within the app.</p>
<p> This verification link will be valid for ${constants.EMAIL_VERIFICATION_HOURS} hour(s). If you do not verify your email within this time, you will need to request a new verification email.</p>
<br>
<p> If you have any questions or need assistance with the verification process, please don't hesitate to reach out to our support team: support@airqo.net.</p>
<br>
<p> Thank you for choosing AirQo, and we look forward to helping you achieve your goals</p>
<br>
<p> Sincerely,</p>
<p> The AirQo Data Team</p>
`;
  },
  composeEmailVerificationMessage: ({
    email,
    firstName,
    user_id,
    token,
    category,
  } = {}) => {
    let url = `${constants.ANALYTICS_BASE_URL}/user/creation/individual/interest/${user_id}/${token}`;
    if (category && category === "organisation") {
      url = `${constants.ANALYTICS_BASE_URL}/user/creation/organisation/verify/${user_id}/${token}`;
    }

    const content = `<tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                    Welcome to AirQo 🎉
                                    <br />
                                    Thanks for signing up; we can't wait for you to get started!
                                    <br /><br />
                                    If you are using the AirQo web platform, click the button to verify your email:
                                    <br /><br />
                                    <a href=${url} target="_blank">
                                        <div
                                            style="width: 20%; height: 100%; padding-left: 32px; padding-right: 32px; padding-top: 16px; padding-bottom: 16px; background: #135DFF; border-radius: 1px; justify-content: center; align-items: center; gap: 10px; display: inline-flex">
                                            <div
                                                style="text-align: center; color: white; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word">
                                                Verify Email</div>
                                        </div>
                                    </a>
                                    <br /><br />
                                    If you are using the AirQo mobile app, you can verify your email directly within the app.
                                    <br /><br />
                                    Trouble logging in? Paste this URL into your browser:
                                    </br>
                                    <a href=${url} target="_blank">${url}</a>
                                    <br /><br />
                                    <div
                                        style="width: 100%; opacity: 0.60; color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word">
                                        You can set a permanent password anytime within your AirQo personal settings<br />Didn't make this
                                        request? You can safely ignore and delete this email</div>
                                    <br />
                                    <br />
                                </td>
                            </tr>`;
    return constants.EMAIL_BODY({ email, content });
  },
  afterEmailVerification: ({
    firstName,
    username,
    email,
    analyticsVersion = 3,
  } = {}) => {
    const name = firstName;
    let content = "";

    if (analyticsVersion === 4) {
      content = `
        <tr>
            <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                <p>Congratulations! Your AirQo account has been successfully verified.</p>
                <p>You can now fully access all the features and services offered by the AirQo mobile application.</p>

                <p>If you have any questions or need assistance, please don't hesitate to contact our customer support team at support@airqo.net. We are here to help.</p>
                <br />
                 <p>Thank you for choosing AirQo.</p>
                <br />
                <p>Sincerely,</p>
                <p>The AirQo Team</p>
            </td>
        </tr>`;
    } else {
      // other user types (web app)
      content = ` <tr>
            <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                <p>Congratulations! Your AirQo account has been successfully verified.</p>
                <p>We are pleased to inform you that you can now fully access all of the features and services offered by AirQo.</p>
                <p>If you are using the AirQo web platform, you can access your account using the details below:</p>
                <ul>
                    <li>YOUR USERNAME: ${username}</li>
                    <li>ACCESS LINK: ${constants.ANALYTICS_BASE_URL}/user/login</li>
                </ul>
                <br />
                <p>If you have any questions or need assistance, please don't hesitate to contact our customer support team at support@airqo.net. We are here to help.</p>
                <br />
                <p>Thank you for choosing AirQo, and we look forward to helping you achieve your goals</p>
                <br />
                <br />
                <p>Sincerely,</p>
                <br />
                <p>The AirQo Data Team</p>
            </td>
        </tr>`;
    }

    return constants.EMAIL_BODY({ email, content, name });
  },

  afterAcceptingInvitation: ({
    firstName,
    username,
    email,
    entity_title,
    login_url,
  }) => {
    const safeLoginUrl =
      login_url || `${constants.ANALYTICS_BASE_URL}/user/login`;

    const name = firstName;
    const content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                              Congratulations! You have successfully joined the "${processString(
                                entity_title || "team",
                              )}" organization on AirQo.
                                <br />
                                We are pleased to inform you that you can now access ${
                                  entity_title
                                    ? processString(entity_title)
                                    : "the team"
                                } data, insights and visualisations on AirQo.
                                <br />
                                <p>If you are using the AirQo web platform, you can access your account using the details below:</p>
                                <ul>
                                    <li>YOUR USERAME: ${username}</li>
                                    <li>ACCESS LINK: <a href="${safeLoginUrl}">${safeLoginUrl}</a></li>
                                </ul>
                                    <br />
                                If you have any questions or need assistance with anything, please don't hesitate to reach out to our customer support
                                team. We are here to help.
                                <br />
                                Thank you for choosing AirQo, and we look forward to helping you achieve your goals
                                <br />
                                <br />
                                Sincerely,
                                <br />
                                The AirQo Data Team
                                </td>
                            </tr>`;
    return constants.EMAIL_BODY({ email, content, name });
  },
  deleteMobileAccountEmail: (email, token) => {
    const content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                    We received your request to delete your AirQo account. Before we proceed, we need to verify your identity. Please follow
                                    the instructions below:
                                    <br />
                                    <ol>
                                        <li>Open the AirQo mobile app.</li>
                                        <li>Enter the verification code: ${token}</li>
                                    </ol>
                                    
                                    Please note that deleting your account will permanently remove all your data associated with AirQo. This action cannot
                                    be undone.
                                    <br /><br />
                                    
                                    If you did not initiate this request, please contact our support team immediately.
                                    Thank you for using AirQo.

                                    <br />
                                </td>
                            </tr>`;
    return constants.EMAIL_BODY({ email, content });
  },
  mobileEmailVerification: ({ email, firebase_uid, token }) => {
    const content = `
    <tr>
      <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
        <p>Welcome to AirQo Mobile! 🎉</p>
        <p>Thank you for registering with AirQo. Please use the code below to verify your email address:</p>
        <h1 style="font-size: 36px; font-weight: bold; margin: 20px 0; color: #135DFF; text-align: center;">${token}</h1>
        <p>This verification code will expire in 24 hours.</p>
        <p>Enter this code directly in the AirQo mobile app to verify your email and complete your registration.</p>
        <div style="margin: 24px 0; padding: 16px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #135DFF;">
          <p style="margin: 0; font-size: 14px; color: #6c757d;">
            <strong>Account Details:</strong><br/>
            Email: ${email}<br/>
            User ID: ${firebase_uid}
          </p>
        </div>
        <p style="font-size: 14px; color: #6c757d; opacity: 0.8;">
          If you did not register for an AirQo mobile account, you can safely ignore this email.
        </p>
      </td>
    </tr>
  `;

    return constants.EMAIL_BODY({ email, content });
  },
};
