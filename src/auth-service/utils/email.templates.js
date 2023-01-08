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

  inquiryTemplate: (fullName) => {
    return `
    <h3>Hi ${fullName}</h3>
    <p>We are excited to welcome you to AirQo and we are even more excited about what we have got planned. You are already on your way to creating beautiful visual products.</p>
    <br> 
    <p>Whether you are here for your brand, for a cause, or just for fun, welcome!</p>
    <p>If there is anything you need, we will be here every step of the way.</p>
    <br> 
    <a href=${constants.PLATFORM_BASE_URL}> Check out our air quality analytics platform</a>
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
<p> Thank you for signing up for our platform! We are excited to have you on board.</p>
<p> Before you can fully access all of the features and services offered by our platform, we need to verify your account. </p>
<p> This is a quick and easy process that helps us ensure the security and privacy of our users. </p>
<br>
<p> To verify your account, please click on the following link: <a href=${constants.PLATFORM_BASE_URL}/api/v1/users/verify/${user_id}/${token}>verification link</a></p>
<br>
<p> If you have any questions or need assistance with the verification process, please don't hesitate to reach out to our support team: support@airqo.net.</p>
<br>
<p> Thank you for choosing our platform, and we look forward to helping you achieve your goals</p>
<br>
<p> Sincerely,</p>
<p> The AirQo Data Team</p>
`;
  },

  afterEmailVerification: (firstName, username, password) => {
    return `
<h3>Dear ${firstName}</h3>
<p> Congratulations! Your account has been successfully verified.</p>
<p> We are pleased to inform you that you can now fully access all of the features and services offered by our platform.</p>
<br>
<p>YOUR USERAME: ${username} </p>
<p>YOUR PASSWORD: ${password} </p>
<p>ACCESS LINK: ${constants.PLATFORM_BASE_URL}/login </p>
<br>
<p> Thank you for your patience and understanding during the verification process.</p>
<p> We take the security and privacy of our users very seriously, and the verification process is an important part of ensuring that our platform is safe and secure for all.</p>
<br>
<p> If you have any questions or need assistance with anything, please don't hesitate to reach out to our customer support team. We are here to help.</p>
<p> Thank you for choosing our platform, and we look forward to helping you achieve your goals </p>
<br>
<p> Sincerely, <p>
<p> The AirQo Data Team </p>
`;
  },
};
