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
  inquiry: (fullName) => {
    return (
      `Hi ${fullName}, \n\n` +
      `We are excited to welcome you to AirQo and we are even more excited \n` +
      `about what we have got planned. You are already on your way to creating \n` +
      `beautiful visual products. \n\n` +
      `Whether you are here for your brand, for a cause, or just for fun---,welcome! \n` +
      `If there is anything you need, we will be here every step of the way. \n\n` +
      `Thank you for signing up. If you have any questions, send us a message at\n` +
      `info@airqo.net or on Twitter. We would love to hear from you.\n\n` +
      `The AirQo team.`
    );
  },

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

  v2_emailVerification: (email, firstName, user_id, token) => {
    const url = `${constants.PLATFORM_BASE_URL}/api/v1/users/verify/${user_id}/${token}`;
    return `
<!DOCTYPE html>
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

</html>
`;
  },

  afterEmailVerification: (firstName, username, password) => {
    return `
<h3>Dear ${firstName}</h3>
<p> Congratulations! Your account has been successfully verified.</p>
<p> We are pleased to inform you that you can now fully access all of the features and services offered by AirQo Analytics.</p>
<br>
<p>YOUR USERAME: ${username} </p>
<p>YOUR PASSWORD: ${password} </p>
<p>ACCESS LINK: ${constants.PLATFORM_BASE_URL}/login </p>
<br>
<p> If you have any questions or need assistance with anything, please don't hesitate to reach out to our customer support team. We are here to help.</p>
<p> Thank you for choosing AirQo Analytics, and we look forward to helping you achieve your goals </p>
<br>
<p> Sincerely, <p>
<p> The AirQo Data Team </p>
`;
  },
  policyInquiry: (fullName) => {
    return `
    <p> Dear ${fullName}<p/>
    <p> Thank you for getting in touch with us and for your interest in our work.</p>  
    <p> Kindly let us know how you would like to partner with us and we will get back to you.<p/>
    <p> Alternatively, you can get in touch with our Policy Engagement Officer Angela Nshimye at angela@airqo.net who will be of further support.</p>`;
  },

  championInquiry: (fullName) => {
    return `
    <p> Dear ${fullName}</p>
    <p>Thank you for getting in touch with us and for your interest in being an air quality champion in your community.</p> 
    <p> As an air quality champion, you are key in advocating for clean air practices in your community and urging community members to take action against air pollution.</p>
    <p> Please get in touch with our Marketing and Communications Lead at maclina@airqo.net for further support.</p>`;
  },

  developerInquiry: (fullName) => {
    return `
    <p> Dear ${fullName}</p>
    <p> Thank you for your interest in our work. Please get in touch with our Software Engineering Lead Martin Bbaale at martin@airqo.net for further support</p>`;
  },

  partnerInquiry: (fullName) => {
    return `
    <p> Dear ${fullName} </p>
    <p>Thank you for getting in touch with us and for your interest in supporting our work in closing the air quality data gaps in African Cities.</p>
    <p> We are happy to foster partnerships to advance air quality monitoring and management in African Cities.</p>
    <p> Please get in touch with our project lead Professor Engineer at baino@airqo.net or Programme Manager Deo Okure at deo@airqo.net for further support.</p>`;
  },

  researcherInquiry: (fullName) => {
    return `
    <p> Dear ${fullName} </p>
    <p> Thank you for your interest in accessing our air quality data to further research in air quality monitoring and management.</p>
    <p> You can visit our website at airqo.net and navigate to https://airqo.net/explore-data or click here to access data.</p>
    <p> If you still need further support, please contact our Data Scientists Richard Sserujogi at richard.sserunjogi@airqo.net or Wabinyai Fidel Raja at raja@airqo.net for further support.</p>`;
  },

  mobileAppWelcome: (fullName) => {
    return `
    <p> We're thrilled to have you onboard and excited for you to experience all that our app has to offer. This is the first step to Know Your Air and Breathe Clean.</p>  
    <p> With the AirQo app, you'll have access to:<p/>
    <p>1. Air quality analytics - view air quality readings by day/week in different locations</p>
    <p>2. For You - personalized air quality recommendations based on what you share frequently and your favorite locations</p>
    <p>3. Search - find locations by location name or by navigating the map</p>
    <p>4. Know your air - a fun way of learning about air quality</p>
    <p>We've designed it to be easy to use and navigate, so you can find what you're looking for quickly. Get air quality information like air quality lessons and tips on how to reduce air pollution that you can share with your pals through text or visual updates.</p>
    <p>We're constantly updating and improving our app to make sure you have the best experience possible. If you have any questions or feedback, please don't hesitate to reach out to us through the app's support feature</p>
    <p>Thank you for choosing our app, and we can't wait for you to see what it can do for you. Happy exploring!</p>`;
  },

  deleteMobileAccountEmail: (email, token) => {
    return `
    <!DOCTYPE html>
<html>

    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>

    <body style="margin: 0; padding: 0;font-family:Arial, sans-serif;">

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
                                    style="padding-bottom: 24px; color: #344054; font-size: 16px; font-family: Inter; font-weight: 600; line-height: 24px; word-wrap: break-word;">
                                    Hello,
                                </td>
                            </tr>
                            <tr>
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

</html>
    `
  },
};
