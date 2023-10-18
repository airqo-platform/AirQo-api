const constants = require("../config/constants");
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
<p> Thank you for signing up for AirQo Analytics! We are excited to have you on board.</p>
<p> Before you can fully access all of the features and services offered by AirQo Analytics, we need to verify your account. </p>
<p> This is a quick and easy process that helps us ensure the security and privacy of our users. </p>
<br>
<p> To verify your account, please click on the following link: <a href=${constants.PLATFORM_BASE_URL}/api/v1/users/verify/${user_id}/${token}>verification link</a></p>
<p> This verification link will be valid for ${constants.EMAIL_VERIFICATION_HOURS} hour(s). If you do not verify your email within this time, you will need to request a new verification email.</p>
<br>
<p> If you have any questions or need assistance with the verification process, please don't hesitate to reach out to our support team: support@airqo.net.</p>
<br>
<p> Thank you for choosing AirQo Analytics, and we look forward to helping you achieve your goals</p>
<br>
<p> Sincerely,</p>
<p> The AirQo Data Team</p>
`;
  },

  v2_emailVerification: ({
    email,
    firstName,
    user_id,
    token,
    category,
  } = {}) => {
    let url = `${constants.ANALYTICS_BASE_URL}/account/creation/individual/interest/${user_id}/${token}/${category}`;
    if (category && category === "organisation") {
      url = `${constants.ANALYTICS_BASE_URL}/account/creation/organisation/verify/${user_id}/${token}/${category}`;
    }

    const content = `<tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                    Welcome to AirQo Analytics 🎉
                                    <br />
                                    Thanks for signing up; we can't wait for you to get started! Click the button to verify your email:
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
                                    Trouble logging in? Paste this URL into your browser:
                                    </br>
                                    <a href=${url} target="_blank">${url}</a>
                                    <br /><br />
                                    <div
                                        style="width: 100%; opacity: 0.60; color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word">
                                        You can set a permanent password anytime within your AirQo Analytics personal settings<br />Didn't make this
                                        request? You can safely ignore and delete this email</div>
                                    <br />
                                    <br />
                                </td>
                            </tr>`;
    return constants.EMAIL_BODY(email, content);
  },

  acceptInvitation: ({
    email,
    entity_title = "",
    targetId,
    inviterEmail,
  } = {}) => {
    const url = `${constants.ANALYTICS_BASE_URL}/account/creation/step2/${email}/${targetId}`;
    const content = `<tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                    Join your team on ${entity_title} 🎉
                                    <br /><br />
                                    ${entity_title}, ${inviterEmail} has invited you to collaborate in ${entity_title} on AirQo Analytics
                                    <br /><br />
                                    Use AirQo Analytics to access real-time air pollution location data for research and gain access to device management tools. Drive meaningful change, city location at a time.
                                    <br /><br />
                                    <a href=${url} target="_blank">
                                        <div
                                            style="width: 20%; height: 100%; padding-left: 32px; padding-right: 32px; padding-top: 16px; padding-bottom: 16px; background: #135DFF; border-radius: 1px; justify-content: center; align-items: center; gap: 10px; display: inline-flex">
                                            <div
                                                style="text-align: center; color: white; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word">
                                                Join ${entity_title}</div>
                                        </div>
                                    </a>
                                    <br /><br />
                                    Trouble logging in? Paste this URL into your browser:
                                    </br>
                                    <a href=${url} target="_blank">${url}</a>
                                    <br /><br />
                                    <div
                                        style="width: 100%; opacity: 0.60; color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word">
                                        You can set a permanent password anytime within your AirQo Analytics personal settings<br />Didn't make this
                                        request? You can safely ignore and delete this email</div>
                                    <br />
                                    <br />
                                </td>
                            </tr>`;
    return constants.EMAIL_BODY(email, content);
  },

  afterEmailVerification: (firstName, username, password, email) => {
    const name = firstName;
    const content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                Congratulations! Your account has been successfully verified.
                                <br />
                                We are pleased to inform you that you can now fully access all of the features and services offered by AirQo Analytics.
                                <br />
                                <ul>
                                    <li>YOUR USERAME: ${username}</li>
                                    <li>ACCESS LINK: ${constants.PLATFORM_BASE_URL}/login</li>
                                </ul>
                                    <br />
                                If you have any questions or need assistance with anything, please don't hesitate to reach out to our customer support
                                team. We are here to help.
                                <br />
                                Thank you for choosing AirQo Analytics, and we look forward to helping you achieve your goals
                                <br />
                                <br />
                                Sincerely,
                                <br />
                                The AirQo Data Team
                                </td>
                            </tr>`;
    return constants.EMAIL_BODY(email, content, name);
  },

  afterAcceptingInvitation: ({ firstName, username, email, entity_title }) => {
    const name = firstName;
    const content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                Congratulations! You have successfully joined ${entity_title} organisation on AirQo Analytics.
                                <br />
                                We are pleased to inform you that you can now access ${entity_title} data, insights and visualisations on AirQo Analytics.
                                <br />
                                <ul>
                                    <li>YOUR USERAME: ${username}</li>
                                    <li>ACCESS LINK: ${constants.PLATFORM_BASE_URL}/login</li>
                                </ul>
                                    <br />
                                If you have any questions or need assistance with anything, please don't hesitate to reach out to our customer support
                                team. We are here to help.
                                <br />
                                Thank you for choosing AirQo Analytics, and we look forward to helping you achieve your goals
                                <br />
                                <br />
                                Sincerely,
                                <br />
                                The AirQo Data Team
                                </td>
                            </tr>`;
    return constants.EMAIL_BODY(email, content, name);
  },

  deleteMobileAccountEmail: (email, token) => {
    const content = ` <tr>
                                <td
                                    style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
                                    We received your request to delete your AirQo account. Before we proceed, we need to verify your identity. Please follow
                                    the instructions below:
                                    <br />
                                    <ol>
                                        <li>Open the app.</li>
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
    return constants.EMAIL_BODY(email, content);
  },
};
